export type MediaRequestKind = "mic" | "camera" | "both";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function isLocalDevHostname(hostname: string): boolean {
  const clean = String(hostname || "").trim().toLowerCase();
  return LOCAL_HOSTS.has(clean) || clean.endsWith(".localhost");
}

export function isInsecureNonLocalHttp(): boolean {
  if (typeof window === "undefined") return false;
  if (window.isSecureContext) return false;
  return window.location.protocol === "http:" && !isLocalDevHostname(window.location.hostname);
}

export function buildHttpsCompanionUrl(): string | null {
  if (typeof window === "undefined") return null;
  if (!isInsecureNonLocalHttp()) return null;
  const { hostname, port, pathname, search, hash } = window.location;
  const targetHost = port === "5173" ? `${hostname}:5443` : window.location.host;
  return `https://${targetHost}${pathname}${search}${hash}`;
}

export function isMediaCaptureSupported(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return Boolean(window.isSecureContext && navigator.mediaDevices?.getUserMedia);
}

export function explainMediaAccessError(
  err: unknown,
  kind: MediaRequestKind = "mic",
): string {
  const targetLabel =
    kind === "both"
      ? "الميكروفون والكاميرا"
      : kind === "camera"
        ? "الكاميرا"
        : "الميكروفون";

  if (typeof window !== "undefined" && !window.isSecureContext) {
    const httpsUrl = buildHttpsCompanionUrl();
    return httpsUrl
      ? `المتصفح على الجوال يمنع ${targetLabel} على رابط HTTP غير الآمن — افتح الرابط عبر HTTPS (${httpsUrl}) لتظهر نافذة السماح`
      : `المتصفح يمنع الوصول إلى ${targetLabel} خارج اتصال HTTPS الآمن`;
  }

  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return `المتصفح الحالي لا يدعم الوصول إلى ${targetLabel}`;
  }

  const name = err instanceof Error ? err.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
    return `تم رفض صلاحية الوصول إلى ${targetLabel} — اضغط على أيقونة القفل/الإعدادات بجانب رابط الموقع واسمح بالإذن ثم أعد المحاولة`;
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return `لم يتم العثور على ${targetLabel} متاح في هذا الجهاز`;
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return `${targetLabel} قيد الاستخدام حالياً من تطبيق آخر — أغلق التطبيق الآخر ثم حاول مجدداً`;
  }
  if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
    return `إعدادات ${targetLabel} غير مدعومة في هذا الجهاز`;
  }
  return `تعذر تشغيل ${targetLabel} — تأكد من السماح بالصلاحية في إعدادات المتصفح`;
}

let sharedUnlockCtx: AudioContext | null = null;

export function unlockBrowserAudioContext(): void {
  if (typeof window === "undefined") return;
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    if (!sharedUnlockCtx || sharedUnlockCtx.state === "closed") {
      sharedUnlockCtx = new Ctx();
    }
    if (sharedUnlockCtx.state === "suspended") {
      void sharedUnlockCtx.resume().catch(() => undefined);
    }
  } catch {
    // ignore WebAudio autoplay lock cleanly
  }
}

export async function requestUserMediaWithFallback(opts: {
  audio: boolean;
  video: boolean;
}): Promise<MediaStream> {
  unlockBrowserAudioContext();

  if (!isMediaCaptureSupported()) {
    const err = new Error("INSECURE_OR_UNSUPPORTED_MEDIA");
    err.name = "SecurityError";
    throw err;
  }

  const preferredConstraints: MediaStreamConstraints = {
    audio: opts.audio
      ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      : false,
    video: opts.video
      ? {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        }
      : false,
  };

  try {
    return await navigator.mediaDevices.getUserMedia(preferredConstraints);
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (
      name === "OverconstrainedError" ||
      name === "ConstraintNotSatisfiedError" ||
      name === "TypeError"
    ) {
      return await navigator.mediaDevices.getUserMedia({
        audio: opts.audio,
        video: opts.video,
      });
    }
    throw err;
  }
}

interface StashedCallMedia {
  callType: "audio" | "video";
  stream: MediaStream;
  timerId: ReturnType<typeof setTimeout>;
}

let stashedCallMedia: StashedCallMedia | null = null;

export function clearStashedCallMediaStream(): void {
  if (!stashedCallMedia) return;
  clearTimeout(stashedCallMedia.timerId);
  stashedCallMedia.stream.getTracks().forEach((t) => {
    try {
      t.stop();
    } catch {
      // ignore
    }
  });
  stashedCallMedia = null;
}

export function stashCallMediaStream(
  callType: "audio" | "video",
  stream: MediaStream,
): void {
  clearStashedCallMediaStream();
  const timerId = setTimeout(() => {
    clearStashedCallMediaStream();
  }, 60_000);
  stashedCallMedia = { callType, stream, timerId };
}

export function consumeCallMediaStream(
  callType: "audio" | "video",
): MediaStream | null {
  if (!stashedCallMedia) return null;
  if (stashedCallMedia.callType !== callType) {
    clearStashedCallMediaStream();
    return null;
  }
  const { stream, timerId } = stashedCallMedia;
  clearTimeout(timerId);
  stashedCallMedia = null;

  const hasLiveAudio = stream.getAudioTracks().some((t) => t.readyState === "live");
  const hasNeededVideo =
    callType !== "video" || stream.getVideoTracks().some((t) => t.readyState === "live");

  if (!hasLiveAudio || !hasNeededVideo) {
    stream.getTracks().forEach((t) => t.stop());
    return null;
  }
  return stream;
}
