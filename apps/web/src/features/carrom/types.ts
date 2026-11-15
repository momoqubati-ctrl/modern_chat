export type CoinKind = "striker" | "black" | "white" | "red";

export interface CarromDisc {
  x: number;
  y: number;
  vx: number;
  vy: number;
  name: CoinKind;
  color: string;
  radius: number;
}

export interface PlayerScoreState {
  score: number;
  coins: {
    black: number;
    white: number;
  };
}

export interface CarromPlayerProfile {
  socketId?: string;
  slot?: 0 | 1;
  playerName: string;
  playerAvatar: string;
}

export interface CarromWaitingRoom {
  roomCode: string;
  roomId: string;
  title: string;
  hostName: string;
  hostAvatar: string;
  playerCount: number;
  spectatorCount: number;
  status: string;
  game: string;
}

export interface CarromChatMessage {
  id: string;
  senderName: string;
  senderAvatar: string;
  message: string;
  ts: number;
  isOwn: boolean;
  isSystem?: boolean;
}

export interface CarromSnapshot {
  currPlayer: 0 | 1;
  redPut: 0 | 1 | 2;
  strikerPot: boolean;
  coinPoted: boolean;
  firstHit: boolean;
  hitBlueCoin: boolean;
  turnSeq: number;
  players: [PlayerScoreState, PlayerScoreState];
  hittingObjs: CarromDisc[];
}

export interface PotBurstEffect {
  x: number;
  y: number;
  color: string;
  startedAt: number;
}

export type BoardSkinId = "wood1" | "wood2" | "cream";
export type RoseSkinId = "classic" | "modern";
export type BackdropThemeId = "crimson" | "midnight" | "emerald";
export type InteractionPhase = "idle" | "place" | "aim_drag" | "aim_locked" | "shooting" | "ai_thinking";
