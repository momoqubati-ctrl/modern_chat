import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import type { Plugin } from "vite";

function collectLanIpv4Addresses(): string[] {
  const ifaces = os.networkInterfaces();
  const ips: string[] = [];
  for (const entries of Object.values(ifaces)) {
    if (!entries) continue;
    for (const entry of entries) {
      if (entry.family === "IPv4" && !entry.internal && entry.address) {
        ips.push(entry.address);
      }
    }
  }
  return Array.from(new Set(ips)).sort();
}

function findOpenSslBinary(): string | null {
  const candidates = [
    process.env.OPENSSL_BIN,
    "openssl",
    "C:\\Program Files\\Git\\usr\\bin\\openssl.exe",
    "C:\\Program Files\\Git\\mingw64\\bin\\openssl.exe",
    "C:\\Program Files (x86)\\Git\\usr\\bin\\openssl.exe",
  ].filter((v): v is string => Boolean(v && v.trim()));

  for (const bin of candidates) {
    try {
      execFileSync(bin, ["version"], { stdio: "ignore", windowsHide: true });
      return bin;
    } catch {
      // try next candidate
    }
  }
  return null;
}

function ensureDevTlsMaterial(
  cacheDir: string,
  lanIps: string[],
): { key: string; cert: string } | null {
  const openssl = findOpenSslBinary();
  if (!openssl) return null;

  fs.mkdirSync(cacheDir, { recursive: true });
  const keyPath = path.join(cacheDir, "dev-lan.key");
  const certPath = path.join(cacheDir, "dev-lan.crt");
  const stampPath = path.join(cacheDir, "dev-lan.stamp");
  const confPath = path.join(cacheDir, "openssl-san.cnf");

  const sanEntries = [
    "DNS:localhost",
    "IP:127.0.0.1",
    ...lanIps.map((ip) => `IP:${ip}`),
  ];
  const stamp = crypto.createHash("sha256").update(sanEntries.join(",")).digest("hex");

  const existingStamp = fs.existsSync(stampPath)
    ? fs.readFileSync(stampPath, "utf8").trim()
    : "";

  if (
    existingStamp === stamp &&
    fs.existsSync(keyPath) &&
    fs.existsSync(certPath)
  ) {
    return {
      key: fs.readFileSync(keyPath, "utf8"),
      cert: fs.readFileSync(certPath, "utf8"),
    };
  }

  const sanLines = sanEntries.map((entry, idx) => {
    const [kind, val] = entry.split(":");
    return `${kind}.${idx + 1} = ${val}`;
  });

  const cnf = [
    "[req]",
    "default_bits = 2048",
    "prompt = no",
    "default_md = sha256",
    "distinguished_name = dn",
    "x509_extensions = v3_ext",
    "",
    "[dn]",
    "CN = localhost",
    "",
    "[v3_ext]",
    "basicConstraints = CA:FALSE",
    "keyUsage = digitalSignature, keyEncipherment",
    "extendedKeyUsage = serverAuth",
    "subjectAltName = @alt_names",
    "",
    "[alt_names]",
    ...sanLines,
    "",
  ].join("\n");

  fs.writeFileSync(confPath, cnf, "utf8");

  try {
    execFileSync(
      openssl,
      [
        "req",
        "-x509",
        "-newkey",
        "ec",
        "-pkeyopt",
        "ec_paramgen_curve:prime256v1",
        "-nodes",
        "-days",
        "365",
        "-keyout",
        keyPath,
        "-out",
        certPath,
        "-config",
        confPath,
      ],
      { stdio: "ignore", windowsHide: true },
    );
    fs.writeFileSync(stampPath, stamp, "utf8");
    return {
      key: fs.readFileSync(keyPath, "utf8"),
      cert: fs.readFileSync(certPath, "utf8"),
    };
  } catch {
    return null;
  }
}

export function lanHttpsCompanionPlugin(options?: { httpsPort?: number }): Plugin {
  const httpsPort = Number(process.env.VITE_HTTPS_PORT || options?.httpsPort || 5443);

  return {
    name: "newchat-lan-https-companion",
    apply: "serve",
    configureServer(server) {
      if (process.env.VITE_LAN_HTTPS === "0") return;

      const lanIps = collectLanIpv4Addresses();
      const cacheDir = path.resolve(server.config.root, "node_modules/.vite-lan-cert");
      const tlsMaterial = ensureDevTlsMaterial(cacheDir, lanIps);
      if (!tlsMaterial) {
        server.config.logger.warn(
          "[lan-https] OpenSSL unavailable; skipped companion HTTPS server for mobile mic/camera.",
        );
        return;
      }

      const httpServer = server.httpServer;
      if (!httpServer) return;

      let tlsServer: https.Server | null = null;

      httpServer.once("listening", () => {
        const addr = httpServer.address();
        const targetPort =
          typeof addr === "object" && addr && "port" in addr ? addr.port : 5173;

        tlsServer = https.createServer(
          { key: tlsMaterial.key, cert: tlsMaterial.cert },
          (req, res) => {
            const headers: Record<string, string | string[] | undefined> = {
              ...req.headers,
              "x-forwarded-proto": "https",
              "x-forwarded-host": req.headers.host || `127.0.0.1:${httpsPort}`,
            };

            const upstreamReq = http.request(
              {
                hostname: "127.0.0.1",
                port: targetPort,
                path: req.url || "/",
                method: req.method || "GET",
                headers,
              },
              (upstreamRes) => {
                res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
                upstreamRes.pipe(res);
              },
            );

            upstreamReq.on("error", () => {
              if (!res.headersSent) {
                res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
              }
              res.end("HTTPS companion proxy error");
            });

            req.on("aborted", () => upstreamReq.destroy());
            req.pipe(upstreamReq);
          },
        );

        tlsServer.on("upgrade", (req, clientSocket, head) => {
          const upstreamSocket = net.connect(targetPort, "127.0.0.1", () => {
            const rawLines: string[] = [
              `${req.method || "GET"} ${req.url || "/"} HTTP/${req.httpVersion || "1.1"}`,
            ];
            for (let i = 0; i < req.rawHeaders.length; i += 2) {
              const headerName = req.rawHeaders[i];
              const headerVal = req.rawHeaders[i + 1] ?? "";
              if (headerName) rawLines.push(`${headerName}: ${headerVal}`);
            }
            rawLines.push("X-Forwarded-Proto: https", "", "");
            upstreamSocket.write(rawLines.join("\r\n"));
            if (head && head.length > 0) {
              upstreamSocket.write(head);
            }
            upstreamSocket.pipe(clientSocket);
            clientSocket.pipe(upstreamSocket);
          });

          const cleanup = () => {
            if (!clientSocket.destroyed) clientSocket.destroy();
            if (!upstreamSocket.destroyed) upstreamSocket.destroy();
          };
          upstreamSocket.on("error", cleanup);
          clientSocket.on("error", cleanup);
        });

        tlsServer.on("error", (err) => {
          server.config.logger.warn(
            `[lan-https] Could not bind https://0.0.0.0:${httpsPort}: ${err.message}`,
          );
        });

        tlsServer.listen(httpsPort, "0.0.0.0", () => {
          const primaryLan = lanIps[0] || "127.0.0.1";
          server.config.logger.info(
            `  \x1b[32m➜\x1b[39m  Phone HTTPS (Mic/Camera): \x1b[36mhttps://${primaryLan}:${httpsPort}/\x1b[39m`,
          );
        });
      });

      httpServer.once("close", () => {
        if (tlsServer) {
          tlsServer.close();
          tlsServer = null;
        }
      });
    },
  };
}
