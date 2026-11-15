import type { Server, Socket } from "socket.io";
import type {
  OnlineUserSnapshot,
  OwnerRuntimeState,
  PowerRole,
  RoomSnapshot,
  SiteBadge,
  SiteSettingShape,
} from "@newchat/shared";

export type AccountKind = "عضو" | "زائر" | "بوت";

export interface GatewaySession extends OnlineUserSnapshot {
  id: string;
  idreg?: number | string;
  lid: string;
  uid: string;
  username: string;
  topic: string;
  pic: string;
  pich: string;
  msg: string;
  power: string;
  rank: string;
  bg: string;
  gcol: string;
  ucol: string;
  mcol: string;
  stat: number;
  offline: boolean;
  co: string;
  ico: string;
  gift_ico: string;
  documents: boolean;
  documentationc: boolean;
  yp: string;
  them: string;
  cover: string;
  site_badge_id: string;
  site_badge: SiteBadge | string | unknown;
  roomid: string | null;
  islogin: AccountKind;
  rep: number;
  coin: number;
  coins: number;
  evaluation: number;
  wall_post_likes: number;
  gifts_received_count: number;
  busy: boolean;
  alerts: boolean;
  nopm: boolean;
  nonot: boolean;
  nopmcall: boolean;
  nopmvideocall: boolean;
  token: string;
  ip: string;
  fp: string;
  location: string;
  refr: string;
  joinedAt: number;
  joinuser: number;
  last_eval_login_day: string;
  auto_power: string;
  eval_awards: Record<string, unknown>;
  loginG: boolean;
  stealth: boolean;
  muted: boolean;
  ismuted: boolean;
  kicked?: boolean;
  loggedOut?: boolean;
  pageHidden?: boolean;
  meta_ts: number;
  lastRoomId?: string | null;
  s?: string | number | null;
}

export interface BanRuleRow {
  id: number;
  name_band: string | null;
  type: string | null;
  deccode: string | null;
  decoderDans: string | null;
  device_band: string | null;
  ip_band: string | null;
  country_band: string | null;
  date: string | null;
}

export interface ProhibitedWordRule {
  id: number;
  type: string | null;
  path: string | null;
  v: string | null;
}

export interface WallLimitsConfig {
  lengthMsgRoom: number;
  lengthMsgBar: number;
  lengthMsgPm: number;
  lengthUserReg: number;
  likeTopicEdit: number;
  likeUpPic: number;
  bclikes: number;
  pmlikes: number;
  miclikes: number;
  fileslikes: number;
  wallminutes: number;
  allowreg: boolean;
  evaluationAutoPromotionEnabled: boolean;
  welcomeMessage: string;
  [key: string]: unknown;
}

export interface GatewayEnvelope<T = unknown> {
  cmd: string;
  data?: T;
}

export interface DeviceQueryFingerprint {
  plt: string;
  wk: string;
  version: string;
  browser: string;
  c: string;
  raw: string;
}

export type SocketHandlerFn = (socket: Socket, envelope: GatewayEnvelope) => Promise<void> | void;

export interface GatewayContext {
  io: Server;
  catalogStore: import("../services/catalogStore.js").CatalogStore;
  securityGuard: import("../services/securityGuard.js").SecurityGuard;
  presenceDirectory: import("../services/presenceDirectory.js").PresenceDirectory;
  evaluationEngine: import("../services/evaluationEngine.js").EvaluationEngine;
  micStageManager: import("../services/micStageManager.js").MicStageManager;
  competitionEngine: import("../services/competitionEngine.js").CompetitionEngine;
  talkingBotCoordinator: import("../services/talkingBotCoordinator.js").TalkingBotCoordinator;
  carromManager: import("../services/carromManager.js").CarromManager;
  ludoManager: import("../services/ludoManager.js").LudoManager;
  mediaResolver: import("../services/mediaResolver.js").MediaResolver;
  disconnectUserSession: (
    socketId: string,
    opts?: { state?: number; forceImmediate?: boolean; reason?: string },
  ) => Promise<void>;
}

export type GatewayRoomRecord = RoomSnapshot & {
  pass?: string;
  user?: string;
};

export type GatewayOwnerState = OwnerRuntimeState & {
  guestList?: string[];
  visitorList?: string[];
};

export type GatewaySiteState = {
  siteRowId: number;
  siteName: string;
  banner: string;
  logo: string;
  host: string;
  setting: SiteSettingShape;
  limits: WallLimitsConfig;
  powers: PowerRole[];
};
