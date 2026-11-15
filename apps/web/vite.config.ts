import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { lanHttpsCompanionPlugin } from "./viteLanHttps.js";

const API_TARGET = "http://127.0.0.1:3003";
const GATEWAY_TARGET = "http://127.0.0.1:3004";

export default defineConfig({
  plugins: [react(), tailwindcss(), lanHttpsCompanionPlugin({ httpsPort: 5443 })],
  server: {
    host: true,
    port: 5173,
    allowedHosts: true,
    watch: {
      ignored: ["**/carrom-game/**"],
    },
    proxy: {
      "/api": API_TARGET,
      "/getonline": API_TARGET,
      "/bootstrap": API_TARGET,
      "/rooms": API_TARGET,
      "/top10": API_TARGET,
      "/top10wall": API_TARGET,
      "/top10walld": API_TARGET,
      "/storieswall": API_TARGET,
      "/stor10": API_TARGET,
      "/room_badges": API_TARGET,
      "/site_badges": API_TARGET,
      "/micprovider.nd": API_TARGET,
      "/livekit": API_TARGET,
      "/uploads": API_TARGET,
      "/cp.nd": API_TARGET,
      "/cp.html": API_TARGET,
      "/cp/cp.nd": API_TARGET,
      "/cp/pic": API_TARGET,
      "/cp/site": API_TARGET,
      "/cp/token=": API_TARGET,
      "/uh": API_TARGET,
      "/wallet": API_TARGET,
      "/agent/topup.nd": API_TARGET,
      "/upload": API_TARGET,
      "/pic2": API_TARGET,
      "^/pic(?:/|$)": API_TARGET,
      "/picroom": API_TARGET,
      "/bot-pic": API_TARGET,
      "/sico": API_TARGET,
      "/site": API_TARGET,
      "/cover": API_TARGET,
      "/dro3": API_TARGET,
      "/emo": API_TARGET,
      "/them": API_TARGET,
      "/gifts_git": API_TARGET,
      "/entry_slides": API_TARGET,
      "/room_badges/": API_TARGET,
      "/recorder": API_TARGET,
      "/sendfile": API_TARGET,
      "/topup_receipts": API_TARGET,
      "/carrom-game": API_TARGET,
      "/fonts/fontawesome-webfont.woff2": API_TARGET,
      "/health": API_TARGET,
      "/healthz": API_TARGET,
      "/readyz": API_TARGET,
      "/ping": API_TARGET,
      "^/_coins_.*": API_TARGET,
      "/socket.io": {
        target: GATEWAY_TARGET,
        ws: true,
      },
    },
  },
});
