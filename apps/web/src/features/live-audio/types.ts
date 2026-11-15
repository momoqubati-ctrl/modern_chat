import type { LiveRoomConfig, LiveRoomGiftGoal, OnlineUserSnapshot } from "@newchat/shared";

export interface StageRequestItem {
  socketId: string;
  topic: string;
  pic: string;
  slot: number;
  time?: number;
}

export interface LiveRoomSummaryData {
  durationSeconds: number;
  viewersCount: number;
  giftsTotalCoins: number;
  supportersCount: number;
  topSupporter?: { topic: string; pic: string; coin: number };
}
