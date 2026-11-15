import { Queue } from "bullmq";
import { apiConfig } from "../config.js";

let imageQueue: Queue | null = null;
let mainQueue: Queue | null = null;

function bullConnectionOpts() {
  const url = new URL(apiConfig.redisUrl);
  return {
    host: url.hostname || "127.0.0.1",
    port: Number(url.port || 6379),
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
  };
}

export function getMainQueue(): Queue {
  if (!mainQueue) {
    mainQueue = new Queue("mainQueue", { connection: bullConnectionOpts() });
  }
  return mainQueue;
}

export function getImageQueue(): Queue {
  if (!imageQueue) {
    imageQueue = new Queue("imageQueue", { connection: bullConnectionOpts() });
  }
  return imageQueue;
}

export async function closeQueues(): Promise<void> {
  await Promise.allSettled([
    mainQueue ? mainQueue.close() : Promise.resolve(),
    imageQueue ? imageQueue.close() : Promise.resolve(),
  ]);
  mainQueue = null;
  imageQueue = null;
}
