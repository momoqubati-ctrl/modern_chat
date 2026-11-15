import type { IncomingCmd, OutgoingCmd } from "./events.js";

export interface SocketMsgEnvelope<T = unknown> {
  cmd: IncomingCmd | OutgoingCmd | string;
  data?: T;
}

export interface OnlineUserSnapshot {
  id: string;
  idreg?: number | string;
  lid?: string;
  uid?: string;
  username?: string;
  topic: string;
  pic: string;
  pich?: string;
  msg: string;
  power: string;
  rank?: string;
  bg: string;
  gcol: string;
  ucol: string;
  mcol: string;
  stat: number;
  offline: boolean;
  co?: string;
  ico?: string;
  gift_ico?: string;
  documents?: boolean;
  documentationc?: boolean;
  yp?: string;
  them?: string;
  cover?: string;
  site_badge_id?: string;
  site_badge?: SiteBadge | string | unknown;
  roomid?: string | null;
  islogin?: string;
  rep?: number;
  coins?: number;
  coin?: number;
  evaluation?: number;
  wall_post_likes?: number;
  gifts_received_count?: number;
  busy?: boolean;
  alerts?: boolean;
  nopm?: boolean;
  nonot?: boolean;
  nopmcall?: boolean;
  nopmvideocall?: boolean;
  meiut?: boolean;
  muted?: boolean;
  s?: string | number | null;
  meta_ts?: number;
}

export interface LiveRoomGiftGoal {
  giftId?: string;
  giftFile?: string;
  giftName?: string;
  giftIcon?: string;
  giftCoin?: number;
  targetCount: number;
  currentCount: number;
  endsAt?: number;
}

export interface LiveRoomConfig {
  is_live_audio?: boolean;
  join_mode?: "free" | "request";
  chat_locked?: boolean;
  gift_goal?: LiveRoomGiftGoal;
  pinned_notice?: string;
  hourly_rank?: string;
  likes_count?: number;
}

export interface RoomSnapshot {
  id: string;
  idroom?: number;
  topic: string;
  about: string;
  pic: string;
  welcome: string;
  owner: string;
  needpass: boolean;
  broadcast: boolean;
  deleted: boolean;
  color: string;
  max: number;
  rmli: number;
  mic: number;
  stage_count: number;
  stage_state: Record<string, unknown>;
  message_mode: "real" | string;
  room_owner_meta: RoomOwnerMeta | Record<string, unknown>;
  onlineCount?: number;
  live_config?: LiveRoomConfig;
  is_live_audio?: boolean;
  join_mode?: "free" | "request";
}

export interface RoomMessagePayload {
  id?: string;
  mi?: string;
  uid?: string;
  lid?: string;
  topic: string;
  msg: string;
  pic: string;
  power?: string;
  bg?: string;
  gcol?: string;
  ucol?: string;
  mcol?: string;
  ico?: string;
  gift_ico?: string;
  documents?: boolean;
  documentationc?: boolean;
  class?: string;
  roomid?: string;
  time?: number;
  reply?: Record<string, unknown> | null;
  replyTo?: Record<string, unknown> | null;
  likes?: string[];
  file?: string;
  fileType?: "image" | "audio" | "video" | "file" | "youtube" | "tiktok";
  _cid?: string;
  _cts?: number;
  _srt?: number;
  _sts?: number;
}

export interface PowerRole {
  rank: number;
  name: string;
  ico: string;
  kick?: number;
  delbc?: number;
  alert?: number;
  mynick?: number;
  unick?: number;
  ban?: number;
  publicmsg?: number;
  publicmsghide?: number;
  forcepm?: number;
  roomowner?: number;
  createroom?: number;
  can_create_voice_room?: number;
  rooms?: number;
  edituser?: number;
  setpower?: number;
  upgrades?: number;
  history?: number;
  cp?: number;
  stealth?: number;
  owner?: number;
  meiut?: number;
  loveu?: number;
  ulike?: number;
  flter?: number;
  subs?: number;
  shrt?: number;
  msgs?: number;
  bootedit?: number;
  brbbot?: number;
  micprovideredit?: number;
  hostcleanup?: number;
  hostcontrols?: number;
  hostsettings?: number;
  hostdomains?: number;
  grupes?: number;
  delmsg?: number;
  delpic?: number;
  uploadgif?: number;
  gradientname?: number;
  custombg?: number;
  chattem?: number;
  frame?: number;
  banner?: number;
  gift?: number;
  gifticon?: number;
  reveal?: number;
  profile_viewers?: number;
  evaluationpoints?: number;
  auto_enabled?: number;
  auto_promote?: number;
  auto_points?: number;
  [key: string]: unknown;
}

export interface BroadcastWallPost {
  id?: number;
  bid: string;
  lid: string;
  uid: string;
  topic: string;
  pic: string;
  msg: string;
  bg: string;
  ucol: string;
  mcol: string;
  likes: string[];
  bcc: Array<Record<string, unknown>>;
  documents?: boolean;
  documentationc?: boolean;
}

export interface GiftDefinition {
  id?: string;
  file: string;
  name?: string;
  coin: number;
  category?: string;
}

export interface WalletCenterDashboard {
  coins: number;
  packages: Array<Record<string, unknown>>;
  agents: Array<Record<string, unknown>>;
  orders: Array<Record<string, unknown>>;
  ledger: Array<Record<string, unknown>>;
}

export interface RoomBadge {
  id: string;
  name: string;
  bg: string;
  icon: string;
  bg_type: "static" | "animated";
}

export interface SiteBadge {
  id: string;
  name: string;
  bg: string;
  icon: string;
  bg_type: "static" | "animated";
}

export interface RoomOwnerBadge {
  name: string;
  bg: string;
  icon: string;
  bg_type: "static" | "animated";
}

export interface RoomOwnerAssignment {
  userId: string;
  userUser: string;
  userTopic: string;
  badge_id: string;
  badge: RoomOwnerBadge;
}

export interface RoomOwnerMeta {
  ownerId: string;
  ownerUser: string;
  ownerTopic: string;
  badge_id: string;
  badge: RoomOwnerBadge;
  assignments: RoomOwnerAssignment[];
  live_config?: LiveRoomConfig;
}

export type EvaluationAwardActionKey =
  | "room_message"
  | "wall_post"
  | "private_message"
  | "online_duration"
  | "daily_login"
  | "game_win";

export interface EvaluationAwardRule {
  points: number;
  cooldownMs: number;
  dailyLimit: number;
  minRoomMembers: number;
  minLength: number;
  requireDifferentMember: boolean;
}

export interface EvaluationAwardSettings {
  enabled: boolean;
  actions: Record<EvaluationAwardActionKey, EvaluationAwardRule>;
}

export interface AutoPromotionRule {
  power: PowerRole;
  points: number;
  rank: number;
}

export type HostingSectionKey =
  | "hostcleanup"
  | "hostcontrols"
  | "hostsettings"
  | "hostdomains";

export type HostingSectionAccess = Record<HostingSectionKey, boolean>;

export type CompetitionBotKind =
  | "brb"
  | "capitals"
  | "general_questions"
  | "english_word"
  | "fast_challenge"
  | "confession_chair"
  | "odd_number"
  | "missing_letters"
  | "guess_number"
  | "lucky_wheel";

export interface RoomCompetitionState {
  roomId: string | null;
  active: boolean;
  kind: CompetitionBotKind | "";
  roundOpen: boolean;
  roundNumber?: number;
  targetPoints?: number;
  maxQuestions?: number;
}

export type CarromPieceKind = "dark" | "light" | "queen" | "striker";

export interface CarromPiece {
  id: string;
  kind: CarromPieceKind | string;
  x: number;
  y: number;
  r: number;
  alive: boolean;
}

export interface CarromPlayer {
  seat: number;
  stageSlot?: number;
  socketId: string;
  userId: string;
  topic: string;
  pic: string;
  status?: "playing" | "finished" | "seated";
}

export interface CarromShotInput {
  angle?: number;
  power?: number;
  offset?: number;
  pullDx?: number;
  pullDy?: number;
  pullPower?: number;
}

export interface CarromGameState {
  key?: string;
  roomId: string;
  status: "waiting" | "active" | "finished" | "stopped" | string;
  players: CarromPlayer[];
  scores: [number, number];
  turnSeat: number;
  shotInProgress: boolean;
  winnerSeat: number | null;
  winnerTopic: string;
  pieces: CarromPiece[];
  lastActionText: string;
  queenPocketed: boolean;
  queenCoveredBy: number | null;
  strikerFouled: boolean;
  turnTimerStartedAt: number;
  updatedAt: number;
}

export interface CarromPublicState {
  roomId: string;
  status: string;
  scores: [number, number];
  turnSeat: number;
  turnTopic: string;
  queenPocketed: boolean;
  queenCoveredBy: number | null;
  strikerFouled: boolean;
  turnTimerStartedAt: number;
  players: Array<{
    seat: number;
    stageSlot: number;
    userId: string;
    socketId: string;
    topic: string;
    pic: string;
    status: string;
  }>;
  spectators: number;
  shotInProgress: boolean;
  winnerSeat: number | null;
  winnerTopic: string;
  lastActionText: string;
  pieces: CarromPiece[];
  updatedAt: number;
}

export type MicProviderMode = "WEBRTC" | "LIVEKIT" | "JITSI";

export interface SiteSettingShape {
  micprovider: MicProviderMode;
  roomMessageTheme: "classic" | "bubble";
  evaluation_awards: EvaluationAwardSettings;
  [key: string]: unknown;
}

export interface OwnerRuntimeState {
  bars: boolean;
  offline: boolean;
  cooment: boolean;
  isbanner: boolean;
  rc: boolean;
  vpn: boolean;
  tv: string;
  maxRep: number;
  room: string;
  datafinish: number | string;
  updatedAt: number;
}

// ---------- Ludo Game Types ----------

export type LudoColor = "red" | "green" | "yellow" | "blue";
export type LudoGameStatus = "waiting" | "active" | "finished" | "stopped";
export type LudoTurnPhase = "awaiting_roll" | "awaiting_move";

export interface LudoToken {
  id: string;
  color: LudoColor;
  index: 0 | 1 | 2 | 3;
  /** -1 = yard, 0..50 = shared main track progress, 51..55 = home stretch, 56 = finished */
  progress: number;
}

export interface LudoPlayer {
  seat: 0 | 1 | 2 | 3;
  color: LudoColor;
  socketId: string;
  userId: string;
  topic: string;
  pic: string;
  isBot?: boolean;
  online?: boolean;
  finishedCount?: number;
}

export interface LudoGameState {
  roomId: string;
  title?: string;
  hostSocketId?: string;
  hostUserId?: string;
  status: LudoGameStatus;
  phase: LudoTurnPhase;
  players: LudoPlayer[];
  tokens: LudoToken[];
  turnSeat: 0 | 1 | 2 | 3;
  diceValue: number | null;
  consecutiveSixes: number;
  legalTokenIds: string[];
  winnerSeat: number | null;
  winnerColor: LudoColor | null;
  winnerTopic: string;
  lastActionText: string;
  turnStartedAt: number;
  updatedAt: number;
}

export interface LudoPublicState {
  roomId: string;
  title?: string;
  status: LudoGameStatus;
  phase: LudoTurnPhase;
  players: LudoPlayer[];
  tokens: LudoToken[];
  turnSeat: 0 | 1 | 2 | 3;
  turnColor: LudoColor | null;
  turnTopic: string;
  diceValue: number | null;
  consecutiveSixes: number;
  legalTokenIds: string[];
  spectators: number;
  winnerSeat: number | null;
  winnerColor: LudoColor | null;
  winnerTopic: string;
  lastActionText: string;
  turnStartedAt: number;
  turnTimeoutMs: number;
  updatedAt: number;
}

export interface LudoMoveOutcome {
  movedTokenId: string;
  fromProgress: number;
  toProgress: number;
  capturedTokenIds: string[];
  reachedHome: boolean;
  retainTurn: boolean;
  finished: boolean;
}

export interface LudoArenaRoomSummary {
  roomCode: string;
  title: string;
  hostName: string;
  playerCount: number;
  botCount: number;
  spectatorCount: number;
  status: LudoGameStatus;
}

// ---------- Stories & Hierarchical Comments Types ----------

export interface StorySlideItem {
  id: string;
  type: "image" | "video" | "text" | string;
  src: string;
  caption?: string;
  bgColor?: string;
  textColor?: string;
  length?: number;
  time?: number;
  viewsCount?: number;
  likesCount?: number;
  commentsCount?: number;
  viewedByMe?: boolean;
  likedByMe?: boolean;
}

export interface StoryGroupRecord {
  id?: number;
  sid: string;
  photo: string;
  name: string;
  ucol?: string;
  link: string;
  lastUpdated?: string;
  item: StorySlideItem[];
  seen?: boolean;
  hasUnviewed?: boolean;
  currentPreview?: unknown[];
}

export interface StoryLikeRecord {
  user_uid: string;
  topic: string;
  photo: string;
  created_at: number;
}

export interface StoryCommentRecord {
  id?: number;
  cid: string;
  story_sid: string;
  item_id: string;
  parent_cid: string;
  reply_to_topic: string;
  author_uid: string;
  author_topic: string;
  author_pic: string;
  author_ucol: string;
  author_verified: boolean;
  body: string;
  likes_count: number;
  liked_by_me?: boolean;
  created_at: number;
}

// ---------- Dedicated Member Notes Types (Separate from Stories) ----------

export interface UserNoteRecord {
  id: number;
  nid: string;
  uid: string;
  authorTopic: string;
  authorPic?: string;
  authorUcol?: string;
  authorVerified?: boolean;
  type: "text" | "audio";
  text?: string;
  caption?: string;
  audioUrl?: string;
  duration?: number;
  tag?: string;
  likesCount: number;
  commentsCount: number;
  likedByMe?: boolean;
  createdAt: number;
}

export interface NoteLikeRecord {
  id?: number;
  noteNid: string;
  userUid: string;
  topic?: string;
  photo?: string;
  createdAt: number;
}

export interface NoteCommentRecord {
  id?: number;
  cid: string;
  noteNid: string;
  parent_cid?: string;
  parentCid?: string;
  reply_to_topic?: string;
  replyToTopic?: string;
  authorUid: string;
  author_uid?: string;
  authorTopic: string;
  authorPic?: string;
  authorUcol?: string;
  author_pic?: string;
  author_topic?: string;
  author_ucol?: string;
  author_verified?: boolean;
  authorVerified?: boolean;
  body: string;
  likesCount: number;
  likes_count?: number;
  likedByMe?: boolean;
  liked_by_me?: boolean;
  createdAt: number;
  created_at?: number;
}

export interface PublishNotePayload {
  type: "text" | "audio";
  text?: string;
  caption?: string;
  audioUrl?: string;
  duration?: number;
  tag?: string;
}
