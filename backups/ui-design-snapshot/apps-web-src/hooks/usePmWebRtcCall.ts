import { useCallback, useEffect, useRef, useState } from "react";
import { useChatStore } from "@newchat/core-client";
import { DEFAULT_RTC_ICE_SERVERS } from "@newchat/shared";
import {
  clearStashedCallMediaStream,
  consumeCallMediaStream,
  explainMediaAccessError,
  requestUserMediaWithFallback,
} from "../lib/mediaPermissions.js";

export interface UsePmWebRtcCallResult {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  micMuted: boolean;
  cameraOff: boolean;
  mediaError: string | null;
  toggleMic: () => void;
  toggleCamera: () => void;
}

export function usePmWebRtcCall(): UsePmWebRtcCallResult {
  const callState = useChatStore((s) => s.callState);
  const lastCallSignal = useChatStore((s) => s.lastCallSignal);
  const site = useChatStore((s) => s.site);
  const sendCallSignal = useChatStore((s) => s.sendCallSignal);
  const endCall = useChatStore((s) => s.endCall);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const offerSentRef = useRef(false);

  const cleanupMedia = useCallback(() => {
    offerSentRef.current = false;
    pendingCandidatesRef.current = [];
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch {
        // ignore close error
      }
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    setMicMuted(false);
    setCameraOff(false);
    setMediaError(null);
  }, []);

  // Setup WebRTC PeerConnection once call becomes active
  useEffect(() => {
    if (callState.status === "idle") {
      clearStashedCallMediaStream();
      cleanupMedia();
      return;
    }
    if (callState.status !== "active" || !callState.peerId) {
      cleanupMedia();
      return;
    }

    let cancelled = false;
    const startPeerConnection = async () => {
      try {
        setMediaError(null);
        const preCaptured = consumeCallMediaStream(callState.callType);
        const stream =
          preCaptured ||
          (await requestUserMediaWithFallback({
            audio: true,
            video: callState.callType === "video",
          }));
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        setLocalStream(stream);

        const iceServers =
          Array.isArray(site?.rtcIceServers) && site.rtcIceServers.length > 0
            ? site.rtcIceServers
            : [...DEFAULT_RTC_ICE_SERVERS];

        const pc = new RTCPeerConnection({ iceServers: iceServers as RTCIceServer[] });
        pcRef.current = pc;

        const inbound = new MediaStream();
        setRemoteStream(inbound);

        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        pc.ontrack = (event) => {
          if (event.streams && event.streams[0]) {
            setRemoteStream(event.streams[0]);
          } else if (event.track) {
            inbound.addTrack(event.track);
          }
        };

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            sendCallSignal({
              kind: "candidate",
              callId: callState.callId,
              candidate: event.candidate.toJSON(),
            });
          }
        };

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === "failed" || pc.connectionState === "closed") {
            endCall("connection_closed");
          }
        };

        if (callState.isCaller && !offerSentRef.current) {
          offerSentRef.current = true;
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendCallSignal({
            kind: "offer",
            callId: callState.callId,
            sdp: offer,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setMediaError(
            explainMediaAccessError(err, callState.callType === "video" ? "both" : "mic"),
          );
        }
      }
    };

    void startPeerConnection();

    return () => {
      cancelled = true;
      cleanupMedia();
    };
  }, [callState.status, callState.peerId, callState.callType, callState.isCaller, callState.callId, site?.rtcIceServers, sendCallSignal, endCall, cleanupMedia]);

  // Process inbound signaling packets (offer / answer / candidate)
  useEffect(() => {
    const pc = pcRef.current;
    if (!pc || !lastCallSignal || callState.status !== "active") return;
    const fromId = String(lastCallSignal.from || lastCallSignal.id || "");
    if (fromId && fromId !== callState.peerId) return;

    const kind = String(lastCallSignal.kind || lastCallSignal.type || "");
    const processSignal = async () => {
      try {
        if (kind === "offer" || lastCallSignal.offer) {
          const sdp = (lastCallSignal.sdp || lastCallSignal.offer) as RTCSessionDescriptionInit;
          if (!sdp) return;
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          for (const cand of pendingCandidatesRef.current) {
            await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => undefined);
          }
          pendingCandidatesRef.current = [];
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendCallSignal({
            kind: "answer",
            callId: callState.callId,
            sdp: answer,
          });
        } else if (kind === "answer" || lastCallSignal.answer) {
          const sdp = (lastCallSignal.sdp || lastCallSignal.answer) as RTCSessionDescriptionInit;
          if (!sdp) return;
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          for (const cand of pendingCandidatesRef.current) {
            await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => undefined);
          }
          pendingCandidatesRef.current = [];
        } else if (kind === "candidate" || lastCallSignal.candidate) {
          const candidate = lastCallSignal.candidate as RTCIceCandidateInit | undefined;
          if (!candidate) return;
          if (pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => undefined);
          } else {
            pendingCandidatesRef.current.push(candidate);
          }
        }
      } catch {
        // Ignore stale signaling frames safely
      }
    };

    void processSignal();
  }, [lastCallSignal, callState.status, callState.peerId, callState.callId, sendCallSignal]);

  const toggleMic = useCallback(() => {
    const tracks = localStreamRef.current?.getAudioTracks() ?? [];
    if (!tracks.length) return;
    const nextMuted = !micMuted;
    tracks.forEach((t) => {
      t.enabled = !nextMuted;
    });
    setMicMuted(nextMuted);
  }, [micMuted]);

  const toggleCamera = useCallback(() => {
    const tracks = localStreamRef.current?.getVideoTracks() ?? [];
    if (!tracks.length) return;
    const nextOff = !cameraOff;
    tracks.forEach((t) => {
      t.enabled = !nextOff;
    });
    setCameraOff(nextOff);
  }, [cameraOff]);

  return {
    localStream,
    remoteStream,
    micMuted,
    cameraOff,
    mediaError,
    toggleMic,
    toggleCamera,
  };
}
