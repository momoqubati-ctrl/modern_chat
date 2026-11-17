import type http from "node:http";
import type { Server, Socket } from "socket.io";
import { startGateway } from "./apps/gateway/src/index.js";
import { getFilterService, warmFilterCache } from "./apps/gateway/src/services/filterService.js";
import { getShortcutService, warmShortcutCache } from "./apps/gateway/src/services/shortcutService.js";

export { warmFilterCache, warmShortcutCache };

export interface SocketServerInstance {
  io: Server;
  shutdown: () => Promise<void>;
  warmCaches: () => Promise<void>;
}

/**
 * Initializes and warms up Socket.IO gateway with full cache warming and
 * cold-start protection for room_message and filter services.
 */
export async function initSocketServer(httpServer?: http.Server): Promise<SocketServerInstance> {
  // Pre-warm caches before accepting incoming messages so even the first message is served from memory
  await Promise.allSettled([warmFilterCache(), warmShortcutCache()]);

  const gw = await startGateway(httpServer);

  return {
    io: gw.io,
    shutdown: gw.shutdown,
    warmCaches: async () => {
      await Promise.all([warmFilterCache(), warmShortcutCache()]);
    },
  };
}

/**
 * Cold-start protection helper for room_message:
 * Guarantees that FilterService and ShortcutService are ready on demand
 * if a message arrives during boot before background warming completes,
 * preventing silent failure or "تعذر إرسال الرسالة".
 */
export async function ensureColdStartReady(): Promise<void> {
  const filter = getFilterService();
  const shortcut = getShortcutService();

  const tasks: Array<Promise<void>> = [];
  if (!filter.isInitialized()) {
    tasks.push(filter.warmFilterCache());
  }
  if (!shortcut.isInitialized()) {
    tasks.push(shortcut.warmShortcutCache());
  }

  if (tasks.length > 0) {
    try {
      await Promise.all(tasks);
    } catch (err) {
      console.warn("[vite-socket-io] Cold start on-demand warming completed with warnings:", err);
    }
  }
}

export default initSocketServer;
