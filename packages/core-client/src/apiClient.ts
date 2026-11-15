import type { MicProviderMode, OnlineUserSnapshot, PowerRole, RoomSnapshot } from "@newchat/shared";

export interface BootstrapSiteConfig {
  settingId?: number;
  name?: string;
  title?: string;
  description?: string;
  keywords?: string;
  head?: string;
  script?: string;
  banner?: string;
  bannerOptimized?: string;
  bannerWebp?: string;
  logo?: string;
  logoOptimized?: string;
  logoWebp?: string;
  allowg?: boolean;
  allowreg?: boolean;
  micProvider?: MicProviderMode | string;
  roomMessageTheme?: "classic" | "bubble" | string;
  evaluationAwards?: Record<string, unknown>;
  colors?: {
    hicolor?: string;
    bgcolor?: string;
    btcolor?: string;
  };
  walllikes?: Record<string, unknown>;
  wallminutes?: number;
  bclikes?: number;
  msgst?: number;
  pmlikes?: number;
  miclikes?: number;
  notlikes?: number;
  fileslikes?: number;
  ifbanner?: boolean;
  radio?: string;
  tv?: string;
  bars?: boolean;
  offline?: boolean;
  rc?: boolean;
  cooment?: boolean;
  vpn?: boolean;
  maxRep?: number;
  defaultRoom?: string;
  entrySlides?: Array<Record<string, unknown>>;
  sicos?: string[];
  dro3?: string[];
  emos?: string[];
  them?: string[];
  cover?: string[];
  roomBadges?: Array<Record<string, unknown>>;
  siteBadges?: Array<Record<string, unknown>>;
  giftsGit?: Array<Record<string, unknown>>;
  giftCategories?: Array<Record<string, unknown>>;
  liveKitWsUrl?: string;
  rtcIceServers?: Array<{ urls: string | string[] }>;
}

export interface BootstrapResponse {
  onlineCount: number;
  online: OnlineUserSnapshot[];
  powers: PowerRole[];
  rooms: RoomSnapshot[];
  roomsCounts: Record<string, number>;
  shortcuts?: Array<{ text1: string; text2: string }>;
  site?: BootstrapSiteConfig | null;
  ts: number;
}

export interface AuthenticatedMember {
  idreg: number;
  uid: string;
  lid: string;
  username: string;
  topic: string;
  pic: string;
  pich?: string;
  msg: string;
  power: string;
  rank: string;
  bg: string;
  ucol: string;
  mcol: string;
  gcol: string;
  ico?: string;
  gift_ico?: string;
  them?: string;
  cover?: string;
  youtub?: string;
  yp?: string;
  rep: number;
  coins: number;
  coin: number;
  evaluation: number;
  point: number;
  wall_post_likes: number;
  gifts_received_count: number;
  documentationc?: boolean;
  documents?: boolean;
  loginG?: boolean;
  muted?: boolean;
  busy?: boolean;
  nopm?: boolean;
  alerts?: boolean;
  nopmcall?: boolean;
  nopmvideocall?: boolean;
  site_badge_id?: string;
  site_badge?: unknown;
  auto_power?: string;
  joinuser?: string;
  lastssen?: string;
}

export interface AuthTokenBundle {
  type: "Bearer";
  accessToken: string;
  resumeToken: string;
  accessExpiresAt: number;
  resumeExpiresAt: number;
}

export interface AuthResponse {
  ok: boolean;
  message?: string;
  code?: string;
  accessToken?: string;
  resumeToken?: string;
  sessionToken?: string;
  auth?: AuthTokenBundle;
  user?: AuthenticatedMember;
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export interface RequestOptions extends RequestInit {
  token?: string;
}

export class NewChatApiClient {
  constructor(private readonly baseUrl: string) {}

  getAssetUrl(pathOrRelative: string): string {
    if (!pathOrRelative) return "";
    if (/^(?:https?:)?\/\//i.test(pathOrRelative) || pathOrRelative.startsWith("data:") || pathOrRelative.startsWith("blob:")) {
      return pathOrRelative;
    }
    return this.url(pathOrRelative);
  }

  private url(path: string): string {
    const cleanBase = this.baseUrl.replace(/\/+$/, "");
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    return `${cleanBase}${cleanPath}`;
  }

  private buildHeaders(init?: RequestOptions, extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(extra ?? {}),
    };
    if (init?.headers && typeof init.headers === "object" && !Array.isArray(init.headers)) {
      Object.assign(headers, init.headers as Record<string, string>);
    }
    if (init?.token && !headers.Authorization) {
      headers.Authorization = `Bearer ${init.token}`;
    }
    return headers;
  }

  async requestJson<T>(path: string, init?: RequestOptions): Promise<T> {
    const hasBody = init?.body !== undefined && !(init.body instanceof FormData);
    const res = await fetch(this.url(path), {
      ...init,
      headers: this.buildHeaders(init, hasBody ? { "Content-Type": "application/json" } : undefined),
    });

    const text = await res.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }

    if (!res.ok) {
      const obj = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
      const errMsg = String(obj?.message || obj?.msg || `HTTP ${res.status}`);
      const errCode = obj?.code ? String(obj.code) : undefined;
      throw new ApiRequestError(errMsg, res.status, errCode);
    }

    return parsed as T;
  }

  getJson<T>(path: string, init?: RequestOptions): Promise<T> {
    return this.requestJson<T>(path, { ...init, method: "GET" });
  }

  postJson<T>(path: string, body: unknown, init?: RequestOptions): Promise<T> {
    return this.requestJson<T>(path, {
      ...init,
      method: "POST",
      body: JSON.stringify(body ?? {}),
    });
  }

  private async uploadMultipartRaw(path: string, file: Blob | File, filename?: string, token?: string): Promise<string> {
    const formData = new FormData();
    formData.append("file", file, filename || (file instanceof File ? file.name : "upload.bin"));
    // Auto-attach the persisted session token so uploads always come from an
    // authenticated session (the API rejects anonymous uploads).
    const autoToken =
      token ||
      (() => {
        try {
          if (typeof window !== "undefined" && window.localStorage) {
            return window.localStorage.getItem("newchat_session_token") || "";
          }
        } catch {
          // ignore storage errors
        }
        return "";
      })();
    const res = await fetch(this.url(path), {
      method: "POST",
      headers: autoToken ? { Authorization: `Bearer ${autoToken}` } : undefined,
      body: formData,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new ApiRequestError(text || `Upload failed (${res.status})`, res.status);
    }
    return text;
  }

  private async uploadMultipartJson<T>(path: string, file: Blob | File, filename?: string, token?: string): Promise<T> {
    const text = await this.uploadMultipartRaw(path, file, filename, token);
    try {
      return JSON.parse(text) as T;
    } catch {
      return { err: true, msg: text } as T;
    }
  }

  // -------- Health & Public Discovery --------
  getHealth() {
    return this.getJson<{ ok: boolean; service?: string }>("/health");
  }

  getOnline() {
    return this.getJson<{
      powers: PowerRole[];
      online: OnlineUserSnapshot[];
      onlineCount: number;
      ts: number;
    }>("/getonline");
  }

  getBootstrap() {
    return this.getJson<BootstrapResponse>("/bootstrap");
  }

  getRooms() {
    return this.getJson<{ err: boolean; rooms: RoomSnapshot[]; roomsCounts: Record<string, number> }>("/rooms");
  }

  getTop10() {
    return this.getJson<Array<Record<string, unknown>>>("/top10");
  }

  getTop10Wall() {
    return this.getJson<Array<Record<string, unknown>>>("/top10wall");
  }

  getTop10WallByLid(lid: string) {
    const qs = new URLSearchParams({ lid });
    return this.getJson<Array<Record<string, unknown>>>(`/top10walld?${qs.toString()}`);
  }

  getStoriesWall() {
    return this.getJson<Array<Record<string, unknown>>>("/storieswall");
  }

  getStoriesLeaderboard() {
    return this.getJson<Array<Record<string, unknown>>>("/stor10");
  }

  getRoomBadges() {
    return this.getJson<{ err: boolean; data: Array<Record<string, unknown>> }>("/room_badges");
  }

  getSiteBadges() {
    return this.getJson<{ err: boolean; data: Array<Record<string, unknown>> }>("/site_badges");
  }

  getMicProvider() {
    return this.getJson<{ micProvider: string }>("/micprovider.nd");
  }

  getLiveKitToken(room: string, token?: string) {
    return this.postJson<{ ok?: boolean; token: string; url: string; wsUrl?: string; canPublish?: boolean }>(
      "/livekit/token",
      { room },
      token ? { token } : undefined,
    );
  }

  // -------- Auth --------
  loginMember(payload: { username: string; password: string; fp?: string; refr?: string }) {
    return this.postJson<AuthResponse>("/api/auth/login", payload);
  }

  registerMember(payload: { username: string; password: string; topic?: string; fp?: string; refr?: string }) {
    return this.postJson<AuthResponse>("/api/auth/register", payload);
  }

  getMe(token: string) {
    return this.getJson<{ ok: boolean; user?: AuthenticatedMember; message?: string }>("/api/auth/me", { token });
  }

  refreshSession(resumeTokenOrSessionToken: string) {
    return this.postJson<AuthResponse>("/api/auth/refresh", { resumeToken: resumeTokenOrSessionToken });
  }

  // -------- Media Uploads --------
  uploadAvatar(file: Blob | File, filename?: string) {
    return this.uploadMultipartRaw("/pic", file, filename);
  }

  uploadProfileCover(file: Blob | File, filename?: string) {
    return this.uploadMultipartRaw("/pic2", file, filename);
  }

  uploadRoomPic(file: Blob | File, filename?: string) {
    return this.uploadMultipartRaw("/picroom", file, filename);
  }

  uploadCpRoomPic(file: Blob | File, token: string, filename?: string) {
    return this.uploadMultipartJson<{ err?: boolean; msg?: string }>("/cp/pic", file, filename, token);
  }

  uploadBotPic(file: Blob | File, filename?: string) {
    return this.uploadMultipartRaw("/bot-pic", file, filename);
  }

  uploadMediaFile(file: Blob | File, filename?: string) {
    return this.uploadMultipartRaw("/upload?secid=u", file, filename);
  }

  uploadAdminAsset(
    state: "banner" | "logo" | "entry_slides" | "sico" | "dro3" | "emo" | "them" | "cover" | "gifts_git" | "room_badges" | string,
    file: Blob | File,
    token: string,
    filename?: string,
  ) {
    const qs = new URLSearchParams({ state });
    return this.uploadMultipartJson<{ err?: boolean; error?: boolean; msg?: string }>(
      `/upload?${qs.toString()}`,
      file,
      filename,
      token,
    );
  }

  uploadSiteScript(file: Blob | File, token: string, filename = "site.json") {
    return this.uploadMultipartJson<{ err?: boolean; msg?: string; value?: string }>("/cp/site", file, filename, token);
  }

  uploadTopupReceipt(file: Blob | File, token: string, filename?: string) {
    return this.uploadMultipartJson<{
      err: boolean;
      msg?: string;
      data?: { receipt_path: string; receipt_uploaded_at: number };
    }>("/wallet/topup-upload", file, filename, token);
  }

  // -------- Wallet, Topup & Agent Panel --------
  getWalletCenterDashboard(token: string) {
    return this.postJson<{ err: boolean; msg?: string; data?: Record<string, unknown> }>(
      "/wallet/center.nd",
      { cmd: "dashboard" },
      { token },
    );
  }

  getTopupUserDashboard(token: string) {
    return this.postJson<{ err: boolean; msg?: string; data?: Record<string, unknown> }>(
      "/wallet/topup.nd",
      { cmd: "dashboard" },
      { token },
    );
  }

  createTopupOrder(
    token: string,
    payload: {
      package_id: number;
      agent_id: number;
      payment_method_id: number;
      receipt_path?: string;
      payment_reference?: string;
      payment_note?: string;
      idempotency_key?: string;
    },
  ) {
    return this.postJson<{ err: boolean; msg?: string; data?: Record<string, unknown> }>(
      "/wallet/topup.nd",
      { cmd: "create", data: payload },
      { token },
    );
  }

  agentTopupCommand<T = Record<string, unknown>>(
    cmd: "login" | "logout" | "dashboard" | "payment_method_save" | "payment_method_toggle" | "order_approve" | "order_reject",
    params?: Record<string, unknown>,
    sid?: string,
  ) {
    return this.postJson<{
      err: boolean;
      msg?: string;
      session?: { sid: string; ttlMs: number; expiresAt: number };
      data?: T;
    }>("/agent/topup.nd", { cmd, ...(params ?? {}) }, sid ? { token: sid } : undefined);
  }

  // -------- Control Panel & Inspection --------
  getUserIpAliases(token: string, targetSocketOrUid: string) {
    const qs = new URLSearchParams({ u2: targetSocketOrUid });
    return this.getJson<Array<Record<string, unknown>>>(`/uh?${qs.toString()}`, { token });
  }

  cpCommand<T = Record<string, unknown>>(
    token: string,
    cmd: string,
    params?: Record<string, unknown>,
  ) {
    return this.postJson<T>("/cp/cp.nd", { cmd, ...(params ?? {}) }, { token });
  }

  setPowerCpRoot(token: string, payload: { id: string | number; power: string; days?: number }) {
    return this.postJson<{ err: boolean; msg?: string }>("/cp.nd", { cmd: "setpower", ...payload }, { token });
  }
}
