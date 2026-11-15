var debug = true;
var powerc = 35;
var strikerPot = false;
var coinPoted = false;
var ableToHit = false;
var redPut = 0;
var overlap = false;
var checkNextCoin = false;
var redRound = 0;
var strikerLocation, polePoint;
var hittingObjs = [];
var aiMode = false;
var blueCoins = [];
var myreq = null;
var aiTimeout = null; // Manage AI timing
var socket = null;
var myPlayerIndex = null;
var roomReady = false;
var roomJoined = false;
var currentRoomId = "";
var matchStarted = false;
var lastPlaceEmitAt = 0;
var playerName = "";
var playerAvatar = "";
var waitingRooms = [];
var currentMatchProfiles = [
    { playerName: "Player 1", playerAvatar: "" },
    { playerName: "Player 2", playerAvatar: "" }
];
var turnSeq = 0;

// document.addEventListener('contextmenu', event => event.preventDefault());
$(document).ready(function () {
    function switchb() {
        $('.myButton.active').removeClass('active');
        $(this).addClass('active');
    }
    $("#tpc").on('click', switchb);
    $("#pc").on('click', switchb);

    function switchb1() {
        $('.b.active').removeClass('active');
        $(this).addClass('active');
    }

    $(".b1").on('click', switchb1);
    $(".b2").on('click', switchb1);
    $(".b3").on('click', switchb1);


    function switchb2() {
        $('.g.active').removeClass('active');
        $(this).addClass('active');
    }

    $(".g1").on('click', switchb2);
    $(".g2").on('click', switchb2);

    function switchbg() {
        $('.bg.active').removeClass('active');
        $(this).addClass('active');
        if ($(this).hasClass("blue")) {
            $("body").removeClass("bodybgimg").removeClass("bodybgblack").removeClass("bodybgimg1").addClass("bodybgblue");
        } else if ($(this).hasClass("black")) {
            $("body").removeClass("bodybgimg").removeClass("bodybgblue").removeClass("bodybgimg1").addClass("bodybgblack");
        } else if ($(this).hasClass("imgbg")) {
            $("body").removeClass("bodybgblue").removeClass("bodybgblack").removeClass("bodybgimg1").addClass("bodybgimg");
        } else if ($(this).hasClass("imgbg1")) {
            $("body").removeClass("bodybgblue").removeClass("bodybgblack").removeClass("bodybgimg").addClass("bodybgimg1");
        }
    }

    $(".bg1").on('click', switchbg);
    $(".bg2").on('click', switchbg);
    $(".bg3").on('click', switchbg);
    $(".bg4").on('click', switchbg);

    function showMsg(msg) {
        $('#msgbox').text(msg);
    }

    function updateTurnBadge() {
        if (!roomJoined) {
            $('#turnBadge').text('Waiting to join');
            return;
        }
        if (!roomReady) {
            $('#turnBadge').text('Waiting for opponent');
            return;
        }
        $('#turnBadge').text(currPlayer === myPlayerIndex ? 'Your turn' : 'Opponent turn');
    }

    function updatePlayerBadge() {
        if (myPlayerIndex === null) {
            $('#playerBadge').text('Not joined');
            return;
        }
        $('#playerBadge').text(playerName || ('Player ' + (myPlayerIndex + 1)));
        $('#playerBadgeAvatar').attr('src', getAvatarSrc(playerAvatar, playerName || 'Player'));
    }

    function isPlayerTwoView() {
        return myPlayerIndex === 1;
    }

    function getInitials(name) {
        var parts = (name || 'Player').trim().split(/\s+/).slice(0, 2);
        return parts.map(function (part) {
            return part.charAt(0).toUpperCase();
        }).join('') || 'P';
    }

    function getFallbackAvatar(name) {
        var initials = getInitials(name);
        // Use a more compatible SVG with better font handling
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect width="120" height="120" rx="60" fill="#4caf50"/><text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="50" fill="#fff">' + initials + '</text></svg>';
        return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    }

    function getAvatarSrc(url, name) {
        return url && $.trim(url) ? $.trim(url) : getFallbackAvatar(name);
    }

    function refreshBoardLabels() {
        var bottomProfile = isPlayerTwoView() ? currentMatchProfiles[1] : currentMatchProfiles[0];
        var topProfile = isPlayerTwoView() ? currentMatchProfiles[0] : currentMatchProfiles[1];
        
        $('#player1Label').text(bottomProfile && bottomProfile.playerName ? bottomProfile.playerName : 'You');
        $('#player2Label').text(topProfile && topProfile.playerName ? topProfile.playerName : 'Opponent');

        // Update real avatars
        if (bottomProfile) {
            $('#player1Avatar').attr('src', getAvatarSrc(bottomProfile.playerAvatar, bottomProfile.playerName));
        }
        if (topProfile) {
            $('#player2Avatar').attr('src', getAvatarSrc(topProfile.playerAvatar, topProfile.playerName));
        }
    }

    function applyPlayerView() {
        $('body').toggleClass('player-two-view', isPlayerTwoView());
        refreshBoardLabels();
    }

    function getBoardPointer(event, rect) {
        var e = event.originalEvent || event;
        var pageX = e.pageX;
        var pageY = e.pageY;

        if (e.touches && e.touches.length > 0) {
            pageX = e.touches[0].pageX;
            pageY = e.touches[0].pageY;
        } else if (e.changedTouches && e.changedTouches.length > 0) {
            pageX = e.changedTouches[0].pageX;
            pageY = e.changedTouches[0].pageY;
        }

        var x = pageX - (rect.left + window.scrollX);
        var y = pageY - (rect.top + window.scrollY);

        // Scale coordinates to internal 520x520 system
        var scaleX = 520 / rect.width;
        var scaleY = 520 / rect.height;
        x *= scaleX;
        y *= scaleY;

        if (isPlayerTwoView()) {
            x = 520 - x;
            y = 520 - y;
        }

        return { x: x, y: y };
    }

    function setRoomStatus(message) {
        $('#roomStatus').text(message);
    }

    function syncRoomBadge() {
        $('#roomBadge').text('Room: ' + (currentRoomId || '-'));
    }

    function renderWaitingRooms() {
        var list = $('#roomsList');
        list.empty();

        if (!waitingRooms.length) {
            list.append('<div class="roomsEmpty"><div class="roomsEmpty-icon">🎮</div><div>لا يوجد لاعبون بانتظار الخصم حالياً. قم بإنشاء غرفة!</div></div>');
            return;
        }

        waitingRooms.forEach(function (room) {
            var card = $('<div class="roomCard"></div>');

            // 1. Avatar (Next to name)
            var avatarWrap = $('<div class="rc-avatar"></div>');
            avatarWrap.append($('<img alt="avatar" />').attr('src', getAvatarSrc(room.hostAvatar, room.hostName)));
            card.append(avatarWrap);

            // 2. Player info
            var info = $('<div class="rc-info"></div>');
            var nameRow = $('<div class="rc-name-row"></div>');
            nameRow.append('<span class="rc-host-name">' + room.hostName + '</span>');
            info.append(nameRow);

            var gameLabel = $('<div class="rc-game-label">' + (room.game || 'Carrom') + '</div>');
            info.append(gameLabel);
            card.append(info);

            // 3. Game icon (Next to button)
            var gameIcon = $('<div class="rc-game-icon"><img src="./assets/images/game-icon.png?v=2" alt="' + (room.game || 'Carrom') + '" /></div>');
            card.append(gameIcon);

            // 4. Join or Watch button
            var isFull = room.playerCount >= 2;
            var btnClass = isFull ? 'rc-btn rc-btn-watch' : 'rc-btn rc-btn-join';
            var btnText = isFull ? '👁 مشاهدة' : '🎮 انضمام';
            var button = $('<button class="' + btnClass + '">' + btnText + '</button>');

            if (!isFull) {
                button.on('click', function () {
                    if (!socket || !socket.connected) {
                        setRoomStatus('الاتصال غير جاهز بعد.');
                        return;
                    }
                    socket.emit('register_profile', {
                        playerName: $.trim($('#playerNameInput').val()),
                        playerAvatar: $.trim($('#playerAvatarInput').val())
                    });
                    socket.emit('join_waiting_room', {
                        roomId: room.roomId
                    });
                });
            }

            card.append(button);
            list.append(card);
        });
    }

    function canControlTurn() {
        return roomReady && myPlayerIndex !== null && currPlayer === myPlayerIndex;
    }

    function buildSnapshot() {
        turnSeq++;
        return {
            currPlayer: currPlayer,
            redPut: redPut,
            strikerPot: strikerPot,
            coinPoted: coinPoted,
            firstHit: firstHit,
            hitBlueCoin: hitBlueCoin,
            turnSeq: turnSeq,
            players: players.map(function (player) {
                return {
                    score: player.score,
                    coins: {
                        white: player.coins.white,
                        black: player.coins.black
                    }
                };
            }),
            hittingObjs: hittingObjs.map(function (obj) {
                return {
                    x: obj.x,
                    y: obj.y,
                    vx: obj.vx,
                    vy: obj.vy,
                    name: obj.name,
                    color: obj.color,
                    radius: obj.radius
                };
            })
        };
    }

    function emitStateSnapshot() {
        if (!socket || !roomJoined) {
            return;
        }
        socket.emit('state_snapshot', {
            roomId: currentRoomId,
            snapshot: buildSnapshot()
        });
    }

    function applySnapshot(snapshot) {
        if (!snapshot || !snapshot.players || !snapshot.hittingObjs) {
            return;
        }

        currPlayer = typeof snapshot.currPlayer === 'number' ? snapshot.currPlayer : 0;
        redPut = snapshot.redPut || 0;
        strikerPot = !!snapshot.strikerPot;
        coinPoted = !!snapshot.coinPoted;
        firstHit = !!snapshot.firstHit;
        hitBlueCoin = !!snapshot.hitBlueCoin;

        for (var i = 0; i < players.length; i++) {
            if (!snapshot.players[i]) {
                continue;
            }
            players[i].score = snapshot.players[i].score || 0;
            players[i].coins.black = snapshot.players[i].coins ? snapshot.players[i].coins.black || 0 : 0;
            players[i].coins.white = snapshot.players[i].coins ? snapshot.players[i].coins.white || 0 : 0;
        }

        hittingObjs = snapshot.hittingObjs.map(function (obj) {
            return new coin(obj.x, obj.y, obj.color, obj.vx, obj.vy, obj.name, obj.radius);
        });
        striker = hittingObjs[0] || striker;
        coins = hittingObjs.slice(1);
        updateScore();

        var c = document.getElementById("Striker");
        var ctx = c.getContext("2d");
        ctx.clearRect(0, 0, 520, 520);
        drawPockets(ctx);
        drawCoins();
        updateTurnBadge();
    }

    function emitStrikerPlacement() {
        var now = Date.now();
        if (!socket || !roomReady || !canControlTurn() || now - lastPlaceEmitAt < 30) {
            return;
        }
        lastPlaceEmitAt = now;
        socket.emit('striker_place', {
            x: striker.x,
            y: striker.y
        });
    }

    function beginMatch() {
        matchStarted = true;
        updateTurnBadge();
        setRoomStatus('المباراة جاهزة. بالتوفيق.');
        showMsg(currPlayer === myPlayerIndex ? 'دورك الآن' : 'الخصم يلعب الآن...');
        setTimeout(function () {
            $('#vsOverlay').hide();
            strikerPlace();
        }, 1400);
    }

    function showVsOverlay(profiles) {
        profiles = profiles || currentMatchProfiles;
        $('#vsPlayerOne').text(profiles[0] && profiles[0].playerName ? profiles[0].playerName : 'Player 1');
        $('#vsPlayerTwo').text(profiles[1] && profiles[1].playerName ? profiles[1].playerName : 'Player 2');
        $('#vsAvatarOne').attr('src', getAvatarSrc(profiles[0] && profiles[0].playerAvatar, profiles[0] && profiles[0].playerName));
        $('#vsAvatarTwo').attr('src', getAvatarSrc(profiles[1] && profiles[1].playerAvatar, profiles[1] && profiles[1].playerName));
        $('#vsOverlay').show();
    }

    function connectMultiplayer() {
        if (typeof io === 'undefined') {
            setRoomStatus('Socket.IO client failed to load.');
            return;
        }

        socket = io('/carrom', { transports: ['websocket'] });

        // Safety timeout to ensure overlay is hidden even if connect event is delayed
        setTimeout(function() {
            $('#loadingOverlay').fadeOut(500);
        }, 5000);

        socket.on('connect_error', function (err) {
            setRoomStatus('خطأ في الاتصال: ' + err.message);
            $('#loadingOverlay').show();
        });

        socket.on('connect', function () {
            console.log("Game socket connected!");
            $('#loadingOverlay').hide();
            var urlParams = new URLSearchParams(window.location.search);
            var qName = urlParams.get('name');
            var qAvatar = urlParams.get('avatar');
            if (qName || qAvatar) {
                socket.emit('register_profile', {
                    playerName: qName || '',
                    playerAvatar: qAvatar || ''
                });
            }
            setRoomStatus('متصل. قم بإنشاء غرفة كيرم أو انضم من قائمة الانتظار.');
            socket.emit('request_waiting_rooms');
        });

        socket.on('disconnect', function () {
            roomReady = false;
            roomJoined = false;
            matchStarted = false;
            $(document).off('.carrom');
            setRoomStatus('Connection lost. Reconnect and rejoin your room.');
            $('#roomPopup').show();
            $('#vsOverlay').hide();
            waitingRooms = [];
            renderWaitingRooms();
            updateTurnBadge();
        });

        socket.on('join_error', function (payload) {
            setRoomStatus(payload.message || 'Unable to join that room.');
        });

        socket.on('profile_ready', function (payload) {
            playerName = payload.playerName || playerName;
            playerAvatar = payload.playerAvatar || "";
            $('#playerNameInput').val(playerName);
            $('#playerAvatarInput').val(playerAvatar);
            updatePlayerBadge();
        });

        socket.on('waiting_rooms', function (payload) {
            waitingRooms = payload.rooms || [];
            renderWaitingRooms();
        });

        socket.on('room_joined', function (payload) {
            roomJoined = true;
            currentRoomId = payload.roomId;
            myPlayerIndex = payload.playerIndex;
            updatePlayerBadge();
            applyPlayerView();
            syncRoomBadge();
            updateTurnBadge();
            $('#roomPopup').hide();
            setRoomStatus('انضممت إلى ' + payload.roomId + '.');
            showMsg(payload.playerIndex === 0 ? 'تم إنشاء الغرفة. في انتظار انضمام الخصم...' : 'جاري الانضمام للمباراة...');
        });

        socket.on('room_waiting', function (payload) {
            currentRoomId = payload.roomId || currentRoomId;
            roomReady = false;
            matchStarted = false;
            syncRoomBadge();
            setRoomStatus('تم إنشاء الغرفة. في انتظار انضمام لاعب آخر...');
            showMsg('الغرفة جاهزة. يمكن للخصم الانضمام الآن.');
        });

        socket.on('game_ready', function (payload) {
            roomReady = true;
            currentMatchProfiles = payload.playerProfiles || currentMatchProfiles;
            refreshBoardLabels();
            showVsOverlay(currentMatchProfiles);
            if (!matchStarted) {
                // Force full reset for a new match to avoid stale scores
                players[0].score = 0;
                players[1].score = 0;
                players[0].coins.black = 0;
                players[0].coins.white = 0;
                players[1].coins.black = 0;
                players[1].coins.white = 0;
                redPut = 0;
                strikerPot = false;
                coinPoted = false;
                hitBlueCoin = false;
                firstHit = false;
                currPlayer = 0;
                turnSeq = 0;
                updateScore();
                beginMatch();
            } else {
                updateTurnBadge();
                setRoomStatus('Both players connected.');
            }
        });

        socket.on('room_resume_state', function (payload) {
            applySnapshot(payload.snapshot);
            showMsg('تم استئناف المباراة من آخر حالة محفوظة.');
        });

        socket.on('player_reassigned', function (payload) {
            var oldIndex = myPlayerIndex;
            myPlayerIndex = payload.playerIndex;
            // Swap local player scores if index changed to prevent score inversion
            if (oldIndex !== null && oldIndex !== myPlayerIndex && players.length === 2) {
                var tmpScore = players[0].score;
                var tmpBlack = players[0].coins.black;
                var tmpWhite = players[0].coins.white;
                players[0].score = players[1].score;
                players[0].coins.black = players[1].coins.black;
                players[0].coins.white = players[1].coins.white;
                players[1].score = tmpScore;
                players[1].coins.black = tmpBlack;
                players[1].coins.white = tmpWhite;
                // Also fix currPlayer if it pointed to the old index
                if (currPlayer === oldIndex) {
                    currPlayer = myPlayerIndex;
                } else {
                    currPlayer = currPlayer === 0 ? 1 : 0;
                }
                updateScore();
            }
            updatePlayerBadge();
            applyPlayerView();
            updateTurnBadge();
            setRoomStatus('You are now ' + payload.playerLabel + '. Waiting in the lobby again.');
        });

        socket.on('player_left', function (payload) {
            roomReady = false;
            matchStarted = false;
            $(document).off('.carrom');
            $('#vsOverlay').hide();
            setRoomStatus(payload.message || 'The other player left the room.');
            showMsg('غادر الخصم الغرفة.');
            updateTurnBadge();
        });

        socket.on('match_paused', function (payload) {
            roomReady = false;
            $(document).off('.carrom');
            // If it was the opponent's turn, give the turn to this player (index 0 after reassign)
            if (currPlayer !== myPlayerIndex) {
                currPlayer = myPlayerIndex !== null ? myPlayerIndex : 0;
            }
            setRoomStatus(payload.message || 'Match paused.');
            showMsg(payload.message || 'توقفت المباراة مؤقتاً.');
            emitStateSnapshot();
            updateTurnBadge();
        });

        socket.on('opponent_striker_place', function (payload) {
            if (!roomReady || canControlTurn() || payload.playerIndex !== currPlayer) {
                return;
            }

            striker.x = payload.x;
            striker.y = payload.y;

            var c = document.getElementById('Striker');
            var ctx = c.getContext('2d');
            ctx.clearRect(0, 0, 520, 520);
            drawCoins();
            drawSCircle(striker.x, striker.y, coinSize + 1, 'white', ctx);
            drawHitAreas();
        });

        socket.on('opponent_striker_aim', function (payload) {
            if (!roomReady || canControlTurn() || payload.playerIndex !== currPlayer) {
                return;
            }
            if (typeof payload.aimX !== 'number' || typeof payload.aimY !== 'number') {
                return;
            }

            var c = document.getElementById('Striker');
            var ctx = c.getContext('2d');
            ctx.clearRect(0, 0, 520, 520);
            drawCoins();
            drawSCircle(striker.x, striker.y, coinSize + 1, 'white', ctx);

            // Draw opponent's aim arrow
            var dx = striker.x - payload.aimX;
            var dy = striker.y - payload.aimY;
            var aimPower = Math.sqrt(dx * dx + dy * dy);
            var arrowLen = Math.min(aimPower * 1.5, 120);
            if (arrowLen > 15) {
                var angle = Math.atan2(dy, dx);
                var endX = striker.x + Math.cos(angle) * arrowLen;
                var endY = striker.y + Math.sin(angle) * arrowLen;
                drawPredictivePath(ctx, striker.x, striker.y, angle, aimPower);
                drawAimArrow(ctx, striker.x, striker.y, endX, endY);
            }
            drawHitAreas();
        });

        socket.on('opponent_striker_hit', function (payload) {
            if (!roomReady || canControlTurn() || payload.playerIndex !== currPlayer) {
                return;
            }
            if (typeof payload.vX !== 'number' || typeof payload.vY !== 'number') {
                return;
            }

            striker.x = payload.strikerX;
            striker.y = payload.strikerY;
            $(document).off('.carrom');
            hitStriker({
                isRemote: true,
                vX: payload.vX,
                vY: payload.vY
            });
        });

        socket.on('opponent_play_again', function () {
            playAgain(false);
        });

        socket.on('request_sync_from_peer', function () {
            // If we have control of the turn, we have the most authoritative state
            if (canControlTurn()) {
                emitStateSnapshot();
            }
        });

        socket.on('chat_message', function (payload) {
            var msgClass = (payload.senderName === playerName) ? 'own-msg' : 'other-msg';
            var senderName = payload.senderName || 'Player';
            var senderAvatar = getAvatarSrc(payload.senderAvatar, senderName);
            var message = payload.message || '';

            var msgHTML = '<div class="chat-msg-row ' + msgClass + '">' +
                '<div class="chat-msg-avatar"><img src="' + senderAvatar + '" alt="Avatar" /></div>' +
                '<div class="chat-msg-content">' +
                '<div class="chat-msg-sender">' + senderName + '</div>' +
                '<div class="chat-msg-bubble">' + message + '</div>' +
                '</div>' +
                '</div>';

            $('#inlineChatMessages').append(msgHTML);
            var chatBox = document.getElementById('inlineChatMessages');
            chatBox.scrollTop = chatBox.scrollHeight;
        });
    }

    updatePlayerBadge();
    applyPlayerView();
    syncRoomBadge();
    updateTurnBadge();
    connectMultiplayer();

    $('#s1').on('click', function () {
        if ($(this).attr('src') === './assets/images/s1.svg') {
            $(this).attr('src', './assets/images/s2.svg');
            bgsnd.pause();
            bgsndMuted = true;
        } else {
            $(this).attr('src', './assets/images/s1.svg');
            bgsnd.play();
            bgsndMuted = false;
        }
    })

    $("#playAgain").on('click', function () {
        playAgain(true);
    });

    $("#exitGame").on('click', function () {
        $("#popup").hide();
        if (socket && socket.connected && roomJoined) {
            socket.emit('leave_room');
        }
        roomReady = false;
        roomJoined = false;
        matchStarted = false;
        currentRoomId = '';
        myPlayerIndex = null;
        $(document).off('.carrom');
        syncRoomBadge();
        updateTurnBadge();
        updatePlayerBadge();
        $('#roomPopup').show();
        if (socket && socket.connected) {
            socket.emit('request_waiting_rooms');
        }
        showMsg('غادرت اللعبة.');
        setRoomStatus('لقد غادرت اللعبة. قم بإنشاء أو الانضمام لغرفة للعب مجدداً.');
    });

    $("#createRoomBtn").on('click', function () {
        if (roomJoined && !roomReady) {
            setRoomStatus('You already created a waiting room. Wait for someone to join.');
            return;
        }
        if (!socket || !socket.connected) {
            setRoomStatus('Socket connection is not ready yet.');
            return;
        }
        socket.emit('register_profile', {
            playerName: $.trim($('#playerNameInput').val()),
            playerAvatar: $.trim($('#playerAvatarInput').val())
        });
        socket.emit('create_room');
    });

    $("#refreshRoomsBtn").on('click', function () {
        if (!socket || !socket.connected) {
            setRoomStatus('Socket connection is not ready yet.');
            return;
        }
        socket.emit('request_waiting_rooms');
    });

    $("#refreshSyncBtn").on('click', function () {
        if (!socket || !socket.connected || !roomJoined) {
            showMsg('لا يمكن التحديث، أنت لست متصلاً بالغرفة.');
            return;
        }
        
        // Visual feedback
        var btn = $(this);
        btn.css("opacity", "0.5");
        setTimeout(function() { btn.css("opacity", "1"); }, 500);
        
        showMsg('جاري تحديث وتزامن اللوحة...');
        socket.emit('request_sync');
    });

    $("#playerNameInput").on('change blur', function () {
        if (!socket || !socket.connected) {
            return;
        }
        socket.emit('register_profile', {
            playerName: $.trim($(this).val()),
            playerAvatar: $.trim($('#playerAvatarInput').val())
        });
    });

    $("#playerAvatarInput").on('change blur', function () {
        if (!socket || !socket.connected) {
            return;
        }
        socket.emit('register_profile', {
            playerName: $.trim($('#playerNameInput').val()),
            playerAvatar: $.trim($(this).val())
        });
    });

    // Inline Chat UI Handlers
    function sendChatMessage() {
        var msgInput = $("#inlineChatInput");
        var msg = $.trim(msgInput.val());
        if (msg && socket && socket.connected && roomJoined) {
            socket.emit('send_chat_message', { message: msg });
            msgInput.val('');
        }
    }

    $("#inlineSendChatBtn").on('click', sendChatMessage);

    $("#inlineChatInput").on('keypress', function (e) {
        if (e.which == 13) {
            sendChatMessage();
            return false;
        }
    });

    function setPolePos(pp) {
        poleX = pp.x;
        poleY = pp.y;
    }

    function strikerPlace() {
        strikerPot = false;

        var c = document.getElementById("Striker");
        var ctx = c.getContext("2d");

        $(document).off(".carrom"); // Cleanup any old listeners

        striker.x = players[currPlayer].x;
        striker.y = players[currPlayer].y;
        ctx.clearRect(0, 0, 520, 520);
        drawCoins();
        drawSCircle(striker.x, striker.y, coinSize + 1, 'white', ctx);
        emitStateSnapshot();
        updateTurnBadge();

        if (!roomReady) {
            showMsg('في انتظار انضمام كلا اللاعبين.');
            return;
        }

        if (!canControlTurn()) {
            showMsg('الخصم يلعب الآن...');
            return;
        }

        if (currPlayer == 1 && aiMode && hittingObjs.length > 1) {
            $(document).off(".carrom");
            var target = setTargetNearPot();
            var targetPot = getTargetPot(target);
            // checkOverlap();

            strikerLocation = getStrikerPlace(targetPot.x, targetPot.y, target.x, target.y, players[currPlayer].lb, 100, players[currPlayer].rb, 100)
            if (strikerLocation.x < 100 || strikerLocation.x > 420) {
                strikerLocation = { x: Math.floor(Math.random() * 280) + 110, y: 100 };
            }
            striker.x = strikerLocation.x;
            if (debug) {
                drawPoint1(strikerLocation.x, striker.y, 'green');
                drawLine1({ x: strikerLocation.x, y: striker.y, x1: target.x, y1: target.y }, 'black');
                console.log("Striker placed at ", striker.x, striker.y);
            }
            polePoint = getStrikerPlace(target.x, target.y, strikerLocation.x, striker.y, 50, 50, 470, 50)
            if (debug) {
                drawPoint1(polePoint.x, polePoint.y, 'blue');
                drawLine1({ x: strikerLocation.x, y: striker.y, x1: polePoint.x, y1: polePoint.y }, 'green');
            }
            setPolePos(polePoint);

            if (aiTimeout) clearTimeout(aiTimeout);

            // AI Simplification: Delay and small error for realism
            aiTimeout = setTimeout(function () {
                // Add minor random noise to make AI beatable
                var errX = (Math.random() - 0.5) * 8;
                var errY = (Math.random() - 0.5) * 8;

                powerc = dist(striker.x, striker.y, polePoint.x + errX, polePoint.y + errY);
                slope = (polePoint.x + errX - striker.x) / (polePoint.y + errY - striker.y);
                $(document).off(".carrom");
                hitStriker();
            }, 1000); // 1 second delay
            ableToHit = false;
        } else {
            $(document).on("mousemove.carrom touchmove.carrom", function (event) {
                var rect = c.getBoundingClientRect(); // Update rect in case of scroll
                var pointer = getBoardPointer(event, rect);
                checkOverlap();

                // Clamp striker position within bounds
                striker.x = Math.min(Math.max(pointer.x, players[currPlayer].lb), players[currPlayer].rb);
                ctx.clearRect(0, 0, 520, 520);
                drawCoins();
                drawSCircle(striker.x, striker.y, coinSize + 1, 'white', ctx);
                drawHitAreas();
                emitStrikerPlacement();

                // Prevent scrolling on mobile while moving striker
                if (event.type === 'touchmove') event.preventDefault();
            });
            $(document).on("click.carrom touchend.carrom", function (event) {
                if (event.type === 'touchend') event.preventDefault();
                if (!bgsndMuted) {
                    bgsnd.play();
                }
                if (!overlap) {
                    emitStrikerPlacement();
                    $(document).off(".carrom");
                    polePlace();
                }
            });
        }
    }

    function setTargetNearPot() {
        // clean this more. When both coins pot by AI, its trying to pot again
        if (hittingObjs.length == 3 && checkRedPresent()) {
            if (hittingObjs[1].name == 'red') {
                return hittingObjs[1];
            } else {
                return hittingObjs[2];
            }
        }
        return hittingObjs.reduce((a, b) => a.y > b.y ? a : b)
    }

    function getTargetPot(target) {
        if (target.x > (players[currPlayer].rb - players[currPlayer].lb) / 2) { //+ players[currPlayer].lb
            return { x: 495, y: 495 };
        } else {
            return { x: 25, y: 495 };
        }
    }

    function drawPoint1(x, y, color) {
        ctx.fillStyle = color || 'black';
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, 2 * Math.PI, true);
        ctx.fill();
    };

    function drawLine1(line, color) {
        color = color || 'black';
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(line.x, line.y);
        ctx.lineTo(line.x1, line.y1);
        ctx.stroke();
        drawPoint1(line.x, line.y, color);
        drawPoint1(line.x1, line.y1, color);
    };


    function getStrikerPlace(line1StartX, line1StartY, line1EndX, line1EndY, line2StartX, line2StartY, line2EndX, line2EndY) {
        // if the lines intersect, the result contains the x and y of the intersection (treating the lines as infinite) and booleans for whether line segment 1 or line segment 2 contain the point
        var denominator, a, b, numerator1, numerator2, result = {
            x: null,
            y: null,
            onLine1: false,
            onLine2: false
        };
        denominator = ((line2EndY - line2StartY) * (line1EndX - line1StartX)) - ((line2EndX - line2StartX) * (line1EndY - line1StartY));
        if (denominator == 0) {
            return result;
        }
        a = line1StartY - line2StartY;
        b = line1StartX - line2StartX;
        numerator1 = ((line2EndX - line2StartX) * a) - ((line2EndY - line2StartY) * b);
        numerator2 = ((line1EndX - line1StartX) * a) - ((line1EndY - line1StartY) * b);
        a = numerator1 / denominator;
        b = numerator2 / denominator;

        // if we cast these lines infinitely in both directions, they intersect here:
        result.x = line1StartX + (a * (line1EndX - line1StartX));
        result.y = line1StartY + (a * (line1EndY - line1StartY));
        // if line1 is a segment and line2 is infinite, they intersect if:
        if (a > 0 && a < 1) {
            result.onLine1 = true;
        }
        // if line2 is a segment and line1 is infinite, they intersect if:
        if (b > 0 && b < 1) {
            result.onLine2 = true;
        }
        // if line1 and line2 are segments, they intersect if both of the above are true
        return result;
    }

    function checkOverlap() {
        for (var i = 1; i < hittingObjs.length; i++) {
            var d = dist(striker.x, striker.y, hittingObjs[i].x, hittingObjs[i].y);
            if (d < 23) {
                showMsg('يوجد قرص هنا.');
                overlap = true;
                return;
            }
        }
        showMsg('يمكنك وضع المضرب الآن.');
        overlap = false;
    }

    var virtualAimX = 0;
    var virtualAimY = 0;
    var lastMouseX = 0;
    var lastMouseY = 0;

    function polePlace() {
        if (!canControlTurn()) {
            return;
        }

        var rect = document.getElementById("Striker").getBoundingClientRect();
        lastMouseX = 0;
        lastMouseY = 0;
        virtualAimX = striker.x;
        virtualAimY = isPlayerTwoView() ? striker.y - 50 : striker.y + 50; // Keep pull direction natural for each view

        $(document).keyup(function (e) {
            if (e.key === "Escape") {
                $(document).off(".carrom");
                strikerPlace();
            }
        });
        $(document).on("mousemove.carrom touchmove.carrom", function (event) {
            var pointer = getBoardPointer(event, rect);
            var x = pointer.x;
            var y = pointer.y;
            // showMsg('Game started.');
            if ((currPlayer == 0 && y > striker.y) || (currPlayer == 1 && y < striker.y)) {
                ableToHit = true;

                var c = document.getElementById("Striker");
                var ctx = c.getContext("2d");
                ctx.clearRect(0, 0, 520, 520);
                drawCoins();
                drawSCircle(striker.x, striker.y, coinSize + 1, 'white', ctx);

                // Calculate mouse movement in board coordinates so player 2 view is not inverted
                var mouseX = pointer.x;
                var mouseY = pointer.y;

                if (lastMouseX === 0) {
                    lastMouseX = mouseX;
                    lastMouseY = mouseY;
                }

                var dx_move = mouseX - lastMouseX;
                var dy_move = mouseY - lastMouseY;

                // Update virtual aim with high precision scaling (0.3 for ultra-fine control)
                virtualAimX += dx_move * 0.3;
                virtualAimY += dy_move * 0.3;

                lastMouseX = mouseX;
                lastMouseY = mouseY;

                var dx = striker.x - virtualAimX;
                var dy = striker.y - virtualAimY;
                powerc = Math.sqrt(dx * dx + dy * dy);
                var arrowLen = Math.min(powerc * 1.5, 120);

                if (arrowLen > 15) {
                    var angle = Math.atan2(dy, dx);
                    var aimX = striker.x + Math.cos(angle) * arrowLen;
                    var aimY = striker.y + Math.sin(angle) * arrowLen;

                    // Draw predictive path (white dashed line)
                    drawPredictivePath(ctx, striker.x, striker.y, angle, powerc);

                    // Draw main force arrow
                    drawAimArrow(ctx, striker.x, striker.y, aimX, aimY);

                    // Update global poles for the hit function
                    poleX = virtualAimX;
                    poleY = virtualAimY;

                    // Send aim direction to opponent (throttled)
                    if (typeof window.lastAimEmitAt === 'undefined') window.lastAimEmitAt = 0;
                    var nowAim = Date.now();
                    if (socket && roomReady && nowAim - window.lastAimEmitAt > 50) {
                        window.lastAimEmitAt = nowAim;
                        socket.emit('striker_aim', {
                            aimX: virtualAimX,
                            aimY: virtualAimY
                        });
                    }
                }

                // Prevent scrolling on mobile while aiming
                if (event.type === 'touchmove') event.preventDefault();
            } else {
                ableToHit = false;
            }
            drawHitAreas();
        });
        $(document).on("click.carrom touchend.carrom", function (event) {
            if (event.type === 'touchend') event.preventDefault();
            if (ableToHit) {
                slope = (poleX - striker.x) / (poleY - striker.y);
                $(document).off(".carrom");
                hitStriker({ isRemote: false });
                ableToHit = false;
                return;
            }
        });
    }

    function checkRedPresent() {
        for (var i = 0; i < hittingObjs.length; i++) {
            if (hittingObjs[i].name == 'red') {
                return true;
            }
        }

        return false;
    }
    //hitting Striker
    function hitStriker(options) {
        options = options || {};
        if (myreq) window.cancelAnimationFrame(myreq); // Prevent multiple loops
        var canvas = document.getElementById("Striker");
        var c = canvas.getContext('2d');

        var vX = options.vX;
        var vY = options.vY;
        if (typeof vX !== 'number' || typeof vY !== 'number') {
            var ranger = powerc / 2;
            ranger = ranger > 40 ? 40 : ranger;
            vX = ranger * Math.sin(Math.atan(slope));
            vY = ranger * Math.cos(Math.atan(slope));

            if (poleY > striker.y) {
                vX = -vX;
                vY = -vY;
            }
        }

        if (!options.isRemote && socket && roomReady) {
            socket.emit('striker_hit', {
                strikerX: striker.x,
                strikerY: striker.y,
                vX: vX,
                vY: vY
            });
        }

        striker.vx = vX;
        striker.vy = vY;

        function draw() {
            var subSteps = 16; // High precision for accurate pocket detection
            var dt = 1 / subSteps;

            // Pocket centers for sweep testing
            var pockets = [{ x: 27, y: 27 }, { x: 493, y: 27 }, { x: 27, y: 493 }, { x: 493, y: 493 }];
            var potThreshold = 32; // Must match coinFunc.js

            for (var s = 0; s < subSteps; s++) {
                // 1. Collision detection between all pairs
                for (var i = 0; i < hittingObjs.length; i++) {
                    for (var j = i + 1; j < hittingObjs.length; j++) {
                        // Check if it's the first hit with striker (for blue coin penalty)
                        var obj1 = hittingObjs[j];
                        var obj2 = hittingObjs[i];
                        if (i == 0 && !firstHit) {
                            var dis = dist(obj1.x + obj1.vx * dt, obj1.y + obj1.vy * dt, obj2.x + obj2.vx * dt, obj2.y + obj2.vy * dt);
                            if (dis <= 20 && blueCoins.indexOf(j) > -1) {
                                hitBlueCoin = true;
                                firstHit = true;
                            } else if (dis <= 20) {
                                firstHit = true;
                            }
                        }
                        hittingObjs[j].crash(i, j, dt);
                    }
                }

                // 2. Rebound + Update + Pocket check for each coin
                for (var i = 0; i < hittingObjs.length; i++) {
                    var co = hittingObjs[i];

                    // Save position BEFORE movement for sweep test
                    var oldX = co.x;
                    var oldY = co.y;

                    // Rebound (wall bounce) â€” rebound() internally skips if near pocket
                    co.rebound(dt);

                    // Move the coin
                    co.update(dt);

                    // *** SWEEP-TEST POCKET CHECK ***
                    // Check if the coin's path from oldPos to newPos crossed through any pocket
                    // This catches even extremely fast coins
                    var hitPocket = false;
                    if (coinPot(co)) {
                        hitPocket = true;
                    } else {
                        // Sweep test: sample intermediate points along the path
                        var moveX = co.x - oldX;
                        var moveY = co.y - oldY;
                        var moveDist = Math.sqrt(moveX * moveX + moveY * moveY);
                        if (moveDist > 2) { // Only sweep-test if the coin moved significantly
                            var sweepSteps = Math.ceil(moveDist / 2); // Check every 2px
                            for (var sw = 1; sw < sweepSteps; sw++) {
                                var t = sw / sweepSteps;
                                var testX = oldX + moveX * t;
                                var testY = oldY + moveY * t;
                                for (var p = 0; p < pockets.length; p++) {
                                    if (dist(testX, testY, pockets[p].x, pockets[p].y) < potThreshold) {
                                        // Snap coin to the pocket position
                                        co.x = testX;
                                        co.y = testY;
                                        hitPocket = true;
                                        break;
                                    }
                                }
                                if (hitPocket) break;
                            }
                        }
                    }

                    // Handle potting
                    if (hitPocket && i > 0) {
                        coinPoted = true;
                        var pCoin = co;
                        if (pCoin.name === "white") {
                            if (hittingObjs.length === 3 && checkRedPresent()) {
                                showMsg('خطأ (Foul)');
                                if (players[currPlayer].coins.black > 0) {
                                    players[currPlayer].score -= 10;
                                    hittingObjs.push(new coin(260, 260, '#333333', 0, 0, 'black'));
                                    players[currPlayer].coins.black--;
                                } else if (players[currPlayer].coins.white > 0) {
                                    players[currPlayer].score -= 20;
                                    hittingObjs.push(new coin(260, 260, '#f3e5ab', 0, 0, 'white'));
                                    players[currPlayer].coins.white--;
                                }
                                currPlayer = (currPlayer + 1) % TotalplayerNo;
                                hittingObjs.push(new coin(260, 260, '#f3e5ab', 0, 0, 'white'));
                            } else {
                                players[currPlayer].score += 20;
                                players[currPlayer].coins.white++;
                                if (redPut == 2 || redPut == 1) {
                                    players[currPlayer].score += 50;
                                    redPut = 0;
                                    showMsg('تسديدة رائعة! تم تأكيد الأحمر.');
                                } else {
                                    showMsg('استمر في اللعب');
                                }
                            }
                        } else if (pCoin.name === "black") {
                            if (hittingObjs.length === 3 && checkRedPresent()) {
                                showMsg('خطأ (Foul)');
                                if (players[currPlayer].coins.black > 0) {
                                    players[currPlayer].score -= 10;
                                    hittingObjs.push(new coin(260, 260, '#333333', 0, 0, 'black'));
                                    players[currPlayer].coins.black--;
                                } else if (players[currPlayer].coins.white > 0) {
                                    players[currPlayer].score -= 20;
                                    hittingObjs.push(new coin(260, 260, '#f3e5ab', 0, 0, 'white'));
                                    players[currPlayer].coins.white--;
                                }
                                currPlayer = (currPlayer + 1) % TotalplayerNo;
                                hittingObjs.push(new coin(260, 260, '#333333', 0, 0, 'black'));
                            } else {
                                players[currPlayer].score += 10;
                                players[currPlayer].coins.black++;
                                if (redPut == 2 || redPut == 1) {
                                    players[currPlayer].score += 50;
                                    redPut = 0;
                                    showMsg('لعب نظيف! تم تأكيد الأحمر.');
                                } else {
                                    showMsg('أحسنت! استمر');
                                }
                            }
                        } else if (pCoin.name === "red" && redPut == 0) {
                            showMsg('يرجى إدخال قرص آخر لتأكيد الأحمر.');
                            redPut = 1;
                        }

                        updateScore();
                        hittingObjs.splice(i, 1);
                        cdropsnd.play();
                        i--;
                    } else if (hitPocket && i == 0) {
                        // Striker potted
                        striker.vx = 0;
                        striker.vy = 0;
                        strikerPot = true;

                        if (players[currPlayer].coins.black > 0) {
                            players[currPlayer].score -= 10;
                            hittingObjs.push(new coin(260, 260, '#333333', 0, 0, 'black'));
                            players[currPlayer].coins.black--;
                        } else if (players[currPlayer].coins.white > 0) {
                            players[currPlayer].score -= 20;
                            hittingObjs.push(new coin(260, 260, '#f3e5ab', 0, 0, 'white'));
                            players[currPlayer].coins.white--;
                        }
                        updateScore();
                        drawCoins();
                        sdropsnd.play();

                        striker.x = -100;
                        striker.y = -100;
                    }
                }
            }

            c.clearRect(0, 0, 520, 520);

            // Redraw pockets every frame (since clearRect erases them)
            drawPockets(c);

            var allStopped = true;
            for (var i = 0; i < hittingObjs.length; i++) {
                if (i == 0) {
                    drawSCircle(hittingObjs[i].x, hittingObjs[i].y, coinSize + 1, hittingObjs[i].color, c);
                } else {
                    drawCircle(hittingObjs[i].x, hittingObjs[i].y, coinSize, hittingObjs[i].color, c);
                }
                // Snap very slow coins to 0 to avoid infinite drift
                if (Math.abs(hittingObjs[i].vx) <= 0.3 && Math.abs(hittingObjs[i].vy) <= 0.3) {
                    hittingObjs[i].vx = 0;
                    hittingObjs[i].vy = 0;
                } else {
                    allStopped = false;
                }
            }

            // Check game-over: only the striker remains
            if (hittingObjs.length == 1) {
                var wonIdx = players[0].score > players[1].score ? 0 : 1;
                var swapped = document.body.classList.contains('player-two-view');
                var bottomIdx = swapped ? 1 : 0;
                var topIdx = swapped ? 0 : 1;
                var winnerProfile = currentMatchProfiles[wonIdx] || { playerName: 'Player ' + (wonIdx + 1), playerAvatar: '' };
                $('#winnerAvatar').attr('src', getAvatarSrc(winnerProfile.playerAvatar, winnerProfile.playerName));
                $('#winnerName').text(winnerProfile.playerName);
                $('#winScoreP1Name').text((currentMatchProfiles[bottomIdx] || {}).playerName || 'Player 1');
                $('#winScoreP1').text(players[bottomIdx].score);
                $('#winScoreP2Name').text((currentMatchProfiles[topIdx] || {}).playerName || 'Player 2');
                $('#winScoreP2').text(players[topIdx].score);
                $("#w1").text(wonIdx + 1);
                showMsg(winnerProfile.playerName + " Won the game!");
                emitStateSnapshot();
                hittingObjs = [];
                coins = [];
                currPlayer = 0;
                updateTurnBadge();
                window.cancelAnimationFrame(myreq);
                $("#popup").show();
                return;
            }

            // Turn resolution: check ONCE per frame after all coins are drawn
            var strikerStopped = (striker.vx === 0 && striker.vy === 0) || strikerPot;
            if (allStopped && strikerStopped && allCoinStop()) {
                // Decide turn switch
                if (strikerPot) {
                    // Striker pot always switches turn
                    currPlayer = (currPlayer + 1) % TotalplayerNo;
                } else if (!coinPoted) {
                    // No coin potted â€” switch turn
                    currPlayer = (currPlayer + 1) % TotalplayerNo;
                }
                // If coinPoted && !strikerPot: player keeps turn (correct)

                // Handle red coin state machine
                if (redPut == 2) {
                    redPut = 0;
                    hittingObjs.push(new coin(260, 260, '#ff002b', 0, 0, 'red'));
                    showMsg('للأسف.. لم تصب الهدف.');
                }
                if (redPut == 1) {
                    redPut = 2;
                }

                // Reset state for next turn
                strikerPot = false;
                coinPoted = false;
                drawCoins();
                emitStateSnapshot();
                updateTurnBadge();
                window.cancelAnimationFrame(myreq);
                strikerPlace();
                return;
            }

            myreq = requestAnimationFrame(draw);
        }
        myreq = requestAnimationFrame(draw);
    }

    function playAgain(shouldBroadcast) {
        shouldBroadcast = shouldBroadcast !== false;
        $("#popup").hide();
        players[0].score = 0;
        players[1].score = 0;
        players[0].coins.black = 0;
        players[0].coins.white = 0;
        players[1].coins.black = 0;
        players[1].coins.white = 0;
        redPut = 0;
        strikerPot = false;
        coinPoted = false;
        overlap = false;
        checkNextCoin = false;
        redRound = 0;
        hitBlueCoin = false;
        firstHit = false;
        currPlayer = 0;
        turnSeq = 0;
        updateScore();
        createCoins();
        updateTurnBadge();

        if (shouldBroadcast && socket && roomReady) {
            socket.emit('play_again');
        }

        // Send the fresh (reset) snapshot to the server so latestState is clean
        emitStateSnapshot();

        setTimeout(function () {
            strikerPlace();
        }, 20);
    }

    $("#config").on('click', function () {
        $("#popup1").show();
    });

    $("#start").on('click', function () {
        $("#popup1").hide();
    });

    function drawHitAreas() {
        // this function is only for blue highlight coins
        var ct = document.getElementById("Striker");
        var ctx = ct.getContext("2d");
        blueCoins = [];
        for (var i = 1; i < hittingObjs.length; i++) {
            var c = hittingObjs[i];
            if (currPlayer == 1) {
                if (c.y < 190 && c.y > 65 && c.x < 455 && c.x > 65) {
                    if (dist(c.x, c.y, 160, 160) < 30 || dist(c.x, c.y, 360, 160) < 30) {
                        drawCircle(hittingObjs[i].x, hittingObjs[i].y, 10, 'blue', ctx);
                        if (blueCoins.indexOf(i) < 0) {
                            blueCoins.push(i);
                        }
                    }
                    if (c.x < 180) {
                        // top left line
                        // get perpendicular point
                        // check distance for hit test
                        var p1 = getSpPoint({ x: 75, y: 75 }, { x: 175, y: 175 }, { x: c.x, y: c.y }, 141.422); // dist(75, 75, 175, 175)
                        if (p1.x !== 0 && dist(c.x, c.y, p1.x, p1.y) < 20) {
                            drawCircle(hittingObjs[i].x, hittingObjs[i].y, 10, 'blue', ctx);
                            if (blueCoins.indexOf(i) < 0) {
                                blueCoins.push(i);
                            }
                        }
                    }
                    else if (c.x > 340) {
                        // top right line
                        var p1 = getSpPoint({ x: 445, y: 75 }, { x: 345, y: 175 }, { x: c.x, y: c.y }, 141.422); // dist(75, 75, 175, 175)
                        if (p1.x !== 0 && dist(c.x, c.y, p1.x, p1.y) < 20) {
                            drawCircle(hittingObjs[i].x, hittingObjs[i].y, 10, 'blue', ctx);
                            if (blueCoins.indexOf(i) < 0) {
                                blueCoins.push(i);
                            }
                        }
                    }
                }
            }
            else if (currPlayer == 0) {
                if (c.y > 330 && c.y < 455 && c.x > 65 && c.x < 455) {
                    if (dist(c.x, c.y, 160, 360) < 30 || dist(c.x, c.y, 360, 360) < 30) {
                        drawCircle(hittingObjs[i].x, hittingObjs[i].y, 10, 'blue', ctx);
                        if (blueCoins.indexOf(i) < 0) {
                            blueCoins.push(i);
                        }
                    }
                }
                if (c.x < 180) {
                    // top left line
                    // get perpendicular point
                    // check distance for hit test
                    var p1 = getSpPoint({ x: 75, y: 445 }, { x: 175, y: 345 }, { x: c.x, y: c.y }, 141.422); // dist(75, 75, 175, 175)
                    if (p1.x !== 0 && dist(c.x, c.y, p1.x, p1.y) < 20) {
                        drawCircle(hittingObjs[i].x, hittingObjs[i].y, 10, 'blue', ctx);
                        if (blueCoins.indexOf(i) < 0) {
                            blueCoins.push(i);
                        }
                    }
                }
                else if (c.x > 340) {
                    // top right line
                    var p1 = getSpPoint({ x: 445, y: 445 }, { x: 345, y: 345 }, { x: c.x, y: c.y }, 141.422); // dist(75, 75, 175, 175)
                    if (p1.x !== 0 && dist(c.x, c.y, p1.x, p1.y) < 20) {
                        drawCircle(hittingObjs[i].x, hittingObjs[i].y, 10, 'blue', ctx);
                        if (blueCoins.indexOf(i) < 0) {
                            blueCoins.push(i);
                        }
                    }
                }
            }
        }
    }

    function getSpPoint(A, B, C, lineL) {
        var x1 = A.x, y1 = A.y, x2 = B.x, y2 = B.y, x3 = C.x, y3 = C.y;
        var px = x2 - x1, py = y2 - y1, dAB = px * px + py * py;
        var u = ((x3 - x1) * px + (y3 - y1) * py) / dAB;
        var x = x1 + u * px, y = y1 + u * py;

        var dis = dist(C.x, C.y, x, y);
        var distFromP1 = dist(A.x, A.y, x, y);
        var distFromP2 = dist(B.x, B.y, x, y);
        if (distFromP1 < lineL + 10 && distFromP2 < lineL + 10) {
            if (dis < 10) {
                return { x: x, y: y }
            }
        }
        return { x: 0, y: 0 }; //this is D
    }

});
