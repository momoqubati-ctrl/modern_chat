# Graph Report - newchat  (2026-11-21)

## Corpus Check
- 316 files · ~603,010 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 12 file(s) not represented in the graph (top: .css 5, .example 1, (none) 1)

## Summary
- 3171 nodes · 8987 edges · 158 communities (142 shown, 16 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 217 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7e42d3cd`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- PresenceDirectory
- authHandlers.ts
- NewChatSocketClient
- cp.ts
- Sections
- getDb
- jquery.js
- CatalogStore
- carromManager.ts
- MediaMiniPlayer.tsx
- getDb
- safeJsonParse
- startGateway
- viteLanHttps.ts
- src/components/PrivateChatDock.tsx
- NewChatApiClient
- gateway/package.json
- main.js
- gateway/src/index.ts
- useChatStore.ts
- src/components/ChatRoomWorkspace.tsx
- OnlineUserSnapshot
- LudoManager
- src/lib/mediaUrl.ts
- schema/feed.ts
- wallet.ts
- apps-web-src/components/UserProfileModal.tsx
- constants.ts
- lucide-react
- worker/package.json
- src/App.tsx
- LudoArenaClient
- media.ts
- api/src/index.ts
- mobile/package.json
- core-client/src/index.ts
- Web Performance Audit
- apps-web-src/lib/mediaUrl.ts
- idempotencyService.ts
- boardRenderer.ts
- scripts
- core-client/package.json
- public.ts
- apps-web-src/components/ChatRoomWorkspace.tsx
- apps-web-src/components/UserProfileModal.tsx
- registerLudoNamespace
- getDb
- CarromGameExperience.tsx
- rbac.ts
- engine.ts
- React + Vite Best Practices
- LudoBoard.tsx
- CarromArenaClient
- db/package.json
- registerCarromNamespace
- schema/index.ts
- validators.ts
- shared/package.json
- dependencies
- gamesData.ts
- MemberAvatar
- ludoEngine.ts
- socketClient.ts
- CarromGameExperience
- voiceCredentials.ts
- compilerOptions
- Performance Optimization
- mediaResolver.ts
- expo
- src/hooks/useMicStageAudio.ts
- Hooks and Server Actions
- Lighthouse and Lighthouse CI
- EvaluationEngine
- shapeFunc.js
- carromSoundPool
- src/lib/permissions.ts
- apps-web-src/pages/CarromArenaPage.tsx
- Node.js Performance
- economyEngine.ts
- React Compiler
- Profiling and Debugging
- Categories
- compilerOptions
- compilerOptions
- HostingOwnerPortal.tsx
- react-patterns/SKILL.md
- Code Splitting
- Media, lists and rendering in the browser
- coinFunc.js
- web/package.json
- validators.ts
- FilterService
- tasks
- Troubleshooting
- Component Patterns
- Server-Side Rendering
- Rendering Optimization
- JavaScript on the main thread
- dependencies
- devDependencies
- Sections
- Trace one slow interaction
- api/tsconfig.json
- gateway/tsconfig.json
- worker/tsconfig.json
- core-client/tsconfig.json
- What each signal means
- نسخة احتياطية لقاعدة البيانات (NewChat Database Backup)
- smoke-e2e.ts
- db/tsconfig.json
- shared/tsconfig.json
- Anti-Patterns and Troubleshooting
- Eliminating Waterfalls (CRITICAL)
- React Performance
- textFilter.ts
- boardSetup.js
- apps-web-src/components/RoomCarromModal.tsx
- apps-web-src/components/ChatComposer.tsx
- Re-render Optimization Techniques
- React DevTools Profiler
- Web performance
- NewChat v2.0 (بنية حديثة بدون Docker لملايين المستخدمين)
- Common Bottleneck Patterns
- When to Use Manual Memoization
- React + Vite Best Practices - Complete Reference
- asset-fonts.md
- asset-image-optimization.md
- asset-public-dir.md
- asset-svg-components.md
- build-asset-hashing.md
- build-compression.md
- build-manual-chunks.md
- build-minification.md
- build-sourcemaps.md
- build-target-modern.md
- build-tree-shaking.md
- bundle-visualizer.md
- dev-dependency-prebundling.md
- dev-fast-refresh.md
- dev-hmr-config.md
- env-modes.md
- env-sensitive-data.md
- env-vite-prefix.md
- split-component-lazy.md
- split-dynamic-imports.md
- split-prefetch-hints.md
- split-route-lazy.md
- split-suspense-boundaries.md
- _template.md
- api/src/types/password-hash.d.ts
- gateway/src/types/password-hash.d.ts
- scripts
- src/main.tsx

## God Nodes (most connected - your core abstractions)
1. `useChatStore` - 212 edges
2. `getDb()` - 162 edges
3. `getRedis()` - 116 edges
4. `NewChatSocketClient` - 109 edges
5. `lucide-react` - 95 edges
6. `handleCpCommand()` - 93 edges
7. `CatalogStore` - 90 edges
8. `resolveAssetUrl()` - 86 edges
9. `Sections` - 76 edges
10. `startGateway()` - 56 edges

## Surprising Connections (you probably didn't know these)
- `Setup` --references--> `dist()`  [INFERRED]
  .agents/skills/web-performance/LIGHTHOUSE-CI.md → apps/web/public/carrom-game/js/coinFunc.js
- `Stale Closures` --references--> `setState()`  [INFERRED]
  .agents/skills/react-patterns/references/anti-patterns.md → apps/web/src/lib/mediaPlaybackStore.ts
- `Let scrolling start at once` --references--> `Window`  [INFERRED]
  .agents/skills/web-performance/MAIN-THREAD.md → apps/web/src/components/media/MediaMiniPlayer.tsx
- `LudoArenaRoomRecord` --references--> `LudoGameState`  [EXTRACTED]
  apps/gateway/src/namespaces/ludoNamespace.ts → packages/shared/src/types.ts
- `UseMicStageAudioResult` --references--> `MicProviderMode`  [EXTRACTED]
  apps/web/src/hooks/useMicStageAudio.ts → packages/shared/src/types.ts

## Import Cycles
- None detected.

## Communities (158 total, 16 thin omitted)

### Community 0 - "PresenceDirectory"
Cohesion: 0.09
Nodes (11): sanitizePublicSnapshot(), BusBridge, isActiveRoomMember(), PresenceDirectory, roomMembersKey(), TalkingBotCoordinator, GatewaySession, BusEvent (+3 more)

### Community 1 - "authHandlers.ts"
Cohesion: 0.07
Nodes (65): here, buildInitialWallPosts(), createAuthHandlers(), completeSessionEntry(), disconnectUserSession(), finalizeSessionRemoval(), loadInitialStories(), releasePmCallsForSocket() (+57 more)

### Community 3 - "cp.ts"
Cohesion: 0.07
Nodes (82): createLockedSlotsJson(), ensureBotLoadTestRooms(), randomIp(), runTalkingBotsSeed(), AgentPanelActor, applyCoinsToOnlineUser(), broadcastCmd(), DDOS_NORMAL_CFG (+74 more)

### Community 4 - "Sections"
Cohesion: 0.03
Nodes (76): 1. Build Optimization (build), 2. Code Splitting (split), 3. Development (dev), 4. Asset Handling (asset), 5. Environment Config (env), 6. Bundle Analysis (bundle), Bundle Analysis with Visualizer, Configure Asset Hashing for Cache Busting (+68 more)

### Community 5 - "getDb"
Cohesion: 0.10
Nodes (57): approveTopupOrderAtomic(), approveTopupOrderByAgentAtomic(), buildAgentActorLabel(), buildAgentCode(), buildEmptyAgentTopupReport(), buildOwnerAgentReportsSummary(), buildTopupOrderNo(), buildTopupReceiptAbsolutePath() (+49 more)

### Community 6 - "jquery.js"
Cohesion: 0.07
Nodes (44): b(), c(), d(), f(), $a(), Ab(), B(), Ea() (+36 more)

### Community 7 - "CatalogStore"
Cohesion: 0.05
Nodes (9): CatalogStore, escapeRegex(), FilterService, GatewayOwnerState, GatewayRoomRecord, ProhibitedWordRule, GiftDefinition, RoomBadge (+1 more)

### Community 8 - "carromManager.ts"
Cohesion: 0.14
Nodes (15): CarromManager, acquireCarromLock(), addUidSocket(), beginRedisIdempotent(), BUS_CHANNEL, CarromLockHandle, completeRedisIdempotent(), getRecentChatMessages() (+7 more)

### Community 9 - "MediaMiniPlayer.tsx"
Cohesion: 0.08
Nodes (44): Stale Closures, clampToViewport(), computeRatio(), DragState, estimatePlayerSize(), hasUsableViewport(), initialPosition(), loadYouTubeApi() (+36 more)

### Community 10 - "getDb"
Cohesion: 0.19
Nodes (22): registerFeedRoutes(), requireAuth(), resolveOptionalAuth(), addPostComment(), createFeedPost(), deleteFeedPost(), deletePostComment(), FeedAuthor (+14 more)

### Community 11 - "safeJsonParse"
Cohesion: 0.12
Nodes (8): safeJsonParse(), emptySlots(), MicStageManager, normalizeSlotLocks(), normalizeStageSnapshot(), parseSafeLiveKitHttpBase(), StageMediaAuthority, verRoomsOwner()

### Community 12 - "startGateway"
Cohesion: 0.13
Nodes (5): deleteKeysByPattern(), startGateway(), runGuarded(), emitGatewayError(), SecurityGuard

### Community 13 - "viteLanHttps.ts"
Cohesion: 0.18
Nodes (6): ensureDevTlsMaterial(), findOpenSslBinary(), lanHttpsCompanionPlugin(), @tailwindcss/vite, vite, @vitejs/plugin-react

### Community 14 - "src/components/PrivateChatDock.tsx"
Cohesion: 0.07
Nodes (64): ChatComposer(), PendingMedia, buildWaveform(), formatClock(), hashString(), VoiceNotePlayer, VoiceNotePlayerImpl(), VoiceNotePlayerProps (+56 more)

### Community 16 - "gateway/package.json"
Cohesion: 0.05
Nodes (43): dependencies, bcryptjs, dotenv, ioredis, livekit-server-sdk, @newchat/db, @newchat/shared, password-hash (+35 more)

### Community 18 - "main.js"
Cohesion: 0.13
Nodes (36): applyPlayerView(), applySnapshot(), beginMatch(), buildSnapshot(), canControlTurn(), checkOverlap(), checkRedPresent(), connectMultiplayer() (+28 more)

### Community 19 - "gateway/src/index.ts"
Cohesion: 0.10
Nodes (32): gatewayConfig, createCallsMediaHandlers(), isSocketBusyInCall(), PmCallLockRecord, createMicStageHandlers(), ACTION_SHORTHAND_CMDS, extractDeviceFingerprint(), geoLookupCache (+24 more)

### Community 20 - "useChatStore.ts"
Cohesion: 0.06
Nodes (41): ActiveCompetitionGame, FALLBACK_SAMPLE_NOTES, AuthenticatedMember, AuthResponse, AuthTokenBundle, BootstrapResponse, BootstrapSiteConfig, RequestOptions (+33 more)

### Community 21 - "src/components/ChatRoomWorkspace.tsx"
Cohesion: 0.07
Nodes (40): ChatRoomWorkspace(), ChatRoomWorkspaceProps, RoomCarromModal, RoomLudoModal, SidePanelTab, FeedStoriesBar(), FeedStoriesBarProps, GiftRoomOverlay() (+32 more)

### Community 22 - "OnlineUserSnapshot"
Cohesion: 0.16
Nodes (14): GiftPickerModalProps, LeaderboardPanelProps, MembersPanelProps, StageMicStripProps, UserProfileModalProps, VirtualizedMembersListProps, LiveAudioRoomExperienceProps, getStatusLabel() (+6 more)

### Community 23 - "LudoManager"
Cohesion: 0.41
Nodes (3): LudoManager, withLudoLock(), LudoGameState

### Community 24 - "src/lib/mediaUrl.ts"
Cohesion: 0.12
Nodes (54): ChatFeed(), ChatMessageRow, ChatRowMessage, GiftPickerModal(), InternalMailPanel(), InternalMailPanelProps, MailRecipientDraft, AWARD_ACTION_LABELS (+46 more)

### Community 25 - "schema/feed.ts"
Cohesion: 0.13
Nodes (14): feed_bookmarks, feed_comment_likes, feed_comments, feed_post_gifts, feed_post_likes, feed_post_media, feed_post_reposts, feed_posts (+6 more)

### Community 26 - "wallet.ts"
Cohesion: 0.10
Nodes (49): buildAgentPanelSession(), clearBruteForceSlot(), clearRedisIdempotentKey(), constantTimeStringEquals(), consumeBruteForceSlot(), createSecretCoinsSession(), deleteSecretCoinsSession(), emitTopupAdminNotification() (+41 more)

### Community 27 - "apps-web-src/components/UserProfileModal.tsx"
Cohesion: 0.13
Nodes (28): ChatComposer(), StageMicStrip(), AttachedLiveKitAudio, AttachedRtcAudio, DEFAULT_ICE_SERVERS, normalizeClientMicProvider(), resolveVadSpeaking(), StageSlotView (+20 more)

### Community 28 - "constants.ts"
Cohesion: 0.07
Nodes (29): AGENT_PANEL_SESSION_TTL_MS, ALLOWED_UPLOAD_EXTENSIONS, BLOCKED_UPLOAD_EXTENSIONS, BROWSER_LIST, CARROM_AUTO_RESET_DELAY_MS, CHAT_HISTORY_REDIS_LIMIT, CHAT_HISTORY_REDIS_TTL_SEC, COUNTRY_VPN_LIST (+21 more)

### Community 29 - "lucide-react"
Cohesion: 0.08
Nodes (38): FeedCommentsSheet(), formatTimeAgo(), QUICK_EMOJIS, FeedCreatePostModal(), FeedCreatePostModalProps, MediaPreview, ensureFeedScrollTracker(), FeedMediaViewer() (+30 more)

### Community 30 - "worker/package.json"
Cohesion: 0.07
Nodes (27): dependencies, bullmq, dotenv, @newchat/db, @newchat/shared, sharp, devDependencies, tsx (+19 more)

### Community 31 - "src/App.tsx"
Cohesion: 0.13
Nodes (23): AgentPortalPage, App(), CarromArenaPage, ControlPanelPage, HostingOwnerPortal, InstagramFeedView, LudoArenaPage, normalizePathname() (+15 more)

### Community 33 - "media.ts"
Cohesion: 0.08
Nodes (28): apiConfig, here, jwtSecret, secretCoinsKey, bullConnectionOpts(), closeQueues(), getImageQueue(), getMainQueue() (+20 more)

### Community 34 - "api/src/index.ts"
Cohesion: 0.05
Nodes (49): devDependencies, tsx, @types/bcryptjs, @types/jsonwebtoken, @types/node, typescript, bcryptjs, bullmq (+41 more)

### Community 35 - "mobile/package.json"
Cohesion: 0.08
Nodes (24): dependencies, expo, @newchat/core-client, @newchat/shared, react, react-native, devDependencies, @types/react (+16 more)

### Community 36 - "core-client/src/index.ts"
Cohesion: 0.09
Nodes (59): App(), styles, formatDateTimeArabic(), AgentPortalPage(), ControlPanelPage(), ControlPanelPageProps, CpTabId, resolveInitialToken() (+51 more)

### Community 37 - "Web Performance Audit"
Cohesion: 0.08
Nodes (22): Issue body, Skill feedback, Steps, What not to include, Compression & Minification, Detect Framework & Bundler, FIRST: Verify MCP Tools Available, Key Guidelines (+14 more)

### Community 38 - "apps-web-src/lib/mediaUrl.ts"
Cohesion: 0.13
Nodes (30): AgentPortalPage, App(), CarromArenaPage, ControlPanelPage, normalizePathname(), GiftRoomOverlay(), LoginScreen(), LoginScreenProps (+22 more)

### Community 39 - "idempotencyService.ts"
Cohesion: 0.13
Nodes (23): executeGiftTransfer(), safeGiftErrorMessage(), isUnifiedEconomyError(), UnifiedGiftTransferInput, UnifiedGiftTransferResult, beginIdempotencyLease(), BeginLeaseInput, BeginLeaseResult (+15 more)

### Community 40 - "boardRenderer.ts"
Cohesion: 0.13
Nodes (22): ActiveLayerRenderOptions, ASSET_URLS, drawActiveLayer(), drawAimGuide(), drawBaseRedCircle(), drawBgLayer(), drawBoardLinesLayer(), drawDisc() (+14 more)

### Community 41 - "scripts"
Cohesion: 0.08
Nodes (23): description, devDependencies, turbo, typescript, engines, node, typescript, name (+15 more)

### Community 42 - "core-client/package.json"
Cohesion: 0.08
Nodes (23): dependencies, @newchat/shared, socket.io-client, socket.io-msgpack-parser, zustand, devDependencies, typescript, exports (+15 more)

### Community 43 - "public.ts"
Cohesion: 0.11
Nodes (42): hashPasswordSync(), needsPasswordRehash(), verifyPasswordAsync(), getBandList(), getBsbRow(), getEntrySlides(), getHostList(), getHostSettingRow() (+34 more)

### Community 44 - "apps-web-src/components/ChatRoomWorkspace.tsx"
Cohesion: 0.09
Nodes (33): ChatRoomWorkspace(), ChatRoomWorkspaceProps, SidePanelTab, COMPETITION_KINDS, CompetitionBotModal(), CompetitionBotModalProps, GiftPickerModal(), GiftPickerModalProps (+25 more)

### Community 45 - "apps-web-src/components/UserProfileModal.tsx"
Cohesion: 0.47
Nodes (8): MailRecipientDraft, UserProfileModal(), UserProfileModalProps, canManageRooms(), canModerateUser(), hasRoleFlag(), resolveMemberRole(), canActOnRank()

### Community 46 - "registerLudoNamespace"
Cohesion: 0.38
Nodes (14): registerLudoNamespace(), broadcastWaitingRooms(), clearRoomTimers(), emitRoomState(), executeBotStep(), getWaitingRoomList(), handleTimeout(), leaveCurrentRoom() (+6 more)

### Community 47 - "getDb"
Cohesion: 0.09
Nodes (33): start(), ensureRoomRowById(), getSecretCoinsLedger(), sweepExpiredPendingTopupOrders(), syncMemberIdentity(), resolveOwnerTarget(), cleanOldProfileVisits(), getBullConnection() (+25 more)

### Community 48 - "CarromGameExperience.tsx"
Cohesion: 0.14
Nodes (19): AvatarWithTurnTimerProps, BACKDROP_THEME_LABELS, BOARD_SKIN_LABELS, CarromGameExperienceProps, getInitialsAvatar(), getSafeAvatarSrc(), QUICK_CHAT_PHRASES, COIN_COLORS (+11 more)

### Community 49 - "rbac.ts"
Cohesion: 0.08
Nodes (41): LiveRoomSummaryData, StageRequestItem, comparePresencePriority(), comparePresenceUsers(), getAutoPromotionRequiredPoints(), getAutoPromotionRules(), getAutoPromotionTarget(), getPowerRankValue() (+33 more)

### Community 50 - "engine.ts"
Cohesion: 0.15
Nodes (23): BASELINE_DEFAULT_X, BASELINE_MAX_X, BASELINE_MIN_X, BASELINE_Y, clampBoardNum(), collidePair(), computeBlueFoulCoinIndices(), dist2D() (+15 more)

### Community 51 - "React + Vite Best Practices"
Cohesion: 0.11
Nodes (18): 1. Build Optimization (CRITICAL), 2. Code Splitting (CRITICAL), 3. Development (HIGH), 4. Asset Handling (HIGH), 5. Environment Config (MEDIUM), 6. Bundle Analysis (MEDIUM), Environment Variables, Essential Configurations (+10 more)

### Community 52 - "LudoBoard.tsx"
Cohesion: 0.15
Nodes (15): HOME_CELL_BG, LudoBoard, LudoBoardProps, renderDiceIcon(), STACK_OFFSETS, START_CELL_COLOR_BY_INDEX, STATIC_TRACK_CELLS, StaticTrackCell (+7 more)

### Community 54 - "db/package.json"
Cohesion: 0.06
Nodes (31): dependencies, dotenv, drizzle-orm, ioredis, pg, devDependencies, drizzle-kit, mysql2 (+23 more)

### Community 55 - "registerCarromNamespace"
Cohesion: 0.17
Nodes (14): CarromArenaPlayer, CarromArenaRoom, CarromSocketProfile, clampNum(), RateBucket, registerCarromNamespace(), applyServerTimeoutToSnapshot(), broadcastWaitingRooms() (+6 more)

### Community 56 - "schema/index.ts"
Cohesion: 0.29
Nodes (5): idempotency_records, IdempotencyRecord, NewIdempotencyRecord, room_welcome_visits, drizzle-orm

### Community 57 - "validators.ts"
Cohesion: 0.11
Nodes (19): INCOMING_CMDS, OUTGOING_CMDS, SOCKET_EVENTS, SocketEventName, chatMessageSchema, feedGiftSchema, giftFeeSlabSchema, giftSendSchema (+11 more)

### Community 58 - "shared/package.json"
Cohesion: 0.11
Nodes (17): dependencies, zod, devDependencies, typescript, exports, typescript, zod, main (+9 more)

### Community 59 - "dependencies"
Cohesion: 0.12
Nodes (17): dependencies, bcryptjs, bullmq, dotenv, fastify, @fastify/cors, @fastify/helmet, @fastify/multipart (+9 more)

### Community 60 - "gamesData.ts"
Cohesion: 0.14
Nodes (22): BOT_PICS, CARROM_MAX_SCORE, CARROM_POCKET_CAPTURE_RADIUS, CARROM_POCKET_FUNNEL_RADIUS, CAPITALS_QUESTIONS, CONFESSION_CHAIR_QUESTIONS, ENGLISH_WORD_QUESTIONS, FAST_CHALLENGES (+14 more)

### Community 61 - "MemberAvatar"
Cohesion: 0.25
Nodes (16): ChatFeed(), MemberAvatar(), PrivateChatDock(), PrivateChatDockProps, WallPanel(), WallPanelProps, formatTimeArabic(), isSafeLinkUrl() (+8 more)

### Community 62 - "ludoEngine.ts"
Cohesion: 0.14
Nodes (28): ARENA_BOT_NAMES, LudoArenaRoomRecord, LudoSocketProfile, BOT_NAMES, LUDO_BOT_THINK_DELAY_MS, LUDO_TURN_TIMEOUT_MS, applyLudoDiceRoll(), applyLudoTokenMove() (+20 more)

### Community 63 - "socketClient.ts"
Cohesion: 0.16
Nodes (9): detectClientBrowser(), detectClientPlatform(), getOrCreateDeviceFingerprint(), MsgCommandHandler, RawSocketEventHandler, SocketConnectOptions, IncomingCmd, OutgoingCmd (+1 more)

### Community 64 - "CarromGameExperience"
Cohesion: 0.16
Nodes (14): RoomCarromModal(), RoomCarromModalProps, getLoadedBoardAssets(), preloadBoardAssets(), AvatarWithTurnTimer(), CarromGameExperience(), applySnapshotToState(), computeShotVelocity() (+6 more)

### Community 65 - "voiceCredentials.ts"
Cohesion: 0.21
Nodes (15): areValidLiveKitValues(), deriveSealKey(), extractLiveKitPublicMeta(), isValidLiveKitWsUrl(), LIVEKIT_CREDS_STORAGE_KEY, LiveKitEnvFallback, LiveKitPublicMeta, LiveKitRuntimeConfig (+7 more)

### Community 66 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, declaration, declarationMap, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, lib, module (+6 more)

### Community 67 - "Performance Optimization"
Cohesion: 0.14
Nodes (13): Additional Techniques, Avoid Barrel File Imports, Bundle Size (CRITICAL), Defer Non-Critical Third-Party Libraries, Dynamic Imports for Heavy Components, JavaScript Micro-Optimizations (LOW-MEDIUM), Performance Optimization, Preload on Intent (+5 more)

### Community 68 - "mediaResolver.ts"
Cohesion: 0.20
Nodes (8): ALLOWED_TIKTOK_HOSTS, isAllowedTikTokHost(), MediaResolver, parseYoutubeUrlId(), ResolvedTikTokMeta, YoutubeSearchMode, YoutubeSearchResultItem, YOUTUBE_SHORTS_DISCOVERY_TERMS

### Community 69 - "expo"
Cohesion: 0.14
Nodes (13): package, expo, android, extra, ios, name, orientation, slug (+5 more)

### Community 70 - "src/hooks/useMicStageAudio.ts"
Cohesion: 0.19
Nodes (11): LiveAudioMiniPlayerProps, AttachedLiveKitAudio, AttachedRtcAudio, DEFAULT_ICE_SERVERS, normalizeClientMicProvider(), resolveVadSpeaking(), StageSlotView, stopAttachedAudioElement() (+3 more)

### Community 71 - "Hooks and Server Actions"
Cohesion: 0.15
Nodes (12): Calling Server Functions with Transitions, Hooks and Server Actions, Narrow Effect Dependencies, React Query (Client-Side Server State), Server Action Pattern, Sharing Promises Across Components, The `use()` API (React 19), `useActionState` (Form Management) (+4 more)

### Community 72 - "Lighthouse and Lighthouse CI"
Cohesion: 0.15
Nodes (13): Assertions, Audit ids in Lighthouse 12 and 13, Lighthouse and Lighthouse CI, Pages behind login, Prove it, Reading a Lighthouse result, Running Lighthouse from Node, Start slowly, then ratchet (+5 more)

### Community 73 - "EvaluationEngine"
Cohesion: 0.19
Nodes (4): CompetitionEngine, EvaluationEngine, getUtcDayKey(), parseEvaluationAwardsJson()

### Community 76 - "src/lib/permissions.ts"
Cohesion: 0.11
Nodes (28): COMPETITION_KINDS, CompetitionBotModal(), CompetitionBotModalProps, NoteCommentsSheet(), NoteCommentsSheetProps, QUICK_EMOJIS, NotesStripBarProps, formatNoteRelativeAge() (+20 more)

### Community 77 - "apps-web-src/pages/CarromArenaPage.tsx"
Cohesion: 0.18
Nodes (12): drawCarromBoardCanvas(), ArenaChatMsg, ArenaPlayer, ArenaWaitingRoom, CarromArenaPageProps, makeFreshGameState(), CARROM_BOARD_SIZE, carromClamp() (+4 more)

### Community 78 - "Node.js Performance"
Cohesion: 0.17
Nodes (11): Benchmarking Guidance, CI / Flake Handling, Common Hot-Path Smells, Execution Workflow, Goals, Impact-First Selection, Node.js Performance, Operating Rules (+3 more)

### Community 79 - "economyEngine.ts"
Cohesion: 0.23
Nodes (13): calculateGiftFees(), DEFAULT_GIFT_SETTINGS, executeUnifiedGiftTransfer(), getHostingFeePercent(), GiftFeeSlab, GiftSystemSettings, loadGiftFeeSlabs(), loadGiftSettings() (+5 more)

### Community 80 - "React Compiler"
Cohesion: 0.17
Nodes (12): Callbacks Passed to Memoized Children, Conditional Rendering, Diagnosing Re-render Issues, Expensive Computations, How It Works, O(1) Lookups with Set, React Compiler, Rules for Compiler Compatibility (+4 more)

### Community 81 - "Profiling and Debugging"
Cohesion: 0.17
Nodes (12): Bundle Analysis, Highlight Updates, Next.js Bundle Analyzer, Next.js Production Profiling, Optimization Priority, Performance Measurement in Code, Production Profiling, Profiling and Debugging (+4 more)

### Community 82 - "Categories"
Cohesion: 0.17
Nodes (11): 1. Build Optimization (Critical), 2. Code Splitting (Critical), 3. Development (High), 4. Asset Handling (High), 5. Environment Config (Medium), 6. Bundle Analysis (Medium), Categories, Overview (+3 more)

### Community 83 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, declaration, declarationMap, jsx, lib, noEmit, sourceMap, target (+3 more)

### Community 84 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, declaration, declarationMap, jsx, lib, noEmit, sourceMap, target (+3 more)

### Community 85 - "HostingOwnerPortal.tsx"
Cohesion: 0.27
Nodes (9): createIdempotencyKey(), currentPortalPath(), EarningEntry, formatDate(), FundingEntry, getApiBase(), HostingDashboard, HostingOwnerPortal() (+1 more)

### Community 86 - "react-patterns/SKILL.md"
Cohesion: 0.18
Nodes (6): Common Mistakes, Delegation, Overview, Quick Reference, React, References

### Community 87 - "Code Splitting"
Cohesion: 0.18
Nodes (11): Avoid Barrel File Imports, Bundle Analysis Checklist, Code Splitting, Conditional Module Loading, Defer Third-Party Libraries, Next.js optimizePackageImports, Preload on Feature Flag, Preload on User Intent (+3 more)

### Community 88 - "Media, lists and rendering in the browser"
Cohesion: 0.18
Nodes (11): Animation, Bundle, Connections, fonts and scripts, Images and video, Layout shift, Loading states, Long lists, Media, lists and rendering in the browser (+3 more)

### Community 89 - "coinFunc.js"
Cohesion: 0.27
Nodes (6): Setup, allCoinStop(), coin(), coinPot(), dist(), updateScore()

### Community 90 - "web/package.json"
Cohesion: 0.15
Nodes (12): @newchat/core-client, @newchat/shared, react, @types/react, typescript, name, private, type (+4 more)

### Community 91 - "validators.ts"
Cohesion: 0.15
Nodes (4): ActiveStorySlide, filterActiveStorySlides(), STORY_LIFETIME_MS, toTimestampMs()

### Community 92 - "FilterService"
Cohesion: 0.11
Nodes (14): FilterResult, FilterRule, getFilterService(), warmFilterCache(), escapeRegex(), getShortcutService(), ShortcutRule, ShortcutService (+6 more)

### Community 93 - "tasks"
Cohesion: 0.18
Nodes (10): dependsOn, outputs, cache, persistent, $schema, tasks, build, dev (+2 more)

### Community 94 - "Troubleshooting"
Cohesion: 0.20
Nodes (10): Bundle Size Bloat, Data Fetching Waterfalls, Hydration Mismatch, Infinite Re-renders, Memory Leaks, Race Conditions, React Compiler Not Optimizing, Troubleshooting (+2 more)

### Community 95 - "Component Patterns"
Cohesion: 0.20
Nodes (10): Component Architecture, Component Patterns, Component Structure, Derived State, Error Handling, Form Handling, State Management, TypeScript (+2 more)

### Community 96 - "Server-Side Rendering"
Cohesion: 0.20
Nodes (9): `<Activity>` Component (React 19.2+), Cross-Request LRU Caching, Hydration Mismatch Prevention, Minimize Serialization at RSC Boundaries, Non-Blocking Post-Response Operations, Parallel Data Fetching with Component Composition, Partial Pre-rendering (PPR), Server Action Security (+1 more)

### Community 97 - "Rendering Optimization"
Cohesion: 0.20
Nodes (10): content-visibility for Long Lists, Defer State Reads, Derive State During Render, Functional setState for Stable Callbacks, Hoist Static JSX, React Compiler (Preferred), Rendering Optimization, Stable Object References (+2 more)

### Community 98 - "JavaScript on the main thread"
Cohesion: 0.20
Nodes (10): Batch frequent work, JavaScript on the main thread, Let scrolling start at once, Prioritize and defer, Prove it, Remove work the screen can't use, Split long tasks, What the main thread does (+2 more)

### Community 99 - "dependencies"
Cohesion: 0.25
Nodes (8): dependencies, livekit-client, lucide-react, @newchat/core-client, @newchat/shared, react, react-dom, @tanstack/react-virtual

### Community 100 - "devDependencies"
Cohesion: 0.25
Nodes (8): devDependencies, tailwindcss, @tailwindcss/vite, @types/react, @types/react-dom, typescript, vite, @vitejs/plugin-react

### Community 101 - "Sections"
Cohesion: 0.25
Nodes (7): 1. Build Optimization (build), 2. Code Splitting (split), 3. Development (dev), 4. Asset Handling (asset), 5. Environment Config (env), 6. Bundle Analysis (bundle), Sections

### Community 102 - "Trace one slow interaction"
Cohesion: 0.25
Nodes (8): Connect measurements to source, Define the interaction, Prove it, Read it in this order, Record it, Report findings, Trace one slow interaction, Validate a fix

### Community 103 - "api/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, outDir, rootDir, types, extends, include, ../../tsconfig.base.json

### Community 104 - "gateway/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, outDir, rootDir, types, extends, include, ../../tsconfig.base.json

### Community 105 - "worker/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, outDir, rootDir, types, extends, include, ../../tsconfig.base.json

### Community 106 - "core-client/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, lib, outDir, rootDir, extends, include, ../../tsconfig.base.json

### Community 107 - "What each signal means"
Cohesion: 0.29
Nodes (7): Event Timing and interactions, INP, Layout shift: the tool's CLS is not web.dev's CLS, LCP inside an interaction recording, Linking an interaction to its frames, Long Animation Frames, What each signal means

### Community 108 - "نسخة احتياطية لقاعدة البيانات (NewChat Database Backup)"
Cohesion: 0.29
Nodes (6): 1. عبر PowerShell (Windows):, 2. عبر الطرفية العامة (Bash / Linux / Mac):, تفاصيل النسخة, طريقة أخذ نسخة احتياطية جديدة (Backup), طريقة استعادة النسخة الاحتياطية (Restore), نسخة احتياطية لقاعدة البيانات (NewChat Database Backup)

### Community 110 - "db/tsconfig.json"
Cohesion: 0.29
Nodes (6): compilerOptions, outDir, rootDir, extends, include, ../../tsconfig.base.json

### Community 111 - "shared/tsconfig.json"
Cohesion: 0.29
Nodes (6): compilerOptions, outDir, rootDir, extends, include, ../../tsconfig.base.json

### Community 112 - "Anti-Patterns and Troubleshooting"
Cohesion: 0.33
Nodes (5): Anti-Patterns and Troubleshooting, Component Anti-Patterns, Data Fetching Anti-Patterns, Performance Anti-Patterns, State Anti-Patterns

### Community 113 - "Eliminating Waterfalls (CRITICAL)"
Cohesion: 0.33
Nodes (6): cacheSignal (React 19.2+), Defer Await Until Needed, Dependency-Based Parallelization, Eliminating Waterfalls (CRITICAL), Parallel Execution, Suspense Boundaries

### Community 114 - "React Performance"
Cohesion: 0.33
Nodes (6): Common Mistakes, Delegation, Overview, Quick Reference, React Performance, References

### Community 115 - "textFilter.ts"
Cohesion: 0.29
Nodes (7): applyTextShortcuts(), ARABIC_DIGIT_CHARS, CompiledEktisarRule, findWord(), matchesProhibitedWord(), toArabicDigits(), toEnglishDigits()

### Community 116 - "boardSetup.js"
Cohesion: 0.53
Nodes (4): createBoard(), createCoins(), drawCoins(), loadImages()

### Community 117 - "apps-web-src/components/RoomCarromModal.tsx"
Cohesion: 0.22
Nodes (8): POCKETS, RoomCarromModalProps, CARROM_BASELINE_OFFSET, CARROM_OUTER_MARGIN, CARROM_PLAY_MAX, CARROM_PLAY_MIN, CARROM_POCKET_RADIUS, CarromPiece

### Community 118 - "apps-web-src/components/ChatComposer.tsx"
Cohesion: 0.33
Nodes (6): ChatComposerProps, ChatFeedProps, ChatMessageRowProps, ChatComposerProps, ChatFeedProps, RoomMessagePayload

### Community 119 - "Re-render Optimization Techniques"
Cohesion: 0.40
Nodes (5): Defer State Reads, Hoist Default Props, Hoist Static JSX, Narrow Effect Dependencies, Re-render Optimization Techniques

### Community 120 - "React DevTools Profiler"
Cohesion: 0.40
Nodes (5): Identifying Slow Components, Identifying Unnecessary Re-renders, React DevTools Profiler, Reading the Flamegraph, Recording a Profile

### Community 122 - "Web performance"
Cohesion: 0.40
Nodes (5): Gotchas, Prove it, Related owners, The rules, Web performance

### Community 124 - "NewChat v2.0 (بنية حديثة بدون Docker لملايين المستخدمين)"
Cohesion: 0.33
Nodes (5): NewChat v2.0 (بنية حديثة بدون Docker لملايين المستخدمين), اقتصاد الهدايا وبوابة مالك الاستضافة, الإعداد الأولي, المتطلبات المحلية (Windows - بدون Docker), المنافذ الافتراضية

### Community 126 - "Common Bottleneck Patterns"
Cohesion: 0.50
Nodes (4): Common Bottleneck Patterns, Context Re-render Cascade, Expensive Render in Unrelated Update, Large List Without Virtualization

### Community 127 - "When to Use Manual Memoization"
Cohesion: 0.50
Nodes (4): React.memo -- Component-Level Memoization, useCallback -- Memoized Child Consumers Only, useMemo -- Expensive Computations Only, When to Use Manual Memoization

### Community 128 - "React + Vite Best Practices - Complete Reference"
Cohesion: 0.50
Nodes (3): Abstract, React + Vite Best Practices - Complete Reference, References

### Community 129 - "asset-fonts.md"
Cohesion: 0.50
Nodes (3): Correct, Incorrect, Web Font Loading in Vite

### Community 130 - "asset-image-optimization.md"
Cohesion: 0.50
Nodes (3): Correct, Incorrect, Optimize Image Loading and Format

### Community 131 - "asset-public-dir.md"
Cohesion: 0.50
Nodes (3): Correct, Incorrect, Public Directory vs Import

### Community 132 - "asset-svg-components.md"
Cohesion: 0.50
Nodes (3): Correct, Incorrect, Use SVGs as React Components

### Community 133 - "build-asset-hashing.md"
Cohesion: 0.50
Nodes (3): Configure Asset Hashing for Cache Busting, Correct, Incorrect

### Community 134 - "build-compression.md"
Cohesion: 0.50
Nodes (3): Configure Build-Time Compression, Correct, Incorrect

### Community 135 - "build-manual-chunks.md"
Cohesion: 0.50
Nodes (3): Configure Manual Chunks for Vendor Separation, Correct, Incorrect

### Community 136 - "build-minification.md"
Cohesion: 0.50
Nodes (3): Configure Optimal Minification Settings, Correct, Incorrect

### Community 137 - "build-sourcemaps.md"
Cohesion: 0.50
Nodes (3): Configure Source Maps for Production Debugging, Correct, Incorrect

### Community 138 - "build-target-modern.md"
Cohesion: 0.50
Nodes (3): Correct, Incorrect, Target Modern Browsers for Smaller Bundles

### Community 139 - "build-tree-shaking.md"
Cohesion: 0.50
Nodes (3): Configure Build for Effective Tree Shaking, Correct, Incorrect

### Community 140 - "bundle-visualizer.md"
Cohesion: 0.50
Nodes (3): Bundle Analysis with Visualizer, Correct, Incorrect

### Community 141 - "dev-dependency-prebundling.md"
Cohesion: 0.50
Nodes (3): Configure Dependency Pre-bundling, Correct, Incorrect

### Community 142 - "dev-fast-refresh.md"
Cohesion: 0.50
Nodes (3): Correct, Incorrect, Structure Components for Fast Refresh

### Community 143 - "dev-hmr-config.md"
Cohesion: 0.50
Nodes (3): Configure HMR for Optimal Development, Correct, Incorrect

### Community 144 - "env-modes.md"
Cohesion: 0.50
Nodes (3): Correct, Incorrect, Mode-Specific Environment Files

### Community 145 - "env-sensitive-data.md"
Cohesion: 0.50
Nodes (3): Correct, Incorrect, Never Expose Secrets in Client Code

### Community 146 - "env-vite-prefix.md"
Cohesion: 0.50
Nodes (3): Correct, Incorrect, Use VITE_ Prefix for Environment Variables

### Community 147 - "split-component-lazy.md"
Cohesion: 0.50
Nodes (3): Correct, Incorrect, Lazy Load Non-Critical Components

### Community 148 - "split-dynamic-imports.md"
Cohesion: 0.50
Nodes (3): Correct, Incorrect, Use Dynamic Imports for Heavy Components

### Community 149 - "split-prefetch-hints.md"
Cohesion: 0.50
Nodes (3): Correct, Incorrect, Prefetch Code Chunks on User Intent

### Community 150 - "split-route-lazy.md"
Cohesion: 0.50
Nodes (3): Correct, Incorrect, Use React.lazy() for Route-Based Splitting

### Community 151 - "split-suspense-boundaries.md"
Cohesion: 0.50
Nodes (3): Correct, Incorrect, Strategic Suspense Boundaries for Lazy Loading

### Community 158 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, preview, typecheck

## Knowledge Gaps
- **68 isolated node(s):** `@newchat/db`, `@newchat/gateway`, `@newchat/shared`, `bcryptjs`, `bullmq` (+63 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1135 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **16 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useChatStore` connect `core-client/src/index.ts` to `NewChatSocketClient`, `src/components/PrivateChatDock.tsx`, `NewChatApiClient`, `useChatStore.ts`, `src/components/ChatRoomWorkspace.tsx`, `OnlineUserSnapshot`, `src/lib/mediaUrl.ts`, `apps-web-src/components/UserProfileModal.tsx`, `lucide-react`, `src/App.tsx`, `LudoArenaClient`, `apps-web-src/lib/mediaUrl.ts`, `apps-web-src/components/ChatRoomWorkspace.tsx`, `apps-web-src/components/UserProfileModal.tsx`, `CarromGameExperience.tsx`, `CarromArenaClient`, `MemberAvatar`, `CarromGameExperience`, `src/hooks/useMicStageAudio.ts`, `src/lib/permissions.ts`, `apps-web-src/pages/CarromArenaPage.tsx`, `textFilter.ts`, `apps-web-src/components/RoomCarromModal.tsx`, `apps-web-src/components/ChatComposer.tsx`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **What connects `@newchat/db`, `@newchat/gateway`, `@newchat/shared` to the rest of the system?**
  _68 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `PresenceDirectory` be split into smaller, more focused modules?**
  _Cohesion score 0.08944793850454227 - nodes in this community are weakly interconnected._
- **Why does `Stale Closures` connect `MediaMiniPlayer.tsx` to `Troubleshooting`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Should `authHandlers.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06593406593406594 - nodes in this community are weakly interconnected._
- **Should `NewChatSocketClient` be split into smaller, more focused modules?**
  _Cohesion score 0.047530864197530866 - nodes in this community are weakly interconnected._
- **Should `cp.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06789628441593157 - nodes in this community are weakly interconnected._