import { NewChatApiClient, NewChatSocketClient } from "../packages/core-client/dist/index.js";

async function waitForReady(url: string, attempts = 15): Promise<any> {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      const data = (await res.json()) as any;
      if (res.ok && data.ok) return data;
    } catch {
      // wait
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  throw new Error(`Service not ready at ${url}`);
}

async function main() {
  console.log("1. Testing API /readyz ...");
  const ready = await waitForReady("http://127.0.0.1:3003/readyz");
  console.log("   /readyz:", JSON.stringify(ready));

  console.log("2. Testing @newchat/core-client NewChatApiClient ...");
  const api = new NewChatApiClient("http://127.0.0.1:3003");
  const boot = await api.getBootstrap();
  console.log(`   rooms=${boot.rooms.length}, powers=${boot.powers.length}, onlineCount=${boot.onlineCount}`);

  const top10 = await api.getTop10();
  const wall = await api.getTop10Wall();
  console.log(`   top10=${top10.length}, top10wall=${wall.length}`);

  console.log("3. Testing Web server :5173 ...");
  let webStatus = 0;
  for (let i = 0; i < 15; i++) {
    try {
      const webRes = await fetch("http://127.0.0.1:5173/");
      webStatus = webRes.status;
      if (webStatus === 200) break;
    } catch {
      // wait for Vite
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  if (webStatus !== 200) throw new Error(`Web :5173 returned ${webStatus}`);
  console.log(`   Web status=${webStatus}`);

  console.log("4. Testing @newchat/core-client NewChatSocketClient (MsgPack :3004) ...");
  await new Promise<void>((resolve, reject) => {
    const client = new NewChatSocketClient();
    const timer = setTimeout(() => {
      client.disconnect();
      reject(new Error("Socket smoke timeout"));
    }, 10_000);

    const receivedCmds = new Set<string>();
    let bcCount = 0;

    client.onCmd("*", (_payload, env) => {
      receivedCmds.add(String(env.cmd));
      if (env.cmd === "bc") bcCount++;
    });

    client.onCmd("ok", () => {
      client.emitCmd("msg", { msg: "رسالة اختبار التطابق" });
    });

    client.onCmd("msg", (data) => {
      if (data?.msg === "رسالة اختبار التطابق") {
        clearTimeout(timer);
        console.log(
          `   Socket MsgPack roundtrip OK! cmds=[${Array.from(receivedCmds).join(", ")}], initialWallPosts=${bcCount}`
        );
        client.emitCmd("logout", {});
        client.disconnect();
        resolve();
      }
    });

    const raw = client.connect("http://127.0.0.1:3004");
    raw.on("connect", () => {
      client.emitCmd("g", { username: "زائر_اختبار_آلي", refr: "smoke" });
    });
    raw.on("connect_error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });

  console.log("=== ALL LIVE E2E SMOKE TESTS PASSED ===");
}

main().catch((err) => {
  console.error("SMOKE TEST FAILED:", err);
  process.exit(1);
});
