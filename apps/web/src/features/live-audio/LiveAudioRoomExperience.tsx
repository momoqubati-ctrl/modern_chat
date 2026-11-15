import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
  type TouchEvent,
} from "react";
import {
  Award,
  ChevronDown,
  Compass,
  Crown,
  DoorOpen,
  Flame,
  Gift,
  Heart,
  Lock,
  MessageSquare,
  Mic,
  MicOff,
  MoreVertical,
  Music,
  Plus,
  Radio,
  Send,
  Settings2,
  Share2,
  Shield,
  Smile,
  Sparkles,
  Unlock,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { subscribeStageSignals, useChatStore } from "@newchat/core-client";
import type {
  LiveRoomConfig,
  LiveRoomGiftGoal,
  OnlineUserSnapshot,
  RoomMessagePayload,
} from "@newchat/shared";
import { useMicStageAudio } from "../../hooks/useMicStageAudio.js";
import { normalizeHexColor, resolveAssetUrl } from "../../lib/mediaUrl.js";
import { canUseRoomManagement } from "../../lib/permissions.js";
import { GiftPickerModal } from "../../components/GiftPickerModal.js";
import { UserProfileModal } from "../../components/UserProfileModal.js";
import { VerifiedBadge, isUserVerified } from "../../components/VerifiedBadge.js";
import type { StageRequestItem } from "./types.js";

interface LiveAudioRoomExperienceProps {
  dark: boolean;
  onMinimize: () => void;
  onClose: () => void;
  onSelectUser?: (user: OnlineUserSnapshot) => void;
  onOpenWallet?: () => void;
  onOpenMail?: () => void;
}

export function LiveAudioRoomExperience({
  dark,
  onMinimize,
  onClose,
  onSelectUser,
  onOpenWallet,
  onOpenMail,
}: LiveAudioRoomExperienceProps) {
  const me = useChatStore((s) => s.me);
  const powers = useChatStore((s) => s.powers);
  const currentRoomId = useChatStore((s) => s.currentRoomId);
  const rooms = useChatStore((s) => s.rooms);
  const roomsCounts = useChatStore((s) => s.roomsCounts);
  const onlineMap = useChatStore((s) => s.onlineMap);
  const listenersCount = useChatStore((s) => s.listenersCount);
  const messages = useChatStore((s) => s.messages);
  const sendRoomMessage = useChatStore((s) => s.sendRoomMessage);
  const sendGift = useChatStore((s) => s.sendGift);
  const updateLiveSettings = useChatStore((s) => s.updateLiveSettings);
  const emitMicAction = useChatStore((s) => s.emitMicAction);
  const pushNotice = useChatStore((s) => s.pushNotice);
  const followUser = useChatStore((s) => s.followUser);
  const unfollowUser = useChatStore((s) => s.unfollowUser);
  const getFollowInfo = useChatStore((s) => s.getFollowInfo);
  const followInfoMap = useChatStore((s) => s.followInfoMap);
  const lastGiftFx = useChatStore((s) => s.lastGiftFx);
  const gifts = useChatStore((s) => s.gifts);
  const deleteRoom = useChatStore((s) => s.deleteRoom);
  const joinRoom = useChatStore((s) => s.joinRoom);
  const site = useChatStore((s) => s.site);

  const activeRoom = useMemo(
    () => rooms.find((r) => r.id === currentRoomId) ?? null,
    [rooms, currentRoomId],
  );

  const brandAccent = useMemo(() => {
    return normalizeHexColor(site?.colors?.hicolor, "#0284c7");
  }, [site?.colors?.hicolor]);

  const brandButton = useMemo(() => {
    return normalizeHexColor(site?.colors?.btcolor, "#0369a1");
  }, [site?.colors?.btcolor]);

  const roomCustomColor = useMemo(() => {
    return activeRoom?.color ? normalizeHexColor(activeRoom.color, "") : "";
  }, [activeRoom?.color]);

  const {
    micCount,
    slots,
    mySlotNumber,
    isSelfMuted,
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
  } = useMicStageAudio();

  // Local state
  const [chatDraft, setChatDraft] = useState("");
  const [heartsCount, setHeartsCount] = useState<number>(() => {
    const liveLikes = Number((activeRoom?.room_owner_meta as any)?.live_config?.likes_count);
    return !Number.isNaN(liveLikes) && liveLikes > 0 ? liveLikes : 0;
  });
  const [floatingHearts, setFloatingHearts] = useState<
    Array<{ id: number; x: number; y: number; icon: string; scale: number; rot: number }>
  >([]);
  const [comboCount, setComboCount] = useState(0);
  const [selectedSeatForSheet, setSelectedSeatForSheet] = useState<number | null>(null);
  const [multiGuestOpen, setMultiGuestOpen] = useState(false);
  const [giftPickerOpen, setGiftPickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileModalUser, setProfileModalUser] = useState<OnlineUserSnapshot | null>(null);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [endLiveConfirmOpen, setEndLiveConfirmOpen] = useState(false);
  const [endLiveSummaryOpen, setEndLiveSummaryOpen] = useState(false);
  const [audienceModalOpen, setAudienceModalOpen] = useState(false);
  const [exploreModalOpen, setExploreModalOpen] = useState(false);
  const [liveDurationSec, setLiveDurationSec] = useState(0);
  const [peakListeners, setPeakListeners] = useState(() => Number(listenersCount || 0));

  // Dynamic Gifts Goal & Real Supporters tracking
  const [currentGiftsCount, setCurrentGiftsCount] = useState<number>(() => {
    const rawGoal = (activeRoom?.room_owner_meta as any)?.live_config?.gift_goal;
    return Number(rawGoal?.currentCount ?? 0);
  });
  const [supportersMap, setSupportersMap] = useState<
    Record<string, { user: OnlineUserSnapshot; totalCoins: number; likesCount: number; score: number }>
  >({});
  const [supportersModalOpen, setSupportersModalOpen] = useState(false);

  // Live requests from listeners
  const [pendingRequests, setPendingRequests] = useState<StageRequestItem[]>([]);
  const [hasRequestedMic, setHasRequestedMic] = useState(false);

  // Sound effects local feedback
  const [activeFxName, setActiveFxName] = useState<string | null>(null);

  // Chat scroll anchor
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const autoSeatedRef = useRef(false);
  const lastTapRef = useRef<number>(0);

  const isHost = useMemo(() => {
    if (!activeRoom || !me) return false;
    const myReg = me.idreg ? String(me.idreg).replace(/^#/, "") : "";
    const rOwner = String(activeRoom.owner || "").replace(/^#/, "");
    const roomUser = (activeRoom as any)?.user;
    return Boolean(
      (me.username && activeRoom.owner?.toLowerCase() === me.username.toLowerCase()) ||
        (myReg && myReg === rOwner) ||
        (roomUser && me.topic && roomUser === me.topic),
    );
  }, [activeRoom, me]);

  const isStaff = useMemo(() => {
    return isHost || canUseRoomManagement(me, powers);
  }, [isHost, me, powers]);

  const liveConfig = useMemo<LiveRoomConfig>(() => {
    const raw = (activeRoom?.room_owner_meta as any)?.live_config;
    return raw && typeof raw === "object"
      ? raw
      : {
          is_live_audio: true,
          join_mode: "free",
          chat_locked: false,
          gift_goal: {
            giftId: "rose_standard",
            giftFile: "rose.png",
            giftName: "وردة",
            giftIcon: "🌹",
            giftCoin: 1,
            targetCount: 100,
            currentCount: 0,
          },
          hourly_rank: "🔥 ترتيب كل ساعة",
        };
  }, [activeRoom?.room_owner_meta]);

  // Dynamically resolve target goal gift from catalog or fall back to standard 1-coin gift
  const goalGift = useMemo(() => {
    if (!gifts || gifts.length === 0) return null;
    const gg = liveConfig.gift_goal;
    if (gg) {
      if (gg.giftFile) {
        const found = gifts.find((g) => g.file === gg.giftFile);
        if (found) return found;
      }
      if (gg.giftId) {
        const found = gifts.find((g) => g.id === gg.giftId);
        if (found) return found;
      }
      if (gg.giftName) {
        const found = gifts.find((g) => g.name === gg.giftName);
        if (found) return found;
      }
    }
    return (
      gifts.find((g) => g.file === "rose.png" || g.name === "وردة" || g.coin === 1) ||
      gifts[0] ||
      null
    );
  }, [gifts, liveConfig.gift_goal]);

  // Host occupant info
  const hostUser = useMemo(() => {
    if (!activeRoom) return null;
    const rOwner = String(activeRoom.owner || "").replace(/^#/, "");
    for (const u of Object.values(onlineMap)) {
      if (u) {
        const uReg = u.idreg ? String(u.idreg).replace(/^#/, "") : "";
        const roomUser = (activeRoom as any)?.user;
        if (
          (activeRoom.owner && u.username?.toLowerCase() === activeRoom.owner.toLowerCase()) ||
          (uReg && uReg === rOwner) ||
          (roomUser && u.topic === roomUser)
        ) {
          return u;
        }
      }
    }
    return null;
  }, [activeRoom, onlineMap]);

  // 1. Host Auto-Seat on Slot 1
  useEffect(() => {
    if (!isHost || mySlotNumber > 0 || !activeRoom || autoSeatedRef.current) return;
    const slot1 = slots.find((s) => s.slot === 1);
    if (slot1 && (!slot1.active || slot1.occupantId === me?.id) && !slot1.locked) {
      autoSeatedRef.current = true;
      takeSlot(1);
    }
  }, [isHost, mySlotNumber, slots, activeRoom, me?.id, takeSlot]);

  // Track Peak Listeners
  useEffect(() => {
    setPeakListeners((prev) => Math.max(prev, Number(listenersCount || 0)));
  }, [listenersCount]);

  // Fetch host follow info on load
  useEffect(() => {
    if (hostUser?.id && !isHost) {
      getFollowInfo(hostUser.id, true);
    }
  }, [hostUser?.id, isHost, getFollowInfo]);

  const isFollowing = useMemo(() => {
    if (!hostUser?.id) return false;
    return Boolean(followInfoMap[hostUser.id]?.isFollowing);
  }, [hostUser?.id, followInfoMap]);

  const handleToggleFollow = () => {
    if (!hostUser?.id) return;
    if (isFollowing) {
      unfollowUser(hostUser.id, true);
      pushNotice(`تم إلغاء متابعة ${hostUser.topic}`, { force: 1 });
    } else {
      followUser(hostUser.id, true);
      pushNotice(`تمت متابعة المضيف ${hostUser.topic} بنجاح! ❤️`, { force: 1 });
    }
  };

  // التكبيس (Double-tap / Rapid Tapping for Hearts)
  const lastTapTimeRef = useRef(0);
  const likeBatchRef = useRef(0);
  const likeBatchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const HEART_ICONS = ["❤️", "💖", "💗", "💓", "🔥", "✨", "🤍", "💘", "💝"];

  const spawnFloatingHeartAt = useCallback((clientX?: number, clientY?: number) => {
    const id = Date.now() + Math.random();
    const x =
      clientX !== undefined
        ? clientX + (Math.random() * 50 - 25)
        : window.innerWidth * 0.82 + (Math.random() * 40 - 20);
    const y =
      clientY !== undefined
        ? clientY + (Math.random() * 30 - 15)
        : window.innerHeight * 0.7;
    const icon = HEART_ICONS[Math.floor(Math.random() * HEART_ICONS.length)]!;
    const scale = 0.9 + Math.random() * 0.45;
    const rot = Math.random() * 40 - 20;

    setFloatingHearts((prev) => [...prev.slice(-30), { id, x, y, icon, scale, rot }]);
    setTimeout(() => {
      setFloatingHearts((prev) => prev.filter((h) => h.id !== id));
    }, 1400);
  }, []);

  const triggerFloatingHearts = useCallback(() => {
    spawnFloatingHeartAt();
    setTimeout(() => spawnFloatingHeartAt(), 120);
  }, [spawnFloatingHeartAt]);

  // Request authoritative room likes on mount or room change
  useEffect(() => {
    if (!currentRoomId) return;
    emitMicAction("broadcasting", {
      cmd: "req-room-likes",
      roomid: currentRoomId,
    });
  }, [currentRoomId, emitMicAction]);

  // Sync if activeRoom metadata has updated likes_count
  useEffect(() => {
    const metaLikes = Number((activeRoom?.room_owner_meta as any)?.live_config?.likes_count);
    if (!Number.isNaN(metaLikes) && metaLikes > 0) {
      setHeartsCount((c) => Math.max(c, metaLikes));
    }
  }, [activeRoom]);

  // Real-time stage signals (likes, stage requests, sound effects, invitations)
  useEffect(() => {
    return subscribeStageSignals((payload) => {
      const cmd = String(payload?.cmd || "");
      if (cmd === "stage-request-list" && Array.isArray(payload.requests)) {
        setPendingRequests(payload.requests as StageRequestItem[]);
      } else if (cmd === "stage-request-approved") {
        setHasRequestedMic(false);
        pushNotice("تمت الموافقة على صعودك للمايك! 🎙️", { force: 1 });
      } else if (cmd === "all" && typeof payload.likes === "number") {
        setHeartsCount((c) => Math.max(c, Number(payload.likes)));
      } else if (cmd === "room-likes") {
        const total = Number(payload.total ?? payload.likes);
        if (!Number.isNaN(total)) {
          setHeartsCount((c) => Math.max(c, total));
        }
      } else if (cmd === "room-like") {
        const added = Math.max(1, Number(payload.count || 1));
        const likerTopic = String(payload.user || "");
        const isSelf = Boolean(
          likerTopic &&
            (likerTopic === me?.topic ||
              likerTopic === me?.username ||
              likerTopic === me?.id),
        );
        const hasTotal = payload.total !== undefined && payload.total !== null;
        const total = hasTotal ? Number(payload.total) : null;

        if (total !== null && !Number.isNaN(total)) {
          // Synchronize with authoritative server total without double-counting on sender
          setHeartsCount((c) => (isSelf ? Math.max(c, total) : total));
        } else if (!isSelf) {
          setHeartsCount((c) => c + added);
        }

        if (!isSelf) {
          triggerFloatingHearts();
        }

        if (likerTopic) {
          const liker = Object.values(onlineMap).find(
            (u) => u?.topic === likerTopic || u?.username === likerTopic,
          );
          if (liker && liker.id !== hostUser?.id) {
            setSupportersMap((prev) => {
              const prevEntry = prev[liker.id];
              const prevCoins = prevEntry?.totalCoins || 0;
              const prevLikes = (prevEntry?.likesCount || 0) + added;
              const newScore = prevCoins * 100 + prevLikes;
              return {
                ...prev,
                [liker.id]: {
                  user: liker,
                  totalCoins: prevCoins,
                  likesCount: prevLikes,
                  score: newScore,
                },
              };
            });
          }
        }
      } else if (cmd === "stage-invite-offer") {
        const slot = Number(payload.slot || 2);
        const hostName = String(payload.hostTopic || "المضيف");
        pushNotice(`دعاك ${hostName} للصعود على المقعد ${slot}! 🎙️`, { force: 1 });
      }
    });
  }, [
    pushNotice,
    onlineMap,
    hostUser?.id,
    triggerFloatingHearts,
    me?.topic,
    me?.username,
    me?.id,
  ]);

  // Real-time gift listener
  useEffect(() => {
    if (!lastGiftFx || !activeRoom) return;
    if (lastGiftFx.roomId && lastGiftFx.roomId !== activeRoom.id) return;
    const addedGifts = Number(lastGiftFx.qty || 1);
    setCurrentGiftsCount((c) => c + addedGifts);

    const sender = Object.values(onlineMap).find(
      (u) => u?.id === lastGiftFx.fromId || u?.topic === lastGiftFx.fromTopic,
    );
    if (sender && sender.id !== hostUser?.id) {
      const addedCoins = (Number(lastGiftFx.coin) || 1) * (Number(lastGiftFx.qty) || 1);
      setSupportersMap((prev) => {
        const prevEntry = prev[sender.id];
        const prevCoins = (prevEntry?.totalCoins || 0) + addedCoins;
        const prevLikes = prevEntry?.likesCount || 0;
        const newScore = prevCoins * 100 + prevLikes;
        return {
          ...prev,
          [sender.id]: {
            user: sender,
            totalCoins: prevCoins,
            likesCount: prevLikes,
            score: newScore,
          },
        };
      });
    }
  }, [lastGiftFx, activeRoom, onlineMap, hostUser?.id]);

  // Filter members of THIS room only
  const allRoomMembers = useMemo(() => {
    if (!currentRoomId) return [];
    const seatedUserIds = new Set(
      slots.filter((s) => s.active && s.occupantId).map((s) => s.occupantId),
    );
    return (Object.values(onlineMap).filter(Boolean) as OnlineUserSnapshot[]).filter((u) => {
      if (u.roomid === currentRoomId) return true;
      if (seatedUserIds.has(u.id)) return true;
      if (hostUser?.id && u.id === hostUser.id) return true;
      return false;
    });
  }, [onlineMap, currentRoomId, slots, hostUser?.id]);

  // Top supporters ranked by real coins & likes in this live room
  const topSupporters = useMemo(() => {
    const list = Object.values(supportersMap);
    const validList = list.filter((s) => s.user && s.user.id !== hostUser?.id && s.score > 0);
    if (validList.length > 0) {
      return validList
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map((s) => ({
          ...s.user,
          totalCoins: s.totalCoins,
          likesCount: s.likesCount,
          score: s.score,
        }));
    }
    // Fallback: only members who joined THIS live room (excluding host)
    return allRoomMembers
      .filter((u) => u.id !== hostUser?.id)
      .slice(0, 3)
      .map((u) => ({
        ...u,
        totalCoins: 0,
        likesCount: 0,
        score: 0,
      }));
  }, [supportersMap, hostUser?.id, allRoomMembers]);

  // Broadcast duration timer
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveDurationSec((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedDuration = useMemo(() => {
    const h = Math.floor(liveDurationSec / 3600);
    const m = Math.floor((liveDurationSec % 3600) / 60);
    const s = liveDurationSec % 60;
    if (h > 0) {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, [liveDurationSec]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle Tap / Double Tap Like (التكبيس)
  const handleTapLike = useCallback(
    (e?: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
      let clientX: number | undefined;
      let clientY: number | undefined;

      if (e) {
        if ("touches" in e && e.touches.length > 0 && e.touches[0]) {
          clientX = e.touches[0].clientX;
          clientY = e.touches[0].clientY;
        } else if ("clientX" in e && typeof e.clientX === "number") {
          clientX = e.clientX;
          clientY = e.clientY;
        }
      }

      spawnFloatingHeartAt(clientX, clientY);
      if (Math.random() > 0.35) {
        setTimeout(
          () =>
            spawnFloatingHeartAt(
              clientX ? clientX + (Math.random() * 30 - 15) : undefined,
              clientY ? clientY + (Math.random() * 30 - 15) : undefined,
            ),
          70,
        );
      }

      setHeartsCount((c) => c + 1);

      // Increment combo count with 1.2s timeout
      setComboCount((prev) => {
        const next = prev + 1;
        if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
        comboTimerRef.current = setTimeout(() => setComboCount(0), 1200);
        return next;
      });

      // Batch emit to server (300ms window)
      likeBatchRef.current += 1;
      if (!likeBatchTimerRef.current) {
        likeBatchTimerRef.current = setTimeout(() => {
          const count = likeBatchRef.current;
          likeBatchRef.current = 0;
          likeBatchTimerRef.current = null;
          if (activeRoom && count > 0) {
            emitMicAction("broadcasting", {
              cmd: "room-like",
              roomid: activeRoom.id,
              count,
            });
          }
        }, 300);
      }
    },
    [activeRoom, emitMicAction, spawnFloatingHeartAt],
  );

  const handleContainerTap = (
    e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>,
  ) => {
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("input") ||
      target.closest("a") ||
      target.closest("[data-no-tap]")
    ) {
      return;
    }
    const now = Date.now();
    const diff = now - lastTapTimeRef.current;
    if (diff < 380) {
      handleTapLike(e);
      lastTapTimeRef.current = 0;
    } else {
      lastTapTimeRef.current = now;
    }
  };

  // Quick gift: Send the Target Goal Gift (or lowest cost gift)
  const handleQuickGift = () => {
    const target = hostUser?.id || activeRoom?.owner;
    if (!target) return;
    const giftToSend = goalGift || gifts.find((g) => g.coin === 1) || gifts[0];
    if (!giftToSend) {
      setGiftPickerOpen(true);
      return;
    }
    if (me?.islogin !== "عضو") {
      pushNotice("إرسال الهدايا متاح للأعضاء المسجلين فقط", { force: 1 });
      return;
    }
    const myCoins = Number(me?.coins ?? me?.coin ?? 0);
    if (myCoins < (giftToSend.coin || 1)) {
      pushNotice("رصيد الكوينز غير كافٍ لإرسال هذه الهدية", { force: 1 });
      return;
    }
    sendGift(target, giftToSend.file);
    handleTapLike();
    pushNotice(`أرسلت ${giftToSend.name} 🎁 لدعم البث!`, { force: 1 });
  };

  // Send room chat message
  const handleSendMessage = (e: FormEvent) => {
    e.preventDefault();
    const text = chatDraft.trim();
    if (!text) return;
    if (liveConfig.chat_locked && !isStaff) {
      pushNotice("الدردشة مقفلة حالياً من قبل المضيف", { force: 1 });
      return;
    }
    sendRoomMessage(text);
    setChatDraft("");
  };

  // Handle Taking / Moving Seats
  const handleTakeOrMoveSeat = (slotNumber: number) => {
    if (mySlotNumber > 0 && mySlotNumber !== slotNumber) {
      leaveSlot();
    }
    takeSlot(slotNumber);
    setSelectedSeatForSheet(null);
  };

  // Handle Seat Click
  const handleSeatClick = (slotNumber: number) => {
    const slot = slots.find((s) => s.slot === slotNumber);
    if (!slot) return;

    // 1. My Own Seat: always open personal mic action sheet
    if (slot.active && slot.occupantId === me?.id) {
      setSelectedSeatForSheet(slotNumber);
      return;
    }

    // 2. Staff / Host clicking any seat: open management sheet
    if (isStaff) {
      setSelectedSeatForSheet(slotNumber);
      return;
    }

    // 3. Listener clicking an occupied seat: view profile
    if (slot.active) {
      const occupant = onlineMap[slot.occupantId];
      if (occupant) {
        setProfileModalUser(occupant);
      }
      return;
    }

    // 4. Listener clicking an empty seat
    if (slot.locked) {
      pushNotice("هذا المقعد مقفل حالياً من المضيف", { force: 1 });
      return;
    }

    if (liveConfig.join_mode === "request") {
      if (!hasRequestedMic) {
        requestSlot(slotNumber);
        setHasRequestedMic(true);
        pushNotice("تم إرسال طلب الصعود للمايك إلى المضيف ✋", { force: 1 });
      } else {
        cancelSlotRequest();
        setHasRequestedMic(false);
        pushNotice("تم إلغاء طلب الصعود", { force: 1 });
      }
    } else {
      takeSlot(slotNumber);
    }
  };

  // Sound effects player
  const handlePlaySoundFx = (soundName: string) => {
    sendSoundFx(soundName);
    setActiveFxName(soundName);
    setTimeout(() => setActiveFxName(null), 1500);
  };

  // Exit Button Click
  const handleExitClick = () => {
    if (isHost) {
      setEndLiveConfirmOpen(true);
    } else {
      if (mySlotNumber > 0) {
        leaveSlot();
      }
      onClose();
    }
  };

  // Confirm End Live (Host)
  const handleConfirmEndLive = () => {
    if (activeRoom?.id) {
      deleteRoom(activeRoom.id);
    }
    setEndLiveConfirmOpen(false);
    setEndLiveSummaryOpen(true);
  };

  const selectedSlot = slots.find((s) => s.slot === selectedSeatForSheet);
  const selectedOccupant = selectedSlot?.occupantId ? onlineMap[selectedSlot.occupantId] : null;
  const isSelectedMyOwnSeat = selectedSlot?.active && selectedSlot.occupantId === me?.id;

  const targetGoalCount = liveConfig.gift_goal?.targetCount || 100;
  const goalProgressPercent = Math.min(100, Math.round((currentGiftsCount / targetGoalCount) * 100));

  // Active voice rooms for explore modal
  const activeVoiceRooms = useMemo(() => {
    return rooms.filter(
      (r) =>
        r.id !== activeRoom?.id &&
        (r.is_live_audio ||
          r.broadcast ||
          (r.room_owner_meta as any)?.live_config?.is_live_audio),
    );
  }, [rooms, activeRoom?.id]);

  return (
    <div
      dir="rtl"
      onClick={handleContainerTap}
      onTouchStart={handleContainerTap}
      className={`relative w-full h-full flex flex-col overflow-hidden select-none font-sans transition-colors duration-300 ${
        dark
          ? "bg-[#080c14] text-white"
          : "bg-gradient-to-b from-slate-100 via-sky-50/40 to-slate-200/90 text-slate-800"
      }`}
    >
      {/* Background ambient lighting */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className={`absolute top-0 right-1/4 w-96 h-96 rounded-full blur-[120px] transition-colors ${
            dark ? "bg-sky-500/10" : "bg-sky-400/20"
          }`}
        />
        <div
          className={`absolute bottom-1/4 left-10 w-80 h-80 rounded-full blur-[100px] transition-colors ${
            dark ? "bg-rose-500/10" : "bg-rose-400/15"
          }`}
        />
      </div>

      {/* Floating Hearts Particles (التكبيس) */}
      <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
        {floatingHearts.map((h) => (
          <div
            key={h.id}
            style={
              {
                left: `${h.x}px`,
                top: `${h.y}px`,
                "--heart-rot": `${h.rot}deg`,
                transform: `translate(-50%, -50%) scale(${h.scale})`,
              } as React.CSSProperties
            }
            className="absolute text-3xl animate-float-heart drop-shadow-xl select-none"
          >
            {h.icon}
          </div>
        ))}
      </div>

      {/* التكبيس Combo Badge */}
      {comboCount >= 2 && (
        <div className="fixed top-28 left-6 z-40 pointer-events-none animate-bounce">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-sky-600 via-rose-500 to-amber-400 text-white font-black text-xs shadow-xl shadow-rose-500/40 border border-white/20">
            <span>🔥 تكبيس</span>
            <span className="font-mono text-sm">x{comboCount}</span>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 1. TOP HEADER BAR                                        */}
      {/* ======================================================== */}
      <header
        className={`relative z-20 flex items-center justify-between px-3 pt-3 pb-2 shrink-0 border-b transition-colors ${
          dark
            ? "bg-black/40 backdrop-blur-md border-white/10"
            : "bg-white/80 backdrop-blur-md border-slate-200/80 shadow-xs"
        }`}
      >
        {/* Right side: Host Info & Follow Button */}
        <div className="flex items-center gap-2">
          {/* Host Avatar & Name Card */}
          <div
            className={`flex items-center gap-2 py-1 px-2.5 rounded-full backdrop-blur-md border cursor-pointer transition shadow-md ${
              dark
                ? "bg-white/10 hover:bg-white/15 border-white/15 text-white"
                : "bg-white/90 hover:bg-white border-slate-200 text-slate-900 shadow-slate-200/50"
            }`}
            onClick={() => hostUser && setProfileModalUser(hostUser)}
          >
            <div className="relative">
              <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-[#FE2C55] bg-slate-900 shrink-0 shadow-md">
                <img
                  src={resolveAssetUrl(activeRoom?.pic || "pic.png", "room", "/default-avatar.png")}
                  alt={activeRoom?.topic || "المضيف"}
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#FE2C55] border-2 border-black flex items-center justify-center" />
            </div>

            <div className="flex flex-col min-w-0 pr-0.5">
              <div className="flex items-center gap-1">
                <span
                  className={`text-xs font-extrabold truncate max-w-[85px] ${
                    dark ? "text-white" : "text-slate-900"
                  }`}
                >
                  {activeRoom?.topic || me?.topic || "المضيف"}
                </span>
                <span
                  className={`text-[9px] px-1 py-0.2 rounded font-bold border ${
                    dark
                      ? "bg-amber-500/20 text-amber-300 border-amber-400/30"
                      : "bg-amber-100 text-amber-800 border-amber-300"
                  }`}
                >
                  المضيف
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleTapLike(e);
                }}
                className={`flex items-center gap-1 text-[10px] font-bold transition text-right ${
                  dark
                    ? "text-rose-400 hover:brightness-125"
                    : "text-rose-600 hover:text-rose-700"
                }`}
                title="تكبيس ❤️"
              >
                <span>{heartsCount}</span>
                <span>🤍</span>
              </button>
            </div>

            {/* + Follow Button */}
            {!isHost && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleFollow();
                }}
                className={`py-1 px-3 rounded-full text-xs font-black shadow-md transition ${
                  isFollowing
                    ? dark
                      ? "bg-white/20 text-white"
                      : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                    : "bg-gradient-to-r from-sky-600 to-rose-500 hover:brightness-110 active:scale-95 text-white shadow-sky-500/25"
                }`}
              >
                {isFollowing ? "تتابع" : "+ متابعة"}
              </button>
            )}
          </div>
        </div>

        {/* Left side: Supporters, Viewer Count, Minimize & Close */}
        <div className="flex items-center gap-1.5">
          {/* Top Supporters */}
          <div
            onClick={() => setSupportersModalOpen(true)}
            className="flex items-center -space-x-1.5 space-x-reverse cursor-pointer hover:brightness-110 transition"
            title="لوحة شرف الداعمين"
          >
            {topSupporters.length > 0 ? (
              topSupporters.slice(0, 2).map((supporter, idx) => (
                <div
                  key={supporter.id}
                  className="relative transition hover:scale-105"
                  title={`${supporter.topic} ${supporter.totalCoins ? `(${supporter.totalCoins} 🪙)` : ""}`}
                >
                  <div
                    className={`w-7 h-7 rounded-full overflow-hidden border-2 bg-slate-800 ${
                      idx === 0
                        ? "border-amber-400 shadow-amber-500/40"
                        : dark
                          ? "border-slate-400 shadow-slate-400/30"
                          : "border-slate-300 shadow-slate-300/40"
                    }`}
                  >
                    <img
                      src={resolveAssetUrl(supporter.pic || "pic.png", "user", "/default-avatar.png")}
                      alt={supporter.topic}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span
                    className={`absolute -bottom-1 -left-1 w-3.5 h-3.5 rounded-full text-[9px] font-black flex items-center justify-center text-black shadow ${
                      idx === 0 ? "bg-amber-400" : "bg-slate-300"
                    }`}
                  >
                    {idx + 1}
                  </span>
                </div>
              ))
            ) : (
              <div
                className={`w-7 h-7 rounded-full border border-dashed flex items-center justify-center text-[10px] transition ${
                  dark
                    ? "border-white/30 text-slate-400 hover:border-amber-400 hover:text-amber-400"
                    : "border-slate-300 text-slate-500 hover:border-amber-500 hover:text-amber-600 bg-white/60"
                }`}
                title="كن أول داعم للبث"
              >
                +
              </div>
            )}
          </div>

          {/* Viewers Counter (Opens Audience Modal on Click) */}
          <button
            type="button"
            onClick={() => setAudienceModalOpen(true)}
            className={`flex items-center gap-1 py-1 px-2 rounded-full backdrop-blur-md border text-xs font-extrabold transition ${
              dark
                ? "bg-white/10 hover:bg-white/20 border-white/10 text-white"
                : "bg-white/90 hover:bg-white border-slate-200 text-slate-700 shadow-xs"
            }`}
            title="عرض قائمة المتواجدين في الغرفة"
          >
            <Users className={`w-3 h-3 ${dark ? "text-slate-300" : "text-slate-500"}`} />
            <span>{listenersCount}</span>
          </button>

          {/* Minimize Button (v) */}
          <button
            type="button"
            onClick={onMinimize}
            className={`w-8 h-8 rounded-full active:scale-90 flex items-center justify-center transition backdrop-blur-md ${
              dark
                ? "bg-white/10 hover:bg-white/20 text-white"
                : "bg-white/90 hover:bg-white border border-slate-200 text-slate-600 shadow-xs"
            }`}
            title="تصغير الغرفة وإبقاء الصوت في الخلفية"
            aria-label="تصغير الغرفة"
          >
            <ChevronDown className="w-4 h-4" />
          </button>

          {/* Close / Leave Button (X) */}
          <button
            type="button"
            onClick={handleExitClick}
            className={`w-8 h-8 rounded-full active:scale-90 flex items-center justify-center transition backdrop-blur-md ${
              dark
                ? "bg-white/10 hover:bg-rose-500/30 text-white"
                : "bg-white/90 hover:bg-rose-50 border border-slate-200 text-slate-600 hover:text-rose-600 shadow-xs"
            }`}
            title={isHost ? "إنهاء البث" : "مغادرة الغرفة"}
            aria-label="إغلاق الغرفة"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ======================================================== */}
      {/* 2. SUB-HEADER & GIFT GOAL BAR                            */}
      {/* ======================================================== */}
      <div className="relative z-10 px-3 pb-1">
        <div className="flex items-center justify-between text-xs py-1">
          {/* Right: Hourly Rank */}
          <div
            className={`flex items-center gap-1 font-bold px-2 py-0.5 rounded-full border ${
              dark
                ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                : "text-amber-700 bg-amber-50 border-amber-200 shadow-xs"
            }`}
          >
            <Flame className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span>{liveConfig.hourly_rank || "ترتيب كل ساعة"}</span>
          </div>

          {/* Left: Explore Button */}
          <button
            type="button"
            onClick={() => setExploreModalOpen(true)}
            className={`flex items-center gap-1 font-medium transition ${
              dark ? "text-slate-300 hover:text-white" : "text-slate-600 hover:text-sky-600"
            }`}
          >
            <span>استكشف</span>
            <span className="text-sky-500 font-bold">&gt;</span>
          </button>
        </div>

        {/* Gift Goal Widget */}
        <div
          onClick={() => (isHost ? setSettingsOpen(true) : handleQuickGift())}
          className={`mt-1 flex items-center justify-between p-2 rounded-2xl border backdrop-blur-md cursor-pointer transition shadow-xs ${
            dark
              ? "bg-white/5 border-white/10 hover:bg-white/10 text-white"
              : "bg-white/85 border-slate-200/90 hover:bg-white text-slate-800 shadow-slate-200/60"
          }`}
          title={isHost ? "تعديل إعدادات الهدف" : `إرسال ${goalGift?.name || "هدية الهدف"}`}
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 via-rose-500 to-amber-400 flex items-center justify-center text-base shadow-sm overflow-hidden p-1 text-white">
              {goalGift?.file && goalGift.file !== "rose.png" ? (
                <img
                  src={resolveAssetUrl(goalGift.file, "gifts_git")}
                  alt={goalGift.name}
                  className="w-full h-full object-contain"
                />
              ) : (
                <span>🌹</span>
              )}
            </div>
            <div className="flex flex-col">
              <span
                className={`text-[11px] font-extrabold ${dark ? "text-white" : "text-slate-900"}`}
              >
                هدف الهدية: {goalGift?.name || liveConfig.gift_goal?.giftName || "وردة"}
              </span>
              <span className={`text-[10px] ${dark ? "text-slate-400" : "text-slate-500"}`}>
                {liveConfig.gift_goal?.endsAt ? "متبقي 3h56m" : "ساعات قليلة"}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            <span
              className={`text-xs font-mono font-black ${
                dark ? "text-amber-300" : "text-amber-600"
              }`}
            >
              {currentGiftsCount} / {targetGoalCount}
            </span>
            <div
              className={`w-24 h-1.5 rounded-full overflow-hidden ${
                dark ? "bg-white/10" : "bg-slate-200"
              }`}
            >
              <div
                className="h-full bg-gradient-to-r from-sky-500 via-rose-500 to-amber-400 rounded-full transition-all duration-500"
                style={{
                  width: `${goalProgressPercent}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. 12-SEAT AUDIO GRID (شبكة الـ 12 مقعداً)                */}
      {/* ======================================================== */}
      <section className="relative z-10 flex-1 px-3 py-2 flex flex-col justify-center min-h-0">
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-y-4 gap-x-2 w-full max-w-lg mx-auto">
          {slots.map((slot) => {
            const isHostSeat = slot.slot === 1;
            const occupant = slot.occupantId ? onlineMap[slot.occupantId] : null;
            const isMeOccupant = slot.occupantId === me?.id;

            return (
              <div
                key={slot.slot}
                onClick={() => handleSeatClick(slot.slot)}
                className="flex flex-col items-center justify-center cursor-pointer group select-none transition-transform active:scale-95"
              >
                {/* Seat Circle Container */}
                <div className="relative w-16 h-16 sm:w-18 sm:h-18 flex items-center justify-center">
                  {/* Speaking Waves Pulse Animation */}
                  {slot.active && slot.speaking && !slot.muted && (
                    <span
                      className={`absolute inset-0 rounded-full border-2 animate-ping opacity-75 pointer-events-none ${
                        dark ? "border-[#FE2C55]" : "border-sky-500"
                      }`}
                    />
                  )}
                  {slot.active && slot.speaking && !slot.muted && (
                    <span className="absolute -inset-1.5 rounded-full border border-amber-400 animate-pulse opacity-90 pointer-events-none" />
                  )}

                  {/* 1. Occupied Seat */}
                  {slot.active && occupant ? (
                    <div
                      className={`relative w-full h-full rounded-full overflow-hidden border-2 shadow-lg ${
                        dark ? "bg-slate-900" : "bg-white shadow-md"
                      } ${
                        isHostSeat
                          ? dark
                            ? "border-[#FE2C55]"
                            : "border-sky-600"
                          : slot.speaking
                            ? "border-amber-400"
                            : dark
                              ? "border-white/20"
                              : "border-slate-300"
                      }`}
                    >
                      <img
                        src={resolveAssetUrl(occupant.pic || "pic.png", "user", "/default-avatar.png")}
                        alt={occupant.topic}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : slot.locked ? (
                    /* 2. Locked Seat */
                    <div
                      className={`w-full h-full rounded-full border flex items-center justify-center shadow-inner ${
                        dark
                          ? "bg-white/5 border-white/10 text-slate-500"
                          : "bg-slate-200/70 border-slate-300 text-slate-400"
                      }`}
                    >
                      <Lock className="w-6 h-6" />
                    </div>
                  ) : (
                    /* 3. Empty Open Seat (+) */
                    <div
                      className={`w-full h-full rounded-full border flex items-center justify-center transition shadow-xs ${
                        dark
                          ? "bg-white/[0.08] hover:bg-white/[0.14] border-white/10 text-slate-400 group-hover:text-white shadow-sm"
                          : "bg-white/80 hover:bg-white border-2 border-dashed border-slate-300 hover:border-sky-400 text-slate-400 hover:text-sky-600 shadow-slate-200/60"
                      }`}
                    >
                      <Plus
                        className={`w-7 h-7 group-hover:scale-110 transition ${
                          dark
                            ? "text-slate-300 group-hover:text-white"
                            : "text-slate-400 group-hover:text-sky-600"
                        }`}
                      />
                    </div>
                  )}

                  {/* Mic Status Badge on Occupied Seats */}
                  {slot.active && (
                    <div
                      className={`absolute -bottom-1 -left-1 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] shadow-md ${
                        slot.muted || slot.locallyMuted
                          ? "bg-rose-500"
                          : "bg-emerald-500"
                      }`}
                    >
                      {slot.muted || slot.locallyMuted ? (
                        <MicOff className="w-3 h-3" />
                      ) : (
                        <Mic className="w-3 h-3" />
                      )}
                    </div>
                  )}
                </div>

                {/* Seat Name & Role Label Underneath */}
                <div className="mt-1 flex flex-col items-center max-w-[80px]">
                  {slot.active && occupant ? (
                    <>
                      <span
                        className={`text-[11px] font-extrabold truncate w-full text-center ${
                          dark ? "text-white" : "text-slate-900"
                        }`}
                      >
                        {occupant.topic}
                      </span>
                      {isHostSeat ? (
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold border ${
                            dark
                              ? "bg-[#FE2C55]/20 text-[#FE2C55] border-[#FE2C55]/40"
                              : "bg-sky-100 text-sky-800 border-sky-300 shadow-xs"
                          }`}
                        >
                          المضيف
                        </span>
                      ) : (
                        <span
                          className={`text-[9px] font-mono ${
                            dark ? "text-slate-400" : "text-slate-500"
                          }`}
                        >
                          {isMeOccupant ? "أنت" : `${slot.slot}`}
                        </span>
                      )}
                    </>
                  ) : (
                    <span
                      className={`text-[10px] font-mono ${
                        dark ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      {isHostSeat ? "المضيف" : `${slot.slot}`}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ======================================================== */}
      {/* 4. LIVE CHAT & SYSTEM FEED (Fade-out Mask)               */}
      {/* ======================================================== */}
      <section className="relative z-10 h-44 px-3 flex flex-col justify-end min-h-0">
        {/* CSS Mask for smooth fade-out towards the top */}
        <div
          ref={chatScrollRef}
          style={{
            maskImage: "linear-gradient(to top, black 80%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to top, black 80%, transparent 100%)",
          }}
          className="overflow-y-auto chat-scroll flex flex-col space-y-2 pr-1"
        >
          {/* System Safety Notice */}
          <div
            className={`p-2 rounded-2xl border text-[10px] leading-relaxed ${
              dark
                ? "bg-white/5 border-white/5 text-slate-400"
                : "bg-white/80 border-slate-200 text-slate-600 shadow-xs"
            }`}
          >
            {liveConfig.pinned_notice ||
              "مباشر وفي الوقت الفعلي، يلزم أن يكون عمر المذيعين 18 عاماً أو أكثر لبدء بث مباشر، ويلزم أن يكون عمر المشاهدين 18 عاماً أو أكثر لشحن الرصيد وإرسال الهدايا. تذكر اتباع إرشادات المجتمع لدينا."}
          </div>

          {/* Chat Messages */}
          {messages.slice(-20).map((msg: RoomMessagePayload) => {
            const isMsgHost = msg.topic === activeRoom?.topic;

            return (
              <div
                key={msg.id || msg.mi || Math.random()}
                className={`flex items-start gap-1.5 text-xs ${
                  dark ? "text-white" : "text-slate-800"
                }`}
              >
                {/* Mini Avatar */}
                <div className="w-5 h-5 rounded-full overflow-hidden bg-slate-800 shrink-0 mt-0.5">
                  <img
                    src={resolveAssetUrl(msg.pic || "pic.png", "user", "/default-avatar.png")}
                    alt={msg.topic}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Level / Role Badge */}
                <span className="px-1.5 py-0.2 rounded-md bg-blue-500/20 text-blue-300 font-extrabold text-[10px] border border-blue-400/30 shrink-0">
                  💎 19
                </span>

                {/* Username & Badge */}
                <div className="flex-1 min-w-0">
                  <span
                    className={`font-extrabold ml-1 inline-flex items-center gap-0.5 ${
                      dark ? "text-slate-300" : "text-sky-700"
                    }`}
                  >
                    @{msg.topic}
                    {isUserVerified(msg, onlineMap) && <VerifiedBadge size="xs" />}
                  </span>
                  {isMsgHost && (
                    <span
                      className={`text-[9px] px-1 py-0.2 rounded font-bold border ml-1 ${
                        dark
                          ? "bg-[#FE2C55]/20 text-[#FE2C55] border-[#FE2C55]/30"
                          : "bg-sky-100 text-sky-800 border-sky-300 shadow-xs"
                      }`}
                    >
                      المضيف
                    </span>
                  )}
                  <span
                    className={`font-medium break-words ${
                      dark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    {msg.msg}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ======================================================== */}
      {/* 5. BOTTOM ACTION BAR                                     */}
      {/* ======================================================== */}
      <footer
        className={`relative z-20 px-3 py-2.5 flex items-center gap-2 border-t shrink-0 backdrop-blur-md transition-colors ${
          dark
            ? "bg-[#0B0B0D]/90 border-white/10"
            : "bg-white/90 border-slate-200/80 shadow-md"
        }`}
      >
        {/* Chat Input Field */}
        <form onSubmit={handleSendMessage} className="flex-1 flex items-center gap-2">
          <div className="relative flex-1 flex items-center">
            <input
              type="text"
              value={chatDraft}
              onChange={(e) => setChatDraft(e.target.value)}
              placeholder="اكتب تعليقاً..."
              className={`w-full pl-8 pr-3.5 py-2 rounded-full border text-xs outline-none transition ${
                dark
                  ? "bg-white/10 border-white/15 text-white placeholder-slate-400 focus:border-[#FE2C55]"
                  : "bg-slate-100 border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-sky-500 shadow-inner"
              }`}
            />
            <button
              type="button"
              onClick={() => setChatDraft((d) => d + " ❤️")}
              className={`absolute left-2.5 transition ${
                dark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Smile className="w-4 h-4" />
            </button>
          </div>

          {chatDraft.trim() && (
            <button
              type="submit"
              className={`p-2 rounded-full text-white transition shrink-0 ${
                dark ? "bg-[#FE2C55] hover:bg-rose-500" : "bg-sky-600 hover:bg-sky-500 shadow-sm"
              }`}
            >
              <Send className="w-3.5 h-3.5 rotate-180" />
            </button>
          )}
        </form>

        {/* Action Buttons: Multi-guest, Quick Gift, Gift Box, Share */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Multi-Guest / Mic Requests Button */}
          <button
            type="button"
            onClick={() => setMultiGuestOpen(true)}
            className={`relative p-2 rounded-full border transition shadow-xs ${
              dark
                ? "bg-white/10 hover:bg-white/20 border-white/10 text-[#FE2C55]"
                : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-sky-600 shadow-xs"
            }`}
            title="إدارة المقاعد وطلبات الصعود"
            aria-label="إدارة المقاعد"
          >
            <Users className="w-4 h-4" />
            {pendingRequests.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center animate-bounce">
                {pendingRequests.length}
              </span>
            )}
          </button>

          {/* Quick Mic Toggle if Seated */}
          {mySlotNumber > 0 && (
            <button
              type="button"
              onClick={toggleSelfMute}
              className={`p-2 rounded-full border transition ${
                isSelfMuted
                  ? "bg-rose-500/20 border-rose-500 text-rose-400"
                  : "bg-emerald-500/20 border-emerald-500 text-emerald-400"
              }`}
              title={isSelfMuted ? "إلغاء كتم المايك" : "كتم المايك"}
            >
              {isSelfMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}

          {/* Quick Heart: تكبيس ❤️ */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleTapLike(e);
            }}
            className={`p-2 rounded-full border transition active:scale-90 ${
              dark
                ? "bg-rose-500/15 hover:bg-rose-500/30 text-rose-400 border-rose-500/30"
                : "bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-200"
            }`}
            title="تكبيس ❤️"
            aria-label="تكبيس للغرفة"
          >
            <Heart className="w-4 h-4 fill-rose-500 text-rose-500 animate-pulse" />
          </button>

          {/* Quick Gift: Target Goal Gift */}
          <button
            type="button"
            onClick={handleQuickGift}
            className={`p-2 rounded-full border transition active:scale-90 ${
              dark
                ? "bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border-rose-500/40"
                : "bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-200"
            }`}
            title={`إرسال ${goalGift?.name || "هدية الهدف"} سريعة`}
            aria-label="إرسال هدية سريعة"
          >
            {goalGift?.file && goalGift.file !== "rose.png" ? (
              <img
                src={resolveAssetUrl(goalGift.file, "gifts_git")}
                alt={goalGift.name}
                className="w-5 h-5 object-contain"
              />
            ) : (
              <span className="text-base leading-none">🌹</span>
            )}
          </button>

          {/* Interactive Gifts Box */}
          <button
            type="button"
            onClick={() => setGiftPickerOpen(true)}
            className={`p-2 rounded-full text-white shadow-lg active:scale-95 transition ${
              dark
                ? "bg-gradient-to-tr from-[#FE2C55] to-rose-400 shadow-rose-500/30 hover:brightness-110"
                : "bg-gradient-to-tr from-sky-600 to-rose-500 shadow-sky-500/25 hover:brightness-110"
            }`}
            title="صندوق الهدايا"
            aria-label="صندوق الهدايا"
          >
            <Gift className="w-4 h-4" />
          </button>

          {/* Share Button */}
          <button
            type="button"
            onClick={() => {
              if (typeof navigator !== "undefined" && navigator.clipboard) {
                navigator.clipboard.writeText(window.location.href);
                pushNotice("تم نسخ رابط الغرفة الصوتية للمشاركة! 📋", { force: 1 });
              }
            }}
            className={`p-2 rounded-full border transition ${
              dark
                ? "bg-white/10 hover:bg-white/20 border-white/10 text-slate-300 hover:text-white"
                : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-600 hover:text-slate-900 shadow-xs"
            }`}
            title="مشاركة رابط الغرفة"
            aria-label="مشاركة"
          >
            <Share2 className="w-4 h-4" />
          </button>

          {/* Host Settings */}
          {isStaff && (
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className={`p-2 rounded-full border transition ${
                dark
                  ? "bg-white/10 hover:bg-white/20 border-white/10 text-slate-300 hover:text-white"
                  : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-600 hover:text-slate-900 shadow-xs"
              }`}
              title="إعدادات البث"
              aria-label="إعدادات البث"
            >
              <Settings2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </footer>

      {/* ======================================================== */}
      {/* 6. SEAT MANAGEMENT & PERSONAL ACTION SHEET               */}
      {/* ======================================================== */}
      {selectedSeatForSheet !== null && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-xs animate-fade-in"
          onClick={() => setSelectedSeatForSheet(null)}
        >
          <div
            className={`w-full max-w-lg rounded-t-3xl border-t p-4 shadow-2xl animate-slide-up ${
              dark
                ? "bg-[#0B0B0D] border-white/15 text-white"
                : "bg-white border-slate-200 text-slate-900"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={`w-12 h-1 rounded-full mx-auto mb-3 ${
                dark ? "bg-white/20" : "bg-slate-300"
              }`}
            />

            <div
              className={`flex items-center justify-between pb-3 border-b mb-3 ${
                dark ? "border-white/10" : "border-slate-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-extrabold">
                  {isSelectedMyOwnSeat
                    ? `مقعدك الخاص (المقعد رقم ${selectedSeatForSheet})`
                    : `إدارة المقعد رقم ${selectedSeatForSheet}`}
                </span>
                {selectedSlot?.active && selectedOccupant && !isSelectedMyOwnSeat && (
                  <span className={`text-xs ${dark ? "text-slate-400" : "text-slate-500"}`}>
                    ({selectedOccupant.topic})
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedSeatForSheet(null)}
                className={`p-1 rounded-full ${
                  dark ? "text-slate-400 hover:text-white" : "text-slate-400 hover:text-slate-700"
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* CASE A: User clicking their own occupied seat */}
            {isSelectedMyOwnSeat ? (
              <div className="space-y-2">
                {/* 1. Mute / Unmute self */}
                <button
                  type="button"
                  onClick={() => {
                    toggleSelfMute();
                    setSelectedSeatForSheet(null);
                  }}
                  className={`w-full flex items-center gap-2.5 p-3 rounded-2xl text-xs font-bold transition ${
                    dark
                      ? "bg-white/5 hover:bg-white/10 text-white"
                      : "bg-slate-100 hover:bg-slate-200/80 text-slate-800 border border-slate-200/60"
                  }`}
                >
                  {isSelfMuted ? (
                    <>
                      <Mic className="w-4 h-4 text-emerald-400" />
                      <span>إلغاء كتم المايك (تشغيل الصوت)</span>
                    </>
                  ) : (
                    <>
                      <MicOff className="w-4 h-4 text-rose-400" />
                      <span>كتم المايك</span>
                    </>
                  )}
                </button>

                {/* 2. Leave seat (Back to listener) */}
                <button
                  type="button"
                  onClick={() => {
                    leaveSlot();
                    setSelectedSeatForSheet(null);
                    pushNotice("نزلت من المقعد إلى المستمعين", { force: 1 });
                  }}
                  className={`w-full flex items-center gap-2.5 p-3 rounded-2xl text-xs font-bold transition ${
                    dark
                      ? "bg-rose-500/10 hover:bg-rose-500/20 text-rose-400"
                      : "bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200"
                  }`}
                >
                  <UserMinus className="w-4 h-4" />
                  <span>النزول من المايك (العودة كمستمع)</span>
                </button>
              </div>
            ) : !selectedSlot?.active ? (
              /* CASE B: Empty Seat */
              <div className="space-y-2">
                {/* 1. Take or Move to this seat (for Host / Staff / Listeners) */}
                <button
                  type="button"
                  onClick={() => handleTakeOrMoveSeat(selectedSeatForSheet)}
                  className={`w-full flex items-center gap-2.5 p-3 rounded-2xl text-xs font-bold transition ${
                    dark
                      ? "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400"
                      : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200"
                  }`}
                >
                  <Mic className="w-4 h-4" />
                  <span>
                    {mySlotNumber > 0
                      ? "الانتقال إلى هذا المقعد"
                      : "الجلوس في هذا المقعد (الصعود للمايك)"}
                  </span>
                </button>

                {/* 2. Lock / Unlock Seat */}
                {isStaff && (
                  <button
                    type="button"
                    onClick={() => {
                      toggleSlotLock(selectedSeatForSheet, !selectedSlot?.locked);
                      setSelectedSeatForSheet(null);
                    }}
                    className={`w-full flex items-center gap-2.5 p-3 rounded-2xl text-xs font-bold transition ${
                      dark
                        ? "bg-white/5 hover:bg-white/10 text-white"
                        : "bg-slate-100 hover:bg-slate-200/80 text-slate-800 border border-slate-200/60"
                    }`}
                  >
                    {selectedSlot?.locked ? (
                      <>
                        <Unlock className="w-4 h-4 text-emerald-400" />
                        <span>فتح المقعد للجميع</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4 text-amber-500" />
                        <span>قفل المقعد (منع الصعود)</span>
                      </>
                    )}
                  </button>
                )}

                {/* 3. Invite listener to this seat */}
                {isStaff && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSeatForSheet(null);
                      setInviteModalOpen(true);
                    }}
                    className={`w-full flex items-center gap-2.5 p-3 rounded-2xl text-xs font-bold transition ${
                      dark
                        ? "bg-white/5 hover:bg-white/10 text-white"
                        : "bg-slate-100 hover:bg-slate-200/80 text-slate-800 border border-slate-200/60"
                    }`}
                  >
                    <UserPlus className="w-4 h-4 text-sky-500" />
                    <span>دعوة مستمع للصعود على هذا المقعد</span>
                  </button>
                )}

                {/* 4. Batch Seat Controls for Staff */}
                {isStaff && (
                  <div
                    className={`grid grid-cols-2 gap-2 pt-2 border-t ${
                      dark ? "border-white/10" : "border-slate-200"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        lockAllEmpty();
                        setSelectedSeatForSheet(null);
                        pushNotice("تم قفل جميع المقاعد الفارغة", { force: 1 });
                      }}
                      className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl text-xs font-bold ${
                        dark
                          ? "bg-white/5 hover:bg-white/10 text-amber-400"
                          : "bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200"
                      }`}
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>قفل كل الفارغ</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        unlockAll();
                        setSelectedSeatForSheet(null);
                        pushNotice("تم فتح جميع المقاعد", { force: 1 });
                      }}
                      className={`flex items-center justify-center gap-1.5 p-2.5 rounded-xl text-xs font-bold ${
                        dark
                          ? "bg-white/5 hover:bg-white/10 text-emerald-400"
                          : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200"
                      }`}
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      <span>فتح كل المقاعد</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* CASE C: Occupied Seat (by other member, clicked by Staff) */
              <div className="space-y-2">
                {/* Speaker Mute/Unmute */}
                <button
                  type="button"
                  onClick={() => {
                    if (selectedSlot?.occupantId) {
                      toggleUserMute(selectedSlot.occupantId, !selectedSlot.muted);
                    }
                    setSelectedSeatForSheet(null);
                  }}
                  className={`w-full flex items-center gap-2.5 p-3 rounded-2xl text-xs font-bold transition ${
                    dark
                      ? "bg-white/5 hover:bg-white/10 text-white"
                      : "bg-slate-100 hover:bg-slate-200/80 text-slate-800 border border-slate-200/60"
                  }`}
                >
                  {selectedSlot.muted ? (
                    <>
                      <Mic className="w-4 h-4 text-emerald-400" />
                      <span>إلغاء كتم ميكروفون العضو</span>
                    </>
                  ) : (
                    <>
                      <MicOff className="w-4 h-4 text-rose-400" />
                      <span>كتم ميكروفون العضو</span>
                    </>
                  )}
                </button>

                {/* Remove from seat */}
                <button
                  type="button"
                  onClick={() => {
                    if (selectedSlot?.occupantId) {
                      kickFromStage(selectedSlot.occupantId);
                    }
                    setSelectedSeatForSheet(null);
                    pushNotice("تم إنزال العضو من المقعد", { force: 1 });
                  }}
                  className={`w-full flex items-center gap-2.5 p-3 rounded-2xl text-xs font-bold transition ${
                    dark
                      ? "bg-white/5 hover:bg-rose-500/20 text-rose-400"
                      : "bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200"
                  }`}
                >
                  <UserMinus className="w-4 h-4" />
                  <span>إنزال العضو من المقعد (إلى المستمعين)</span>
                </button>

                {/* View profile */}
                {selectedOccupant && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSeatForSheet(null);
                      setProfileModalUser(selectedOccupant);
                    }}
                    className={`w-full flex items-center gap-2.5 p-3 rounded-2xl text-xs font-bold transition ${
                      dark
                        ? "bg-white/5 hover:bg-white/10 text-white"
                        : "bg-slate-100 hover:bg-slate-200/80 text-slate-800 border border-slate-200/60"
                    }`}
                  >
                    <UserCheck className="w-4 h-4 text-sky-400" />
                    <span>عرض الملف الشخصي</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 7. MULTI-GUEST / MIC REQUESTS SHEET                      */}
      {/* ======================================================== */}
      {multiGuestOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-xs animate-fade-in"
          onClick={() => setMultiGuestOpen(false)}
        >
          <div
            className={`w-full max-w-lg rounded-t-3xl border-t p-4 shadow-2xl animate-slide-up max-h-[85vh] flex flex-col ${
              dark
                ? "bg-[#0B0B0D] border-white/15 text-white"
                : "bg-white border-slate-200 text-slate-900"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`w-12 h-1 rounded-full mx-auto mb-3 ${dark ? "bg-white/20" : "bg-slate-300"}`} />

            <div className={`flex items-center justify-between pb-3 border-b mb-3 ${dark ? "border-white/10" : "border-slate-200"}`}>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#FE2C55]" />
                <h3 className={`text-sm font-extrabold ${dark ? "text-white" : "text-slate-900"}`}>
                  وضع تعدد الضيوف وإدارة الطلبات
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setMultiGuestOpen(false)}
                className={`p-1 rounded-full ${dark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-800"}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mode Switcher */}
            {isStaff && (
              <div className={`p-3 rounded-2xl border mb-3 space-y-2 ${dark ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200"}`}>
                <span className={`text-xs font-bold ${dark ? "text-slate-300" : "text-slate-700"}`}>
                  وضع الانضمام للمقاعد:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (activeRoom) {
                        updateLiveSettings({
                          roomId: activeRoom.id,
                          join_mode: "free",
                        });
                        pushNotice("تم تحويل الغرفة إلى الصعود الحر", { force: 1 });
                      }
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                      liveConfig.join_mode === "free"
                        ? "bg-emerald-500/20 border-emerald-500 text-emerald-500 font-black shadow-xs"
                        : dark
                          ? "bg-white/5 border-white/10 text-slate-400"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    صعود حر للجميع
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (activeRoom) {
                        updateLiveSettings({
                          roomId: activeRoom.id,
                          join_mode: "request",
                        });
                        pushNotice("تم تفعيل وضع طلب الموافقة للصعود", { force: 1 });
                      }
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition ${
                      liveConfig.join_mode === "request"
                        ? "bg-[#FE2C55]/20 border-[#FE2C55] text-[#FE2C55] font-black shadow-xs"
                        : dark
                          ? "bg-white/5 border-white/10 text-slate-400"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    بطلب موافقة المضيف
                  </button>
                </div>
              </div>
            )}

            {/* Tabs: Requests & Online Members to Invite */}
            <div className="flex-1 overflow-y-auto chat-scroll space-y-3 pr-1">
              <div>
                <span className={`text-xs font-bold block mb-2 ${dark ? "text-slate-400" : "text-slate-600"}`}>
                  طلبات الصعود للمايك ({pendingRequests.length}):
                </span>

                {pendingRequests.length === 0 ? (
                  <div className={`py-4 text-center text-xs rounded-2xl border ${
                    dark
                      ? "text-slate-500 bg-white/5 border-white/5"
                      : "text-slate-500 bg-slate-50 border-slate-200/80"
                  }`}>
                    لا توجد طلبات صعود معلقة حالياً.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pendingRequests.map((req) => (
                      <div
                        key={req.socketId}
                        className={`flex items-center justify-between p-3 rounded-2xl border ${
                          dark
                            ? "bg-white/5 border-white/10"
                            : "bg-slate-50 border-slate-200/80 shadow-xs"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-full overflow-hidden bg-slate-800">
                            <img
                              src={resolveAssetUrl(req.pic || "pic.png", "user", "/default-avatar.png")}
                              alt={req.topic}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex flex-col">
                            <span className={`text-xs font-extrabold ${dark ? "text-white" : "text-slate-900"}`}>
                              {req.topic}
                            </span>
                            <span className={`text-[10px] ${dark ? "text-slate-400" : "text-slate-500"}`}>
                              يريد الصعود {req.slot ? `للمقعد ${req.slot}` : "للمايك"}
                            </span>
                          </div>
                        </div>

                        {isStaff && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                const nextSlot =
                                  req.slot ||
                                  slots.find((s) => !s.active && !s.locked)?.slot ||
                                  2;
                                approveSlotRequest(req.socketId, nextSlot);
                                setPendingRequests((prev) =>
                                  prev.filter((p) => p.socketId !== req.socketId),
                                );
                                pushNotice(`تمت الموافقة على صعود ${req.topic}`, { force: 1 });
                              }}
                              className="py-1 px-3 rounded-xl bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-400 transition"
                            >
                              قبول
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                rejectSlotRequest(req.socketId);
                                setPendingRequests((prev) =>
                                  prev.filter((p) => p.socketId !== req.socketId),
                                );
                              }}
                              className={`py-1 px-2.5 rounded-xl text-xs font-bold transition ${
                                dark
                                  ? "bg-white/10 text-slate-400 hover:text-white"
                                  : "bg-slate-200 text-slate-600 hover:text-slate-900"
                              }`}
                            >
                              رفض
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Audience list to invite */}
              {isStaff && (
                <div>
                  <span className={`text-xs font-bold block mb-2 ${dark ? "text-slate-400" : "text-slate-600"}`}>
                    المستمعون في الغرفة ({allRoomMembers.length}):
                  </span>
                  <div className="space-y-2">
                    {allRoomMembers
                      .filter((u) => u.id !== me?.id)
                      .map((u) => {
                        const isSeated = slots.some((s) => s.active && s.occupantId === u.id);
                        return (
                          <div
                            key={u.id}
                            className={`flex items-center justify-between p-2.5 rounded-2xl border ${
                              dark
                                ? "bg-white/5 border-white/5"
                                : "bg-slate-50 border-slate-200/80 shadow-xs"
                            }`}
                          >
                            <div
                              className="flex items-center gap-2 cursor-pointer"
                              onClick={() => setProfileModalUser(u)}
                            >
                              <div className="w-7 h-7 rounded-full overflow-hidden bg-slate-800">
                                <img
                                  src={resolveAssetUrl(u.pic || "pic.png", "user", "/default-avatar.png")}
                                  alt={u.topic}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <span className={`text-xs font-bold truncate max-w-[120px] ${dark ? "text-white" : "text-slate-900"}`}>
                                {u.topic}
                              </span>
                            </div>

                            {isSeated ? (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                                dark
                                  ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                                  : "text-emerald-700 bg-emerald-50 border-emerald-200"
                              }`}>
                                على المايك
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  const nextSlot =
                                    slots.find((s) => !s.active && !s.locked)?.slot || 2;
                                  inviteToSlot(u.id, nextSlot);
                                  pushNotice(`تم إرسال دعوة الصعود إلى ${u.topic}`, { force: 1 });
                                }}
                                className="py-1 px-2.5 rounded-xl bg-[#FE2C55] text-white text-[11px] font-bold hover:brightness-110 transition"
                              >
                                دعوة للمايك
                              </button>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 8. AUDIENCE MODAL                                        */}
      {/* ======================================================== */}
      {audienceModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fade-in"
          onClick={() => setAudienceModalOpen(false)}
        >
          <div
            className={`w-full max-w-sm rounded-3xl border p-4 shadow-2xl max-h-[75vh] flex flex-col ${
              dark
                ? "bg-[#0B0B0D] border-white/15 text-white"
                : "bg-white border-slate-200 text-slate-900"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex items-center justify-between pb-2 border-b mb-3 ${dark ? "border-white/10" : "border-slate-200"}`}>
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-sky-400" />
                <h4 className={`text-xs font-extrabold ${dark ? "text-white" : "text-slate-900"}`}>
                  المتواجدون في الغرفة ({allRoomMembers.length})
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setAudienceModalOpen(false)}
                className={`p-1 rounded-full ${dark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-800"}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto chat-scroll space-y-2">
              {allRoomMembers.map((u) => {
                const isSeated = slots.some((s) => s.active && s.occupantId === u.id);
                return (
                  <div
                    key={u.id}
                    className={`flex items-center justify-between p-2 rounded-xl border transition ${
                      dark
                        ? "bg-white/5 hover:bg-white/10 border-white/5"
                        : "bg-slate-50 hover:bg-slate-100 border-slate-100"
                    }`}
                  >
                    <div
                      className="flex items-center gap-2 cursor-pointer flex-1 min-w-0"
                      onClick={() => {
                        setAudienceModalOpen(false);
                        setProfileModalUser(u);
                      }}
                    >
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-800 shrink-0">
                        <img
                          src={resolveAssetUrl(u.pic || "pic.png", "user", "/default-avatar.png")}
                          alt={u.topic}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className={`text-xs font-bold truncate ${dark ? "text-white" : "text-slate-900"}`}>
                          {u.topic}
                        </span>
                        <span className={`text-[10px] ${dark ? "text-slate-400" : "text-slate-500"}`}>
                          {u.id === hostUser?.id
                            ? "المضيف"
                            : isSeated
                              ? "متحدث على المقعد"
                              : "مستمع"}
                        </span>
                      </div>
                    </div>

                    {isStaff && u.id !== me?.id && !isSeated && (
                      <button
                        type="button"
                        onClick={() => {
                          const nextSlot =
                            slots.find((s) => !s.active && !s.locked)?.slot || 2;
                          inviteToSlot(u.id, nextSlot);
                          pushNotice(`تم إرسال دعوة الصعود إلى ${u.topic}`, { force: 1 });
                        }}
                        className="py-1 px-2.5 rounded-xl bg-[#FE2C55] text-white text-[11px] font-bold hover:brightness-110 transition shrink-0"
                      >
                        دعوة للمايك
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 8.5. SUPPORTERS LEADERBOARD MODAL (لوحة شرف الداعمين)    */}
      {/* ======================================================== */}
      {supportersModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fade-in"
          onClick={() => setSupportersModalOpen(false)}
        >
          <div
            className={`w-full max-w-sm rounded-3xl border p-4 shadow-2xl max-h-[75vh] flex flex-col ${
              dark
                ? "bg-[#0B0B0D] border-white/15 text-white"
                : "bg-white border-slate-200 text-slate-900"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex items-center justify-between pb-3 border-b mb-3 ${dark ? "border-white/10" : "border-slate-200"}`}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-400 to-amber-600 flex items-center justify-center text-black font-black text-sm shadow-md">
                  👑
                </div>
                <div>
                  <h4 className={`text-xs font-extrabold ${dark ? "text-white" : "text-slate-900"}`}>لوحة شرف الداعمين</h4>
                  <p className={`text-[10px] ${dark ? "text-slate-400" : "text-slate-500"}`}>أبرز الداعمين والمتفاعلين في هذا البث</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSupportersModalOpen(false)}
                className={`p-1 rounded-full ${dark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-800"}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto chat-scroll space-y-2">
              {topSupporters.length === 0 ? (
                <div className={`py-8 text-center text-xs ${dark ? "text-slate-400" : "text-slate-600"}`}>
                  <div className="text-3xl mb-2">🎁</div>
                  <div>لا يوجد داعمون حتى الآن</div>
                  <div className={`text-[11px] mt-1 ${dark ? "text-slate-500" : "text-slate-400"}`}>
                    كن أول من يدعم البث بإرسال هدية أو التكبيس!
                  </div>
                </div>
              ) : (
                topSupporters.map((s, idx) => (
                  <div
                    key={s.id}
                    className={`flex items-center justify-between p-2.5 rounded-2xl border transition ${
                      dark
                        ? "bg-white/5 border-white/5 hover:bg-white/10"
                        : "bg-slate-50 border-slate-200/80 hover:bg-slate-100"
                    }`}
                  >
                    <div
                      className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0"
                      onClick={() => {
                        setSupportersModalOpen(false);
                        setProfileModalUser(s);
                      }}
                    >
                      <span
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                          idx === 0
                            ? "bg-amber-400 text-black shadow-md shadow-amber-500/30"
                            : idx === 1
                              ? "bg-slate-300 text-black shadow-md shadow-slate-400/30"
                              : idx === 2
                                ? "bg-amber-700 text-white"
                                : dark ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <div className="w-9 h-9 rounded-full overflow-hidden bg-slate-800 shrink-0">
                        <img
                          src={resolveAssetUrl(s.pic || "pic.png", "user", "/default-avatar.png")}
                          alt={s.topic}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className={`text-xs font-extrabold truncate ${dark ? "text-white" : "text-slate-900"}`}>{s.topic}</span>
                        <span className={`text-[10px] flex items-center gap-2 ${dark ? "text-slate-400" : "text-slate-500"}`}>
                          {s.totalCoins > 0 ? (
                            <span className="text-amber-400 font-mono font-bold">{s.totalCoins} 🪙</span>
                          ) : (
                            <span>داعم بالتفاعل</span>
                          )}
                          {s.likesCount > 0 && (
                            <span className="text-rose-400 font-mono">{s.likesCount} ❤️</span>
                          )}
                        </span>
                      </div>
                    </div>

                    {!isHost && (
                      <button
                        type="button"
                        onClick={() => {
                          setSupportersModalOpen(false);
                          setGiftPickerOpen(true);
                        }}
                        className="py-1 px-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 text-white text-[10px] font-extrabold shadow-sm hover:brightness-110 transition shrink-0"
                      >
                        دعم 🎁
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 9. EXPLORE ACTIVE VOICE ROOMS MODAL                      */}
      {/* ======================================================== */}
      {exploreModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fade-in"
          onClick={() => setExploreModalOpen(false)}
        >
          <div
            className={`w-full max-w-sm rounded-3xl border p-4 shadow-2xl max-h-[75vh] flex flex-col ${
              dark
                ? "bg-[#0B0B0D] border-white/15 text-white"
                : "bg-white border-slate-200 text-slate-900"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex items-center justify-between pb-2 border-b mb-3 ${dark ? "border-white/10" : "border-slate-200"}`}>
              <div className="flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-amber-400" />
                <h4 className={`text-xs font-extrabold ${dark ? "text-white" : "text-slate-900"}`}>
                  استكشاف القنوات الصوتية المباشرة
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setExploreModalOpen(false)}
                className={`p-1 rounded-full ${dark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-800"}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto chat-scroll space-y-2">
              {activeVoiceRooms.length === 0 ? (
                <div className={`py-8 text-center text-xs ${dark ? "text-slate-500" : "text-slate-400"}`}>
                  لا توجد قنوات صوتية أخرى نشطة حالياً.
                </div>
              ) : (
                activeVoiceRooms.map((r) => (
                  <div
                    key={r.id}
                    className={`flex items-center justify-between p-2.5 rounded-2xl transition border ${
                      dark
                        ? "bg-white/5 hover:bg-white/10 border-white/5"
                        : "bg-slate-50 hover:bg-slate-100 border-slate-200/80"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-2xl overflow-hidden bg-slate-800 shrink-0 border border-white/10">
                        <img
                          src={resolveAssetUrl(r.pic || "pic.png", "room", "/default-avatar.png")}
                          alt={r.topic}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className={`text-xs font-extrabold truncate ${dark ? "text-white" : "text-slate-900"}`}>
                          {r.topic}
                        </span>
                        <span className={`text-[10px] flex items-center gap-1 ${dark ? "text-slate-400" : "text-slate-500"}`}>
                          <Users className="w-2.5 h-2.5" />
                          <span>{roomsCounts[r.id] ?? r.onlineCount ?? 0} متواجد</span>
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setExploreModalOpen(false);
                        joinRoom(r.id);
                      }}
                      className="py-1 px-3 rounded-xl bg-[#FE2C55] hover:bg-rose-500 text-white text-xs font-bold transition shrink-0"
                    >
                      دخول
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 10. HOST ROOM SETTINGS & SOUNDBOARD SHEET                */}
      {/* ======================================================== */}
      {settingsOpen && isStaff && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-xs animate-fade-in"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className={`w-full max-w-lg rounded-t-3xl border-t p-4 shadow-2xl animate-slide-up max-h-[85vh] flex flex-col ${
              dark
                ? "bg-[#0B0B0D] border-white/15 text-white"
                : "bg-white border-slate-200 text-slate-900"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`w-12 h-1 rounded-full mx-auto mb-3 ${dark ? "bg-white/20" : "bg-slate-300"}`} />

            <div className={`flex items-center justify-between pb-3 border-b mb-3 ${dark ? "border-white/10" : "border-slate-200"}`}>
              <div className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-[#FE2C55]" />
                <h3 className={`text-sm font-extrabold ${dark ? "text-white" : "text-slate-900"}`}>إعدادات البث الصوتي</h3>
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className={`p-1 rounded-full ${dark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-800"}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto chat-scroll space-y-4 pr-1">
              {/* Interactive Soundboard */}
              <div>
                <span className={`block text-xs font-bold mb-2 ${dark ? "text-slate-300" : "text-slate-700"}`}>
                  المؤثرات الصوتية المباشرة (Sound Effects):
                </span>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: "applause", name: "تصفيق 👏", icon: "👏" },
                    { id: "laughter", name: "ضحك 😂", icon: "😂" },
                    { id: "cheer", name: "تشجيع 🎉", icon: "🎉" },
                    { id: "drums", name: "دراما 🥁", icon: "🥁" },
                  ].map((sfx) => (
                    <button
                      key={sfx.id}
                      type="button"
                      onClick={() => handlePlaySoundFx(sfx.id)}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border text-center transition ${
                        activeFxName === sfx.id
                          ? "bg-amber-500/20 border-amber-400 scale-95"
                          : dark
                            ? "bg-white/5 border-white/10 hover:bg-white/10"
                            : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <span className="text-xl mb-1">{sfx.icon}</span>
                      <span className={`text-[10px] font-bold ${dark ? "text-slate-300" : "text-slate-700"}`}>
                        {sfx.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Chat Lock Toggle */}
              <div className={`flex items-center justify-between p-3 rounded-2xl border ${
                dark ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200"
              }`}>
                <div className="flex flex-col">
                  <span className={`text-xs font-bold ${dark ? "text-white" : "text-slate-900"}`}>قفل الدردشة للجميع</span>
                  <span className={`text-[10px] ${dark ? "text-slate-400" : "text-slate-500"}`}>
                    السماح للمضيف والمشرفين فقط بالكتابة
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (activeRoom) {
                      updateLiveSettings({
                        roomId: activeRoom.id,
                        chat_locked: !liveConfig.chat_locked,
                      });
                      pushNotice(
                        !liveConfig.chat_locked
                          ? "تم قفل الدردشة للجميع"
                          : "تم فتح الدردشة للجميع",
                        { force: 1 },
                      );
                    }
                  }}
                  className={`w-12 h-6 rounded-full transition p-0.5 flex items-center ${
                    liveConfig.chat_locked
                      ? "bg-[#FE2C55] justify-end"
                      : dark
                        ? "bg-white/20 justify-start"
                        : "bg-slate-300 justify-start"
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-white shadow-md" />
                </button>
              </div>

              {/* Live Broadcast Stats */}
              <div className={`p-3 rounded-2xl border space-y-2 ${
                dark ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200"
              }`}>
                <span className={`text-xs font-bold ${dark ? "text-slate-300" : "text-slate-700"}`}>إحصائيات البث الحالية:</span>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className={`p-2 rounded-xl ${dark ? "bg-black/40" : "bg-white border border-slate-200 shadow-xs"}`}>
                    <span className={`text-[10px] block ${dark ? "text-slate-400" : "text-slate-500"}`}>مدة البث</span>
                    <span className="text-xs font-mono font-black text-amber-500">
                      {formattedDuration}
                    </span>
                  </div>
                  <div className={`p-2 rounded-xl ${dark ? "bg-black/40" : "bg-white border border-slate-200 shadow-xs"}`}>
                    <span className={`text-[10px] block ${dark ? "text-slate-400" : "text-slate-500"}`}>المستمعين</span>
                    <span className="text-xs font-mono font-black text-sky-500">
                      {listenersCount}
                    </span>
                  </div>
                  <div className={`p-2 rounded-xl ${dark ? "bg-black/40" : "bg-white border border-slate-200 shadow-xs"}`}>
                    <span className={`text-[10px] block ${dark ? "text-slate-400" : "text-slate-500"}`}>الإعجابات</span>
                    <span className="text-xs font-mono font-black text-rose-500">
                      {heartsCount}
                    </span>
                  </div>
                </div>
              </div>

              {/* End Live Button */}
              {isHost && (
                <button
                  type="button"
                  onClick={() => {
                    setSettingsOpen(false);
                    setEndLiveConfirmOpen(true);
                  }}
                  className="w-full py-3 px-4 rounded-2xl bg-rose-600 hover:bg-rose-500 active:scale-98 text-white font-extrabold text-xs shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 transition"
                >
                  <Radio className="w-4 h-4" />
                  <span>إنهاء البث الصوتي نهائياً (End Live)</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 11. END LIVE CONFIRMATION MODAL (Host)                   */}
      {/* ======================================================== */}
      {endLiveConfirmOpen && (
        <div
          dir="rtl"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fade-in"
          onClick={() => setEndLiveConfirmOpen(false)}
        >
          <div
            className={`w-full max-w-sm rounded-3xl border p-6 text-center shadow-2xl animate-scale-up space-y-4 ${
              dark
                ? "bg-[#0B0B0D] border-white/15 text-white"
                : "bg-white border-slate-200 text-slate-900"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 rounded-full bg-rose-500/20 text-rose-500 border border-rose-500/30 mx-auto flex items-center justify-center">
              <Radio className="w-7 h-7" />
            </div>

            <div>
              <h3 className={`text-base font-black ${dark ? "text-white" : "text-slate-900"}`}>هل تريد إنهاء البث الصوتي؟</h3>
              <p className={`text-xs mt-1 leading-relaxed ${dark ? "text-slate-400" : "text-slate-600"}`}>
                عند إنهاء البث، سيتم إغلاق القناة الصوتية وإخلاء المقاعد وإزالة القناة من القائمة النشطة وعرض ملخص البث.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={handleConfirmEndLive}
                className="w-full py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 active:scale-98 text-white font-extrabold text-xs shadow-lg shadow-rose-600/30 transition"
              >
                إنهاء البث نهائياً
              </button>

              <button
                type="button"
                onClick={() => setEndLiveConfirmOpen(false)}
                className={`w-full py-2.5 rounded-2xl font-bold text-xs transition ${
                  dark
                    ? "bg-white/10 hover:bg-white/15 text-slate-300"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                }`}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 12. END LIVE SUMMARY MODAL                               */}
      {/* ======================================================== */}
      {endLiveSummaryOpen && (
        <div
          dir="rtl"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in"
        >
          <div className={`w-full max-w-sm rounded-3xl border p-6 text-center shadow-2xl animate-scale-up space-y-4 ${
            dark
              ? "bg-[#0B0B0D] border-white/15 text-white"
              : "bg-white border-slate-200 text-slate-900"
          }`}>
            <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-[#FE2C55] to-rose-400 mx-auto flex items-center justify-center text-white shadow-xl shadow-rose-500/30">
              <Award className="w-7 h-7" />
            </div>

            <div>
              <h3 className={`text-lg font-black ${dark ? "text-white" : "text-slate-900"}`}>ملخص البث الصوتي</h3>
              <p className={`text-xs mt-1 ${dark ? "text-slate-400" : "text-slate-600"}`}>
                شكراً لبثك المميز! إليك أهم إحصائيات البث الفعلية:
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-right">
              <div className={`p-3 rounded-2xl border ${
                dark ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200 shadow-xs"
              }`}>
                <span className={`text-[10px] block ${dark ? "text-slate-400" : "text-slate-500"}`}>مدة البث</span>
                <span className="text-sm font-mono font-black text-amber-500">
                  {formattedDuration}
                </span>
              </div>
              <div className={`p-3 rounded-2xl border ${
                dark ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200 shadow-xs"
              }`}>
                <span className={`text-[10px] block ${dark ? "text-slate-400" : "text-slate-500"}`}>ذروة المستمعين</span>
                <span className="text-sm font-mono font-black text-sky-500">
                  {peakListeners} مستمع
                </span>
              </div>
              <div className={`p-3 rounded-2xl border ${
                dark ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200 shadow-xs"
              }`}>
                <span className={`text-[10px] block ${dark ? "text-slate-400" : "text-slate-500"}`}>إجمالي القلوب</span>
                <span className="text-sm font-mono font-black text-rose-500">
                  {heartsCount} 🤍
                </span>
              </div>
              <div className={`p-3 rounded-2xl border ${
                dark ? "bg-white/5 border-white/10" : "bg-slate-50 border-slate-200 shadow-xs"
              }`}>
                <span className={`text-[10px] block ${dark ? "text-slate-400" : "text-slate-500"}`}>الهدايا المستلمة</span>
                <span className="text-sm font-mono font-black text-emerald-500">
                  {currentGiftsCount} هدية
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 rounded-2xl bg-[#FE2C55] hover:bg-rose-500 text-white font-extrabold text-xs shadow-lg shadow-rose-600/30 transition"
            >
              العودة إلى التطبيق
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 13. INVITE LISTENER MODAL                                */}
      {/* ======================================================== */}
      {inviteModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fade-in"
          onClick={() => setInviteModalOpen(false)}
        >
          <div
            className={`w-full max-w-sm rounded-3xl border p-4 shadow-2xl max-h-[70vh] flex flex-col ${
              dark
                ? "bg-[#0B0B0D] border-white/15 text-white"
                : "bg-white border-slate-200 text-slate-900"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex items-center justify-between pb-2 border-b mb-3 ${dark ? "border-white/10" : "border-slate-200"}`}>
              <h4 className={`text-xs font-extrabold ${dark ? "text-white" : "text-slate-900"}`}>دعوة مستمع للصعود على المايك</h4>
              <button
                type="button"
                onClick={() => setInviteModalOpen(false)}
                className={`p-1 rounded-full ${dark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-800"}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto chat-scroll space-y-2">
              {allRoomMembers
                .filter((u) => u.id !== me?.id)
                .map((u) => (
                  <div
                    key={u.id}
                    className={`flex items-center justify-between p-2 rounded-xl border transition ${
                      dark
                        ? "bg-white/5 hover:bg-white/10 border-white/5"
                        : "bg-slate-50 hover:bg-slate-100 border-slate-100"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full overflow-hidden bg-slate-800">
                        <img
                          src={resolveAssetUrl(u.pic || "pic.png", "user", "/default-avatar.png")}
                          alt={u.topic}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span className={`text-xs font-bold truncate max-w-[120px] ${dark ? "text-white" : "text-slate-900"}`}>
                        {u.topic}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const nextSlot =
                          slots.find((s) => !s.active && !s.locked)?.slot || 2;
                        inviteToSlot(u.id, nextSlot);
                        setInviteModalOpen(false);
                        pushNotice(`تم إرسال دعوة الصعود إلى ${u.topic}`, { force: 1 });
                      }}
                      className="py-1 px-3 rounded-xl bg-[#FE2C55] text-white text-[11px] font-bold hover:brightness-110 transition"
                    >
                      دعوة للمايك
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 14. GIFTS MODAL & USER PROFILE MODAL                     */}
      {/* ======================================================== */}
      {giftPickerOpen && (
        <GiftPickerModal
          dark={dark}
          target={hostUser || (me as any)}
          onClose={() => setGiftPickerOpen(false)}
          onOpenWallet={() => {
            if (onOpenWallet) onOpenWallet();
          }}
        />
      )}

      {profileModalUser && (
        <UserProfileModal
          dark={dark}
          user={profileModalUser}
          onClose={() => setProfileModalUser(null)}
          onStartPm={() => {
            setProfileModalUser(null);
            if (onSelectUser) onSelectUser(profileModalUser);
          }}
          onOpenGift={() => {
            setProfileModalUser(null);
            setGiftPickerOpen(true);
          }}
          onOpenMail={() => {
            setProfileModalUser(null);
            if (onOpenMail) onOpenMail();
          }}
          onMention={(mentionText) => {
            setProfileModalUser(null);
            setChatDraft((d) => (d ? `${d} ${mentionText} ` : `${mentionText} `));
          }}
        />
      )}
    </div>
  );
}
