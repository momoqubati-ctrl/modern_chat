import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ParticipantEvent,
  Room,
  RoomEvent,
  Track,
  type LocalTrackPublication,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
} from "livekit-client";
import { subscribeStageSignals, useChatStore } from "@newchat/core-client";
import type { MicProviderMode } from "@newchat/shared";
import {
  explainMediaAccessError,
  isMediaCaptureSupported,
  requestUserMediaWithFallback,
  unlockBrowserAudioContext,
} from "../lib/mediaPermissions.js";

export interface StageSlotView {
  slot: number;
  occupantId: string;
  active: boolean;
  locked: boolean;
  muted: boolean;
  speaking: boolean;
  locallyMuted: boolean;
}

export interface UseMicStageAudioResult {
  micProvider: MicProviderMode;
  micCount: number;
  slots: StageSlotView[];
  mySlotNumber: number;
  isSelfMuted: boolean;
  isWebRtcMode: boolean;
  isJitsiMode: boolean;
  jitsiEmbedUrl: string;
  lkStatus: "idle" | "connecting" | "connected" | "unavailable";
  stageStatus: "idle" | "connecting" | "connected" | "unavailable";
  audioEnabled: boolean;
  setAudioEnabled: (enabled: boolean) => void;
  locallyMutedUsers: Record<string, boolean>;
  toggleLocalMuteUser: (socketId: string) => void;
  takeSlot: (slotNumber: number) => void;
  leaveSlot: () => void;
  toggleSelfMute: () => void;
  toggleUserMute: (socketId: string, nextMuted?: boolean) => void;
  toggleSlotLock: (slotNumber: number, lock: boolean) => void;
  kickFromStage: (socketId: string) => void;
  lockAllEmpty: () => void;
  unlockAll: () => void;
  requestSlot: (slotNumber?: number) => void;
  cancelSlotRequest: () => void;
  approveSlotRequest: (targetSocketId: string, slotNumber?: number) => void;
  rejectSlotRequest: (targetSocketId: string) => void;
  inviteToSlot: (targetSocketId: string, slotNumber?: number) => void;
  sendSoundFx: (soundName: string) => void;
}

interface AttachedLiveKitAudio {
  element: HTMLAudioElement;
  identity: string;
  publication: RemoteTrackPublication;
}

interface AttachedRtcAudio {
  element: HTMLAudioElement;
  peerId: string;
  stream: MediaStream;
}

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

const VAD_RMS_THRESHOLD = 0.015;
const VAD_FREQ_AVG_THRESHOLD = 10;
const VAD_RELEASE_HOLD_MS = 320;
const VAD_MIN_EMIT_GAP_MS = 140;

function normalizeClientMicProvider(raw: unknown): MicProviderMode {
  const clean = String(raw || "WEBRTC").trim().toUpperCase();
  if (clean === "LIVEKIT" || clean === "LK") return "LIVEKIT";
  if (clean === "JITSI" || clean === "JISTI") return "JITSI";
  return "WEBRTC";
}

function stopAttachedAudioElement(el: HTMLAudioElement): void {
  try {
    el.muted = true;
    el.pause();
    el.srcObject = null;
  } catch {
    // ignore DOM cleanup failure
  }
  el.remove();
}

function resolveVadSpeaking(timeData: Float32Array, freqData: Uint8Array): boolean {
  let sumSq = 0;
  for (let i = 0; i < timeData.length; i += 1) {
    const sample = timeData[i]!;
    sumSq += sample * sample;
  }
  const rms = Math.sqrt(sumSq / timeData.length);
  if (rms >= VAD_RMS_THRESHOLD) return true;

  let freqSum = 0;
  for (let i = 0; i < freqData.length; i += 1) {
    freqSum += freqData[i]!;
  }
  const freqAvg = freqSum / freqData.length;
  return freqAvg >= VAD_FREQ_AVG_THRESHOLD;
}

export function useMicStageAudio(): UseMicStageAudioResult {
  const me = useChatStore((s) => s.me);
  const sessionToken = useChatStore((s) => s.sessionToken);
  const currentRoomId = useChatStore((s) => s.currentRoomId);
  const rooms = useChatStore((s) => s.rooms);
  const site = useChatStore((s) => s.site);
  const stageState = useChatStore((s) => s.stageState);
  const speakingUsers = useChatStore((s) => s.speakingUsers);
  const callState = useChatStore((s) => s.callState);
  const getApiClient = useChatStore((s) => s.getApiClient);
  const emitMicAction = useChatStore((s) => s.emitMicAction);
  const setUserSpeakingLocal = useChatStore((s) => s.setUserSpeakingLocal);
  const pushNotice = useChatStore((s) => s.pushNotice);

  const [audioEnabled, setAudioEnabled] = useState(true);
  const [locallyMutedUsers, setLocallyMutedUsers] = useState<Record<string, boolean>>({});
  const [lkStatus, setLkStatus] = useState<"idle" | "connecting" | "connected" | "unavailable">("idle");
  const [rtcStatus, setRtcStatus] = useState<"idle" | "connecting" | "connected" | "unavailable">("idle");
  const [lkSpeakingIds, setLkSpeakingIds] = useState<Record<string, boolean>>({});
  const [localAudioTrackTick, setLocalAudioTrackTick] = useState(0);

  // LiveKit refs
  const lkRoomRef = useRef<Room | null>(null);
  const remoteAudioContainerRef = useRef<HTMLDivElement | null>(null);
  const attachedLkMapRef = useRef<Map<string, AttachedLiveKitAudio>>(new Map());
  const connectGenerationRef = useRef(0);

  // WebRTC mesh refs
  const rtcPeersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const rtcSignalQueuesRef = useRef<Map<string, Promise<void>>>(new Map());
  const rtcPendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const rtcRemoteAudioMapRef = useRef<Map<string, AttachedRtcAudio>>(new Map());
  const localRtcStreamRef = useRef<MediaStream | null>(null);
  const rtcCapturePromiseRef = useRef<Promise<MediaStream | null> | null>(null);
  const prewarmGraceUntilRef = useRef(0);
  const prewarmCleanupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestedSpeakersRef = useRef<Set<string>>(new Set());
  const audioUnlockedRef = useRef(false);

  // Live value refs for async callbacks
  const meIdRef = useRef(me?.id || "");
  meIdRef.current = me?.id || "";

  const currentRoomIdRef = useRef(currentRoomId);
  currentRoomIdRef.current = currentRoomId;

  const audioEnabledRef = useRef(audioEnabled);
  audioEnabledRef.current = audioEnabled;

  const locallyMutedRef = useRef(locallyMutedUsers);
  locallyMutedRef.current = locallyMutedUsers;

  const activeRoom = useMemo(
    () => rooms.find((r) => r.id === currentRoomId) ?? null,
    [rooms, currentRoomId],
  );

  const configuredMicProvider = useMemo(
    () => normalizeClientMicProvider(site?.micProvider),
    [site?.micProvider],
  );
  // Auto-fallback from LiveKit to WebRTC if LiveKit is configured but cloud token or connection fails
  const micProvider = useMemo<MicProviderMode>(() => {
    if (configuredMicProvider === "LIVEKIT" && lkStatus === "unavailable") {
      return "WEBRTC";
    }
    return configuredMicProvider;
  }, [configuredMicProvider, lkStatus]);
  const isWebRtcMode = micProvider === "WEBRTC";
  const isJitsiMode = micProvider === "JITSI";
  const isLiveKitMode = micProvider === "LIVEKIT";

  const rtcIceServers = useMemo<RTCIceServer[]>(() => {
    if (Array.isArray(site?.rtcIceServers) && site.rtcIceServers.length > 0) {
      return site.rtcIceServers as RTCIceServer[];
    }
    return DEFAULT_ICE_SERVERS;
  }, [site?.rtcIceServers]);
  const rtcIceServersRef = useRef(rtcIceServers);
  rtcIceServersRef.current = rtcIceServers;

  const micCount = useMemo(() => {
    const raw = Number(stageState.micCount ?? activeRoom?.stage_count ?? activeRoom?.mic ?? 12);
    return Number.isFinite(raw) ? Math.max(0, Math.min(12, Math.floor(raw))) : 12;
  }, [stageState.micCount, activeRoom?.stage_count, activeRoom?.mic]);

  const slotDataMap = useMemo(() => {
    return (stageState.data && typeof stageState.data === "object"
      ? stageState.data
      : {}) as Record<string, { id?: string; ev?: boolean }>;
  }, [stageState.data]);

  const lockedSlotsMap = useMemo(() => {
    return (stageState.lockedSlots && typeof stageState.lockedSlots === "object"
      ? stageState.lockedSlots
      : {}) as Record<string, number | boolean>;
  }, [stageState.lockedSlots]);

  const mutedUsersMap = useMemo(() => {
    return (stageState.mutedUsers && typeof stageState.mutedUsers === "object"
      ? stageState.mutedUsers
      : {}) as Record<string, boolean>;
  }, [stageState.mutedUsers]);

  const slots = useMemo<StageSlotView[]>(() => {
    const out: StageSlotView[] = [];
    for (let i = 1; i <= micCount; i += 1) {
      const k = String(i);
      const entry = slotDataMap[k];
      const occupantId = String(entry?.id || "");
      const active = Boolean(entry?.ev && occupantId);
      const locked = Boolean(lockedSlotsMap[k]);
      const muted = Boolean(occupantId && mutedUsersMap[occupantId]);
      const locallyMuted = Boolean(occupantId && locallyMutedUsers[occupantId]);
      const speaking = Boolean(
        active &&
          !muted &&
          occupantId &&
          (speakingUsers[occupantId] || lkSpeakingIds[occupantId]),
      );
      out.push({
        slot: i,
        occupantId,
        active,
        locked,
        muted,
        speaking,
        locallyMuted,
      });
    }
    return out;
  }, [micCount, slotDataMap, lockedSlotsMap, mutedUsersMap, speakingUsers, lkSpeakingIds, locallyMutedUsers]);

  const activeSpeakerIds = useMemo(
    () => slots.filter((s) => s.active && s.occupantId).map((s) => s.occupantId),
    [slots],
  );
  const activeSpeakerIdsRef = useRef<string[]>(activeSpeakerIds);
  activeSpeakerIdsRef.current = activeSpeakerIds;

  const mySlotNumber = useMemo(() => {
    if (!me?.id) return 0;
    const found = slots.find((s) => s.active && s.occupantId === me.id);
    return found ? found.slot : 0;
  }, [slots, me?.id]);

  const isSelfMuted = Boolean(me?.id && (mutedUsersMap[me.id] || me.muted));
  const shouldPublishLocal = Boolean(
    mySlotNumber > 0 && !isSelfMuted && callState.status === "idle",
  );

  const mySlotNumberRef = useRef(mySlotNumber);
  mySlotNumberRef.current = mySlotNumber;
  const isSelfMutedRef = useRef(isSelfMuted);
  isSelfMutedRef.current = isSelfMuted;
  const shouldPublishLocalRef = useRef(shouldPublishLocal);
  shouldPublishLocalRef.current = shouldPublishLocal;
  const callStatusRef = useRef(callState.status);
  callStatusRef.current = callState.status;

  // Sync mute & play state across ALL remote <audio> sinks (LiveKit + WebRTC)
  const syncRemoteAudioElements = useCallback(() => {
    const masterEnabled = audioEnabledRef.current;
    const localMutes = locallyMutedRef.current;

    attachedLkMapRef.current.forEach(({ element, identity, publication }) => {
      const mutedForListener = !masterEnabled || Boolean(localMutes[identity]);
      element.muted = mutedForListener;
      try {
        publication.setEnabled(!mutedForListener);
      } catch {
        // ignore disposed publication
      }
      if (mutedForListener) {
        if (!element.paused) element.pause();
      } else if (element.paused && element.srcObject) {
        void element.play().catch(() => undefined);
      }
    });

    rtcRemoteAudioMapRef.current.forEach(({ element, peerId }) => {
      const mutedForListener = !masterEnabled || Boolean(localMutes[peerId]);
      element.muted = mutedForListener;
      if (mutedForListener) {
        if (!element.paused) element.pause();
      } else if (element.paused && element.srcObject) {
        void element.play().catch(() => undefined);
      }
    });
  }, []);

  useEffect(() => {
    syncRemoteAudioElements();
  }, [audioEnabled, locallyMutedUsers, syncRemoteAudioElements]);

  // Global user-gesture autoplay unlock & mobile mic prewarm for remote and local audio
  useEffect(() => {
    if (typeof window === "undefined") return;
    const unlockPlayback = () => {
      audioUnlockedRef.current = true;
      unlockBrowserAudioContext();
      syncRemoteAudioElements();
      if (
        mySlotNumberRef.current > 0 &&
        shouldPublishLocalRef.current &&
        !localRtcStreamRef.current
      ) {
        void ensureLocalRtcMicStreamRef.current(true);
      }
    };
    window.addEventListener("pointerdown", unlockPlayback, { passive: true });
    window.addEventListener("keydown", unlockPlayback, { passive: true });
    window.addEventListener("touchstart", unlockPlayback, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", unlockPlayback);
      window.removeEventListener("keydown", unlockPlayback);
      window.removeEventListener("touchstart", unlockPlayback);
    };
  }, [syncRemoteAudioElements]);

  // Reset local per-speaker mutes cleanly when switching rooms
  useEffect(() => {
    setLocallyMutedUsers({});
  }, [currentRoomId]);

  // Stage seat heartbeat to reclaim orphaned seats if tab closes abruptly
  useEffect(() => {
    if (mySlotNumber <= 0 || !currentRoomId) return;
    const sendHeartbeat = () => {
      emitMicAction("broadcasting", { cmd: "heartbeat", roomid: currentRoomId });
    };
    sendHeartbeat();
    const timer = window.setInterval(sendHeartbeat, 25_000);
    return () => window.clearInterval(timer);
  }, [mySlotNumber, currentRoomId, emitMicAction]);

  // Ensure offscreen DOM sink container exists (NEVER use display: none as WebKit/Safari silences audio)
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!remoteAudioContainerRef.current) {
      const div = document.createElement("div");
      div.setAttribute("data-stage-audio-sink", "true");
      div.style.position = "fixed";
      div.style.left = "-9999px";
      div.style.top = "-9999px";
      div.style.width = "1px";
      div.style.height = "1px";
      div.style.opacity = "0.001";
      div.style.pointerEvents = "none";
      div.style.overflow = "hidden";
      document.body.appendChild(div);
      remoteAudioContainerRef.current = div;
    }
    return () => {
      attachedLkMapRef.current.forEach(({ element }) => stopAttachedAudioElement(element));
      attachedLkMapRef.current.clear();
      rtcRemoteAudioMapRef.current.forEach(({ element }) => stopAttachedAudioElement(element));
      rtcRemoteAudioMapRef.current.clear();
      if (remoteAudioContainerRef.current) {
        remoteAudioContainerRef.current.remove();
        remoteAudioContainerRef.current = null;
      }
    };
  }, []);

  // -------- Hard Teardowns --------
  const hardTeardownLiveKit = useCallback(async (targetRoom?: Room | null) => {
    attachedLkMapRef.current.forEach(({ element }) => stopAttachedAudioElement(element));
    attachedLkMapRef.current.clear();

    const existing = targetRoom ?? lkRoomRef.current;
    if (!targetRoom || lkRoomRef.current === targetRoom) {
      lkRoomRef.current = null;
    }
    if (existing) {
      try {
        await existing.localParticipant.setMicrophoneEnabled(false);
      } catch {
        // ignore if already stopped
      }
      try {
        existing.localParticipant.trackPublications.forEach((pub) => {
          pub.track?.stop();
        });
      } catch {
        // ignore
      }
      try {
        existing.removeAllListeners();
        existing.localParticipant.removeAllListeners();
        await existing.disconnect();
      } catch {
        // ignore disconnect errors
      }
    }
  }, []);

  const stopLocalRtcStream = useCallback(() => {
    if (prewarmCleanupTimerRef.current) {
      clearTimeout(prewarmCleanupTimerRef.current);
      prewarmCleanupTimerRef.current = null;
    }
    prewarmGraceUntilRef.current = 0;
    rtcCapturePromiseRef.current = null;
    const stream = localRtcStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      localRtcStreamRef.current = null;
      setLocalAudioTrackTick((n) => n + 1);
    }
  }, []);

  const closeSingleRtcPeer = useCallback((peerId: string) => {
    const audioEntry = rtcRemoteAudioMapRef.current.get(peerId);
    if (audioEntry) {
      stopAttachedAudioElement(audioEntry.element);
      rtcRemoteAudioMapRef.current.delete(peerId);
    }
    const pc = rtcPeersRef.current.get(peerId);
    if (pc) {
      try {
        pc.ontrack = null;
        pc.onicecandidate = null;
        pc.onconnectionstatechange = null;
        pc.close();
      } catch {
        // ignore
      }
      rtcPeersRef.current.delete(peerId);
    }
    rtcPendingIceRef.current.delete(peerId);
    rtcSignalQueuesRef.current.delete(peerId);
    requestedSpeakersRef.current.delete(peerId);
  }, []);

  const hardTeardownWebRtc = useCallback(() => {
    Array.from(rtcPeersRef.current.keys()).forEach((peerId) => {
      closeSingleRtcPeer(peerId);
    });
    rtcRemoteAudioMapRef.current.forEach(({ element }) => stopAttachedAudioElement(element));
    rtcRemoteAudioMapRef.current.clear();
    rtcSignalQueuesRef.current.clear();
    rtcPendingIceRef.current.clear();
    requestedSpeakersRef.current.clear();
    stopLocalRtcStream();
  }, [closeSingleRtcPeer, stopLocalRtcStream]);

  // -------- WebRTC Helpers --------
  const ensureLocalRtcMicStream = useCallback(
    async (allowPrewarm = false): Promise<MediaStream | null> => {
      const existing = localRtcStreamRef.current;
      if (existing) {
        const liveAudio = existing.getAudioTracks().find((t) => t.readyState === "live");
        if (liveAudio) {
          liveAudio.enabled = !isSelfMutedRef.current && callStatusRef.current === "idle";
          return existing;
        }
      }
      if (rtcCapturePromiseRef.current) {
        return rtcCapturePromiseRef.current;
      }
      if (!isMediaCaptureSupported()) {
        pushNotice(explainMediaAccessError(null, "mic"), { force: 1 });
        return null;
      }

      const capturePromise = requestUserMediaWithFallback({ audio: true, video: false })
        .then((stream) => {
          const canKeep =
            Boolean(currentRoomIdRef.current) &&
            (mySlotNumberRef.current > 0 ||
              shouldPublishLocalRef.current ||
              allowPrewarm ||
              Date.now() < prewarmGraceUntilRef.current);
          if (!canKeep) {
            stream.getTracks().forEach((t) => t.stop());
            return null;
          }
          stream.getAudioTracks().forEach((t) => {
            t.enabled = !isSelfMutedRef.current && callStatusRef.current === "idle";
          });
          localRtcStreamRef.current = stream;
          setLocalAudioTrackTick((n) => n + 1);
          return stream;
        })
        .catch((err) => {
          pushNotice(explainMediaAccessError(err, "mic"), { force: 1 });
          return null;
        })
        .finally(() => {
          rtcCapturePromiseRef.current = null;
        });

      rtcCapturePromiseRef.current = capturePromise;
      return capturePromise;
    },
    [pushNotice],
  );

  const ensureLocalRtcMicStreamRef = useRef(ensureLocalRtcMicStream);
  ensureLocalRtcMicStreamRef.current = ensureLocalRtcMicStream;

  const enqueueRtcPeerSignal = useCallback((peerId: string, job: () => Promise<void>) => {
    const prev = rtcSignalQueuesRef.current.get(peerId) ?? Promise.resolve();
    const next = prev
      .catch(() => undefined)
      .then(job)
      .catch(() => undefined);
    rtcSignalQueuesRef.current.set(peerId, next);
    return next;
  }, []);

  const attachLocalTracksToPeer = useCallback((pc: RTCPeerConnection) => {
    const stream = localRtcStreamRef.current;
    if (!stream || !shouldPublishLocalRef.current) return false;
    const audioTrack = stream.getAudioTracks().find((t) => t.readyState === "live");
    if (!audioTrack) return false;

    let modified = false;

    // 1. Check existing senders to reuse or replace track
    const senders = pc.getSenders();
    const audioSender = senders.find(
      (s) => s.track?.kind === "audio" || (s.track === null && !("dtmf" in s && s.dtmf)),
    );

    if (audioSender) {
      if (audioSender.track !== audioTrack) {
        try {
          void audioSender.replaceTrack(audioTrack);
          modified = true;
        } catch {
          // ignore
        }
      }
    } else {
      try {
        pc.addTrack(audioTrack, stream);
        modified = true;
      } catch {
        // ignore
      }
    }

    // 2. Ensure audio transceiver direction allows sending
    try {
      const transceivers = pc.getTransceivers ? pc.getTransceivers() : [];
      for (const t of transceivers) {
        if (
          t.sender?.track === audioTrack ||
          t.sender?.track?.kind === "audio" ||
          t.receiver?.track?.kind === "audio"
        ) {
          if (t.direction === "recvonly") {
            t.direction = "sendrecv";
            modified = true;
          } else if (t.direction === "inactive") {
            t.direction = "sendonly";
            modified = true;
          }
        }
      }
    } catch {
      // ignore
    }

    return modified;
  }, []);

  const getOrCreateRtcPeer = useCallback(
    (peerId: string, expectedRoomId: string): RTCPeerConnection | null => {
      if (!peerId || peerId === meIdRef.current || !expectedRoomId) return null;
      const existing = rtcPeersRef.current.get(peerId);
      if (
        existing &&
        existing.signalingState !== "closed" &&
        existing.connectionState !== "closed" &&
        existing.connectionState !== "failed"
      ) {
        attachLocalTracksToPeer(existing);
        return existing;
      }
      if (existing) {
        closeSingleRtcPeer(peerId);
      }

      const pc = new RTCPeerConnection({
        iceServers: rtcIceServersRef.current,
      });

      pc.onicecandidate = (event) => {
        if (!event.candidate || currentRoomIdRef.current !== expectedRoomId) return;
        emitMicAction("broadcasting", {
          cmd: "send",
          target: peerId,
          candidate: event.candidate.toJSON(),
        });
      };

      pc.ontrack = (event) => {
        if (currentRoomIdRef.current !== expectedRoomId) return;
        if (!remoteAudioContainerRef.current) return;
        const remoteStream =
          event.streams && event.streams[0]
            ? event.streams[0]
            : new MediaStream([event.track]);

        const prev = rtcRemoteAudioMapRef.current.get(peerId);
        if (prev) {
          stopAttachedAudioElement(prev.element);
          rtcRemoteAudioMapRef.current.delete(peerId);
        }

        const audioEl = document.createElement("audio");
        audioEl.autoplay = true;
        audioEl.setAttribute("playsinline", "true");
        audioEl.setAttribute("webkit-playsinline", "true");
        audioEl.preload = "auto";
        const isMutedNow =
          !audioEnabledRef.current || Boolean(locallyMutedRef.current[peerId]);
        audioEl.muted = isMutedNow;
        audioEl.srcObject = remoteStream;
        remoteAudioContainerRef.current.appendChild(audioEl);

        rtcRemoteAudioMapRef.current.set(peerId, {
          element: audioEl,
          peerId,
          stream: remoteStream,
        });

        if (!isMutedNow) {
          void audioEl.play().catch(() => undefined);
        }

        // On mobile WebKit, play when track receives first RTP packet and un-mutes
        event.track.onunmute = () => {
          if (!audioEl.muted && audioEl.paused) {
            void audioEl.play().catch(() => undefined);
          }
        };

        event.track.onended = () => {
          const cur = rtcRemoteAudioMapRef.current.get(peerId);
          if (cur && cur.element === audioEl) {
            stopAttachedAudioElement(audioEl);
            rtcRemoteAudioMapRef.current.delete(peerId);
          }
        };
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "closed") {
          if (rtcPeersRef.current.get(peerId) === pc) {
            closeSingleRtcPeer(peerId);
          }
        }
      };

      attachLocalTracksToPeer(pc);
      rtcPeersRef.current.set(peerId, pc);
      return pc;
    },
    [attachLocalTracksToPeer, closeSingleRtcPeer, emitMicAction],
  );

  const sendRtcOfferToPeer = useCallback(
    async (peerId: string, expectedRoomId: string) => {
      if (mySlotNumberRef.current <= 0 || !peerId || peerId === meIdRef.current) return;
      if (shouldPublishLocalRef.current && !localRtcStreamRef.current) {
        await ensureLocalRtcMicStream();
      }
      if (currentRoomIdRef.current !== expectedRoomId) return;
      const pc = getOrCreateRtcPeer(peerId, expectedRoomId);
      if (!pc) return;
      attachLocalTracksToPeer(pc);
      if (pc.signalingState !== "stable") return;

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
      });
      await pc.setLocalDescription(offer);
      emitMicAction("broadcasting", {
        cmd: "send",
        target: peerId,
        sdp: pc.localDescription?.toJSON() ?? offer,
      });
    },
    [attachLocalTracksToPeer, emitMicAction, ensureLocalRtcMicStream, getOrCreateRtcPeer],
  );

  // -------- Mode 1: LiveKit SFU Room Connection Lifecycle --------
  useEffect(() => {
    const gen = ++connectGenerationRef.current;
    let cancelled = false;

    const shouldConnectLk = Boolean(
      isLiveKitMode &&
        currentRoomId &&
        activeRoom?.broadcast &&
        me?.id &&
        sessionToken,
    );

    if (!shouldConnectLk) {
      void hardTeardownLiveKit().then(() => {
        if (!cancelled && gen === connectGenerationRef.current) {
          setLkSpeakingIds({});
          setLkStatus("idle");
        }
      });
      return () => {
        cancelled = true;
      };
    }

    hardTeardownWebRtc();

    const connectLiveKit = async () => {
      await hardTeardownLiveKit();
      if (cancelled || gen !== connectGenerationRef.current) return;

      try {
        setLkStatus("connecting");
        const api = getApiClient();
        const res = await api.getLiveKitToken(currentRoomId, sessionToken || undefined);
        if (cancelled || gen !== connectGenerationRef.current) return;

        const wsUrl = String(res.wsUrl || res.url || site?.liveKitWsUrl || "").trim();
        if (!wsUrl || !res.token) {
          setLkStatus("unavailable");
          return;
        }

        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
          audioCaptureDefaults: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        const expectedRoomId = currentRoomId;

        room.on(
          RoomEvent.TrackSubscribed,
          (track: RemoteTrack, pub: RemoteTrackPublication, participant: RemoteParticipant) => {
            if (
              cancelled ||
              gen !== connectGenerationRef.current ||
              currentRoomIdRef.current !== expectedRoomId
            ) {
              try {
                track.detach().forEach((el) => el.remove());
              } catch {
                // ignore
              }
              return;
            }
            if (track.kind !== Track.Kind.Audio || !remoteAudioContainerRef.current) return;

            const prevEntry = attachedLkMapRef.current.get(pub.trackSid);
            if (prevEntry) {
              stopAttachedAudioElement(prevEntry.element);
              attachedLkMapRef.current.delete(pub.trackSid);
            }

            const audioEl = track.attach();
            const isMutedNow =
              !audioEnabledRef.current || Boolean(locallyMutedRef.current[participant.identity]);
            audioEl.autoplay = true;
            audioEl.setAttribute("playsinline", "true");
            audioEl.muted = isMutedNow;
            try {
              pub.setEnabled(!isMutedNow);
            } catch {
              // ignore
            }
            remoteAudioContainerRef.current.appendChild(audioEl);
            attachedLkMapRef.current.set(pub.trackSid, {
              element: audioEl,
              identity: participant.identity,
              publication: pub,
            });
            if (!isMutedNow) {
              void audioEl.play().catch(() => undefined);
            }
          },
        );

        room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, pub: RemoteTrackPublication) => {
          const entry = attachedLkMapRef.current.get(pub.trackSid);
          if (entry) {
            stopAttachedAudioElement(entry.element);
            attachedLkMapRef.current.delete(pub.trackSid);
          }
          track.detach().forEach((el) => {
            if (el instanceof HTMLAudioElement) stopAttachedAudioElement(el);
            else el.remove();
          });
        });

        room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
          if (
            cancelled ||
            gen !== connectGenerationRef.current ||
            currentRoomIdRef.current !== expectedRoomId
          ) {
            return;
          }
          const nextMap: Record<string, boolean> = {};
          for (const p of speakers) {
            if (p.identity) nextMap[p.identity] = true;
          }
          setLkSpeakingIds(nextMap);
        });

        room.localParticipant.on(ParticipantEvent.ParticipantPermissionsChanged, () => {
          if (cancelled || gen !== connectGenerationRef.current) return;
          const canPublish = Boolean(room.localParticipant.permissions?.canPublish);
          const shouldPublish =
            mySlotNumberRef.current > 0 &&
            !isSelfMutedRef.current &&
            callStatusRef.current === "idle" &&
            canPublish;
          void room.localParticipant
            .setMicrophoneEnabled(shouldPublish)
            .then(() => setLocalAudioTrackTick((n) => n + 1))
            .catch(() => undefined);
        });

        room.on(RoomEvent.LocalTrackPublished, (_pub: LocalTrackPublication) => {
          setLocalAudioTrackTick((n) => n + 1);
        });

        room.on(RoomEvent.LocalTrackUnpublished, () => {
          setLocalAudioTrackTick((n) => n + 1);
        });

        room.on(RoomEvent.Disconnected, () => {
          attachedLkMapRef.current.forEach(({ element }) => stopAttachedAudioElement(element));
          attachedLkMapRef.current.clear();
          if (!cancelled && gen === connectGenerationRef.current) {
            setLkSpeakingIds({});
            setLkStatus("idle");
          }
        });

        await room.connect(wsUrl, res.token);
        if (
          cancelled ||
          gen !== connectGenerationRef.current ||
          currentRoomIdRef.current !== expectedRoomId
        ) {
          await hardTeardownLiveKit(room);
          return;
        }

        lkRoomRef.current = room;
        setLkStatus("connected");
      } catch {
        if (!cancelled && gen === connectGenerationRef.current) {
          setLkStatus("unavailable");
        }
      }
    };

    void connectLiveKit();

    return () => {
      cancelled = true;
      void hardTeardownLiveKit();
    };
  }, [
    isLiveKitMode,
    currentRoomId,
    activeRoom?.broadcast,
    me?.id,
    sessionToken,
    getApiClient,
    site?.liveKitWsUrl,
    hardTeardownLiveKit,
    hardTeardownWebRtc,
  ]);

  // Publish or hard-stop LiveKit local mic track
  useEffect(() => {
    const room = lkRoomRef.current;
    if (!room || !isLiveKitMode || lkStatus !== "connected") return;
    const hasPublishGrant = Boolean(room.localParticipant.permissions?.canPublish);
    const shouldPublish =
      mySlotNumber > 0 &&
      !isSelfMuted &&
      callState.status === "idle" &&
      hasPublishGrant;

    void room.localParticipant
      .setMicrophoneEnabled(shouldPublish)
      .then(() => {
        if (!shouldPublish) {
          room.localParticipant.trackPublications.forEach((pub) => {
            if (pub.source === Track.Source.Microphone) {
              pub.track?.stop();
            }
          });
        }
        setLocalAudioTrackTick((n) => n + 1);
      })
      .catch(() => undefined);
  }, [isLiveKitMode, mySlotNumber, isSelfMuted, lkStatus, callState.status]);

  // -------- Mode 2: WebRTC P2P / STUN Stage Lifecycle --------
  useEffect(() => {
    const shouldRunWebRtc = Boolean(
      isWebRtcMode &&
        currentRoomId &&
        activeRoom?.broadcast &&
        me?.id,
    );

    if (!shouldRunWebRtc) {
      hardTeardownWebRtc();
      setRtcStatus("idle");
      return;
    }

    const expectedRoomId = currentRoomId;
    setRtcStatus("connected");

    const unsubscribe = subscribeStageSignals((payload) => {
      if (currentRoomIdRef.current !== expectedRoomId) return;
      const bCmd = String(payload.cmd || "");

      if (bCmd === "rleave") {
        const leftId = String(payload.user || "");
        if (leftId) closeSingleRtcPeer(leftId);
        return;
      }

      if (bCmd === "listener-ready") {
        const listenerId = String(payload.user || "");
        if (!listenerId || listenerId === meIdRef.current) return;
        if (mySlotNumberRef.current <= 0) return;

        const listenerIsAlsoSpeaker = activeSpeakerIdsRef.current.includes(listenerId);
        if (listenerIsAlsoSpeaker && meIdRef.current && meIdRef.current > listenerId) {
          // Deterministic tie-breaker: smaller socket ID initiates offer between two speakers
          return;
        }

        void enqueueRtcPeerSignal(listenerId, async () => {
          await sendRtcOfferToPeer(listenerId, expectedRoomId);
        });
        return;
      }

      if (bCmd === "send") {
        const senderId = String(payload.user || "");
        if (!senderId || senderId === meIdRef.current) return;
        const rawSdp = payload.sdp as RTCSessionDescriptionInit | undefined;
        const rawCandidate = payload.candidate as RTCIceCandidateInit | undefined;

        void enqueueRtcPeerSignal(senderId, async () => {
          if (currentRoomIdRef.current !== expectedRoomId) return;
          if (rawSdp && rawSdp.type) {
            if (rawSdp.type === "offer" && mySlotNumberRef.current > 0 && !localRtcStreamRef.current && shouldPublishLocalRef.current) {
              await ensureLocalRtcMicStream();
            }
            const pc = getOrCreateRtcPeer(senderId, expectedRoomId);
            if (!pc) return;

            if (rawSdp.type === "offer") {
              if (pc.signalingState !== "stable") {
                if (meIdRef.current < senderId) {
                  // Polite/tie-breaker ignore collision; our offer wins
                  return;
                }
                await pc.setLocalDescription({ type: "rollback" }).catch(() => undefined);
              }
              await pc.setRemoteDescription(new RTCSessionDescription(rawSdp));
              const queued = rtcPendingIceRef.current.get(senderId) ?? [];
              rtcPendingIceRef.current.delete(senderId);
              for (const ice of queued) {
                await pc.addIceCandidate(new RTCIceCandidate(ice)).catch(() => undefined);
              }
              attachLocalTracksToPeer(pc);
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              emitMicAction("broadcasting", {
                cmd: "send",
                target: senderId,
                sdp: pc.localDescription?.toJSON() ?? answer,
              });
            } else if (rawSdp.type === "answer") {
              if (pc.signalingState === "have-local-offer") {
                await pc.setRemoteDescription(new RTCSessionDescription(rawSdp));
                const queued = rtcPendingIceRef.current.get(senderId) ?? [];
                rtcPendingIceRef.current.delete(senderId);
                for (const ice of queued) {
                  await pc.addIceCandidate(new RTCIceCandidate(ice)).catch(() => undefined);
                }
              }
            }
            return;
          }

          if (rawCandidate) {
            const pc = getOrCreateRtcPeer(senderId, expectedRoomId);
            if (!pc) return;
            if (pc.remoteDescription && pc.remoteDescription.type) {
              await pc.addIceCandidate(new RTCIceCandidate(rawCandidate)).catch(() => undefined);
            } else {
              const queue = rtcPendingIceRef.current.get(senderId) ?? [];
              queue.push(rawCandidate);
              rtcPendingIceRef.current.set(senderId, queue);
            }
          }
        });
      }
    });

    return () => {
      unsubscribe();
      hardTeardownWebRtc();
      setRtcStatus("idle");
    };
  }, [
    isWebRtcMode,
    currentRoomId,
    activeRoom?.broadcast,
    me?.id,
    attachLocalTracksToPeer,
    closeSingleRtcPeer,
    emitMicAction,
    enqueueRtcPeerSignal,
    ensureLocalRtcMicStream,
    getOrCreateRtcPeer,
    hardTeardownWebRtc,
    sendRtcOfferToPeer,
  ]);

  // WebRTC speaker local mic lifecycle + speaker/listener negotiation synchronization
  useEffect(() => {
    if (!isWebRtcMode || !currentRoomId || !activeRoom?.broadcast || !me?.id) {
      return;
    }

    let cancelled = false;
    const expectedRoomId = currentRoomId;

    const syncWebRtcParticipants = async () => {
      if (mySlotNumber > 0) {
        if (prewarmCleanupTimerRef.current) {
          clearTimeout(prewarmCleanupTimerRef.current);
          prewarmCleanupTimerRef.current = null;
        }
        prewarmGraceUntilRef.current = 0;
        if (shouldPublishLocal) {
          const stream = await ensureLocalRtcMicStream();
          if (cancelled || currentRoomIdRef.current !== expectedRoomId) return;
          if (stream) {
            rtcPeersRef.current.forEach((pc, peerId) => {
              const added = attachLocalTracksToPeer(pc);
              if (added && pc.signalingState === "stable") {
                void enqueueRtcPeerSignal(peerId, async () => {
                  await sendRtcOfferToPeer(peerId, expectedRoomId);
                });
              }
            });
          }
        } else if (localRtcStreamRef.current) {
          localRtcStreamRef.current.getAudioTracks().forEach((t) => {
            t.enabled = false;
          });
        }

        // Notify existing listeners & stage peers that we are seated and ready
        emitMicAction("broadcasting", { cmd: "listener-ready", roomid: expectedRoomId });
      } else if (Date.now() > prewarmGraceUntilRef.current) {
        stopLocalRtcStream();
      }

      // Clean up stale peers that are neither seated speakers (for listener) nor connected while seated
      const speakerSet = new Set(activeSpeakerIds);
      rtcPeersRef.current.forEach((_pc, peerId) => {
        if (!speakerSet.has(peerId) && mySlotNumber <= 0) {
          closeSingleRtcPeer(peerId);
        }
      });

      // Request audio offers from every active stage speaker (besides self)
      for (const speakerId of activeSpeakerIds) {
        if (!speakerId || speakerId === me.id) continue;
        const alreadyHasPeer = rtcPeersRef.current.has(speakerId);
        const alreadyHasAudio = rtcRemoteAudioMapRef.current.has(speakerId);
        if (mySlotNumber > 0 && me.id < speakerId) {
          // Wait or initiate deterministically
          if (!alreadyHasPeer) {
            void enqueueRtcPeerSignal(speakerId, async () => {
              await sendRtcOfferToPeer(speakerId, expectedRoomId);
            });
          }
        } else if (!alreadyHasAudio || !alreadyHasPeer) {
          if (!requestedSpeakersRef.current.has(speakerId)) {
            requestedSpeakersRef.current.add(speakerId);
            emitMicAction("broadcasting", {
              cmd: "listener-ready",
              target: speakerId,
              roomid: expectedRoomId,
            });
          }
        }
      }

      // Drop request flags for speakers who left
      Array.from(requestedSpeakersRef.current).forEach((id) => {
        if (!speakerSet.has(id)) requestedSpeakersRef.current.delete(id);
      });
    };

    void syncWebRtcParticipants();
    return () => {
      cancelled = true;
    };
  }, [
    isWebRtcMode,
    currentRoomId,
    activeRoom?.broadcast,
    me?.id,
    mySlotNumber,
    shouldPublishLocal,
    activeSpeakerIds,
    attachLocalTracksToPeer,
    closeSingleRtcPeer,
    emitMicAction,
    enqueueRtcPeerSignal,
    ensureLocalRtcMicStream,
    sendRtcOfferToPeer,
    stopLocalRtcStream,
  ]);

  // -------- Mode 3 Cleanup Guard for Jitsi --------
  useEffect(() => {
    if (!isJitsiMode) return;
    hardTeardownWebRtc();
    void hardTeardownLiveKit();
  }, [isJitsiMode, hardTeardownLiveKit, hardTeardownWebRtc]);

  // -------- Shared High-Precision Speaking VAD (WebRTC & LiveKit) --------
  useEffect(() => {
    const myId = me?.id || "";
    const activeMediaTrack = isWebRtcMode
      ? localRtcStreamRef.current?.getAudioTracks()[0]
      : isLiveKitMode && lkStatus === "connected"
        ? lkRoomRef.current?.localParticipant.getTrackPublication(Track.Source.Microphone)?.audioTrack?.mediaStreamTrack
        : undefined;

    if (
      !myId ||
      mySlotNumber <= 0 ||
      isSelfMuted ||
      isJitsiMode ||
      callState.status !== "idle" ||
      !activeMediaTrack ||
      activeMediaTrack.readyState !== "live"
    ) {
      if (myId) {
        setUserSpeakingLocal(myId, false);
      }
      if (mySlotNumber > 0) {
        emitMicAction("broadcasting", { cmd: "speaking", speaking: false });
      }
      return;
    }

    let cancelled = false;
    let audioCtx: AudioContext | null = null;
    let rafId = 0;
    let lastSpeaking = false;
    let lastSoundAt = 0;
    let lastEmitAt = 0;

    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;

      const stream = new MediaStream([activeMediaTrack]);
      audioCtx = new Ctx();
      if (audioCtx.state === "suspended") {
        void audioCtx.resume().catch(() => undefined);
      }
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.45;
      source.connect(analyser);

      const timeData = new Float32Array(analyser.fftSize);
      const freqData = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        if (cancelled || activeMediaTrack.readyState !== "live") return;
        if (audioCtx && audioCtx.state === "suspended" && audioUnlockedRef.current) {
          void audioCtx.resume().catch(() => undefined);
        }

        analyser.getFloatTimeDomainData(timeData);
        analyser.getByteFrequencyData(freqData);
        const now = Date.now();
        const detectedVoice = resolveVadSpeaking(timeData, freqData);
        if (detectedVoice) {
          lastSoundAt = now;
        }
        const heldSpeaking = detectedVoice || (lastSpeaking && now - lastSoundAt < VAD_RELEASE_HOLD_MS);

        if (heldSpeaking !== lastSpeaking && now - lastEmitAt >= VAD_MIN_EMIT_GAP_MS) {
          lastSpeaking = heldSpeaking;
          lastEmitAt = now;
          setUserSpeakingLocal(myId, heldSpeaking);
          emitMicAction("broadcasting", { cmd: "speaking", speaking: heldSpeaking });
        }
        rafId = window.requestAnimationFrame(tick);
      };
      rafId = window.requestAnimationFrame(tick);
    } catch {
      // Ignore WebAudio restriction gracefully
    }

    return () => {
      cancelled = true;
      if (rafId) window.cancelAnimationFrame(rafId);
      setUserSpeakingLocal(myId, false);
      if (lastSpeaking) {
        emitMicAction("broadcasting", { cmd: "speaking", speaking: false });
      }
      if (audioCtx) void audioCtx.close().catch(() => undefined);
    };
  }, [
    me?.id,
    mySlotNumber,
    isSelfMuted,
    isWebRtcMode,
    isLiveKitMode,
    isJitsiMode,
    lkStatus,
    callState.status,
    localAudioTrackTick,
    emitMicAction,
    setUserSpeakingLocal,
  ]);

  const toggleLocalMuteUser = useCallback((socketId: string) => {
    if (!socketId) return;
    setLocallyMutedUsers((prev) => ({
      ...prev,
      [socketId]: !prev[socketId],
    }));
  }, []);

  const takeSlot = useCallback(
    (slotNumber: number) => {
      audioUnlockedRef.current = true;
      unlockBrowserAudioContext();

      if (callState.status !== "idle") {
        pushNotice("لا يمكنك الصعود على المايك أثناء وجودك في مكالمة خاصة", { force: 1 });
        return;
      }
      if (me?.muted) {
        pushNotice("تم منعك من الحديث في الدردشة", { force: 1 });
        return;
      }

      // Preserve transient user-activation gesture on iOS Safari & mobile Chrome
      // so the native microphone permission dialog pops immediately on tap.
      if (isWebRtcMode) {
        if (!isMediaCaptureSupported()) {
          pushNotice(explainMediaAccessError(null, "mic"), { force: 1 });
        } else {
          prewarmGraceUntilRef.current = Date.now() + 60_000;
          if (prewarmCleanupTimerRef.current) {
            clearTimeout(prewarmCleanupTimerRef.current);
          }
          prewarmCleanupTimerRef.current = setTimeout(() => {
            prewarmCleanupTimerRef.current = null;
            if (mySlotNumberRef.current <= 0) {
              stopLocalRtcStream();
            }
          }, 60_000);
          void ensureLocalRtcMicStream(true);
        }
      } else if (!isJitsiMode && !isMediaCaptureSupported()) {
        pushNotice(explainMediaAccessError(null, "mic"), { force: 1 });
      }

      emitMicAction("broadcasting", { cmd: "new", it: slotNumber });
    },
    [
      callState.status,
      me?.muted,
      isWebRtcMode,
      isJitsiMode,
      emitMicAction,
      ensureLocalRtcMicStream,
      stopLocalRtcStream,
      pushNotice,
    ],
  );

  const leaveSlot = useCallback(() => {
    if (!me?.id) return;
    stopLocalRtcStream();
    setUserSpeakingLocal(me.id, false);
    emitMicAction("broadcasting", { cmd: "speaking", speaking: false });
    emitMicAction("remic", { id: me.id });
  }, [me?.id, emitMicAction, setUserSpeakingLocal, stopLocalRtcStream]);

  const toggleSelfMute = useCallback(() => {
    if (!me?.id) return;
    audioUnlockedRef.current = true;
    unlockBrowserAudioContext();
    const nextMuted = !isSelfMuted;
    if (nextMuted) {
      setUserSpeakingLocal(me.id, false);
      emitMicAction("broadcasting", { cmd: "speaking", speaking: false });
    } else if (isWebRtcMode) {
      void ensureLocalRtcMicStream(true);
    }
    emitMicAction("broadcasting", {
      cmd: "mic-state",
      user: me.id,
      muted: nextMuted,
    });
  }, [
    me?.id,
    isSelfMuted,
    isWebRtcMode,
    emitMicAction,
    ensureLocalRtcMicStream,
    setUserSpeakingLocal,
  ]);

  const toggleUserMute = useCallback(
    (socketId: string, nextMuted?: boolean) => {
      emitMicAction("broadcasting", {
        cmd: "mic-state",
        user: socketId,
        ...(nextMuted !== undefined ? { muted: nextMuted } : {}),
      });
    },
    [emitMicAction],
  );

  const toggleSlotLock = useCallback(
    (slotNumber: number, lock: boolean) => {
      emitMicAction("broadcasting", {
        cmd: lock ? "lock-slot" : "unlock-slot",
        it: slotNumber,
        ev: lock ? 1 : 0,
      });
    },
    [emitMicAction],
  );

  const kickFromStage = useCallback(
    (socketId: string) => {
      emitMicAction("remic", { id: socketId });
    },
    [emitMicAction],
  );

  const lockAllEmpty = useCallback(() => {
    emitMicAction("broadcasting", { cmd: "lock-all-empty" });
  }, [emitMicAction]);

  const unlockAll = useCallback(() => {
    emitMicAction("broadcasting", { cmd: "unlock-all" });
  }, [emitMicAction]);

  const requestSlot = useCallback((slotNumber = 0) => {
    emitMicAction("broadcasting", { cmd: "stage-request", slot: slotNumber });
  }, [emitMicAction]);

  const cancelSlotRequest = useCallback(() => {
    emitMicAction("broadcasting", { cmd: "stage-request-cancel" });
  }, [emitMicAction]);

  const approveSlotRequest = useCallback((targetSocketId: string, slotNumber = 0) => {
    emitMicAction("broadcasting", { cmd: "stage-request-approve", target: targetSocketId, slot: slotNumber });
  }, [emitMicAction]);

  const rejectSlotRequest = useCallback((targetSocketId: string) => {
    emitMicAction("broadcasting", { cmd: "stage-request-reject", target: targetSocketId });
  }, [emitMicAction]);

  const inviteToSlot = useCallback((targetSocketId: string, slotNumber = 0) => {
    emitMicAction("broadcasting", { cmd: "stage-invite", target: targetSocketId, slot: slotNumber });
  }, [emitMicAction]);

  const sendSoundFx = useCallback((soundName: string) => {
    emitMicAction("broadcasting", { cmd: "sound-fx", sound: soundName });
  }, [emitMicAction]);

  const jitsiEmbedUrl = useMemo(() => {
    if (!isJitsiMode || !currentRoomId || !audioEnabled) return "";
    const roomSlug = encodeURIComponent(`newchat-${currentRoomId}`);
    const displayName = encodeURIComponent(me?.topic || "Guest");
    const startMuted = mySlotNumber > 0 && !isSelfMuted ? "false" : "true";
    return `https://meet.jit.si/${roomSlug}#config.prejoinPageEnabled=false&config.startWithAudioMuted=${startMuted}&config.startWithVideoMuted=true&userInfo.displayName="${displayName}"`;
  }, [isJitsiMode, currentRoomId, audioEnabled, me?.topic, mySlotNumber, isSelfMuted]);

  const stageStatus: "idle" | "connecting" | "connected" | "unavailable" = isWebRtcMode
    ? rtcStatus
    : isJitsiMode
      ? currentRoomId && activeRoom?.broadcast
        ? "connected"
        : "idle"
      : lkStatus;

  return {
    micProvider,
    micCount,
    slots,
    mySlotNumber,
    isSelfMuted,
    isWebRtcMode,
    isJitsiMode,
    jitsiEmbedUrl,
    lkStatus: stageStatus,
    stageStatus,
    audioEnabled,
    setAudioEnabled,
    locallyMutedUsers,
    toggleLocalMuteUser,
    takeSlot,
    leaveSlot,
    toggleSelfMute,
    toggleUserMute,
    toggleSlotLock,
    kickFromStage,
    lockAllEmpty,
    unlockAll,
    requestSlot,
    cancelSlotRequest,
    approveSlotRequest,
    rejectSlotRequest,
    inviteToSlot,
    sendSoundFx,
  };
}
