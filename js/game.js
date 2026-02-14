/* Game engine + UI — requires data.js loaded first (CLASSES, SUITS, RANKS, getVal) */
(function () {
    var CLASSES = window.CLASSES;
    var SUITS = window.SUITS;
    var EXTENDED_CLASS_NAMES = ['THE FUNERAL BELL', 'THE GATEKEEPER', 'THE OCCULTIST', 'THE GRAVEDIGGER', 'THE VULTURE', 'THE PLAGUE', 'THE REAPER', 'THE MIMIC', 'THE LICH', 'THE INQUISITOR', 'THE PYROMANIAC', 'THE USERER', 'THE HOARDER', 'THE SEALBINDER', 'THE MEDDLER', 'THE ORACLE', 'THE CROW', 'THE MIME'];
    function getClassPool() {
        return gameState.players.length > 6 ? CLASSES : CLASSES.filter(function (c) { return EXTENDED_CLASS_NAMES.indexOf(c.name) < 0; });
    }
    var RANKS = window.RANKS;
    var getVal = window.getVal;
    var CARD_IMAGES_BASE = 'images/cards/';
    var CARD_RANKS_BASE = 'images/cards/ranks/';
    var CARD_BACKS_BASE = 'images/cards/backs/';
    var CLASS_IMAGES_BASE = 'images/cards/classes/';
    var CARD_IMAGE_EXT = '.png';
    if (!CLASSES || !SUITS || !RANKS || !getVal) {
        console.error('Deathwick: Load data.js before game.js');
        return;
    }

    var gameState = {
        players: [],
        discard: [],
        turnOrder: [],
        turnIdx: 0,
        concurrentSlot: 0,
        activeIdx: 0,
        selectedIdxs: [],
        selectedDarkTop: false,
        turnPhase: 'SETUP',
        selectionMode: null,
        pendingAction: null,
        pendingCardIdx: null,
        pendingGhostIdx: null,
        isGameOver: false,
        darkMode: false,
        isOnline: false,
        isHost: false,
        roomCode: null,
        myPlayerId: 0,
        guestSocketId: null,
        broadcastState: null,
        displayName: null,
        showAllPlayers: false,
        viewPreferenceSet: false
    };
    var saltCallback = null;
    var aiTimer = null;
    var previousDiscardLength = 0;

    var SAVE_KEY = 'finalFlickerGame';

    function getSerializedState() {
        if (gameState.turnPhase === 'SETUP' || gameState.players.length === 0) return null;
        return {
            players: gameState.players.map(function (p) {
                var out = {
                    id: p.id,
                    name: p.name,
                    type: p.type,
                    hand: p.hand.slice(),
                    candle: p.candle.slice(),
                    shadow: p.shadow.slice(),
                    className: p.class ? p.class.name : null,
                    isSalted: p.isSalted,
                    isDead: p.isDead
                };
                if (p.usedMimic) out.usedMimic = true;
                if (p.usedLichRevive) out.usedLichRevive = true;
                if (p.voodooSuits) out.voodooSuits = p.voodooSuits.slice();
                return out;
            }),
            discard: gameState.discard.slice(),
            turnOrder: gameState.turnOrder.slice(),
            turnIdx: gameState.turnIdx,
            concurrentSlot: gameState.concurrentSlot,
            activeIdx: gameState.activeIdx,
            selectedIdxs: gameState.selectedIdxs.slice(),
            turnPhase: gameState.turnPhase,
            selectionMode: gameState.selectionMode,
            pendingAction: gameState.pendingAction,
            pendingCardIdx: gameState.pendingCardIdx,
            pendingGhostIdx: gameState.pendingGhostIdx,
            isGameOver: gameState.isGameOver,
            lastDamageTo: gameState.lastDamageTo || {},
            darkMode: gameState.darkMode,
            showAllPlayers: gameState.showAllPlayers,
            viewPreferenceSet: gameState.viewPreferenceSet
        };
    }

    function saveGameState() {
        var snap = getSerializedState();
        if (!snap) return;
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(snap));
        } catch (e) { /* quota or disabled */ }
    }

    function applyState(snap) {
        if (!snap || !snap.players || snap.players.length < 2) return;
        var classByName = {};
        for (var i = 0; i < CLASSES.length; i++) classByName[CLASSES[i].name] = CLASSES[i];
        gameState.players = snap.players.map(function (p) {
            var cls = p.className ? classByName[p.className] || null : null;
            var pl = {
                id: p.id,
                name: p.name,
                type: p.type,
                hand: p.hand || [],
                candle: p.candle || [],
                shadow: p.shadow || [],
                class: cls,
                isSalted: !!p.isSalted,
                isDead: !!p.isDead
            };
            if (p.usedMimic) pl.usedMimic = true;
            if (p.usedLichRevive) pl.usedLichRevive = true;
            if (p.voodooSuits) pl.voodooSuits = p.voodooSuits.slice();
            if (p.isRemote) pl.isRemote = true;
            return pl;
        });
        gameState.discard = snap.discard || [];
        previousDiscardLength = gameState.discard.length;
        gameState.turnOrder = snap.turnOrder || gameState.players.map(function (_, i) { return i; });
        gameState.turnIdx = snap.turnIdx != null ? snap.turnIdx : 0;
        gameState.concurrentSlot = snap.concurrentSlot != null ? snap.concurrentSlot : 0;
        gameState.activeIdx = snap.activeIdx != null ? snap.activeIdx : 0;
        gameState.selectedIdxs = snap.selectedIdxs || [];
        gameState.turnPhase = snap.turnPhase || 'ACTION';
        gameState.selectionMode = snap.selectionMode || null;
        gameState.pendingAction = snap.pendingAction || null;
        gameState.pendingCardIdx = snap.pendingCardIdx != null ? snap.pendingCardIdx : null;
        gameState.pendingGhostIdx = snap.pendingGhostIdx != null ? snap.pendingGhostIdx : null;
        gameState.isGameOver = !!snap.isGameOver;
        gameState.lastDamageTo = snap.lastDamageTo || {};
        if (snap.darkMode != null) gameState.darkMode = !!snap.darkMode;
        document.body.classList.toggle('dark-mode', gameState.darkMode);
        if (snap.showAllPlayers != null) gameState.showAllPlayers = !!snap.showAllPlayers;
        if (snap.viewPreferenceSet != null) gameState.viewPreferenceSet = !!snap.viewPreferenceSet;
        if (typeof updateUI === 'function') updateUI();
    }

    function loadGameState() {
        try {
            var raw = localStorage.getItem(SAVE_KEY);
            if (!raw) return false;
            var snap = JSON.parse(raw);
            if (!snap.players || snap.players.length < 2) return false;
            var classByName = {};
            for (var i = 0; i < CLASSES.length; i++) classByName[CLASSES[i].name] = CLASSES[i];
            gameState.players = snap.players.map(function (p) {
                var cls = p.className ? classByName[p.className] || null : null;
                var pl = {
                    id: p.id,
                    name: p.name,
                    type: p.type,
                    hand: p.hand || [],
                    candle: p.candle || [],
                    shadow: p.shadow || [],
                    class: cls,
                    isSalted: !!p.isSalted,
                    isDead: !!p.isDead
                };
                if (p.usedMimic) pl.usedMimic = true;
                if (p.usedLichRevive) pl.usedLichRevive = true;
                if (p.voodooSuits) pl.voodooSuits = p.voodooSuits.slice();
                return pl;
            });
            gameState.discard = snap.discard || [];
            gameState.turnOrder = snap.turnOrder || gameState.players.map(function (_, i) { return i; });
            gameState.turnIdx = snap.turnIdx != null ? snap.turnIdx : 0;
            gameState.concurrentSlot = snap.concurrentSlot != null ? snap.concurrentSlot : 0;
            gameState.activeIdx = snap.activeIdx != null ? snap.activeIdx : 0;
            gameState.selectedIdxs = snap.selectedIdxs || [];
            gameState.turnPhase = snap.turnPhase || 'ACTION';
            gameState.selectionMode = snap.selectionMode || null;
            gameState.pendingAction = snap.pendingAction || null;
            gameState.pendingCardIdx = snap.pendingCardIdx != null ? snap.pendingCardIdx : null;
            gameState.pendingGhostIdx = snap.pendingGhostIdx != null ? snap.pendingGhostIdx : null;
            gameState.isGameOver = !!snap.isGameOver;
            gameState.lastDamageTo = snap.lastDamageTo || {};
            gameState.darkMode = !!snap.darkMode;
            document.body.classList.toggle('dark-mode', gameState.darkMode);
            if (snap.showAllPlayers != null) gameState.showAllPlayers = !!snap.showAllPlayers;
            if (snap.viewPreferenceSet != null) gameState.viewPreferenceSet = !!snap.viewPreferenceSet;
            return true;
        } catch (e) {
            return false;
        }
    }

    function showManual() {
        saveGameState();
        window.location.href = 'manual.html';
    }

    function showClassDesc(cls) {
        if (!cls) return;
        var title = document.getElementById('class-desc-title');
        var text = document.getElementById('class-desc-text');
        var cardImg = document.getElementById('class-desc-card');
        var modal = document.getElementById('class-desc-modal');
        if (title) title.textContent = cls.name;
        if (text) text.textContent = cls.desc;
        if (cardImg) {
            var imgName = getClassImageFilename(cls.name);
            if (imgName) {
                var folder = window.getClassSubfolder ? window.getClassSubfolder(imgName) : '';
                cardImg.src = CLASS_IMAGES_BASE + (folder ? folder + '/' : '') + imgName + CARD_IMAGE_EXT;
                cardImg.alt = cls.name;
                cardImg.style.display = 'block';
            } else {
                cardImg.src = '';
                cardImg.style.display = 'none';
            }
        }
        if (modal) modal.style.display = 'flex';
    }

    function closeClassDesc() {
        var modal = document.getElementById('class-desc-modal');
        if (modal) modal.style.display = 'none';
    }

    var CHEATSHEET_TURN_NORMAL = '<li>Candle empty at end of turn → Consumed (lose).</li>';
    var CHEATSHEET_TURN_DARK = '<li>Candle empty at any moment → Consumed immediately (lose).</li>';
    var CHEATSHEET_REST = '<section class="cs-section"><h3>Actions</h3><ul class="cs-list"><li><strong>Haunt</strong> — Number card to a neighbour\'s Shadow.</li><li><strong>Banish</strong> — Match/beat a Ghost in your Shadow.</li><li><strong>Panic</strong> — Flip top of Candle vs Ghost.</li><li><strong>Séance</strong> — Pair → heal 4 from Dark.</li><li><strong>Cast</strong> (number cards) / <strong>Summon</strong> (face cards & Jokers) — Use card effect (see Grimoire).</li><li><strong>Flicker</strong> — Shuffle hand, draw 3.</li><li><strong>Ability</strong> — Class power.</li></ul></section>' +
        '<section class="cs-section"><h3>Targeting</h3><p>You can only target your two Neighbours (left/right) unless a card or class says otherwise (e.g. THE OCCULTIST 9 = any player).</p></section>' +
        '<section class="cs-section"><h3>Grimoire</h3><table class="cs-table"><tr><td>A or 1</td><td>Exchange</td><td>Swap a ghost in your Shadow with any number card (A–10) from The Dark.</td></tr><tr><td>2</td><td>Greed</td><td>Draw 2 to your hand.</td></tr><tr><td>3</td><td>Scare</td><td>Choose a neighbour; they shuffle hand, discard 1 to The Dark (Sadist: 2 to The Dark).</td></tr><tr><td>4</td><td>Drain</td><td>Choose a neighbour; take top of their Candle, put on top of yours.</td></tr><tr><td>5</td><td>Salt</td><td>Reaction: cancel action targeting you (both to The Dark).</td></tr><tr><td>6</td><td>Sight</td><td>View a neighbour\'s hand and take one card (Watcher: view both, take 1 from either).</td></tr><tr><td>7</td><td>Cleanse</td><td>Destroy 1 Ghost (to The Dark or Siphon to your Candle).</td></tr><tr><td>8</td><td>Recall</td><td>Take a Ghost from any Shadow to your hand.</td></tr><tr><td>9</td><td>Possess</td><td>Move a Ghost from your Shadow to a neighbour\'s Shadow.</td></tr><tr><td>10</td><td>Rekindle</td><td>Top 3 from The Dark to your Candle, then shuffle Candle.</td></tr><tr><td>J</td><td>Mirror</td><td>Choose a neighbour and swap your Shadow with their Shadow.</td></tr><tr><td>Q</td><td>Medium</td><td>1 from Dark to hand (no Joker), OR top 2 from Dark → Candle then shuffle.</td></tr><tr><td>K</td><td>Purge</td><td>Banish all Ghosts in your Shadow (to The Dark / Siphon).</td></tr><tr><td>★</td><td>BOO!</td><td>Others Burn until number (to The Dark); number → Ghost in their Shadow.</td></tr></table></section>';

    function getCheatsheetHTML(darkMode) {
        var candleRule = darkMode ? CHEATSHEET_TURN_DARK : CHEATSHEET_TURN_NORMAL;
        var possessionLine = darkMode
            ? '<li>3 Ghosts same suit → Possessed (lose). In Dark ritual: checked <strong>as soon as</strong> you get the 3rd (Haunt, BOO!, etc.), not only at end of turn.</li>'
            : '<li>3 Ghosts same suit in Shadow → Possessed (lose).</li>';
        return '<section class="cs-section"><h3>Win</h3><p>Be the last player with a lit Candle.</p></section>' +
            '<section class="cs-section"><h3>Turn order</h3><ol class="cs-list"><li>Burn 1 card per Ghost in your Shadow.</li><li>Draw 1.</li><li>Do <strong>one</strong> action.</li><li>Discard down to 5.</li>' + candleRule + possessionLine + '</ol></section>' +
            CHEATSHEET_REST;
    }

    function openCheatsheet() {
        var body = document.getElementById('cheatsheet-body');
        var modal = document.getElementById('cheatsheet-modal');
        if (body) body.innerHTML = getCheatsheetHTML(gameState.darkMode);
        if (modal) modal.style.display = 'flex';
    }

    function closeCheatsheet() {
        var modal = document.getElementById('cheatsheet-modal');
        if (modal) modal.style.display = 'none';
    }

    var alertModalCallback = null;

    function showAlertModal(msg, title, onClose) {
        var titleEl = document.getElementById('alert-modal-title');
        var msgEl = document.getElementById('alert-modal-msg');
        var modal = document.getElementById('alert-modal');
        if (titleEl) titleEl.textContent = title || 'Notice';
        if (msgEl) msgEl.textContent = msg || '';
        alertModalCallback = onClose || null;
        if (modal) modal.style.display = 'flex';
    }

    function closeAlertModal() {
        var modal = document.getElementById('alert-modal');
        if (modal) modal.style.display = 'none';
        if (alertModalCallback) {
            var cb = alertModalCallback;
            alertModalCallback = null;
            cb();
        }
    }

    function resetGameSetup() {
        if (aiTimer) clearTimeout(aiTimer);
        try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
        gameState.players = [];
        gameState.discard = [];
        gameState.turnOrder = [];
        gameState.turnIdx = 0;
        gameState.concurrentSlot = 0;
        gameState.activeIdx = 0;
        gameState.selectedIdxs = [];
        gameState.turnPhase = 'SETUP';
        gameState.selectionMode = null;
        gameState.pendingAction = null;
        gameState.pendingCardIdx = null;
        gameState.pendingGhostIdx = null;
        gameState.isGameOver = false;
        gameState.lastDamageTo = {};
        previousDiscardLength = 0;
        gameState.viewPreferenceSet = false;
        gameState.isOnline = false;
        gameState.isHost = false;
        gameState.roomCode = null;
        gameState.guestSocketId = null;
        gameState.broadcastState = null;
        document.body.classList.remove('dark-mode');
        var dmModal = document.getElementById('dark-mode-modal');
        if (dmModal) dmModal.style.display = 'none';
        var setupModal = document.getElementById('setup-modal');
        var list = document.getElementById('player-setup-list');
        if (setupModal) setupModal.style.display = 'flex';
        var localSetup = document.getElementById('local-setup');
        if (localSetup) localSetup.style.display = '';
        if (list) {
            list.innerHTML = '';
            gameState.players = [];
            addPlayerSlot();
            addPlayerSlot();
            updateSetupRemoveButtons();
            var firstInput = list.querySelector('.setup-name-input');
            if (firstInput) {
                try {
                    var saved = localStorage.getItem('finalFlickerDisplayName');
                    if (saved && saved.trim()) firstInput.value = saved.trim();
                } catch (e) {}
            }
        }
    }

    function addPlayerSlot() {
        var list = document.getElementById('player-setup-list');
        if (!list) return;
        var n = list.children.length + 1;
        var defaultType = n === 1 ? 'human' : 'ai';
        var div = document.createElement('div');
        div.className = 'setup-row';
        div.innerHTML = '<input type="text" class="setup-name-input" placeholder="Player ' + n + '" maxlength="32" aria-label="Name for player ' + n + '">' +
            '<button type="button" class="type-toggle type-' + defaultType + '" onclick="togglePlayerType(this)">' + (defaultType === 'human' ? 'HUMAN' : 'AI') + '</button>' +
            '<button type="button" class="setup-remove-btn" onclick="removePlayerSlot(this)" aria-label="Remove player" title="Remove player">−</button>';
        list.appendChild(div);
        gameState.players.push({ type: defaultType });
        updateSetupRemoveButtons();
    }

    function removePlayerSlot(btn) {
        var row = btn && btn.closest ? btn.closest('.setup-row') : null;
        if (!row) return;
        var list = row.parentElement;
        if (!list || list.id !== 'player-setup-list') return;
        if (list.children.length <= 2) return;
        var idx = Array.prototype.indexOf.call(list.children, row);
        list.removeChild(row);
        if (gameState.players.length > idx) gameState.players.splice(idx, 1);
        updateSetupRemoveButtons();
    }

    function updateSetupRemoveButtons() {
        var list = document.getElementById('player-setup-list');
        if (!list) return;
        var rows = list.querySelectorAll('.setup-row');
        for (var i = 0; i < rows.length; i++) {
            var removeBtn = rows[i].querySelector('.setup-remove-btn');
            if (removeBtn) removeBtn.disabled = rows.length <= 2;
        }
    }

    function clearAllSetupNames() {
        var list = document.getElementById('player-setup-list');
        if (!list) return;
        var inputs = list.querySelectorAll('.setup-name-input');
        for (var i = 0; i < inputs.length; i++) inputs[i].value = '';
    }

    function togglePlayerType(btn) {
        var isHuman = btn.textContent.trim().toLowerCase() === 'human';
        btn.textContent = isHuman ? 'AI' : 'HUMAN';
        btn.className = 'type-toggle type-' + (isHuman ? 'ai' : 'human');
        var row = btn.closest('.setup-row');
        if (row) {
            var idx = Array.prototype.indexOf.call(row.parentElement.children, row);
            if (gameState.players[idx] != null) gameState.players[idx].type = isHuman ? 'ai' : 'human';
        }
    }

    function startClassSelection() {
        if (typeof window.startBackgroundMusic === 'function') window.startBackgroundMusic();
        var rows = document.getElementById('player-setup-list');
        if (!rows) return;
        rows = rows.children;
        gameState.players = [];
        for (var i = 0; i < rows.length; i++) {
            var btn = rows[i].querySelector('.type-toggle');
            var type = (btn && btn.textContent) ? btn.textContent.trim().toLowerCase() : (i === 0 ? 'human' : 'ai');
            var nameEl = rows[i].querySelector('.setup-name-input');
            var name = (nameEl && nameEl.value.trim()) ? nameEl.value.trim() : ('P' + (i + 1));
            if (type === 'human' && i === 0) {
                try { localStorage.setItem('finalFlickerDisplayName', name); } catch (e) {}
            }
            gameState.players.push({
                id: i,
                name: name,
                type: type,
                hand: [],
                candle: [],
                shadow: [],
                class: null,
                isSalted: false,
                isDead: false
            });
        }
        var setupModal = document.getElementById('setup-modal');
        if (setupModal) setupModal.style.display = 'none';
        doDeckAndDealAndPickClasses();
    }

    function doDeckAndDealAndPickClasses() {
        var deck = [];
        var numDecks = Math.ceil(gameState.players.length / 2);
        for (var d = 0; d < numDecks; d++) {
            for (var s = 0; s < SUITS.length; s++) {
                for (var r = 0; r < RANKS.length; r++) {
                    deck.push({
                        s: SUITS[s],
                        r: RANKS[r],
                        val: getVal(RANKS[r]),
                        isFace: RANKS[r] === 'J' || RANKS[r] === 'Q' || RANKS[r] === 'K'
                    });
                }
            }
        }
        var nPlayers = gameState.players.length;
        var totalJokers = nPlayers <= 8 ? 2 * Math.ceil(nPlayers / 2) : 9 + Math.floor((nPlayers - 9) / 2);
        for (var j = 0; j < totalJokers; j++) {
            var jokerVariant = (j % 4) + 1;
            deck.push({ s: '★', r: 'JOKER', val: 99, isFace: false, jokerVariant: jokerVariant });
        }
        for (var k = deck.length - 1; k > 0; k--) {
            var j = Math.floor(Math.random() * (k + 1));
            var t = deck[k];
            deck[k] = deck[j];
            deck[j] = t;
        }
        for (var p = 0; p < gameState.players.length; p++) {
            var pl = gameState.players[p];
            pl.candle = deck.splice(0, 27);
            for (var h = 0; h < 3 && pl.candle.length; h++) {
                pl.hand.push(pl.candle.shift());
            }
        }
        gameState.turnOrder = [];
        for (var i = 0; i < gameState.players.length; i++) gameState.turnOrder.push(i);
        pickClasses(0);
    }

    function showDarkModeModal() {
        var modal = document.getElementById('class-modal');
        if (modal) modal.style.display = 'none';
        var dmModal = document.getElementById('dark-mode-modal');
        if (dmModal) dmModal.style.display = 'flex';
    }

    function chooseDarkMode(dark) {
        gameState.darkMode = !!dark;
        document.body.classList.toggle('dark-mode', gameState.darkMode);
        var dmModal = document.getElementById('dark-mode-modal');
        if (dmModal) dmModal.style.display = 'none';
        if (gameState.isOnline && gameState.isHost) {
            showFirstPlayerModal();
            return;
        }
        startTurn();
    }

    function showFirstPlayerModal() {
        var container = document.getElementById('first-player-options');
        var modal = document.getElementById('first-player-modal');
        if (!container || !modal) return;
        container.innerHTML = '';
        for (var i = 0; i < gameState.players.length; i++) {
            (function (playerIndex) {
                var p = gameState.players[playerIndex];
                var label = (p.name && p.name.trim()) ? p.name.trim() : ('Player ' + (playerIndex + 1));
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'game-btn';
                btn.textContent = label + ' starts';
                btn.onclick = function () { chooseFirstPlayer(playerIndex); };
                container.appendChild(btn);
            })(i);
        }
        modal.style.display = 'flex';
    }

    function chooseFirstPlayer(playerIndex) {
        var n = gameState.players.length;
        if (playerIndex < 0 || playerIndex >= n) return;
        var newOrder = [];
        for (var i = 0; i < n; i++) newOrder.push((playerIndex + i) % n);
        gameState.turnOrder = newOrder;
        gameState.turnIdx = 0;
        gameState.concurrentSlot = 0;
        gameState.activeIdx = gameState.players[gameState.turnOrder[0]].id;
        var modal = document.getElementById('first-player-modal');
        if (modal) modal.style.display = 'none';
        if (gameState.isOnline && gameState.isHost && typeof gameState.broadcastState === 'function') gameState.broadcastState();
        startTurn();
    }

    function chooseFirstPlayerRandom() {
        var n = gameState.players.length;
        if (n === 0) return;
        var idx = Math.floor(Math.random() * n);
        chooseFirstPlayer(idx);
    }
    window.chooseFirstPlayer = chooseFirstPlayer;
    window.chooseFirstPlayerRandom = chooseFirstPlayerRandom;

    function pickClasses(idx) {
        if (idx >= gameState.players.length) {
            showDarkModeModal();
            return;
        }
        var p = gameState.players[idx];
        var pool = getClassPool();
        if (p.type === 'ai') {
            p.class = pool[Math.floor(Math.random() * pool.length)];
            if (p.class.name === 'THE VOODOO DOLL') p.voodooSuits = ['♣', '♦']; /* two lowest suits */
            pickClasses(idx + 1);
            return;
        }
        if (p.isRemote && typeof window.onRequestRemoteClass === 'function') {
            var c1 = pool[Math.floor(Math.random() * pool.length)];
            var c2 = c1;
            while (c2 === c1) c2 = pool[Math.floor(Math.random() * pool.length)];
            var c3 = c1;
            while (c3 === c1 || c3 === c2) c3 = pool[Math.floor(Math.random() * pool.length)];
            window.onRequestRemoteClass(idx, [c1, c2, c3], function (className) {
                p.class = CLASSES.filter(function (c) { return c.name === className; })[0] || CLASSES[0];
                pickClasses(idx + 1);
            });
            return;
        }
        var modal = document.getElementById('class-modal');
        var title = document.getElementById('class-select-title');
        var opts = document.getElementById('class-options');
        if (!modal || !opts) return;
        modal.style.display = 'flex';
        if (title) title.textContent = p.name + ': CHOOSE CLASS';
        opts.innerHTML = '';
        var c1 = pool[Math.floor(Math.random() * pool.length)];
        var c2 = c1;
        while (c2 === c1) c2 = pool[Math.floor(Math.random() * pool.length)];
        var c3 = c1;
        while (c3 === c1 || c3 === c2) c3 = pool[Math.floor(Math.random() * pool.length)];
        [c1, c2, c3].forEach(function (c) {
            var b = document.createElement('div');
            b.className = 'class-box';
            var classImgName = getClassImageFilename(c.name);
            if (classImgName) {
                var img = document.createElement('img');
                img.className = 'class-card-img';
                var classFolder = window.getClassSubfolder ? window.getClassSubfolder(classImgName) : '';
                img.src = CLASS_IMAGES_BASE + (classFolder ? classFolder + '/' : '') + classImgName + CARD_IMAGE_EXT;
                img.alt = c.name;
                img.loading = 'lazy';
                img.onerror = function () { img.style.display = 'none'; };
                b.appendChild(img);
            }
            var textWrap = document.createElement('div');
            textWrap.className = 'class-box-text';
            textWrap.innerHTML = '<span class="class-title">' + c.name + '</span><small>' + c.desc + '</small>';
            b.appendChild(textWrap);
            b.onclick = function () {
                p.class = c;
                if (c.name === 'THE VOODOO DOLL') p.voodooSuits = ['♣', '♦']; /* two lowest suits (suit tier) */
                modal.style.display = 'none';
                pickClasses(idx + 1);
            };
            opts.appendChild(b);
        });
    }

    function startTurn() {
        if (gameState.isGameOver) return;
        if (aiTimer) {
            clearTimeout(aiTimer);
            aiTimer = null;
        }
        if (gameState.isOnline && gameState.isHost && typeof gameState.broadcastState === 'function') gameState.broadcastState();
        var orderIdx = getCurrentTurnOrderIndex();
        var p = gameState.players[gameState.turnOrder[orderIdx]];
        if (p.isDead) {
            endTurn();
            return;
        }
        gameState.activeIdx = p.id;
        gameState.turnPhase = 'ACTION';
        gameState.selectedIdxs = [];
        gameState.selectionMode = null;

        if (p.type === 'human') {
            runStartOfTurnPhase();
            if (!gameState.isGameOver) updateUI();
        } else {
            log('— ' + p.name + "'s turn —");
            startAITurn(p);
        }
    }

    function runStartOfTurnPhase() {
        if (gameState.players.length === 2) {
            var hasWitness = gameState.players.some(function (pl) { return pl.class && pl.class.name === 'THE WITNESS'; });
            if (hasWitness) {
                gameOver('No winner—THE WITNESS in a 2-player game.');
                return;
            }
        }
        var p = gameState.players[gameState.activeIdx];
        if (!p) return;
        p.occultistPossessBonusUsedThisTurn = false;
        p.phantomCancelUsedThisTurn = false;
        p.fatalistUsedThisTurn = false;
        gameState.funeralBellTriggeredThisTurn = false;
        if (p.class && p.class.name === 'THE GRIMOIRE OF REJECTION') gameState.grimoireRejectionSetThisTurn = false;
        if (p.class && p.class.name === 'THE ORACLE' && p.candle.length > 0 && p.type === 'human') {
            var topCard = p.candle[0];
            var slot = document.getElementById('oracle-card-slot');
            var modal = document.getElementById('oracle-modal');
            if (slot && modal) {
                slot.innerHTML = '';
                slot.appendChild(mkCard(topCard));
                modal.style.display = 'flex';
            }
            return;
        }
        if (p.class && p.class.name === 'THE GRIMOIRE OF REJECTION' && p.type === 'ai' && !gameState.grimoireRejectionSetThisTurn) {
            var grRanks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'JOKER'].filter(function (r) { return r !== gameState.grimoireRejectionLastTurn; });
            if (grRanks.length) {
                gameState.grimoireRejectionRank = grRanks[Math.floor(Math.random() * grRanks.length)];
                gameState.grimoireRejectionSetThisTurn = true;
                log(p.name + ' (THE GRIMOIRE OF REJECTION) wrote down ' + gameState.grimoireRejectionRank + '.');
            }
        }
        if (p.class && p.class.name === 'THE ORACLE' && p.candle.length > 0 && p.type === 'ai') {
            if (Math.random() < 0.5) {
                var t = p.candle.shift();
                p.candle.push(t);
                log(p.name + ' (THE ORACLE) put top card on bottom.');
            }
        }
        continueStartOfTurnPhase();
    }

    function resolveOracle(keepOnTop) {
        var modal = document.getElementById('oracle-modal');
        if (modal) modal.style.display = 'none';
        var p = gameState.players[gameState.activeIdx];
        if (!p) return;
        if (!keepOnTop && p.candle.length > 0) {
            var t = p.candle.shift();
            p.candle.push(t);
            log(p.name + ' (THE ORACLE) put top card on bottom.');
        }
        continueStartOfTurnPhase();
        if (!gameState.isGameOver) updateUI();
    }

    function resolveSeerChoice(putOnBottom) {
        var modal = document.getElementById('seer-modal');
        if (modal) modal.style.display = 'none';
        var t = gameState.seerTarget;
        gameState.seerTarget = null;
        var p = gameState.players[gameState.activeIdx];
        if (!p) return;
        if (t && t.candle.length > 0) {
            if (putOnBottom) {
                t.candle.push(t.candle.shift());
                log(p.name + ' (THE WATCHER) put ' + t.name + "'s top card on bottom.");
            } else {
                log(p.name + ' (THE WATCHER) looked at ' + t.name + "'s top card (left on top).");
            }
        }
        clearTargetMode();
        finishAction();
        updateUI();
    }

    function continueStartOfTurnPhase() {
        var p = gameState.players[gameState.activeIdx];
        if (!p) return;
        var ghostCount = p.shadow.filter(function (g) { return !g.isWall; }).length;
        var burn = ghostCount;
        if (p.class && p.class.name === 'THE VESSEL' && burn > 0) burn = Math.max(0, burn - 1);
        for (var i = 0; i < burn; i++) {
            if (p.candle.length) {
                var card = p.candle.shift();
                var isFace = card.isFace || card.r === 'J' || card.r === 'Q' || card.r === 'K';
                var crowNeighbour = null;
                var nBurn = getNeighbours(p);
                if (isFace && nBurn.left && nBurn.left.class && nBurn.left.class.name === 'THE CROW') crowNeighbour = nBurn.left;
                if (isFace && nBurn.right && nBurn.right.class && nBurn.right.class.name === 'THE CROW') crowNeighbour = crowNeighbour || nBurn.right;
                if (crowNeighbour) {
                    crowNeighbour.hand.push(card);
                    log(crowNeighbour.name + ' (THE CROW) took burned ' + card.r + card.s + '.');
                } else {
                    gameState.discard.push(card);
                }
                if (p.class && p.class.name === 'THE SUFFERER' && p.candle.length) {
                    p.hand.push(p.candle.shift());
                    log(p.name + ' (THE SUFFERER) Drew 1 from Candle.');
                }
            } else {
                if (handleDeath(p)) return;
                endTurn();
                return;
            }
        }
        if (burn > 0) {
            log(p.name + ' burned ' + burn + ' card' + (burn === 1 ? '' : 's') + '. Candle: ' + p.candle.length);
            if (typeof window.playSFX === 'function') window.playSFX('burn');
        }
        if (p.candle.length) {
            p.hand.push(p.candle.shift());
            if (typeof window.playSFX === 'function') window.playSFX('draw');
        } else {
            if (handleDeath(p)) return;
            endTurn();
            return;
        }
    }

    function handleDeath(p) {
        var killerId = gameState.lastDamageTo && gameState.lastDamageTo[p.id];
        var killer = killerId != null ? gameState.players[killerId] : null;
        var neighbours = getNeighbours(p);
        p.isDead = true;
        log(p.name + ' ELIMINATED!');
        if (p.class && p.class.name === 'THE LICH' && !p.usedLichRevive) {
            p.usedLichRevive = true;
            p.isDead = false;
            var alive = gameState.players.filter(function (pl) { return !pl.isDead && pl.id !== p.id; });
            for (var li = 0; li < alive.length; li++) {
                for (var lj = 0; lj < 2 && alive[li].candle.length; lj++) p.candle.push(alive[li].candle.shift());
            }
            p.hand = [];
            log(p.name + ' LICH revived! Stole 2 from each.');
            return false;
        }
        if (neighbours.left && neighbours.left.class && neighbours.left.class.name === 'THE VULTURE') {
            for (var v = 0; v < 5 && gameState.discard.length; v++) {
                var idx = Math.floor(Math.random() * gameState.discard.length);
                neighbours.left.candle.push(gameState.discard.splice(idx, 1)[0]);
            }
            log(neighbours.left.name + ' (THE VULTURE) took 5 from The Dark.');
        }
        if (neighbours.right && neighbours.right.class && neighbours.right.class.name === 'THE VULTURE' && neighbours.right.id !== (neighbours.left && neighbours.left.id)) {
            for (var v2 = 0; v2 < 5 && gameState.discard.length; v2++) {
                var idx2 = Math.floor(Math.random() * gameState.discard.length);
                neighbours.right.candle.push(gameState.discard.splice(idx2, 1)[0]);
            }
            log(neighbours.right.name + ' (THE VULTURE) took 5 from The Dark.');
        }
        if (neighbours.left && neighbours.left.class && neighbours.left.class.name === 'THE GRAVEDIGGER') {
            while (p.candle.length) neighbours.left.candle.push(p.candle.shift());
            log(neighbours.left.name + ' (THE GRAVEDIGGER) took ' + p.name + "'s Candle.");
        } else if (neighbours.right && neighbours.right.class && neighbours.right.class.name === 'THE GRAVEDIGGER') {
            while (p.candle.length) neighbours.right.candle.push(p.candle.shift());
            log(neighbours.right.name + ' (THE GRAVEDIGGER) took ' + p.name + "'s Candle.");
        }
        if (gameState.darkMode && p.shadow.length > 0) {
            var ghostsToPass = p.shadow.filter(function (g) { return !g.isWall; });
            var wallsToDiscard = p.shadow.filter(function (g) { return g.isWall; });
            gameState.lastDiscardByPlayerId = p.id;
            for (var wd = 0; wd < wallsToDiscard.length; wd++) gameState.discard.push(wallsToDiscard[wd]);
            p.shadow = [];
            if (ghostsToPass.length > 0) {
                var left = neighbours.left;
                var right = neighbours.right;
                if (!left && !right) {
                    gameState.lastDiscardByPlayerId = p.id;
                    for (var d = 0; d < ghostsToPass.length; d++) gameState.discard.push(ghostsToPass[d]);
                    log(p.name + '\'s ghosts went to The Dark (no neighbours).');
                } else if (left && !right) {
                    for (var l = 0; l < ghostsToPass.length; l++) left.shadow.push(ghostsToPass[l]);
                    log(p.name + '\'s ' + ghostsToPass.length + ' ghost(s) passed to ' + left.name + '.');
                    if (checkPossessionInstantIfDark(left)) return true;
                } else if (!left && right) {
                    for (var r = 0; r < ghostsToPass.length; r++) right.shadow.push(ghostsToPass[r]);
                    log(p.name + '\'s ' + ghostsToPass.length + ' ghost(s) passed to ' + right.name + '.');
                    if (checkPossessionInstantIfDark(right)) return true;
                } else {
                    var half = Math.floor(ghostsToPass.length / 2);
                    var extra = ghostsToPass.length % 2;
                    for (var hl = 0; hl < half; hl++) left.shadow.push(ghostsToPass[hl]);
                    for (var hr = half; hr < half + half; hr++) right.shadow.push(ghostsToPass[hr]);
                    var recipient = null;
                    if (extra === 1) {
                        var aliveForMin = gameState.players.filter(function (pl) { return !pl.isDead; });
                        var minGhosts = Infinity;
                        for (var mi = 0; mi < aliveForMin.length; mi++) {
                            var count = aliveForMin[mi].shadow.filter(function (g) { return !g.isWall; }).length;
                            if (count < minGhosts) { minGhosts = count; recipient = aliveForMin[mi]; }
                        }
                        if (recipient) recipient.shadow.push(ghostsToPass[ghostsToPass.length - 1]);
                        else { gameState.lastDiscardByPlayerId = p.id; gameState.discard.push(ghostsToPass[ghostsToPass.length - 1]); }
                        log(p.name + '\'s ghosts passed to neighbours; 1 extra to ' + (recipient ? recipient.name : 'The Dark') + '.');
                    } else {
                        log(p.name + '\'s ghosts passed evenly to ' + left.name + ' and ' + right.name + '.');
                    }
                    if (checkPossessionInstantIfDark(left)) return true;
                    if (checkPossessionInstantIfDark(right)) return true;
                    if (recipient && checkPossessionInstantIfDark(recipient)) return true;
                }
            }
        }
        var alive = gameState.players.filter(function (pl) { return !pl.isDead; });
        if (alive.length >= 2) {
            if (gameState.players.length === 2) {
                var hasWitness = alive.some(function (pl) { return pl.class && pl.class.name === 'THE WITNESS'; });
                if (hasWitness) {
                    gameOver('No winner—THE WITNESS in a 2-player game.');
                    return true;
                }
            }
            var witnessPlayer = null;
            for (var wi = 0; wi < alive.length; wi++) {
                if (alive[wi].class && alive[wi].class.name === 'THE WITNESS') { witnessPlayer = alive[wi]; break; }
            }
            if (witnessPlayer && alive.length === 2) {
                var otherPlayer = alive[0] === witnessPlayer ? alive[1] : alive[0];
                otherPlayer.isDead = true;
                log(otherPlayer.name + ' also loses—THE WITNESS!');
                return handleDeath(otherPlayer);
            }
        }
        if (alive.length >= 1) {
            var hasFuneralBell = false;
            for (var fb = 0; fb < alive.length; fb++) {
                if (alive[fb].class && alive[fb].class.name === 'THE FUNERAL BELL') { hasFuneralBell = true; break; }
            }
            if (hasFuneralBell && !gameState.funeralBellTriggeredThisTurn) {
                gameState.funeralBellTriggeredThisTurn = true;
                for (var bi = 0; bi < alive.length; bi++) {
                    if (alive[bi].class && alive[bi].class.name === 'THE FUNERAL BELL') continue;
                    if (alive[bi].candle.length > 0) {
                        var burned = alive[bi].candle.shift();
                        gameState.lastDiscardByPlayerId = alive[bi].id;
                        gameState.discard.push(burned);
                        log(alive[bi].name + ' (FUNERAL BELL) Burned 1.');
                        if (typeof window.playSFX === 'function') window.playSFX('burn');
                        if (handleDeath(alive[bi])) return true;
                    }
                }
            }
        }
        alive = gameState.players.filter(function (pl) { return !pl.isDead; });
        if (alive.length === 1) {
            if (alive[0].class && alive[0].class.name === 'THE WITNESS') {
                gameOver('No winner—THE WITNESS cannot win.');
                return true;
            }
            if (typeof window.playSFX === 'function') window.playSFX('win');
            gameOver(alive[0].name + ' WINS!');
            return true;
        }
        return false;
    }

    function endIntermission() {
        runStartOfTurnPhase();
        if (!gameState.isGameOver) updateUI();
    }

    /** Current turn player; resolves by id so it stays correct after state sync or when players die. */
    function getActivePlayer() {
        var idx = gameState.activeIdx;
        var p = gameState.players[idx];
        if (p && p.id === idx) return p;
        for (var i = 0; i < gameState.players.length; i++) {
            if (gameState.players[i].id === idx) return gameState.players[i];
        }
        return p || null;
    }

    function getNeighbours(p) {
        if (!p || p.isDead) return { left: null, right: null };
        var active = gameState.players.filter(function (pl) { return !pl.isDead; });
        var idx = -1;
        for (var i = 0; i < active.length; i++) {
            if (active[i].id === p.id) { idx = i; break; }
        }
        if (idx === -1) return { left: null, right: null };
        var l = (idx - 1 + active.length) % active.length;
        var r = (idx + 1) % active.length;
        return { left: active[l], right: active[r] };
    }

    function getTarget(p, dir) {
        var n = getNeighbours(p);
        return dir === 'left' ? n.left : n.right;
    }

    /** Returns array of valid target players for current pending action (neighbours only unless card/ability says any). */
    function getValidTargets() {
        var p = getActivePlayer();
        if (!p) return [];
        var n = getNeighbours(p);
        var neighbours = [n.left, n.right].filter(Boolean);
        if (gameState.selectionMode !== 'SELECT_TARGET' || !gameState.pendingAction) return neighbours;
        if ((gameState.pendingAction === 'cast' || gameState.pendingAction === 'cast9') && gameState.pendingCardIdx != null) {
            var c = p.hand[gameState.pendingCardIdx];
            if (c && c.r === '9' && p.class && p.class.name === 'THE OCCULTIST')
                return gameState.players.filter(function (pl) { return !pl.isDead && pl.id !== p.id; });
        }
        return neighbours;
    }

    var CARD_WIDTH_EST = 52;
    var SHADOW_GAP = 6;
    function updateShadowColumns(sDiv) {
        if (!sDiv || !sDiv.parentElement) return;
        var w = sDiv.parentElement.offsetWidth || sDiv.offsetWidth || 0;
        if (w <= 0) return;
        var cols = Math.max(1, Math.min(3, Math.floor((w - 12) / (CARD_WIDTH_EST + SHADOW_GAP))));
        sDiv.classList.remove('shadow-cols-1', 'shadow-cols-2', 'shadow-cols-3', 'shadow-cols-auto');
        sDiv.classList.add('shadow-cols-' + cols);
    }

    function attachShadowReveal(zoneEl, player) {
        if (!zoneEl || zoneEl.dataset.revealAttached === '1') return;
        zoneEl.dataset.revealAttached = '1';
        var tooltip = document.getElementById('shadow-reveal-tooltip');
        var modal = document.getElementById('shadow-view-modal');
        var modalTitle = document.getElementById('shadow-view-title');
        var modalCards = document.getElementById('shadow-view-cards');
        var shadowZones = zoneEl.querySelectorAll('.table-shadow-zone, .shadow-zone.table-shadow-zone');
        for (var i = 0; i < shadowZones.length; i++) {
            (function (zone) {
                var sideLabelEl = zone.closest('.shadow-from-neighbour') || zone.closest('.shadow-half');
                var label = sideLabelEl ? (sideLabelEl.querySelector('.shadow-sublabel') || {}).textContent || '' : '';
                zone.addEventListener('mouseenter', function (e) {
                    if (!tooltip) return;
                    var cards = zone.querySelectorAll('.g-card:not(.wall-card)');
                    var parts = [];
                    for (var j = 0; j < cards.length; j++) {
                        var mid = cards[j].querySelector('.mid');
                        var tl = cards[j].querySelector('.tl');
                        if (mid && tl) parts.push((tl.textContent || '').trim() + (mid.textContent || '').trim());
                    }
                    tooltip.innerHTML = '<strong>' + (player.name || '') + '</strong> ' + (label ? '— ' + label : '') + (parts.length ? '<div class="shadow-reveal-cards">' + parts.join(', ') + '</div>' : '<div class="shadow-reveal-cards">(empty)</div>');
                    tooltip.classList.add('visible');
                    tooltip.style.left = Math.min(e.clientX + 12, document.documentElement.clientWidth - 290) + 'px';
                    tooltip.style.top = (e.clientY + 12) + 'px';
                });
                zone.addEventListener('mouseleave', function () {
                    if (tooltip) tooltip.classList.remove('visible');
                });
                zone.addEventListener('click', function (e) {
                    if (gameState.selectionMode === 'SELECT_TARGET') return;
                    if (e.target.closest('.g-card.targetable')) return;
                    if (!modal || !modalTitle || !modalCards) return;
                    modalTitle.textContent = (player.name || '') + (label ? ' — ' + label : '') + ' (Shadow)';
                    modalCards.innerHTML = '';
                    var cards = zone.querySelectorAll('.g-card');
                    for (var j = 0; j < cards.length; j++) {
                        var clone = cards[j].cloneNode(true);
                        clone.classList.remove('targetable', 'small');
                        clone.onclick = null;
                        modalCards.appendChild(clone);
                    }
                    modal.style.display = 'flex';
                    modal.setAttribute('aria-hidden', 'false');
                });
            })(shadowZones[i]);
        }
    }

    function closeShadowViewModal() {
        var modal = document.getElementById('shadow-view-modal');
        if (modal) {
            modal.style.display = 'none';
            modal.setAttribute('aria-hidden', 'true');
        }
    }
    window.closeShadowViewModal = closeShadowViewModal;
    (function () {
        var modal = document.getElementById('shadow-view-modal');
        if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) closeShadowViewModal(); });
    })();

    var CARD_EFFECTS = {
        'A': { name: 'Exchange (A or 1)', effect: 'Choose a ghost in your Shadow; swap it with any number card (A–10) from The Dark (change suit to avoid possession or lower rank to banish).' },
        '2': { name: 'Greed', effect: 'Draw 2 cards to your hand.' },
        '3': { name: 'Scare', effect: 'Choose a neighbour. They shuffle their hand and blindly discard 1 to The Dark (The Sadist: 2 to The Dark; you pick which).' },
        '4': { name: 'Drain', effect: 'Choose a neighbour. Take the top card of their Candle; put it on top of your Candle.' },
        '5': { name: 'Salt', effect: 'Reaction: cancel an action targeting you (your Salt and their card go to the top of The Dark).' },
        '6': { name: 'Sight', effect: 'Choose a neighbour; view their hand and take one card of your choice to your hand (The Watcher: view both neighbours and take 1 from either).' },
        '7': { name: 'Cleanse', effect: 'Destroy 1 Ghost from your Shadow (to the top of The Dark, or to the bottom of your Candle if Siphon).' },
        '8': { name: 'Recall', effect: 'Take a Ghost from any Shadow and add it to your hand.' },
        '9': { name: 'Possess', effect: 'Move a Ghost from your Shadow to a neighbour\'s Shadow.' },
        '10': { name: 'Rekindle', effect: 'Take the top 3 cards from The Dark and put them on top of your Candle.' },
        'J': { name: 'Mirror', effect: 'Choose a neighbour and swap your Shadow with their Shadow.' },
        'Q': { name: 'Medium', effect: 'Choose: take 1 from The Dark to your hand, OR take the top 2 from The Dark and put them on top of your Candle.' },
        'K': { name: 'Purge', effect: 'Banish all Ghosts in your Shadow (to the top of The Dark; Siphon if rank matches and not Spades—Siphoned to bottom of your Candle).' },
        'JOKER': { name: 'BOO!', effect: 'Each other player Burns from the top of their Candle until they reveal a number (burned cards go to the top of The Dark; the number becomes a Ghost in their Shadow).' }
    };

    function getCardEffect(c) {
        if (!c || c.isWall) return null;
        var r = c.r === '★' || (c.isFace && c.r !== 'J' && c.r !== 'Q' && c.r !== 'K') ? 'JOKER' : c.r;
        return CARD_EFFECTS[r] || null;
    }

    function showCardEffectTooltip(card, ev) {
        var info = getCardEffect(card);
        var tip = document.getElementById('card-effect-tooltip');
        if (!tip || !info) return;
        if (ev) ev.stopPropagation();
        var shadowTip = document.getElementById('shadow-reveal-tooltip');
        if (shadowTip) shadowTip.classList.remove('visible');
        var rankSuitEl = tip.querySelector('.card-effect-rank-suit');
        if (rankSuitEl && card) {
            var rankSuit = (card.r === 'JOKER' || card.r === '★') ? 'JOKER' : (card.r || '') + (card.s || '');
            rankSuitEl.textContent = rankSuit;
            rankSuitEl.className = 'card-effect-rank-suit' + (card.s === '♥' || card.s === '♦' ? ' red' : '');
        }
        tip.querySelector('.card-effect-name').textContent = info.name;
        tip.querySelector('.card-effect-text').textContent = info.effect;
        tip.classList.add('visible');
        tip.style.left = (ev ? Math.min(ev.clientX + 8, document.documentElement.clientWidth - 270) : 20) + 'px';
        tip.style.top = (ev ? Math.min(ev.clientY + 8, document.documentElement.clientHeight - 80) : 20) + 'px';
    }

    function hideCardEffectTooltip() {
        var tip = document.getElementById('card-effect-tooltip');
        if (tip) tip.classList.remove('visible');
    }

    function getCardImageFilename(c) {
        if (!c || c.isWall) return null;
        if (c.r === 'JOKER' || c.r === '★') {
            var v = c.jokerVariant || 1;
            return 'deathwick_joker' + (v === 1 ? '' : v);
        }
        var rankMap = { 'A': 'ace', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9', '10': '10', 'J': 'jack', 'Q': 'queen', 'K': 'king' };
        var suitMap = { '♠': 'spades', '♥': 'hearts', '♣': 'clubs', '♦': 'diamonds' };
        var rank = rankMap[c.r];
        var suit = c.s ? suitMap[c.s] : '';
        if (!rank || !suit) return null;
        return 'deathwick_' + rank + '_' + suit;
    }
    /** Rank subfolder under images/cards/ranks/ (ace, two, three, … ten, jack, queen, king, joker) */
    function getRankSubfolder(c) {
        if (!c || c.isWall) return '';
        if (c.r === 'JOKER' || c.r === '★') return 'joker';
        var folderMap = { 'A': 'ace', '2': 'two', '3': 'three', '4': 'four', '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine', '10': 'ten', 'J': 'jack', 'Q': 'queen', 'K': 'king' };
        return folderMap[c.r] || '';
    }
    function getCardBackFilename() {
        return 'deathwick_back_portrait';
    }
    function getClassImageFilename(className) {
        return window.getClassImageFilename ? window.getClassImageFilename(className) : null;
    }
    function mkCard(c, isGhost) {
        var d = document.createElement('div');
        var red = (c.s === '♥' || c.s === '♦');
        d.className = 'g-card ' + (red ? 'red' : 'black') + (isGhost ? ' ghost' : '');
        var imgName = getCardImageFilename(c);
        if (imgName) {
            var img = document.createElement('img');
            img.className = 'card-face';
            var rankFolder = getRankSubfolder(c);
            img.src = CARD_RANKS_BASE + (rankFolder ? rankFolder + '/' : '') + imgName + CARD_IMAGE_EXT;
            img.alt = (c.r || '') + (c.s || '');
            img.loading = 'lazy';
            img.onerror = function () { d.classList.add('card-face-failed'); };
            d.appendChild(img);
        }
        var tl = document.createElement('div');
        tl.className = 'tl';
        tl.textContent = c.r + (c.s || '');
        d.appendChild(tl);
        var mid = document.createElement('div');
        mid.className = 'mid';
        mid.textContent = c.s || '';
        d.appendChild(mid);
        var br = document.createElement('div');
        br.className = 'br';
        br.textContent = c.r + (c.s || '');
        d.appendChild(br);
        if (c && !c.isWall && getCardEffect(c)) {
            d.addEventListener('mouseenter', function (ev) { showCardEffectTooltip(c, ev); });
            d.addEventListener('mouseleave', hideCardEffectTooltip);
        }
        return d;
    }
    function mkCardBack(small) {
        var d = document.createElement('div');
        d.className = 'g-card back' + (small ? ' small' : '');
        var img = document.createElement('img');
        img.className = 'card-face card-back';
        img.src = CARD_BACKS_BASE + getCardBackFilename() + CARD_IMAGE_EXT;
        img.alt = 'Card back';
        img.loading = 'lazy';
        img.onerror = function () { d.classList.add('card-face-failed'); };
        d.appendChild(img);
        return d;
    }

    function mkCardWithInfo(c, isGhost) {
        var d = mkCard(c, isGhost);
        var info = getCardEffect(c);
        if (info) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'card-info-btn';
            btn.setAttribute('aria-label', 'Card effect: ' + info.name);
            btn.textContent = 'i';
            btn.onclick = function (e) {
                e.stopPropagation();
                var tip = document.getElementById('card-effect-tooltip');
                if (tip && tip.classList.contains('visible')) {
                    hideCardEffectTooltip();
                } else {
                    showCardEffectTooltip(c, e);
                }
            };
            d.appendChild(btn);
        }
        return d;
    }

    function animateCardToDark(card, fromPlayerId) {
        if (!card || card.isWall) return;
        var table = document.getElementById('ritual-table');
        if (!table) return;
        var fly = document.createElement('div');
        fly.className = 'flying-discard-card';
        var cardEl = mkCard(card);
        fly.appendChild(cardEl);
        table.appendChild(fly);
        var humanPlayer = null;
        for (var i = 0; i < gameState.players.length; i++) {
            if (gameState.players[i].type === 'human') { humanPlayer = gameState.players[i]; break; }
        }
        var pid = fromPlayerId != null ? fromPlayerId : (gameState.lastDiscardByPlayerId != null ? gameState.lastDiscardByPlayerId : (humanPlayer && humanPlayer.id));
        var seat = null;
        if (pid != null) {
            if (humanPlayer && humanPlayer.id === pid) seat = document.getElementById('seat-you');
            else seat = table.querySelector('.ritual-seat-other[data-player-id="' + pid + '"]');
        }
        if (seat && table.getBoundingClientRect) {
            var tr = table.getBoundingClientRect();
            var sr = seat.getBoundingClientRect();
            var centerX = (sr.left + sr.width / 2 - tr.left) / tr.width * 100;
            var centerY = (sr.top + sr.height / 2 - tr.top) / tr.height * 100;
            fly.style.left = centerX + '%';
            fly.style.top = centerY + '%';
        } else if (pid != null && table.getBoundingClientRect) {
            var others = getOtherPlayersClockwise();
            var idx = -1;
            for (var j = 0; j < others.length; j++) { if (others[j].id === pid) { idx = j; break; } }
            if (idx >= 0) {
                var T = others.length;
                var angle = (3 * Math.PI / 2) + (idx + 1) * (2 * Math.PI / (T + 1));
                angle = angle % (2 * Math.PI);
                if (angle < 0) angle += 2 * Math.PI;
                var radius = Math.min(42, 32 + T * 2);
                var leftPct = 50 + radius * Math.cos(angle);
                var topPct = 50 - radius * Math.sin(angle);
                fly.style.left = leftPct + '%';
                fly.style.top = topPct + '%';
            }
        }
        requestAnimationFrame(function () {
            requestAnimationFrame(function () { fly.classList.add('landed'); });
        });
        setTimeout(function () {
            if (fly.parentNode) fly.parentNode.removeChild(fly);
        }, 420);
    }

    function getOtherPlayersClockwise() {
        var active = gameState.players.filter(function (pl) { return !pl.isDead; });
        var humanIdx = -1;
        for (var i = 0; i < active.length; i++) {
            if (active[i].type === 'human') { humanIdx = i; break; }
        }
        if (humanIdx === -1) return [];
        var out = [];
        for (var j = 1; j < active.length; j++) {
            out.push(active[(humanIdx + j) % active.length]);
        }
        return out;
    }

    /** Index into turnOrder for the player who should act right now (respects concurrentSlot for 6+). */
    function getCurrentTurnOrderIndex() {
        var n = gameState.turnOrder.length;
        if (n < 6) return gameState.turnIdx;
        var slot = gameState.concurrentSlot || 0;
        if (n <= 8) return (gameState.turnIdx + slot * Math.floor(n / 2)) % n;
        return (gameState.turnIdx + slot * Math.floor(n / 3)) % n;
    }

    /** For 6–8 players: 2 act per round (turnIdx and turnIdx+floor(n/2)). For 9–12: 3 act. Returns player ids. */
    function getConcurrentTurnPlayerIds() {
        var n = gameState.turnOrder.length;
        if (n < 6) return [gameState.players[gameState.turnOrder[gameState.turnIdx]].id];
        var idx = gameState.turnIdx;
        var ids = [];
        if (n <= 8) {
            var half = Math.floor(n / 2);
            ids.push(gameState.players[gameState.turnOrder[idx]].id);
            ids.push(gameState.players[gameState.turnOrder[(idx + half) % n]].id);
        } else {
            ids.push(gameState.players[gameState.turnOrder[idx]].id);
            ids.push(gameState.players[gameState.turnOrder[(idx + Math.floor(n / 3)) % n]].id);
            ids.push(gameState.players[gameState.turnOrder[(idx + Math.floor(2 * n / 3)) % n]].id);
        }
        return ids;
    }

    function drawTableSurface() {
        var table = document.getElementById('ritual-table');
        var canvas = document.getElementById('ritual-table-canvas');
        if (!table || !canvas) return;
        var w = table.clientWidth;
        var h = table.clientHeight;
        if (w <= 0 || h <= 0) return;
        var dpr = typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        var ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        var cx = w / 2;
        var cy = h / 2;
        var rx = w / 2;
        var ry = h / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
        ctx.closePath();
        ctx.clip();
        var root = typeof document !== 'undefined' && document.documentElement;
        var style = root && window.getComputedStyle ? window.getComputedStyle(root) : null;
        var surface = (style && style.getPropertyValue('--ritual-table-surface')) ? style.getPropertyValue('--ritual-table-surface').trim() : '#141210';
        var light = (style && style.getPropertyValue('--ritual-table-light')) ? style.getPropertyValue('--ritual-table-light').trim() : '#1c1814';
        var rim = (style && style.getPropertyValue('--ritual-table-rim')) ? style.getPropertyValue('--ritual-table-rim').trim() : '#0a0806';
        var grad = ctx.createRadialGradient(cx, cy * 0.6, 0, cx, cy, rx * 0.9);
        grad.addColorStop(0, light);
        grad.addColorStop(0.4, surface);
        grad.addColorStop(0.85, rim);
        grad.addColorStop(1, rim);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    function updateUI() {
        var table = document.getElementById('ritual-table');
        if (table) drawTableSurface();
        var pileEl = document.getElementById('ritual-discard-pile');
        if (pileEl) {
            pileEl.innerHTML = '';
            var n = gameState.discard.length;
            if (n === 0) gameState.selectedDarkTop = false;
            if (n > 0) {
                var lastCard = gameState.discard[n - 1];
                if (lastCard && !lastCard.isWall) {
                    var cardEl = mkCard(lastCard);
                    cardEl.classList.add('clickable-dark-top');
                    if (gameState.selectedDarkTop) cardEl.classList.add('selected');
                    cardEl.onclick = function () {
                        gameState.selectedDarkTop = !gameState.selectedDarkTop;
                        if (gameState.selectedDarkTop) gameState.selectedIdxs = [];
                        updateUI();
                    };
                    pileEl.appendChild(cardEl);
                }
            }
            if (gameState.turnPhase !== 'SETUP' && gameState.discard.length > previousDiscardLength) {
                var lastCard = gameState.discard[gameState.discard.length - 1];
                if (lastCard && !lastCard.isWall) animateCardToDark(lastCard, gameState.lastDiscardByPlayerId);
            }
            previousDiscardLength = gameState.discard.length;
        }
        var darkPreview = document.getElementById('dark-preview');
        var darkPreviewCard = document.getElementById('dark-preview-card');
        if (darkPreview && darkPreviewCard) {
            var topCard = gameState.discard.length > 0 ? gameState.discard[gameState.discard.length - 1] : null;
            var showPreview = gameState.turnPhase !== 'SETUP' && topCard && !topCard.isWall;
            darkPreview.classList.toggle('visible', showPreview);
            darkPreview.setAttribute('aria-hidden', showPreview ? 'false' : 'true');
            darkPreviewCard.innerHTML = '';
            if (showPreview && topCard) {
                darkPreviewCard.appendChild(mkCard(topCard));
            }
        }
        var selectedPreviewWrap = document.getElementById('selected-card-preview-wrap');
        var selectedPreview = document.getElementById('selected-card-preview');
        var selectedPreviewInner = document.getElementById('selected-card-preview-inner');
        if (selectedPreviewWrap && selectedPreview && selectedPreviewInner) {
            var previewCard = null;
            if (gameState.selectedDarkTop && gameState.discard.length > 0) {
                var top = gameState.discard[gameState.discard.length - 1];
                if (top && !top.isWall) previewCard = top;
            }
            /* No preview when player selects their own hand card — only for top of The Dark */
            selectedPreviewWrap.classList.toggle('visible', !!previewCard);
            selectedPreviewWrap.setAttribute('aria-hidden', previewCard ? 'false' : 'true');
            selectedPreviewInner.innerHTML = '';
            if (previewCard) selectedPreviewInner.appendChild(mkCard(previewCard));
            if (!selectedPreviewWrap._closeBound) {
                selectedPreviewWrap._closeBound = true;
                function closePreview() {
                    gameState.selectedDarkTop = false;
                    gameState.selectedIdxs = [];
                    updateUI();
                }
                var backdrop = document.getElementById('selected-card-preview-backdrop');
                var closeBtn = document.getElementById('selected-card-preview-close');
                if (backdrop) backdrop.addEventListener('click', closePreview);
                if (closeBtn) closeBtn.addEventListener('click', closePreview);
            }
        }
        var p = getActivePlayer();
        if (!p) return;
        var targets = getNeighbours(p);
        var tLeft = targets.left;
        var tRight = targets.right;
        var humanPlayer = null;
        for (var i = 0; i < gameState.players.length; i++) {
            if (gameState.players[i].type === 'human') { humanPlayer = gameState.players[i]; break; }
        }
        if (!humanPlayer) humanPlayer = p;

        var hintEl = document.getElementById('selection-hint');
        if (hintEl) {
            if (gameState.selectionMode === 'SELECT_GHOST') {
                hintEl.textContent = gameState.pendingDoomreader ? 'Select a ghost in your Shadow to change its suit.' : (gameState.selectionTarget != null ? 'Select a ghost (yours)' : 'Select a ghost');
                hintEl.style.display = 'block';
            } else if (gameState.selectionMode === 'SELECT_TARGET') {
                hintEl.textContent = 'Select target player';
                hintEl.style.display = 'block';
            } else if (gameState.selectionMode === 'DISCARD_DOWN' && gameState.pendingDiscardDown) {
                var pd = gameState.pendingDiscardDown;
                hintEl.textContent = 'Discard down to ' + pd.handLimit + ': select ' + pd.needToDiscard + ' card(s) to discard';
                hintEl.style.display = 'block';
            } else if (gameState.selectionMode === 'PHANTOM_DISCARD') {
                hintEl.textContent = 'Click a card in your hand to discard (cancel the Haunt).';
                hintEl.style.display = 'block';
            } else if (gameState.selectionMode === 'MIME_REDIRECT_DISCARD' && gameState.pendingMimeRedirect) {
                hintEl.textContent = 'Click a card to discard (redirect Haunt to ' + gameState.pendingMimeRedirect.otherNeighbour.name + ').';
                hintEl.style.display = 'block';
            } else {
                hintEl.textContent = '';
                hintEl.style.display = 'none';
            }
        }

        var playerName = document.getElementById('player-name');
        var playerClass = document.getElementById('player-class');
        var playerStatus = document.getElementById('player-status');
        if (playerName) playerName.textContent = humanPlayer.name + ' (you)';
        if (playerClass) {
            playerClass.textContent = humanPlayer.class ? humanPlayer.class.name : '';
            playerClass.className = 'seat-class clickable-class' + (humanPlayer.class ? '' : ' empty');
            playerClass.onclick = humanPlayer.class ? (function (cls) { return function () { showClassDesc(cls); }; })(humanPlayer.class) : null;
        }
        var playerClassCardOnTable = document.getElementById('player-class-card-on-table');
        if (playerClassCardOnTable) {
            if (humanPlayer.class && getClassImageFilename(humanPlayer.class.name)) {
                var name = getClassImageFilename(humanPlayer.class.name);
                var folder = window.getClassSubfolder ? window.getClassSubfolder(name) : '';
                playerClassCardOnTable.src = CLASS_IMAGES_BASE + (folder ? folder + '/' : '') + name + CARD_IMAGE_EXT;
                playerClassCardOnTable.alt = humanPlayer.class.name;
                playerClassCardOnTable.style.display = '';
                playerClassCardOnTable.classList.add('clickable-class-card');
                playerClassCardOnTable.onclick = (function (cls) { return function (e) { e.stopPropagation(); showClassDesc(cls); }; })(humanPlayer.class);
            } else {
                playerClassCardOnTable.src = '';
                playerClassCardOnTable.style.display = 'none';
                playerClassCardOnTable.onclick = null;
                playerClassCardOnTable.classList.remove('clickable-class-card');
            }
        }
        if (playerStatus) playerStatus.innerHTML = humanPlayer.isSalted ? ' <span class="status-badge status-salt">SALTED</span>' : '';

        var seatYou = document.getElementById('seat-you');
        if (seatYou) {
            seatYou.classList.toggle('salted', !!humanPlayer.isSalted);
            var concurrentIds = getConcurrentTurnPlayerIds();
            seatYou.classList.toggle('active-turn', concurrentIds.indexOf(humanPlayer.id) >= 0);
        }

        var playerCandleEl = document.getElementById('player-candle');
        if (playerCandleEl) playerCandleEl.style.setProperty('--candle-pct', Math.max(0, Math.min(100, (humanPlayer.candle.length / 27) * 100)));

        var hDiv = document.getElementById('player-hand');
        if (hDiv) {
            hDiv.innerHTML = '';
            var handLen = humanPlayer.hand.length;
            for (var i = 0; i < handLen; i++) {
                var c = humanPlayer.hand[i];
                var el = mkCardWithInfo(c);
                if (gameState.selectedIdxs.indexOf(i) >= 0) el.classList.add('selected');
                var rotateDeg = handLen <= 1 ? 0 : (i - (handLen - 1) / 2) * 8;
                el.style.setProperty('--hand-rotate', rotateDeg + 'deg');
                (function (idx) {
                    el.onclick = function (e) {
                        if (e.target.classList.contains('card-info-btn')) return;
                        selectCard(idx);
                        updateUI();
                    };
                })(i);
                hDiv.appendChild(el);
            }
        }

        var n = getNeighbours(humanPlayer);
        var leftId = n.left ? n.left.id : null;
        var rightId = n.right ? n.right.id : null;
        var fromLeft = [];
        var fromRight = [];
        for (var i = 0; i < humanPlayer.shadow.length; i++) {
            var c = humanPlayer.shadow[i];
            if (c.hauntedBy === leftId) fromLeft.push({ ghost: c, index: i });
            else if (c.hauntedBy === rightId) fromRight.push({ ghost: c, index: i });
            else fromRight.push({ ghost: c, index: i });
        }
        var leftLabel = document.getElementById('player-shadow-left-label');
        var rightLabel = document.getElementById('player-shadow-right-label');
        var isTwoPlayer = gameState.players.length === 2;
        if (isTwoPlayer) {
            if (leftLabel) leftLabel.textContent = '';
            if (rightLabel) rightLabel.textContent = '';
        } else {
            if (leftLabel) leftLabel.textContent = n.left ? 'From Left (' + n.left.name + ')' : 'From Left';
            if (rightLabel) rightLabel.textContent = n.right ? 'From Right (' + n.right.name + ')' : 'From Right';
        }
        function fillShadowZone(zoneId, list) {
            var zone = document.getElementById(zoneId);
            if (!zone) return;
            zone.innerHTML = '';
            for (var k = 0; k < list.length; k++) {
                var c = list[k].ghost;
                var idx = list[k].index;
                var el;
                if (c.isWall) {
                    el = document.createElement('div');
                    el.className = 'g-card wall-card ghost';
                    el.innerHTML = '<div class="tl">WALL</div><div class="mid">—</div><div class="br">WALL</div>';
                } else {
                    el = mkCard(c, true);
                }
                if (gameState.selectionMode === 'SELECT_GHOST' && !c.isWall && (gameState.selectionTarget === humanPlayer.id || gameState.selectionTarget == null)) {
                    el.classList.add('targetable');
                    el.onclick = (function (ownerId, ghostIdx) {
                        return function () { ghostSelected(ownerId, ghostIdx); };
                    })(humanPlayer.id, idx);
                }
                zone.appendChild(el);
            }
            requestAnimationFrame(function () { updateShadowColumns(zone); });
        }
        if (isTwoPlayer) {
            fillShadowZone('player-shadow-left', fromLeft.concat(fromRight));
            fillShadowZone('player-shadow-right', []);
        } else {
            fillShadowZone('player-shadow-left', fromLeft);
            fillShadowZone('player-shadow-right', fromRight);
        }
        var zoneYou = document.getElementById('table-zone-you');
        if (zoneYou && humanPlayer) {
            attachShadowReveal(zoneYou, humanPlayer);
            zoneYou.style.setProperty('--zone-rotate', '0deg');
        }

        var otherPlayersAll = getOtherPlayersClockwise();
        var T = otherPlayersAll.length;
        var showViewSwitcher = T >= 6;
        if (showViewSwitcher && !gameState.viewPreferenceSet) {
            gameState.showAllPlayers = true;
            gameState.viewPreferenceSet = true;
        }
        var neighboursOnly = showViewSwitcher && !gameState.showAllPlayers;
        if (gameState.selectionMode === 'SELECT_TARGET') {
            var validTargets = getValidTargets();
            if (validTargets.length > 2) gameState.showAllPlayers = true;
        }
        var otherPlayers = neighboursOnly ? [otherPlayersAll[0], otherPlayersAll[T - 1]] : otherPlayersAll;
        var displayCount = otherPlayers.length;

        var viewWrap = document.getElementById('view-switcher-wrap');
        if (viewWrap) {
            viewWrap.classList.toggle('visible', showViewSwitcher);
            var btnNeighbours = document.getElementById('view-btn-neighbours');
            var btnAll = document.getElementById('view-btn-all');
            if (btnNeighbours) btnNeighbours.classList.toggle('active', !gameState.showAllPlayers);
            if (btnAll) btnAll.classList.toggle('active', !!gameState.showAllPlayers);
        }

        var tableEl = document.getElementById('ritual-table');
        if (tableEl) tableEl.dataset.playerCount = String(gameState.players.length);
        var tableZonesContainer = document.getElementById('ritual-table-zones');
        var otherContainer = document.getElementById('ritual-other-seats');
        if (tableZonesContainer && otherContainer) {
            /* Remove any table zones for other players (keep table-zone-you) */
            var zonesToRemove = tableZonesContainer.querySelectorAll('.ritual-zone-other');
            for (var zi = 0; zi < zonesToRemove.length; zi++) zonesToRemove[zi].remove();
            otherContainer.innerHTML = '';
            var concurrentIds = getConcurrentTurnPlayerIds();
            var isNarrow = typeof window !== 'undefined' && window.innerWidth <= 640;
            var getLayout = (typeof getRitualLayout !== 'undefined' && getRitualLayout.getOtherPlayerLayout) ? getRitualLayout.getOtherPlayerLayout : null;
            for (var o = 0; o < displayCount; o++) {
                var other = otherPlayers[o];
                if (other.isDead) continue;
                var layout = getLayout ? getLayout(displayCount, o, isNarrow) : null;
                var zoneLeft, zoneTop, seatLeft, seatTop, zoneRotateDeg, isLeftOrRight, isTopPlayer, twoPlayerShadow;
                if (layout) {
                    zoneLeft = layout.zoneLeft;
                    zoneTop = layout.zoneTop;
                    seatLeft = layout.seatLeft;
                    seatTop = layout.seatTop;
                    zoneRotateDeg = layout.zoneRotateDeg;
                    isLeftOrRight = layout.isLeftOrRight;
                    isTopPlayer = layout.isTopPlayer;
                    twoPlayerShadow = layout.twoPlayerShadow;
                } else {
                    zoneLeft = 50;
                    zoneTop = 50;
                    seatLeft = 50;
                    seatTop = 50;
                    zoneRotateDeg = 0;
                    isLeftOrRight = false;
                    isTopPlayer = false;
                    twoPlayerShadow = displayCount === 1;
                }
                var zone = document.createElement('div');
                zone.className = 'ritual-zone ritual-zone-other';
                if (isLeftOrRight) zone.classList.add('zone-side');
                if (layout && layout.zonePosition) zone.dataset.zonePosition = layout.zonePosition;
                zone.dataset.playerId = String(other.id);
                zone.style.left = zoneLeft + '%';
                zone.style.top = zoneTop + '%';
                zone.style.setProperty('--zone-rotate', zoneRotateDeg + 'deg');
                var otherClassImg = '';
                if (other.class && getClassImageFilename(other.class.name)) {
                    var oClassName = getClassImageFilename(other.class.name);
                    var oClassFolder = window.getClassSubfolder ? window.getClassSubfolder(oClassName) : '';
                    otherClassImg = '<div class="ritual-zone-class-card"><img class="class-card-on-table" src="' + CLASS_IMAGES_BASE + (oClassFolder ? oClassFolder + '/' : '') + oClassName + CARD_IMAGE_EXT + '" alt=""></div>';
                } else {
                    otherClassImg = '<div class="ritual-zone-class-card"><img class="class-card-on-table" alt="" src=""></div>';
                }
                var shadowBoxHtml = twoPlayerShadow
                    ? '<div class="table-shadow-box"><div class="shadow-half shadow-half-left"><span class="shadow-sublabel">Shadow</span><div class="shadow-zone table-shadow-zone nb-shadow-zone seat-shadow-single-' + o + '" data-player-id="' + other.id + '" data-side="single"></div></div></div>'
                    : '<div class="table-shadow-box"><div class="shadow-half shadow-half-left"><span class="shadow-sublabel">Left</span><div class="shadow-zone table-shadow-zone nb-shadow-zone seat-shadow-left-' + o + '" data-player-id="' + other.id + '" data-side="left"></div></div><div class="shadow-divider" aria-hidden="true"></div><div class="shadow-half shadow-half-right"><span class="shadow-sublabel">Right</span><div class="shadow-zone table-shadow-zone nb-shadow-zone seat-shadow-right-' + o + '" data-player-id="' + other.id + '" data-side="right"></div></div></div>';
                zone.innerHTML = '<div class="ritual-zone-row">' +
                    '<div class="ritual-zone-left">' +
                    '<div class="ritual-zone-deck" aria-hidden="true"><div class="deck-stack"></div></div>' +
                    otherClassImg +
                    '</div>' +
                    '<div class="ritual-zone-shadow">' + shadowBoxHtml + '</div>' +
                    '<div class="ritual-zone-candle"><span class="candle-label">Candle</span><div class="candle-visual" style="--candle-pct:' + Math.max(0, Math.min(100, (other.candle.length / 27) * 100)) + '"><div class="candle-flame"></div><div class="candle-wax"></div></div></div>' +
                    '</div>' +
                    '<div class="ritual-zone-hand"><span class="hand-label-zone">Hand</span><div class="nb-hand-zone nb-hand-fan"></div><span class="hand-count-zone">' + other.hand.length + '</span></div>';
                var leftZone = twoPlayerShadow ? zone.querySelector('.seat-shadow-single-' + o) : zone.querySelector('.seat-shadow-left-' + o);
                var rightZone = twoPlayerShadow ? null : zone.querySelector('.seat-shadow-right-' + o);
                var nOther = getNeighbours(other);
                var leftId = nOther.left ? nOther.left.id : null;
                for (var s = 0; s < other.shadow.length; s++) {
                    var sc = other.shadow[s];
                    var el;
                    if (sc.isWall) {
                        el = document.createElement('div');
                        el.className = 'g-card wall-card ghost small';
                        el.innerHTML = '<div class="tl">WALL</div><div class="mid">—</div><div class="br">WALL</div>';
                    } else {
                        el = mkCard(sc, true);
                        el.classList.add('small');
                    }
                    if (gameState.selectionMode === 'SELECT_GHOST' && !sc.isWall && gameState.selectionTarget == null) {
                        el.classList.add('targetable');
                        el.onclick = (function (ownerId, ghostIdx) { return function () { ghostSelected(ownerId, ghostIdx); }; })(other.id, s);
                    }
                    var targetZone = (leftZone && rightZone) ? ((sc.hauntedBy === leftId) ? leftZone : rightZone) : leftZone;
                    (targetZone || leftZone).appendChild(el);
                }
                requestAnimationFrame(function () {
                    if (leftZone) updateShadowColumns(leftZone);
                    if (rightZone) updateShadowColumns(rightZone);
                });
                attachShadowReveal(zone, other);
                var classCardImg = zone.querySelector('.ritual-zone-class-card .class-card-on-table');
                if (classCardImg && other.class) {
                    classCardImg.classList.add('clickable-class-card');
                    classCardImg.onclick = (function (cls) { return function (e) { e.stopPropagation(); showClassDesc(cls); }; })(other.class);
                }
                var nbHandZone = zone.querySelector('.nb-hand-fan');
                if (nbHandZone) {
                    var handLen = other.hand.length;
                    for (var h = 0; h < handLen; h++) {
                        var backEl = mkCardBack(true);
                        var rotateDeg = handLen <= 1 ? 0 : (h - (handLen - 1) / 2) * 8;
                        backEl.style.setProperty('--hand-rotate', rotateDeg + 'deg');
                        nbHandZone.appendChild(backEl);
                    }
                }
                if (gameState.selectionMode === 'SELECT_TARGET') {
                    var zoneValidTargets = getValidTargets();
                    if (zoneValidTargets.some(function (pl) { return pl.id === other.id; })) {
                        zone.classList.add('targetable');
                        zone.style.cursor = 'pointer';
                        zone.onclick = (function (tgt) { return function (e) { e.stopPropagation(); targetPlayerSelected(tgt); }; })(other);
                    }
                }
                tableZonesContainer.appendChild(zone);

                /* Minimal seat: name + class only (hand and shadow are in the table zone so they don't overlap) */
                var seat = document.createElement('div');
                seat.className = 'ritual-seat ritual-seat-other ritual-seat-minimal';
                if (displayCount >= 3) seat.classList.add('seat-many');
                if (displayCount >= 5) seat.classList.add('seat-crowded');
                if (displayCount >= 4) seat.classList.add('seat-compact');
                if (isNarrow && displayCount >= 5) seat.classList.add('seat-mobile-many');
                seat.classList.toggle('active-turn', concurrentIds.indexOf(other.id) >= 0);
                seat.classList.toggle('concurrent-flame', concurrentIds.indexOf(other.id) >= 0 && gameState.turnOrder.length >= 6);
                seat.dataset.playerId = String(other.id);
                seat.style.left = seatLeft + '%';
                seat.style.top = seatTop + '%';
                seat.style.setProperty('--seat-rotate', zoneRotateDeg + 'deg');
                var validTargets = gameState.selectionMode === 'SELECT_TARGET' ? getValidTargets() : [];
                var isTargetable = validTargets.some(function (pl) { return pl.id === other.id; });
                if (isTargetable) {
                    seat.classList.add('targetable');
                    seat.onclick = (function (tgt) { return function () { targetPlayerSelected(tgt); }; })(other);
                }
                var clsName = other.class ? other.class.name : '';
                var concurrentBadge = (concurrentIds.indexOf(other.id) >= 0 && gameState.turnOrder.length >= 6) ? ' <span class="concurrent-badge" title="Concurrent flame">🔥</span>' : '';
                seat.innerHTML = '<div class="seat-header"><span class="seat-name">' + other.name + '</span><span class="seat-class clickable-class' + (other.class ? '' : ' empty') + '" data-class-name="' + clsName + '">' + clsName + '</span>' + concurrentBadge + '</div>';
                var seatClassEl = seat.querySelector('.seat-class');
                if (other.class && seatClassEl) seatClassEl.onclick = (function (cls) { return function (e) { e.stopPropagation(); showClassDesc(cls); }; })(other.class);
                otherContainer.appendChild(seat);
            }
        }

        var isHumanTurn = p.type === 'human';
        var isActionPhase = gameState.turnPhase === 'ACTION' && isHumanTurn;
        var isSingle = gameState.selectedIdxs.length === 1;
        var isDouble = gameState.selectedIdxs.length === 2;
        var selCard = isSingle && humanPlayer.hand[gameState.selectedIdxs[0]] ? humanPlayer.hand[gameState.selectedIdxs[0]] : null;
        var isFace = selCard && (selCard.isFace || selCard.r === 'JOKER');
        var isWarlock = humanPlayer.class && humanPlayer.class.name === 'THE WARLOCK';
        var castLabel = !selCard ? 'CAST' : isFace ? (isWarlock ? 'CAST / SUMMON' : 'SUMMON') : 'CAST';

        var castBtn = document.getElementById('btn-cast');
        if (castBtn) castBtn.textContent = castLabel;
        var modalCastBtn = document.getElementById('modal-btn-cast');
        if (modalCastBtn) modalCastBtn.textContent = castLabel;

        var inTargetMode = gameState.selectionMode === 'SELECT_TARGET';
        var btnHaunt = document.getElementById('btn-haunt');
        var btnBanish = document.getElementById('btn-banish');
        var btnCast = document.getElementById('btn-cast');
        var btnClass = document.getElementById('btn-class');
        var btnSeance = document.getElementById('btn-seance');
        var btnFlicker = document.getElementById('btn-flicker');
        var btnPanic = document.getElementById('btn-panic');
        var btnCancelTarget = document.getElementById('btn-cancel-target');
        var canUseGrimoireWithoutCard = humanPlayer.class && humanPlayer.class.name === 'THE GRIMOIRE OF REJECTION' && !gameState.grimoireRejectionSetThisTurn;
        if (btnHaunt) btnHaunt.disabled = inTargetMode || !isHumanTurn || !isSingle || gameState.turnPhase !== 'ACTION';
        if (btnBanish) btnBanish.disabled = inTargetMode || !isHumanTurn || !isSingle || gameState.turnPhase !== 'ACTION';
        if (btnCast) btnCast.disabled = inTargetMode || !isHumanTurn || !isSingle || gameState.turnPhase !== 'ACTION';
        if (btnClass) btnClass.disabled = inTargetMode || !isHumanTurn || gameState.turnPhase !== 'ACTION' || (!isSingle && !canUseGrimoireWithoutCard);
        if (btnSeance) btnSeance.disabled = inTargetMode || !isHumanTurn || !isDouble || gameState.turnPhase !== 'ACTION';
        if (btnFlicker) btnFlicker.disabled = inTargetMode || !isHumanTurn || gameState.turnPhase !== 'ACTION';
        var hasGhosts = humanPlayer.shadow.some(function (g) { return !g.isWall; });
        if (btnPanic) btnPanic.disabled = inTargetMode || !isHumanTurn || !hasGhosts || gameState.turnPhase !== 'ACTION';
        var inDiscardDownMode = gameState.selectionMode === 'DISCARD_DOWN';
        var discardDownOk = inDiscardDownMode && gameState.pendingDiscardDown && gameState.selectedIdxs.length === gameState.pendingDiscardDown.needToDiscard;
        if (btnCancelTarget) btnCancelTarget.style.display = inTargetMode && !inDiscardDownMode ? 'inline-block' : 'none';
        var btnDiscardDown = document.getElementById('btn-discard-down');
        if (btnDiscardDown) {
            btnDiscardDown.style.display = inDiscardDownMode ? 'inline-block' : 'none';
            btnDiscardDown.disabled = !discardDownOk;
        }
        var modalHaunt = document.getElementById('modal-btn-haunt');
        var modalBanish = document.getElementById('modal-btn-banish');
        var modalCast = document.getElementById('modal-btn-cast');
        var modalClass = document.getElementById('modal-btn-class');
        var modalSeance = document.getElementById('modal-btn-seance');
        var modalFlicker = document.getElementById('modal-btn-flicker');
        var modalPanic = document.getElementById('modal-btn-panic');
        if (modalHaunt) modalHaunt.disabled = inTargetMode || !isHumanTurn || !isSingle || gameState.turnPhase !== 'ACTION';
        if (modalBanish) modalBanish.disabled = inTargetMode || !isHumanTurn || !isSingle || gameState.turnPhase !== 'ACTION';
        if (modalCast) modalCast.disabled = inTargetMode || !isHumanTurn || !isSingle || gameState.turnPhase !== 'ACTION';
        if (modalClass) modalClass.disabled = inTargetMode || !isHumanTurn || gameState.turnPhase !== 'ACTION' || (!isSingle && !canUseGrimoireWithoutCard);
        if (modalSeance) modalSeance.disabled = inTargetMode || !isHumanTurn || !isDouble || gameState.turnPhase !== 'ACTION';
        if (modalFlicker) modalFlicker.disabled = inTargetMode || !isHumanTurn || gameState.turnPhase !== 'ACTION';
        if (modalPanic) modalPanic.disabled = inTargetMode || !isHumanTurn || !hasGhosts || gameState.turnPhase !== 'ACTION';

        var possWarn = document.getElementById('possession-warning');
        if (possWarn) possWarn.style.display = checkPossession(humanPlayer.shadow) ? 'block' : 'none';

        saveGameState();
    }

    function resolvePhantomCancel(allow) {
        var pm = gameState.pendingPhantomCancel;
        var phantomModal = document.getElementById('phantom-modal');
        if (phantomModal) phantomModal.style.display = 'none';
        if (!pm) return;
        if (allow) {
            gameState.pendingPhantomCancel = null;
            pm.onAllow();
        } else {
            gameState.selectionMode = 'PHANTOM_DISCARD';
            log('Click a card in your hand to discard (cancel the Haunt).');
            updateUI();
        }
    }

    function resolveMimeRedirect(allow) {
        var pm = gameState.pendingMimeRedirect;
        var mimeModal = document.getElementById('mime-modal');
        if (mimeModal) mimeModal.style.display = 'none';
        if (!pm) return;
        if (allow) {
            var mimeHauntContinuation = function () {
                var cardCopy = { r: pm.card.r, s: pm.card.s, val: pm.card.val, isFace: pm.card.isFace };
                if (pm.attacker.class && pm.attacker.class.name === 'THE WARLOCK' && (pm.card.isFace || pm.card.r === 'JOKER')) cardCopy.val = 10;
                cardCopy.hauntedBy = pm.attacker.id;
                if (!gameState.lastDamageTo) gameState.lastDamageTo = {};
                gameState.lastDamageTo[pm.mime.id] = pm.attacker.id;
                pm.mime.shadow.push(cardCopy);
                pm.attacker.hand.splice(pm.handIdx, 1);
                if (pm.mime.class && pm.mime.class.name === 'THE VOODOO DOLL' && pm.mime.voodooSuits && pm.mime.voodooSuits.indexOf(pm.card.s) >= 0) {
                    gameState.lastDiscardByPlayerId = pm.attacker.id;
                    if (pm.attacker.candle.length) gameState.discard.push(pm.attacker.candle.shift());
                    log(pm.attacker.name + ' (THE VOODOO DOLL) also Burned 1.');
                }
                if (pm.attacker.class && pm.attacker.class.name === 'THE MEDDLER' && pm.mime.candle.length > 0) {
                    var top = pm.mime.candle.shift();
                    pm.mime.candle.push(top);
                    log(pm.attacker.name + ' (THE MEDDLER) put ' + pm.mime.name + "'s top Candle on bottom.");
                }
                log(pm.attacker.name + ' Haunted ' + pm.mime.name + ' with ' + pm.card.r + pm.card.s);
                if (typeof window.playSFX === 'function') window.playSFX('haunt');
                if (checkPossessionInstantIfDark(pm.mime)) return;
                clearTargetMode();
                finishAction();
            };
            gameState.pendingMimeRedirect = null;
            checkSaltInterrupt(pm.attacker, pm.mime, pm.card, mimeHauntContinuation);
        } else {
            gameState.selectionMode = 'MIME_REDIRECT_DISCARD';
            log('Click a card in your hand to discard (redirect Haunt to ' + pm.otherNeighbour.name + ').');
            updateUI();
        }
    }

    function resolveMimeRedirectWithCard(discardIdx) {
        var pm = gameState.pendingMimeRedirect;
        if (!pm || !pm.mime || discardIdx < 0 || discardIdx >= pm.mime.hand.length) return;
        var discarded = pm.mime.hand.splice(discardIdx, 1)[0];
        gameState.lastDiscardByPlayerId = pm.mime.id;
        gameState.discard.push(discarded);
        log(pm.mime.name + ' (THE MIME) discarded 1 to redirect Haunt to ' + pm.otherNeighbour.name + '.');
        gameState.pendingMimeRedirect = null;
        gameState.selectionMode = null;
        doHauntWithTarget(pm.otherNeighbour);
        updateUI();
    }

    function resolveCryptkeeperBlock(useWall) {
        var pb = gameState.pendingCryptkeeperBlock;
        var ckModal = document.getElementById('cryptkeeper-modal');
        if (ckModal) ckModal.style.display = 'none';
        if (!pb) return;
        if (useWall) {
            var wallIdx = -1;
            for (var w = 0; w < pb.t.shadow.length; w++) { if (pb.t.shadow[w].isWall) { wallIdx = w; break; } }
            var wall = pb.t.shadow.splice(wallIdx, 1)[0];
            gameState.lastDiscardByPlayerId = pb.t.id;
            gameState.discard.push(pb.cardCopy);
            gameState.discard.push(wall);
            pb.p.hand.splice(pb.idx, 1);
            log(pb.t.name + ' (THE CRYPTKEEPER) Wall blocked the Haunt! Ghost and Wall → The Dark.');
            clearTargetMode();
            finishAction();
        } else {
            pb.doRest();
        }
        gameState.pendingCryptkeeperBlock = null;
        updateUI();
    }

    function resolvePhantomCancelWithCard(discardIdx) {
        var pm = gameState.pendingPhantomCancel;
        if (!pm || !pm.target || discardIdx < 0 || discardIdx >= pm.target.hand.length) return;
        var discarded = pm.target.hand.splice(discardIdx, 1)[0];
        gameState.lastDiscardByPlayerId = pm.target.id;
        gameState.discard.push(discarded);
        var attCard = pm.attacker.hand.splice(pm.attacker.hand.indexOf(pm.card), 1)[0];
        gameState.lastDiscardByPlayerId = pm.attacker.id;
        gameState.discard.push(attCard);
        pm.target.phantomCancelUsedThisTurn = true;
        log(pm.target.name + ' (THE UNSEEN) discarded 1 to cancel the Haunt. Both cards → The Dark.');
        gameState.pendingPhantomCancel = null;
        gameState.selectionMode = null;
        finishAction();
        updateUI();
    }

    function selectCard(idx) {
        if (gameState.pendingPhantomCancel && gameState.selectionMode === 'PHANTOM_DISCARD') {
            resolvePhantomCancelWithCard(idx);
            return;
        }
        if (gameState.pendingMimeRedirect && gameState.selectionMode === 'MIME_REDIRECT_DISCARD') {
            resolveMimeRedirectWithCard(idx);
            return;
        }
        if (gameState.selectionMode === 'DISCARD_DOWN') {
            var pd = gameState.pendingDiscardDown;
            if (!pd) return;
            var pos = gameState.selectedIdxs.indexOf(idx);
            if (pos >= 0) gameState.selectedIdxs.splice(pos, 1);
            else if (gameState.selectedIdxs.length < pd.needToDiscard) gameState.selectedIdxs.push(idx);
            return;
        }
        if (gameState.turnPhase !== 'ACTION') return;
        gameState.selectedDarkTop = false;
        var pos = gameState.selectedIdxs.indexOf(idx);
        if (pos >= 0) gameState.selectedIdxs.splice(pos, 1);
        else gameState.selectedIdxs.push(idx);
    }

    var logSequence = 0;
    function log(msg) {
        logSequence++;
        var l = document.getElementById('game-log');
        if (l) l.innerHTML = '&gt; <span class="log-seq" title="Order: ' + logSequence + '">[' + logSequence + ']</span> ' + msg + '<br>' + l.innerHTML;
    }

    var saltCounterCallback = null;

    function doSaltCancel(attacker, card) {
        var saltModal = document.getElementById('salt-modal');
        if (saltModal) saltModal.style.display = 'none';
        var idx = -1;
        for (var i = 0; i < attacker.hand.length; i++) { if (attacker.hand[i] === card) { idx = i; break; } }
        if (idx >= 0) {
            var played = attacker.hand.splice(idx, 1)[0];
            gameState.lastDiscardByPlayerId = attacker.id;
            gameState.discard.push(played);
        }
        log('<strong>INTERRUPTED!</strong> Defender used Salt; attacker\'s action cancelled. Both cards → The Dark.');
        clearTargetMode();
        updateUI();
        finishAction();
    }

    function showDefenderSaltPrompt(attacker, target, card, onContinue) {
        var saltIdx = -1;
        for (var i = 0; i < target.hand.length; i++) { if (target.hand[i].r === '5') { saltIdx = i; break; } }
        if (saltIdx === -1) { onContinue(); return; }
        var saltMsg = document.getElementById('salt-msg');
        var saltModal = document.getElementById('salt-modal');
        var defBtns = document.getElementById('salt-defender-buttons');
        var counterBtns = document.getElementById('salt-counter-buttons');
        if (counterBtns) counterBtns.style.display = 'none';
        if (defBtns) defBtns.style.display = 'flex';
        if (saltMsg) saltMsg.innerHTML = attacker.name + ' haunts with <strong>' + card.r + card.s + '</strong>.<br>Interrupt?';
        if (saltModal) saltModal.style.display = 'flex';
        saltCounterCallback = null;
        saltCallback = function (useSalt) {
            if (!useSalt) { if (saltModal) saltModal.style.display = 'none'; onContinue(); return; }
            var saltCard = target.hand.splice(saltIdx, 1)[0];
            gameState.lastDiscardByPlayerId = target.id;
            gameState.discard.push(saltCard);
            if (typeof window.playSFX === 'function') window.playSFX('salt');
            var attackerSaltIdx = -1;
            for (var j = 0; j < attacker.hand.length; j++) { if (attacker.hand[j].r === '5') { attackerSaltIdx = j; break; } }
            if (attackerSaltIdx === -1) {
                doSaltCancel(attacker, card);
                return;
            }
            if (attacker.type === 'ai') {
                if (saltModal) saltModal.style.display = 'none';
                var aiCounter = Math.random() < 0.5;
                if (aiCounter) {
                    var counterCard = attacker.hand.splice(attackerSaltIdx, 1)[0];
                    gameState.lastDiscardByPlayerId = attacker.id;
                    gameState.discard.push(counterCard);
                    log(attacker.name + ' countered with Salt.');
                    if (typeof window.playSFX === 'function') window.playSFX('salt');
                    updateUI();
                    showDefenderSaltPrompt(attacker, target, card, onContinue);
                } else {
                    doSaltCancel(attacker, card);
                }
                return;
            }
            if (defBtns) defBtns.style.display = 'none';
            if (counterBtns) counterBtns.style.display = 'flex';
            if (counterBtns) counterBtns.style.justifyContent = 'center';
            if (saltMsg) saltMsg.innerHTML = 'Counter with Salt? (Your haunt will go through if you do.)';
            saltCounterCallback = function (counter) {
                if (counterBtns) counterBtns.style.display = 'none';
                if (saltModal) saltModal.style.display = 'none';
                if (!counter) {
                    doSaltCancel(attacker, card);
                    return;
                }
                var counterCard = attacker.hand.splice(attackerSaltIdx, 1)[0];
                gameState.lastDiscardByPlayerId = attacker.id;
                gameState.discard.push(counterCard);
                log(attacker.name + ' countered with Salt.');
                if (typeof window.playSFX === 'function') window.playSFX('salt');
                updateUI();
                showDefenderSaltPrompt(attacker, target, card, onContinue);
            };
        };
    }

    function checkSaltInterrupt(attacker, target, card, onContinue) {
        if (attacker.class && attacker.class.name === 'THE SILENCE') {
            onContinue();
            return;
        }
        if (target.type !== 'human') {
            onContinue();
            return;
        }
        showDefenderSaltPrompt(attacker, target, card, onContinue);
    }

    function resolveSalt(choice) {
        if (saltCallback) saltCallback(choice);
    }

    function resolveSaltCounter(choice) {
        if (saltCounterCallback) saltCounterCallback(choice);
    }

    function actionHaunt() {
        if (gameState.selectedIdxs.length !== 1) {
            showAlertModal('Select exactly 1 card.', 'Haunt');
            return;
        }
        var p = gameState.players[gameState.activeIdx];
        var idx = gameState.selectedIdxs[0];
        var c = p.hand[idx];
        var isWarlockHaunt = p.class && p.class.name === 'THE WARLOCK' && (c.isFace || c.r === 'JOKER');
        if ((c.isFace || c.r === 'JOKER') && !isWarlockHaunt) {
            showAlertModal('Face cards and Jokers must be Summoned, not Haunted.', 'Haunt');
            return;
        }
        var n = getNeighbours(p);
        if (!n.left && !n.right) { showAlertModal('No neighbours to haunt.', 'Haunt'); return; }
        gameState.pendingAction = 'haunt';
        gameState.pendingCardIdx = idx;
        gameState.selectionMode = 'SELECT_TARGET';
        updateUI();
    }

    function clearTargetMode() {
        gameState.selectionMode = null;
        gameState.pendingAction = null;
        gameState.pendingCardIdx = null;
        gameState.pendingGhostIdx = null;
        gameState.pendingExorcistFirstOwner = null;
        gameState.pendingExorcistFirstIdx = null;
        gameState.panicGhostIndices = null;
    }

    function cancelTargetMode() {
        clearTargetMode();
        updateUI();
    }

    function targetPlayerSelected(t) {
        if (gameState.selectionMode !== 'SELECT_TARGET' || !t || t.isDead) return;
        var p = gameState.players[gameState.activeIdx];
        var idx = gameState.pendingCardIdx;
        if (gameState.pendingAction === 'haunt') {
            doHauntWithTarget(t);
            return;
        }
        if (gameState.pendingAction === 'cast' || gameState.pendingAction === 'cast9') {
            if (gameState.pendingAction === 'cast9') {
                var gIdx = gameState.pendingGhostIdx;
                if (idx == null || !p.hand[idx] || gIdx == null) { clearTargetMode(); updateUI(); return; }
                var c = p.hand[idx];
                var valid = getValidTargets();
                if (!valid.some(function (pl) { return pl && pl.id === t.id; })) return;
                if (t.class && t.class.name === 'THE GATEKEEPER') {
                    showAlertModal(t.name + ' (THE GATEKEEPER) is immune to ghosts being moved into their Shadow (Possess).', 'Blocked');
                    clearTargetMode();
                    updateUI();
                    return;
                }
                var ghost9 = p.shadow[gIdx];
                var binder9 = ghost9 && ghost9.hauntedBy != null ? gameState.players[ghost9.hauntedBy] : null;
                if (binder9 && binder9.class && binder9.class.name === 'THE SEALBINDER') {
                    showAlertModal('That ghost was Haunted by THE SEALBINDER; it cannot be Possessed.', 'Blocked');
                    clearTargetMode();
                    updateUI();
                    return;
                }
                executeCast(p, c, t, gIdx);
                clearTargetMode();
                finishAction();
                return;
            }
            if (idx == null || !p.hand[idx]) { clearTargetMode(); updateUI(); return; }
            var c = p.hand[idx];
            var valid = getValidTargets();
            if (!valid.some(function (pl) { return pl && pl.id === t.id; })) return;
            if (c.r === '6') {
                clearTargetMode();
                viewHandForClaim(t);
                return;
            }
            if (c.r === '2' && p.class && p.class.name === 'THE RAVENOUS' && t && t.hand.length > 0) {
                p.hand.splice(p.hand.indexOf(c), 1);
                gameState.lastDiscardByPlayerId = p.id;
                gameState.discard.push(c);
                var takeIdx = Math.floor(Math.random() * t.hand.length);
                var stolen = t.hand.splice(takeIdx, 1)[0];
                p.hand.push(stolen);
                log(p.name + ' (THE RAVENOUS) Greed: Stole 1 from ' + t.name + '.');
                clearTargetMode();
                finishAction();
                return;
            }
            if (c.r === 'J' && t.class && t.class.name === 'THE GATEKEEPER') {
                showAlertModal(t.name + ' (THE GATEKEEPER) is immune to ghosts being moved into their Shadow (Mirror).', 'Blocked');
                clearTargetMode();
                updateUI();
                return;
            }
            executeCast(p, c, t, null);
            clearTargetMode();
            finishAction();
            return;
        }
        if (gameState.pendingAction === 'class') {
            doClassWithTarget(t);
            return;
        }
    }

    function isGrimoireRejected(c) {
        if (!c || !gameState.grimoireRejectionRank) return false;
        var r = c.r === '★' ? 'JOKER' : c.r;
        if (r === gameState.grimoireRejectionRank) return true;
        if (gameState.grimoireRejectionRank === 'JOKER' && (c.isFace || c.r === 'JOKER' || c.r === '★')) return true;
        return false;
    }

    function doHauntWithTarget(t) {
        var p = gameState.players[gameState.activeIdx];
        var idx = gameState.pendingCardIdx;
        if (idx == null || !p.hand[idx]) return;
        var c = p.hand[idx];
        if (isGrimoireRejected(c)) {
            p.hand.splice(idx, 1);
            gameState.lastDiscardByPlayerId = p.id;
            gameState.discard.push(c);
            log('THE GRIMOIRE OF REJECTION cancelled ' + (c.r === '★' ? 'JOKER' : c.r + c.s) + '!');
            gameState.grimoireRejectionRank = null;
            clearTargetMode();
            finishAction();
            return;
        }
        var n = getNeighbours(p);
        if (t !== n.left && t !== n.right) return;
        if (t.class && t.class.name === 'THE HEX' && t.type === 'ai') {
            var hexIdx = -1;
            for (var h = 0; h < t.hand.length; h++) { if (t.hand[h].r === c.r) { hexIdx = h; break; } }
            if (hexIdx >= 0 && Math.random() < 0.5) {
                p.hand.splice(idx, 1);
                gameState.lastDiscardByPlayerId = p.id;
                gameState.discard.push(c);
                gameState.lastDiscardByPlayerId = t.id;
                gameState.discard.push(t.hand.splice(hexIdx, 1)[0]);
                log(t.name + ' (THE HEX) cancelled Haunt! Both discarded.');
                clearTargetMode();
                finishAction();
                return;
            }
        }
        if (t.class && t.class.name === 'THE MIME' && t.hand.length >= 1 && t.type === 'ai' && Math.random() < 0.5) {
            var jesterTarget = t;
            var discardIdx = Math.floor(Math.random() * t.hand.length);
            gameState.lastDiscardByPlayerId = t.id;
            gameState.discard.push(t.hand.splice(discardIdx, 1)[0]);
            t = n.left === t ? n.right : n.left;
            if (!t) return;
            log(jesterTarget.name + ' (THE MIME) redirected Haunt to ' + t.name + '.');
        }
        if (t.class && t.class.name === 'THE MIME' && t.hand.length >= 1 && t.type === 'human' && n.left && n.right) {
            var otherNeighbour = n.left === t ? n.right : n.left;
            gameState.pendingMimeRedirect = { attacker: p, mime: t, card: c, handIdx: idx, otherNeighbour: otherNeighbour };
            var mimeModal = document.getElementById('mime-modal');
            var mimeMsg = document.getElementById('mime-msg');
            if (mimeMsg) mimeMsg.textContent = 'Discard 1 card to redirect this Haunt to ' + otherNeighbour.name + '?';
            if (mimeModal) mimeModal.style.display = 'flex';
            return;
        }
        var hauntContinuation = function () {
            var cardCopy = { r: c.r, s: c.s, val: c.val, isFace: c.isFace };
            if (p.class && p.class.name === 'THE WARLOCK' && (c.isFace || c.r === 'JOKER')) cardCopy.val = 10;
            cardCopy.hauntedBy = p.id;
            var architectHasWall = t.shadow.some(function (g) { return g.isWall; });
            if (t.class && t.class.name === 'THE CRYPTKEEPER' && architectHasWall) {
                if (t.type === 'ai') {
                    var wallIdx = -1;
                    for (var w = 0; w < t.shadow.length; w++) { if (t.shadow[w].isWall) { wallIdx = w; break; } }
                    var wall = t.shadow.splice(wallIdx, 1)[0];
                    gameState.lastDiscardByPlayerId = t.id;
                    gameState.discard.push(cardCopy);
                    gameState.discard.push(wall);
                    p.hand.splice(idx, 1);
                    log(t.name + ' (THE CRYPTKEEPER) Wall blocked the Haunt! Ghost and Wall → The Dark.');
                    clearTargetMode();
                    finishAction();
                    return;
                }
                if (t.type === 'human') {
                    var doRestOfHaunt = function () {
                        if (!gameState.lastDamageTo) gameState.lastDamageTo = {};
                        gameState.lastDamageTo[t.id] = p.id;
                        t.shadow.push(cardCopy);
                        p.hand.splice(idx, 1);
                        if (t.class && t.class.name === 'THE VOODOO DOLL' && t.voodooSuits && t.voodooSuits.indexOf(cardCopy.s) >= 0) {
                            gameState.lastDiscardByPlayerId = p.id;
                            if (p.candle.length) gameState.discard.push(p.candle.shift());
                            log(p.name + ' (THE VOODOO DOLL) also Burned 1.');
                        }
                        if (p.class && p.class.name === 'THE MEDDLER' && t.candle.length > 0) {
                            var top = t.candle.shift();
                            t.candle.push(top);
                            log(p.name + ' (THE MEDDLER) put ' + t.name + "'s top Candle on bottom.");
                        }
                        log(p.name + ' Haunted ' + t.name + ' with ' + c.r + c.s);
                        if (typeof window.playSFX === 'function') window.playSFX('haunt');
                        if (checkPossessionInstantIfDark(t)) return;
                        clearTargetMode();
                        finishAction();
                    };
                    gameState.pendingCryptkeeperBlock = { p: p, t: t, cardCopy: cardCopy, idx: idx, c: c, doRest: doRestOfHaunt };
                    var ckModal = document.getElementById('cryptkeeper-modal');
                    if (ckModal) ckModal.style.display = 'flex';
                    return;
                }
            }
            if (!gameState.lastDamageTo) gameState.lastDamageTo = {};
            gameState.lastDamageTo[t.id] = p.id;
            t.shadow.push(cardCopy);
            p.hand.splice(idx, 1);
            if (t.class && t.class.name === 'THE VOODOO DOLL' && t.voodooSuits && t.voodooSuits.indexOf(cardCopy.s) >= 0) {
                gameState.lastDiscardByPlayerId = p.id;
                if (p.candle.length) gameState.discard.push(p.candle.shift());
                log(p.name + ' (THE VOODOO DOLL) also Burned 1.');
            }
            if (p.class && p.class.name === 'THE MEDDLER' && t.candle.length > 0) {
                var top = t.candle.shift();
                t.candle.push(top);
                log(p.name + ' (THE MEDDLER) put ' + t.name + "'s top Candle on bottom.");
            }
            log(p.name + ' Haunted ' + t.name + ' with ' + c.r + c.s);
            if (typeof window.playSFX === 'function') window.playSFX('haunt');
            if (checkPossessionInstantIfDark(t)) return;
            clearTargetMode();
            finishAction();
        };
        if (t.class && t.class.name === 'THE UNSEEN' && t.hand.length >= 1 && !t.phantomCancelUsedThisTurn) {
            if (t.type === 'ai') {
                if (Math.random() < 0.5) {
                    var phIdx = Math.floor(Math.random() * t.hand.length);
                    gameState.lastDiscardByPlayerId = t.id;
                    gameState.discard.push(t.hand.splice(phIdx, 1)[0]);
                    p.hand.splice(p.hand.indexOf(c), 1);
                    gameState.lastDiscardByPlayerId = p.id;
                    gameState.discard.push(c);
                    t.phantomCancelUsedThisTurn = true;
                    log(t.name + ' (THE UNSEEN) discarded 1 to cancel the Haunt. Both cards → The Dark.');
                    clearTargetMode();
                    updateUI();
                    finishAction();
                    return;
                }
            } else {
                gameState.pendingPhantomCancel = { attacker: p, target: t, card: c, handIdx: idx, onAllow: function () {
                    var pm = gameState.pendingPhantomCancel;
                    gameState.pendingPhantomCancel = null;
                    var phantomModal = document.getElementById('phantom-modal');
                    if (phantomModal) phantomModal.style.display = 'none';
                    if (pm) checkSaltInterrupt(pm.attacker, pm.target, pm.card, hauntContinuation);
                } };
                var phantomModal = document.getElementById('phantom-modal');
                var phantomMsg = document.getElementById('phantom-msg');
                if (phantomMsg) phantomMsg.textContent = p.name + ' is Haunting you. Discard 1 card to cancel? (Both cards → The Dark)';
                if (phantomModal) phantomModal.style.display = 'flex';
                return;
            }
        }
        checkSaltInterrupt(p, t, c, hauntContinuation);
    }

    function canBanish(c, g) {
        if (c.val > g.val) return true;
        if (c.val === g.val) {
            var tiers = { '♠': 4, '♥': 3, '♣': 2, '♦': 1, '★': 5 };
            return (tiers[c.s] || 0) >= (tiers[g.s] || 0);
        }
        return false;
    }

    function actionBanish() {
        var p = gameState.players[gameState.activeIdx];
        if (gameState.selectedIdxs.length !== 1) {
            showAlertModal('Select exactly 1 card to banish.', 'Banish');
            return;
        }
        var hasGhosts = p.shadow.some(function (g) { return !g.isWall; });
        if (!hasGhosts) {
            showAlertModal('No ghosts to banish (Walls cannot be banished).', 'Banish');
            return;
        }
        gameState.pendingAction = 'banish';
        gameState.selectionMode = 'SELECT_GHOST';
        gameState.selectionTarget = p.id;
        updateUI();
    }

    function actionFlicker() {
        var p = gameState.players[gameState.activeIdx];
        while (p.hand.length) p.candle.push(p.hand.pop());
        for (var k = p.candle.length - 1; k > 0; k--) {
            var j = Math.floor(Math.random() * (k + 1));
            var t = p.candle[k];
            p.candle[k] = p.candle[j];
            p.candle[j] = t;
        }
        for (var i = 0; i < 3 && p.candle.length; i++) p.hand.push(p.candle.shift());
        log(p.name + ' Flicker: Hand reset.');
        if (typeof window.playSFX === 'function') window.playSFX('draw');
        finishAction();
    }

    function actionCast() {
        if (gameState.selectedIdxs.length !== 1) return;
        var p = gameState.players[gameState.activeIdx];
        var idx = gameState.selectedIdxs[0];
        var c = p.hand[idx];

        if (c.r === 'Q') {
            document.getElementById('queen-modal').style.display = 'flex';
            return;
        }
        if (c.r === '7' || c.r === '9') {
            gameState.selectionMode = 'SELECT_GHOST';
            gameState.selectionTarget = p.id;
            updateUI();
            return;
        }
        if (c.r === '8') {
            gameState.selectionMode = 'SELECT_GHOST';
            updateUI();
            return;
        }
        if (c.r === 'A') {
            var ghosts = p.shadow.filter(function (g) { return !g.isWall; });
            if (ghosts.length === 0) { showAlertModal('No ghost in your Shadow to Exchange.', 'Cast'); return; }
            if (gameState.discard.length === 0) { showAlertModal('The Dark is empty.', 'Exchange'); return; }
            gameState.pendingAction = 'cast';
            gameState.pendingCardIdx = idx;
            gameState.selectionMode = 'SELECT_GHOST';
            gameState.selectionTarget = p.id;
            updateUI();
            return;
        }
        if (c.r === '2' && p.class && p.class.name === 'THE RAVENOUS') {
            var n5 = getNeighbours(p);
            if (!n5.left && !n5.right) { showAlertModal('No neighbour to target.', 'Cast'); return; }
            gameState.pendingAction = 'cast';
            gameState.pendingCardIdx = idx;
            gameState.selectionMode = 'SELECT_TARGET';
            updateUI();
            return;
        }
        if (c.r === '3') {
            var n3 = getNeighbours(p);
            var t3 = (n3.left && n3.right) ? (Math.random() < 0.5 ? n3.left : n3.right) : (n3.left || n3.right);
            if (!t3 || t3.isDead) { showAlertModal('No neighbour to target.', 'Cast'); return; }
            executeCast(p, c, t3, null);
            return;
        }
        if (['4', '6', 'J'].indexOf(c.r) >= 0) {
            var n = getNeighbours(p);
            if (!n.left && !n.right) { showAlertModal('No neighbour to target.', 'Cast'); return; }
            if (c.r === '6' && p.class && p.class.name === 'THE WATCHER') {
                if (!n.left && !n.right) { showAlertModal('No neighbour to target.', 'Cast'); return; }
                viewHandAllNeighboursForClaim(p, idx);
                return;
            }
            gameState.pendingAction = 'cast';
            gameState.pendingCardIdx = idx;
            gameState.selectionMode = 'SELECT_TARGET';
            updateUI();
            return;
        }
        if (c.r === '9') {
            var n = getNeighbours(p);
            if (p.class && p.class.name === 'THE OCCULTIST') {
                var alive = gameState.players.filter(function (pl) { return !pl.isDead && pl.id !== p.id; });
                if (alive.length === 0) { showAlertModal('No one to target.', 'Possess'); return; }
            } else if (!n.left && !n.right) { showAlertModal('No neighbour to target.', 'Possess'); return; }
            gameState.pendingAction = 'cast';
            gameState.pendingCardIdx = idx;
            gameState.selectionMode = 'SELECT_TARGET';
            updateUI();
            return;
        }
        executeCast(p, c, null, null);
    }

    function actionSeance() {
        if (gameState.selectedIdxs.length !== 2) {
            showAlertModal('Select exactly 2 matching cards (same rank).', 'Séance');
            return;
        }
        var p = gameState.players[gameState.activeIdx];
        var c1 = p.hand[gameState.selectedIdxs[0]];
        var c2 = p.hand[gameState.selectedIdxs[1]];
        if (c1.r !== c2.r) {
            showAlertModal('Séance requires a pair of the same rank.', 'Séance');
            return;
        }
        var idxs = gameState.selectedIdxs.slice().sort(function (a, b) { return b - a; });
        p.hand.splice(idxs[0], 1);
        p.hand.splice(idxs[1], 1);
        gameState.lastDiscardByPlayerId = p.id;
        gameState.discard.push(c1, c2);
        for (var i = 0; i < 4 && gameState.discard.length; i++) {
            p.candle.push(gameState.discard.shift());
        }
        log(p.name + ' used Séance: Healed 4 cards.');
        finishAction();
    }

    function viewHand(target) {
        var d = document.getElementById('hand-view-area');
        var modal = document.getElementById('hand-view-modal');
        if (d) d.innerHTML = '';
        if (target && target.hand) {
            for (var i = 0; i < target.hand.length; i++) d.appendChild(mkCard(target.hand[i]));
        }
        if (modal) modal.style.display = 'flex';
        var p = gameState.players[gameState.activeIdx];
        if (p && gameState.selectedIdxs.length === 1) {
            var card = p.hand.splice(gameState.selectedIdxs[0], 1)[0];
            gameState.lastDiscardByPlayerId = p.id;
            gameState.discard.push(card);
        }
        log(p.name + ' used Sight on ' + target.name + '.');
    }

    function viewHandForClaim(target) {
        var p = gameState.players[gameState.activeIdx];
        var cardIdx = gameState.pendingCardIdx;
        var c = cardIdx != null && p.hand[cardIdx] ? p.hand[cardIdx] : null;
        if (!c || c.r !== '6' || !target) return;
        gameState.pendingClaimTarget = target;
        gameState.pendingClaimCardIdx = cardIdx;
        gameState.pendingClaimTaken = gameState.pendingClaimTaken || 0;
        var need = (p.class && p.class.name === 'THE EXTORTIONER') ? 2 : 1;
        var d = document.getElementById('hand-view-area');
        var modal = document.getElementById('hand-view-modal');
        var h2 = modal ? modal.querySelector('h2') : null;
        if (h2) h2.textContent = need > 1 && gameState.pendingClaimTaken > 0 ? 'Sight — pick one more card to take' : 'Sight — pick a card to take';
        if (d) d.innerHTML = '';
        for (var i = 0; i < target.hand.length; i++) {
            (function (idx) {
                var el = mkCard(target.hand[idx]);
                el.classList.add('clickable-claim-card');
                el.style.cursor = 'pointer';
                el.onclick = function () {
                    if (!target.hand[idx]) return;
                    var stolen = target.hand.splice(idx, 1)[0];
                    p.hand.push(stolen);
                    gameState.pendingClaimTaken++;
                    if (gameState.pendingClaimCardIdx != null && p.hand[gameState.pendingClaimCardIdx]) {
                        var six = p.hand.splice(gameState.pendingClaimCardIdx, 1)[0];
                        gameState.lastDiscardByPlayerId = p.id;
                        gameState.discard.push(six);
                        gameState.pendingClaimCardIdx = null;
                    }
                    if (need > 1 && gameState.pendingClaimTaken < need && target.hand.length > 0) {
                        viewHandForClaim(target);
                        return;
                    }
                    var takenCount = gameState.pendingClaimTaken;
                    gameState.pendingClaimTarget = null;
                    gameState.pendingClaimTaken = 0;
                    if (modal) modal.style.display = 'none';
                    var h2r = modal ? modal.querySelector('h2') : null;
                    if (h2r) h2r.textContent = 'SIGHT REVEALED';
                    log(p.name + ' used Sight: took ' + takenCount + ' card(s) from ' + target.name + (p.class && p.class.name === 'THE EXTORTIONER' ? ' (THE EXTORTIONER).' : '.'));
                    clearTargetMode();
                    finishAction();
                };
                d.appendChild(el);
            })(i);
        }
        if (modal) modal.style.display = 'flex';
    }

    function viewHandAllNeighboursForClaim(p, cardIdx) {
        var c = p.hand[cardIdx];
        if (!c || c.r !== '6') return;
        var n = getNeighbours(p);
        var d = document.getElementById('hand-view-area');
        var modal = document.getElementById('hand-view-modal');
        var h2 = modal ? modal.querySelector('h2') : null;
        if (h2) h2.textContent = "Sight (THE WATCHER) — pick one card to take";
        if (d) d.innerHTML = '';
        function addHandLabel(name) {
            var lab = document.createElement('p');
            lab.style.marginTop = '12px';
            lab.style.marginBottom = '4px';
            lab.textContent = name + "'s hand:";
            d.appendChild(lab);
        }
        function addClickableCard(owner, idx) {
            var el = mkCard(owner.hand[idx]);
            el.classList.add('clickable-claim-card');
            el.style.cursor = 'pointer';
            el.onclick = function () {
                if (!owner.hand[idx]) return;
                var stolen = owner.hand.splice(idx, 1)[0];
                p.hand.push(stolen);
                p.hand.splice(p.hand.indexOf(c), 1);
                gameState.lastDiscardByPlayerId = p.id;
                gameState.discard.push(c);
                gameState.pendingClaimTarget = null;
                if (modal) modal.style.display = 'none';
                if (h2) h2.textContent = 'SIGHT REVEALED';
                log(p.name + ' (THE WATCHER) used Sight: took 1 card from ' + owner.name + '.');
                clearTargetMode();
                finishAction();
            };
            d.appendChild(el);
        }
        if (n.left) {
            addHandLabel(n.left.name);
            for (var i = 0; i < n.left.hand.length; i++) addClickableCard(n.left, i);
        }
        if (n.right && n.right !== n.left) {
            addHandLabel(n.right.name);
            for (var j = 0; j < n.right.hand.length; j++) addClickableCard(n.right, j);
        }
        if (modal) modal.style.display = 'flex';
    }

    function viewHandAllNeighbours(p) {
        var n = getNeighbours(p);
        if (!n.left && !n.right) { finishAction(); return; }
        var d = document.getElementById('hand-view-area');
        var modal = document.getElementById('hand-view-modal');
        var h2 = modal ? modal.querySelector('h2') : null;
        if (h2) h2.textContent = "SIGHT (THE WATCHER) — All Neighbours' Hands";
        if (d) d.innerHTML = '';
        if (n.left) {
            var leftLabel = document.createElement('p');
            leftLabel.style.marginTop = '12px';
            leftLabel.style.marginBottom = '4px';
            leftLabel.textContent = n.left.name + "'s hand:";
            d.appendChild(leftLabel);
            for (var i = 0; i < n.left.hand.length; i++) d.appendChild(mkCard(n.left.hand[i]));
        }
        if (n.right && n.right !== n.left) {
            var rightLabel = document.createElement('p');
            rightLabel.style.marginTop = '16px';
            rightLabel.style.marginBottom = '4px';
            rightLabel.textContent = n.right.name + "'s hand:";
            d.appendChild(rightLabel);
            for (var j = 0; j < n.right.hand.length; j++) d.appendChild(mkCard(n.right.hand[j]));
        }
        if (modal) modal.style.display = 'flex';
        log(p.name + ' (THE WATCHER) used Sight on all neighbours.');
    }

    function closeHandView() {
        var modal = document.getElementById('hand-view-modal');
        if (modal) {
            var h2 = modal.querySelector('h2');
            if (h2) h2.textContent = 'SIGHT REVEALED';
            modal.style.display = 'none';
        }
        finishAction();
    }
    (function () {
        var modal = document.getElementById('hand-view-modal');
        if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) closeHandView(); });
    })();

    function executeCast(p, c, target, ghostIdx) {
        if (isGrimoireRejected(c)) {
            var handIdx = p.hand.indexOf(c);
            if (handIdx > -1) p.hand.splice(handIdx, 1);
            gameState.lastDiscardByPlayerId = p.id;
            gameState.discard.push(c);
            log('THE GRIMOIRE OF REJECTION cancelled ' + (c.r === '★' ? 'JOKER' : c.r + (c.s || '')) + '!');
            gameState.grimoireRejectionRank = null;
            gameState.selectionMode = null;
            finishAction();
            return;
        }
        var handIdx = p.hand.indexOf(c);
        if (handIdx > -1) {
            p.hand.splice(handIdx, 1);
            gameState.lastDiscardByPlayerId = p.id;
            gameState.discard.push(c);
        }
        switch (c.r) {
            case '3':
                if (target && target.hand.length > 0) {
                    for (var s = target.hand.length - 1; s > 0; s--) {
                        var j = Math.floor(Math.random() * (s + 1));
                        var tmp = target.hand[s];
                        target.hand[s] = target.hand[j];
                        target.hand[j] = tmp;
                    }
                    var numDiscard = (p.class && p.class.name === 'THE SADIST') ? 2 : 1;
                    numDiscard = Math.min(numDiscard, target.hand.length);
                    var discardedLog = [];
                    for (var d = 0; d < numDiscard; d++) {
                        var discardIdx = p.class && p.class.name === 'THE SADIST' ? 0 : Math.floor(Math.random() * target.hand.length);
                        var discarded = target.hand.splice(discardIdx, 1)[0];
                        gameState.lastDiscardByPlayerId = target.id;
                        gameState.discard.push(discarded);
                        discardedLog.push(discarded.r + discarded.s);
                    }
                    log(p.name + ' Scare: ' + target.name + ' discarded ' + discardedLog.join(', ') + (p.class && p.class.name === 'THE SADIST' ? ' (THE SADIST chose).' : '.'));
                }
                break;
            case '2':
                for (var g = 0; g < 2 && p.candle.length; g++) p.hand.push(p.candle.shift());
                log(p.name + ' Greed: Drew 2.');
                if (typeof window.playSFX === 'function') window.playSFX('draw');
                break;
            case '4':
                if (target && target.class && target.class.name === 'THE SKEPTIC') {
                    log(target.name + ' (THE SKEPTIC) immune to Drain.');
                } else if (target && target.candle.length) {
                    var stolen = target.candle.shift();
                    p.candle.unshift(stolen);
                    log(p.name + ' Drain: Stole 1 from ' + target.name + '. Candle: ' + p.candle.length);
                }
                break;
            case '5':
                p.isSalted = true;
                log(p.name + ' Salt Barrier Active!');
                if (typeof window.playSFX === 'function') window.playSFX('salt');
                break;
            case '7':
                if (p.shadow.length > ghostIdx) {
                    gameState.lastDiscardByPlayerId = p.id;
                    gameState.discard.push(p.shadow.splice(ghostIdx, 1)[0]);
                    log('Cleanse used.');
                }
                break;
            case '6':
                if (target && target.hand.length > 0) {
                    var numClaim = (p.class && p.class.name === 'THE EXTORTIONER' && target.hand.length >= 2) ? 2 : 1;
                    for (var cl = 0; cl < numClaim && target.hand.length > 0; cl++) {
                        var takeIdx = Math.floor(Math.random() * target.hand.length);
                        var stolen = target.hand.splice(takeIdx, 1)[0];
                        p.hand.push(stolen);
                    }
                    log(p.name + ' Claim: Stole ' + numClaim + ' card(s) from ' + target.name + (p.class && p.class.name === 'THE EXTORTIONER' ? ' (THE EXTORTIONER).' : '.'));
                }
                break;
            case '8':
                if (target && target.shadow && target.shadow.length > ghostIdx) {
                    p.hand.push(target.shadow.splice(ghostIdx, 1)[0]);
                }
                log(p.name + ' used Recall.');
                break;
            case '9':
                if (p.shadow.length > ghostIdx && target) {
                    var ghost = p.shadow.splice(ghostIdx, 1)[0];
                    target.shadow.push(ghost);
                    if (p.class && p.class.name === 'THE OCCULTIST') {
                        var nOcc = getNeighbours(p);
                        var isNonNeighbour = target !== nOcc.left && target !== nOcc.right;
                        if (isNonNeighbour && !p.occultistPossessBonusUsedThisTurn && gameState.discard.length) {
                            p.occultistPossessBonusUsedThisTurn = true;
                            p.candle.push(gameState.discard.pop());
                            log(p.name + ' (THE OCCULTIST) Possess to non-neighbour this turn: +1 to Candle.');
                        }
                    }
                }
                log(p.name + ' used Possess on ' + target.name + '.');
                if (target && checkPossessionInstantIfDark(target)) { gameState.selectionMode = null; finishAction(); return; }
                break;
            case 'J':
                var tmp = p.shadow;
                p.shadow = target.shadow;
                target.shadow = tmp;
                log(p.name + ' used Mirror with ' + target.name + '.');
                break;
            case '10':
                for (var rk = 0; rk < 3 && gameState.discard.length; rk++) {
                    p.candle.unshift(gameState.discard.pop());
                }
                for (var sh = p.candle.length - 1; sh > 0; sh--) {
                    var j = Math.floor(Math.random() * (sh + 1));
                    var tmp = p.candle[sh];
                    p.candle[sh] = p.candle[j];
                    p.candle[j] = tmp;
                }
                log(p.name + ' Rekindle: Top 3 from The Dark to Candle, then shuffled. Candle: ' + p.candle.length);
                if (typeof window.playSFX === 'function') window.playSFX('draw');
                break;
            case 'K':
                gameState.lastDiscardByPlayerId = p.id;
                gameState.discard.push.apply(gameState.discard, p.shadow);
                p.shadow = [];
                log(p.name + ' used Purge.');
                if (typeof window.playSFX === 'function') window.playSFX('banish');
                break;
            case 'JOKER': {
                var jokerFoes = [];
                for (var ji = 0; ji < gameState.players.length; ji++) {
                    var foe = gameState.players[ji];
                    if (foe.isDead || foe.id === p.id) continue;
                    jokerFoes.push(foe);
                }
                gameState.pendingJokerAttacker = p;
                gameState.pendingJokerFoes = jokerFoes;
                gameState.pendingJokerFoeIndex = 0;
                runNextJokerTarget();
                return;
            }
            default:
                log((c.isFace || c.r === 'JOKER' || c.r === '★' ? 'Summon ' : 'Cast ') + c.r);
        }
        gameState.selectionMode = null;
        finishAction();
    }

    function ghostSelected(ownerId, idx) {
        if (gameState.selectionMode !== 'SELECT_GHOST') return;
        var p = gameState.players[gameState.activeIdx];
        var t = null;
        for (var i = 0; i < gameState.players.length; i++) {
            if (gameState.players[i].id === ownerId) { t = gameState.players[i]; break; }
        }
        if (!t) return;

        if (gameState.pendingDoomreader) {
            if (ownerId !== p.id) return;
            var ghost = t.shadow[idx];
            if (!ghost || ghost.isWall) { showAlertModal('Choose a ghost (not a Wall) to change its suit.', 'THE DOOMREADER'); return; }
            var suits = ['♠', '♥', '♣', '♦'];
            ghost.s = suits[(suits.indexOf(ghost.s) + 1) % 4];
            log(p.name + ' (THE DOOMREADER) changed Ghost Suit to ' + ghost.s);
            gameState.pendingDoomreader = null;
            gameState.selectionMode = null;
            finishAction();
            return;
        }

        if (gameState.pendingAction === 'cast' && gameState.pendingCardIdx != null && ownerId === p.id) {
            var aceCard = p.hand[gameState.pendingCardIdx];
            if (aceCard && aceCard.r === 'A') {
                var ghostA = t.shadow[idx];
                if (!ghostA || ghostA.isWall) { showAlertModal('Choose a ghost (not a Wall) to Exchange.', 'Exchange'); return; }
                var numberCardsInDark = gameState.discard.filter(function (c) { return c && !c.isWall && c.r !== 'JOKER' && c.r !== '★' && !c.isFace; });
                if (numberCardsInDark.length === 0) { showAlertModal('No number card in The Dark to swap with.', 'Exchange'); return; }
                gameState.pendingExchangeGhostOwnerId = ownerId;
                gameState.pendingExchangeGhostIdx = idx;
                openExchangeDarkModal();
                return;
            }
        }

        if (gameState.selectedIdxs.length === 1) {
            var c = p.hand[gameState.selectedIdxs[0]];
            var ghost = t.shadow[idx];
            if (ghost && ghost.isWall) {
                showAlertModal('Walls cannot be targeted (Banish/Recall/Cleanse/Possess target ghosts only).', 'Wall');
                return;
            }
            /* Banish flow: only resolve banish, do not treat as Cast (7/8/9) */
            if (gameState.pendingAction === 'banish') {
                if (t.id !== p.id) {
                    showAlertModal('You can only Banish ghosts in your own Shadow.', 'Banish');
                    return;
                }
                var clownOwnerB = ghost.hauntedBy != null ? gameState.players[ghost.hauntedBy] : null;
                var canBanishNumberB = !c.isFace && c.r !== '7';
                if (clownOwnerB && clownOwnerB.class && clownOwnerB.class.name === 'THE CLOWN' && canBanishNumberB) {
                    showAlertModal('That ghost was Haunted by THE CLOWN; it can only be Banished by a Face card or Cleanse (7).', 'Blocked');
                    return;
                }
                if (canBanish(c, ghost)) {
                    p.hand.splice(gameState.selectedIdxs[0], 1);
                    gameState.lastDiscardByPlayerId = p.id;
                    gameState.discard.push(c);
                    t.shadow.splice(idx, 1);
                    var isSiphonB = computeSiphon(p, c, ghost);
                    var plagueOwnerB = ghost.hauntedBy != null ? gameState.players[ghost.hauntedBy] : null;
                    resolveBanishResult(p, ghost, isSiphonB, plagueOwnerB, t);
                    gameState.pendingAction = null;
                    gameState.selectionMode = null;
                    if (gameState.pendingPriestDraw) { showPriestDrawModal(); return; }
                    finishAction();
                } else {
                    showAlertModal('Card too weak to banish that ghost.', 'Banish');
                }
                return;
            }
            if (c.r === '8') {
                var g8 = t.shadow[idx];
                var binder = g8 && g8.hauntedBy != null ? gameState.players[g8.hauntedBy] : null;
                if (binder && binder.class && binder.class.name === 'THE SEALBINDER') {
                    showAlertModal('That ghost was Haunted by THE SEALBINDER; it cannot be Recalled.', 'Blocked');
                    return;
                }
                executeCast(p, c, t, idx);
                return;
            }
            if (c.r === '7' && p.class && p.class.name === 'THE EXORCIST') {
                if (gameState.pendingExorcistFirstOwner == null) {
                    gameState.pendingExorcistFirstOwner = ownerId;
                    gameState.pendingExorcistFirstIdx = idx;
                    gameState.pendingExorcistCardIdx = gameState.selectedIdxs[0];
                    updateUI();
                    return;
                }
                if (ownerId === gameState.pendingExorcistFirstOwner && idx !== gameState.pendingExorcistFirstIdx) {
                    var idx1 = gameState.pendingExorcistFirstIdx;
                    var idx2 = idx;
                    var g1 = t.shadow[idx1];
                    var g2 = t.shadow[idx2];
                    t.shadow.splice(Math.max(idx1, idx2), 1);
                    t.shadow.splice(Math.min(idx1, idx2), 1);
                    var siphoned = false;
                    gameState.lastDiscardByPlayerId = t.id;
                    if (g1.s !== '♠') { p.candle.push(g1); siphoned = true; } else { gameState.discard.push(g1); }
                    if (g2.s !== '♠' && !siphoned) { p.candle.push(g2); siphoned = true; } else { gameState.discard.push(g2); }
                    p.hand.splice(p.hand.indexOf(c), 1);
                    gameState.lastDiscardByPlayerId = p.id;
                    gameState.discard.push(c);
                    log(p.name + ' (THE EXORCIST) Cleanse: 2 ghosts, Siphoned one.');
                    gameState.pendingExorcistFirstOwner = null;
                    gameState.pendingExorcistFirstIdx = null;
                    gameState.selectionMode = null;
                    finishAction();
                }
                return;
            }
            if (c.r === '7') {
                executeCast(p, c, t, idx);
                return;
            }
            if (c.r === '9') {
                if (t.id !== p.id) return;
                var n = getNeighbours(p);
                if (p.class && p.class.name === 'THE OCCULTIST') {
                    var alive = gameState.players.filter(function (pl) { return !pl.isDead && pl.id !== p.id; });
                    if (alive.length === 0) { showAlertModal('No one to target.', 'Possess'); return; }
                } else if (!n.left && !n.right) { showAlertModal('No neighbour to target.', 'Target'); return; }
                gameState.pendingAction = 'cast9';
                gameState.pendingCardIdx = gameState.selectedIdxs[0];
                gameState.pendingGhostIdx = idx;
                gameState.selectionMode = 'SELECT_TARGET';
                updateUI();
                return;
            }
            /* Cast with number/face to banish (e.g. from UI that picked ghost after Cast): own shadow only, then resolve */
            if (t.id !== p.id) {
                showAlertModal('You can only Banish ghosts in your own Shadow.', 'Banish');
                return;
            }
            var clownOwner = ghost.hauntedBy != null ? gameState.players[ghost.hauntedBy] : null;
            var canBanishNumber = !c.isFace && c.r !== '7';
            if (clownOwner && clownOwner.class && clownOwner.class.name === 'THE CLOWN' && canBanishNumber) {
                showAlertModal('That ghost was Haunted by THE CLOWN; it can only be Banished by a Face card or Cleanse (7).', 'Blocked');
                return;
            }
            if (canBanish(c, ghost)) {
                p.hand.splice(gameState.selectedIdxs[0], 1);
                gameState.lastDiscardByPlayerId = p.id;
                gameState.discard.push(c);
                t.shadow.splice(idx, 1);
                var isSiphon = computeSiphon(p, c, ghost);
                var plagueOwner = ghost.hauntedBy != null ? gameState.players[ghost.hauntedBy] : null;
                resolveBanishResult(p, ghost, isSiphon, plagueOwner, t);
                gameState.selectionMode = null;
                if (gameState.pendingPriestDraw) { showPriestDrawModal(); return; }
                finishAction();
            } else {
                showAlertModal('Card too weak to banish that ghost.', 'Banish');
            }
            return;
        }
        if (gameState.selectedIdxs.length === 0 && ownerId === p.id) {
            if (t.shadow[idx] && t.shadow[idx].isWall) {
                showAlertModal('Select a ghost to Panic against (not a Wall).', 'Panic');
                return;
            }
            gameState.panicGhostIndices = null;
            resolvePanic(p, idx);
            gameState.selectionMode = null;
        }
    }

    /** Siphon when: rank match, or Cleanse 7 suit match, or face ghost banished with 10/face and suit match; never Spades; Leech always (non-Spade). */
    function computeSiphon(p, c, ghost) {
        if (ghost.s === '♠') return false;
        if (p.class && p.class.name === 'THE LEECH') return true;
        if (c.r === ghost.r) return true;
        if (c.r === '7' && c.s === ghost.s) return true;
        if (ghost.isFace && (c.r === '10' || c.isFace) && c.s === ghost.s) return true;
        return false;
    }

    function resolveBanishResult(p, ghost, isSiphon, plagueOwner, t) {
        if (typeof window.playSFX === 'function') window.playSFX(isSiphon ? 'cleanse' : 'banish');
        if (isSiphon) {
            p.candle.push(ghost);
            log(p.name + ' SIPHON! Healed +1. Candle: ' + p.candle.length);
        } else {
            if (plagueOwner && plagueOwner.class && plagueOwner.class.name === 'THE PLAGUE') {
                var nT = getNeighbours(t);
                var other = (nT.left && nT.left.id !== p.id ? nT.left : null) || (nT.right && nT.right.id !== p.id ? nT.right : null);
                if (other && !other.isDead && other.id !== plagueOwner.id) {
                    other.shadow.push(ghost);
                    log(p.name + ' Banished ' + ghost.r + ghost.s + ' but PLAGUE: moved to ' + other.name + '.');
                    if (checkPossessionInstantIfDark(other)) return;
                } else {
                    gameState.lastDiscardByPlayerId = p.id;
                    gameState.discard.push(ghost);
                    log(p.name + ' Banished ' + ghost.r + ghost.s + (other && other.id === plagueOwner.id ? ' (THE PLAGUE cannot receive spread).' : ''));
                }
            } else {
                var n = getNeighbours(p);
                var reaperNeighbour = (n.left && n.left.class && n.left.class.name === 'THE REAPER') ? n.left : (n.right && n.right.class && n.right.class.name === 'THE REAPER') ? n.right : null;
                if (reaperNeighbour && !reaperNeighbour.isDead) {
                    reaperNeighbour.candle.push(ghost);
                    log(p.name + ' Banished ' + ghost.r + ghost.s + '; ' + reaperNeighbour.name + ' (THE REAPER) took it to Candle.');
                } else {
                    gameState.lastDiscardByPlayerId = p.id;
                    gameState.discard.push(ghost);
                    log(p.name + ' Banished ' + ghost.r + ghost.s);
                }
            }
            if (p.class && p.class.name === 'THE PRIEST') gameState.pendingPriestDraw = p;
        }
    }

    function showPriestDrawModal() {
        var modal = document.getElementById('priest-draw-modal');
        if (modal) modal.style.display = 'flex';
    }

    function resolvePriestDraw(draw) {
        var modal = document.getElementById('priest-draw-modal');
        if (modal) modal.style.display = 'none';
        var p = gameState.pendingPriestDraw;
        gameState.pendingPriestDraw = null;
        if (p && draw) drawCards(p, 1);
        finishAction();
    }

    function openGrimoireRejectionModal() {
        var p = gameState.players[gameState.activeIdx];
        if (!p || !p.class || p.class.name !== 'THE GRIMOIRE OF REJECTION' || gameState.grimoireRejectionSetThisTurn) return;
        var container = document.getElementById('grimoire-rank-buttons');
        if (!container) return;
        container.innerHTML = '';
        var ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'JOKER'];
        for (var ri = 0; ri < ranks.length; ri++) {
            var r = ranks[ri];
            if (r === gameState.grimoireRejectionLastTurn) continue;
            (function (rank) {
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'game-btn';
                btn.textContent = rank;
                btn.onclick = function () { setGrimoireRejection(rank); };
                container.appendChild(btn);
            })(r);
        }
        var modal = document.getElementById('grimoire-rejection-modal');
        if (modal) modal.style.display = 'flex';
    }

    function setGrimoireRejection(rank) {
        gameState.grimoireRejectionRank = rank;
        gameState.grimoireRejectionSetThisTurn = true;
        closeGrimoireRejectionModal();
        var p = gameState.players[gameState.activeIdx];
        if (p) log(p.name + ' (THE GRIMOIRE OF REJECTION) wrote down ' + rank + '.');
        updateUI();
    }

    function closeGrimoireRejectionModal() {
        var modal = document.getElementById('grimoire-rejection-modal');
        if (modal) modal.style.display = 'none';
    }

    function drawCards(p, n) {
        for (var i = 0; i < n && p.candle.length; i++) p.hand.push(p.candle.shift());
        if (n > 0 && typeof window.playSFX === 'function') window.playSFX('draw');
    }

    function runNextJokerTarget() {
        var attacker = gameState.pendingJokerAttacker;
        var foes = gameState.pendingJokerFoes;
        var idx = gameState.pendingJokerFoeIndex;
        if (!foes || idx >= foes.length) {
            gameState.pendingJokerAttacker = null;
            gameState.pendingJokerFoes = null;
            gameState.pendingJokerFoeIndex = 0;
            gameState.selectionMode = null;
            finishAction();
            return;
        }
        var foe = foes[idx];
        gameState.pendingJokerFoeIndex = idx + 1;
        if (attacker.class && attacker.class.name === 'THE SILENCE') {
            resolveJoker(foe);
            setTimeout(runNextJokerTarget, 0);
            return;
        }
        if (foe.type !== 'human') {
            resolveJoker(foe);
            setTimeout(runNextJokerTarget, 0);
            return;
        }
        var saltIdx = -1;
        for (var i = 0; i < foe.hand.length; i++) { if (foe.hand[i].r === '5') { saltIdx = i; break; } }
        if (saltIdx === -1) {
            resolveJoker(foe);
            setTimeout(runNextJokerTarget, 0);
            return;
        }
        var saltMsg = document.getElementById('salt-msg');
        var saltModal = document.getElementById('salt-modal');
        var defBtns = document.getElementById('salt-defender-buttons');
        var counterBtns = document.getElementById('salt-counter-buttons');
        if (counterBtns) counterBtns.style.display = 'none';
        if (defBtns) defBtns.style.display = 'flex';
        if (saltMsg) saltMsg.innerHTML = attacker.name + ' played <strong>BOO! (Joker)</strong>.<br>Use Salt to avoid the Burn?';
        if (saltModal) saltModal.style.display = 'flex';
        saltCallback = function (useSalt) {
            if (saltModal) saltModal.style.display = 'none';
            if (useSalt) {
                var saltCard = foe.hand.splice(saltIdx, 1)[0];
                gameState.lastDiscardByPlayerId = foe.id;
                gameState.discard.push(saltCard);
                log(foe.name + ' used Salt; BOO! has no effect on them.');
                if (typeof window.playSFX === 'function') window.playSFX('salt');
            } else {
                resolveJoker(foe);
            }
            updateUI();
            setTimeout(runNextJokerTarget, 0);
        };
    }

    function resolveJoker(target) {
        if (!target || target.isDead) return;
        var burned = 0;
        while (target.candle.length > 0) {
            var top = target.candle.shift();
            if (!top.isFace && top.r !== 'JOKER') {
                target.shadow.push(top);
                log('BOO!: ' + target.name + ' hit by ' + top.r + top.s + '. Burned ' + burned + '.');
                if (typeof window.playSFX === 'function') window.playSFX('haunt');
                if (checkPossessionInstantIfDark(target)) return;
                return;
            }
            gameState.discard.push(top);
            burned++;
            if (typeof window.playSFX === 'function') window.playSFX('burn');
        }
        if (!gameState.lastDamageTo) gameState.lastDamageTo = {};
        gameState.lastDamageTo[target.id] = gameState.players[gameState.activeIdx].id;
        handleDeath(target);
    }

    function queenExhume() {
        var d = document.getElementById('exhume-area');
        if (!d) return;
        d.innerHTML = '';
        if (gameState.discard.length === 0) {
            showAlertModal('The Dark is empty.', 'Exhume');
            return;
        }
        for (var i = 0; i < gameState.discard.length; i++) {
            var card = gameState.discard[i];
            if (card.r === 'JOKER' || card.r === '★') continue; /* Queen cannot pick a Joker */
            (function (idx) {
                var el = mkCard(gameState.discard[idx]);
                el.onclick = function () {
                    var p = gameState.players[gameState.activeIdx];
                    p.hand.push(gameState.discard.splice(idx, 1)[0]);
                    var qIdx = gameState.selectedIdxs[0];
                    if (p.hand.length > qIdx) { gameState.lastDiscardByPlayerId = p.id; gameState.discard.push(p.hand.splice(qIdx, 1)[0]); }
                    document.getElementById('queen-modal').style.display = 'none';
                    log(p.name + ' Exhumed a card.');
                    if (typeof window.playSFX === 'function') window.playSFX('draw');
                    finishAction();
                };
                d.appendChild(el);
            })(i);
        }
    }

    function queenRekindle() {
        var p = gameState.players[gameState.activeIdx];
        if (gameState.selectedIdxs.length === 1) {
            gameState.lastDiscardByPlayerId = p.id;
            gameState.discard.push(p.hand.splice(gameState.selectedIdxs[0], 1)[0]);
        }
        for (var i = 0; i < 2 && gameState.discard.length; i++) {
            p.candle.unshift(gameState.discard.pop());
        }
        for (var sh = p.candle.length - 1; sh > 0; sh--) {
            var j = Math.floor(Math.random() * (sh + 1));
            var tmp = p.candle[sh];
            p.candle[sh] = p.candle[j];
            p.candle[j] = tmp;
        }
        document.getElementById('queen-modal').style.display = 'none';
        log(p.name + ' Rekindled 2 to Candle and shuffled. Candle: ' + p.candle.length);
        if (typeof window.playSFX === 'function') window.playSFX('draw');
        finishAction();
    }

    function openExchangeDarkModal() {
        var container = document.getElementById('exchange-dark-cards');
        if (!container) return;
        container.innerHTML = '';
        for (var i = 0; i < gameState.discard.length; i++) {
            var c = gameState.discard[i];
            if (!c || c.isWall || c.r === 'JOKER' || c.r === '★' || c.isFace) continue;
            (function (discardIdx) {
                var el = mkCard(c);
                el.style.cursor = 'pointer';
                el.onclick = function () { resolveExchangeWithCard(discardIdx); };
                container.appendChild(el);
            })(i);
        }
        document.getElementById('exchange-dark-modal').style.display = 'flex';
    }

    function closeExchangeDarkModal() {
        gameState.pendingExchangeGhostOwnerId = null;
        gameState.pendingExchangeGhostIdx = null;
        document.getElementById('exchange-dark-modal').style.display = 'none';
        clearTargetMode();
        updateUI();
    }
    window.closeExchangeDarkModal = closeExchangeDarkModal;

    function resolveExchangeWithCard(discardIdx) {
        var p = gameState.players[gameState.activeIdx];
        var ownerId = gameState.pendingExchangeGhostOwnerId;
        var ghostIdx = gameState.pendingExchangeGhostIdx;
        var cardIdx = gameState.pendingCardIdx;
        if (ownerId == null || ghostIdx == null || cardIdx == null || !p.hand[cardIdx] || p.hand[cardIdx].r !== 'A') return;
        var t = null;
        for (var i = 0; i < gameState.players.length; i++) {
            if (gameState.players[i].id === ownerId) { t = gameState.players[i]; break; }
        }
        if (!t || !t.shadow[ghostIdx] || discardIdx < 0 || discardIdx >= gameState.discard.length) return;
        var chosenCard = gameState.discard[discardIdx];
        if (chosenCard.isFace || chosenCard.r === 'JOKER' || chosenCard.r === '★') return;
        var ghostA = t.shadow[ghostIdx];
        gameState.discard.splice(discardIdx, 1);
        gameState.lastDiscardByPlayerId = p.id;
        gameState.discard.push(ghostA);
        chosenCard.hauntedBy = ghostA.hauntedBy;
        t.shadow[ghostIdx] = chosenCard;
        var aceCard = p.hand.splice(cardIdx, 1)[0];
        gameState.lastDiscardByPlayerId = p.id;
        gameState.discard.push(aceCard);
        gameState.pendingExchangeGhostOwnerId = null;
        gameState.pendingExchangeGhostIdx = null;
        document.getElementById('exchange-dark-modal').style.display = 'none';
        log(p.name + ' used Exchange: swapped a ghost with ' + chosenCard.r + chosenCard.s + ' from The Dark.');
        clearTargetMode();
        finishAction();
    }

    function actionClass() {
        var p = gameState.players[gameState.activeIdx];
        if (p.class && p.class.name === 'THE GRIMOIRE OF REJECTION') {
            if (!gameState.grimoireRejectionSetThisTurn) { openGrimoireRejectionModal(); return; }
            showAlertModal('THE GRIMOIRE OF REJECTION: Already set this turn.', 'Ability');
            return;
        }
        if (gameState.selectedIdxs.length !== 1) return;
        var idx = gameState.selectedIdxs[0];
        var c = p.hand[idx];

        if (p.class.name === 'THE DOOMREADER') {
            if (p.fatalistUsedThisTurn) { showAlertModal('THE DOOMREADER: Up to once per turn. Already used this turn.', 'Ability'); return; }
            var ghostCount = p.shadow.filter(function (g) { return !g.isWall; }).length;
            if (ghostCount === 0) { showAlertModal('No ghosts in your Shadow to change.', 'Ability'); return; }
            p.hand.splice(idx, 1);
            gameState.lastDiscardByPlayerId = p.id;
            gameState.discard.push(c);
            p.fatalistUsedThisTurn = true;
            gameState.pendingDoomreader = true;
            gameState.selectionMode = 'SELECT_GHOST';
            gameState.selectionTarget = p.id;
            log('Select a ghost in your Shadow to change its suit.');
            updateUI();
            return;
        }
        if (p.class.name === 'THE PYROMANIAC' && (c.s === '♥' || c.s === '♦')) {
            var n = getNeighbours(p);
            if (!n.left && !n.right) { showAlertModal('No neighbour to target.', 'Cast'); return; }
            gameState.pendingAction = 'class';
            gameState.pendingCardIdx = idx;
            gameState.selectionMode = 'SELECT_TARGET';
            updateUI();
            return;
        }
        if (p.class.name === 'THE USERER') {
            var n = getNeighbours(p);
            if (!n.left && !n.right) { showAlertModal('No neighbour to target.', 'Cast'); return; }
            gameState.pendingAction = 'class';
            gameState.pendingCardIdx = idx;
            gameState.selectionMode = 'SELECT_TARGET';
            updateUI();
            return;
        }
        if (p.class.name === 'THE INQUISITOR') {
            var nInq = getNeighbours(p);
            if (!nInq.left && !nInq.right) { showAlertModal('No neighbour to target.', 'Ability'); return; }
            gameState.pendingAction = 'class';
            gameState.pendingCardIdx = idx;
            gameState.selectionMode = 'SELECT_TARGET';
            updateUI();
            return;
        }
        if (p.class.name === 'THE WATCHER') {
            showClassDesc(p.class);
            return;
        }
        if (p.class.name === 'THE MIMIC' && !p.usedMimic) {
            var n = getNeighbours(p);
            if (!n.left && !n.right) { showAlertModal('No neighbour to target.', 'Ability'); return; }
            gameState.pendingAction = 'class';
            gameState.pendingCardIdx = null;
            gameState.selectionMode = 'SELECT_TARGET';
            updateUI();
            return;
        }
        if (p.class.name === 'THE MIMIC' && p.usedMimic) {
            showAlertModal('THE MIMIC: Once per game. Already used.', 'Ability');
            return;
        }
        if (p.class.name === 'THE CRYPTKEEPER') {
            var card = p.hand[idx];
            if (!card) return;
            p.hand.splice(idx, 1);
            var wall = { r: card.r, s: card.s, val: card.val, isFace: card.isFace, isWall: true };
            p.shadow.push(wall);
            log(p.name + ' (THE CRYPTKEEPER) played a Wall.');
            finishAction();
            return;
        }
        showClassDesc(p.class);
    }

    function doClassWithTarget(t) {
        var p = gameState.players[gameState.activeIdx];
        var idx = gameState.pendingCardIdx;
        var n = getNeighbours(p);
        if (p.class.name === 'THE INQUISITOR') {
            if (t !== n.left && t !== n.right) return;
            if (idx == null || !p.hand[idx]) { clearTargetMode(); updateUI(); return; }
            var cInq = p.hand.splice(idx, 1)[0];
            gameState.lastDiscardByPlayerId = p.id;
            gameState.discard.push(cInq);
            var hasFace = false;
            for (var fi = 0; fi < t.hand.length; fi++) {
                if (t.hand[fi].isFace || t.hand[fi].r === 'J' || t.hand[fi].r === 'Q' || t.hand[fi].r === 'K') { hasFace = true; break; }
            }
            log(p.name + ' (THE INQUISITOR) revealed ' + t.name + "'s hand" + (hasFace ? '—Face card! ' + t.name + ' Burns 2.' : '.'));
            if (hasFace) {
                for (var bi = 0; bi < 2 && t.candle.length; bi++) {
                    gameState.lastDiscardByPlayerId = t.id;
                    gameState.discard.push(t.candle.shift());
                }
                if (typeof window.playSFX === 'function') window.playSFX('burn');
                if (handleDeath(t)) return;
            }
            clearTargetMode();
            finishAction();
            return;
        }
        if (p.class.name === 'THE MIMIC' && !p.usedMimic) {
            if (t !== n.left && t !== n.right) { clearTargetMode(); updateUI(); return; }
            var temp = p.candle.slice();
            p.candle = t.candle.slice();
            t.candle = temp;
            p.usedMimic = true;
            log(p.name + ' (THE MIMIC) swapped Candles with ' + t.name + '.');
            clearTargetMode();
            finishAction();
            return;
        }
        if (idx == null || !p.hand[idx]) { clearTargetMode(); updateUI(); return; }
        var c = p.hand[idx];
        if (t !== n.left && t !== n.right) { clearTargetMode(); updateUI(); return; }
        if (p.class.name === 'THE PYROMANIAC' && (c.s === '♥' || c.s === '♦')) {
            p.hand.splice(idx, 1);
            gameState.lastDiscardByPlayerId = p.id;
            gameState.discard.push(c);
            if (t && t.candle.length) { gameState.lastDiscardByPlayerId = t.id; gameState.discard.push(t.candle.shift()); }
            if (t && t.candle.length) { gameState.lastDiscardByPlayerId = t.id; gameState.discard.push(t.candle.shift()); }
            log(p.name + ' Pyro Burned 2 on ' + t.name + '!');
            clearTargetMode();
            finishAction();
        } else if (p.class.name === 'THE USERER') {
            if (!t || t.hand.length === 0) { clearTargetMode(); updateUI(); return; }
            p.hand.splice(idx, 1);
            var give = c;
            gameState.pendingUsererSwap = { p: p, t: t, giveCard: give };
            openUsererSwapModal(t);
        }
    }

    function openUsererSwapModal(target) {
        var msg = document.getElementById('userer-swap-msg');
        var container = document.getElementById('userer-swap-cards');
        var modal = document.getElementById('userer-swap-modal');
        if (!container || !modal) return;
        if (msg) msg.textContent = 'Choose a card from ' + target.name + "'s hand to swap with your card.";
        container.innerHTML = '';
        for (var i = 0; i < target.hand.length; i++) {
            (function (cardIdx) {
                var el = mkCard(target.hand[cardIdx]);
                el.style.cursor = 'pointer';
                el.onclick = function () { resolveUsererSwap(cardIdx); };
                container.appendChild(el);
            })(i);
        }
        modal.style.display = 'flex';
    }

    function resolveUsererSwap(cardIdx) {
        var pu = gameState.pendingUsererSwap;
        var modal = document.getElementById('userer-swap-modal');
        if (modal) modal.style.display = 'none';
        if (!pu || cardIdx < 0 || cardIdx >= pu.t.hand.length) return;
        var take = pu.t.hand.splice(cardIdx, 1)[0];
        pu.t.hand.splice(cardIdx, 0, pu.giveCard);
        pu.p.hand.push(take);
        log(pu.p.name + ' (THE USERER) swapped a card with ' + pu.t.name + '.');
        gameState.pendingUsererSwap = null;
        clearTargetMode();
        finishAction();
        updateUI();
    }

    function actionPanic() {
        var p = gameState.players[gameState.activeIdx];
        if (!p.candle.length) return;
        var ghostIndices = [];
        for (var pi = 0; pi < p.shadow.length; pi++) { if (!p.shadow[pi].isWall) ghostIndices.push(pi); }
        if (ghostIndices.length === 0) {
            showAlertModal('No ghosts to Panic against (only Walls).', 'Panic');
            return;
        }
        if (ghostIndices.length > 1) {
            gameState.selectionMode = 'SELECT_GHOST';
            gameState.selectionTarget = p.id;
            gameState.panicGhostIndices = ghostIndices;
            updateUI();
            return;
        }
        resolvePanic(p, ghostIndices[0]);
    }

    function resolvePanic(p, ghostIdx) {
        var c = p.candle.shift();
        var g = p.shadow[ghostIdx];
        log(p.name + ' Panic: Flipped ' + c.r + c.s);
        gameState.lastDiscardByPlayerId = p.id;
        if (c.r === 'JOKER') {
            if (g.s !== '♠') p.candle.push(g);
            else gameState.discard.push(g);
            gameState.discard.push(c);
            p.shadow.splice(ghostIdx, 1);
            log('Joker Miracle! Siphoned. Candle: ' + p.candle.length);
        } else if (c.isFace) {
            p.shadow.push(c);
            log(p.name + ' Hubris! Face card failed.');
            if (checkPossessionInstantIfDark(p)) { finishAction(); return; }
        } else if (c.val >= g.val) {
            gameState.lastDiscardByPlayerId = p.id;
            gameState.discard.push(c);
            gameState.discard.push(p.shadow.splice(ghostIdx, 1)[0]);
            log('Panic Success!');
        } else {
            p.shadow.push(c);
            log(p.name + ' Panic Failed!');
            if (checkPossessionInstantIfDark(p)) { finishAction(); return; }
        }
        finishAction();
    }

    function finishAction() {
        var finisher = gameState.players[gameState.activeIdx];
        gameState.lastDiscardByPlayerId = finisher ? finisher.id : null;
        if (finisher && finisher.class && finisher.class.name === 'THE GRIMOIRE OF REJECTION') gameState.grimoireRejectionLastTurn = gameState.grimoireRejectionRank;
        gameState.selectedIdxs = [];
        gameState.turnPhase = 'END';
        updateUI();
        if (gameState.isGameOver) return;
        var p = gameState.players[gameState.activeIdx];
        if (gameState.darkMode && p && !p.isDead && p.candle.length === 0) {
            handleDeath(p);
            if (gameState.isGameOver) return;
        }
        if (gameState.isOnline && gameState.isHost && typeof gameState.broadcastState === 'function') gameState.broadcastState();
        if (p && p.type === 'human') {
            if (aiTimer) clearTimeout(aiTimer);
            aiTimer = null;
            endTurn();
        } else if (p && p.type === 'ai') {
            aiTimer = setTimeout(endTurn, 1200);
        }
    }

    function endTurnContinue() {
        var p = gameState.players[gameState.activeIdx];
        if (!p) return;
        if (!gameState.darkMode && p && !p.isDead && p.candle.length === 0) {
            handleDeath(p);
            if (gameState.isGameOver) return;
        }
        if (checkPossession(p.shadow)) {
            if (handleDeath(p)) return;
        }
        var n = gameState.turnOrder.length;
        if (n < 6) {
            gameState.turnIdx = (gameState.turnIdx + 1) % n;
        } else if (n <= 8) {
            if (gameState.concurrentSlot === 0) {
                gameState.concurrentSlot = 1;
            } else {
                gameState.concurrentSlot = 0;
                gameState.turnIdx = (gameState.turnIdx + 1) % n;
            }
        } else {
            if (gameState.concurrentSlot < 2) {
                gameState.concurrentSlot++;
            } else {
                gameState.concurrentSlot = 0;
                gameState.turnIdx = (gameState.turnIdx + 1) % n;
            }
        }
        if (gameState.isOnline && gameState.isHost && typeof gameState.broadcastState === 'function') gameState.broadcastState();
        startTurn();
    }

    function endTurn() {
        if (gameState.isOnline && !gameState.isHost) {
            if (typeof window.sendPlayerAction === 'function') window.sendPlayerAction({ type: 'endTurn', playerId: gameState.myPlayerId });
            return;
        }
        var p = gameState.players[gameState.activeIdx];
        if (!p) return;
        gameState.lastDiscardByPlayerId = p.id;
        var handLimit = (p.class && p.class.name === 'THE HOARDER') ? 8 : 5;
        if (p.type === 'human' && p.hand.length > handLimit) {
            gameState.pendingDiscardDown = { handLimit: handLimit, needToDiscard: p.hand.length - handLimit };
            gameState.selectionMode = 'DISCARD_DOWN';
            gameState.selectedIdxs = [];
            updateUI();
            return;
        }
        while (p.hand.length > handLimit) gameState.discard.push(p.hand.pop());
        endTurnContinue();
    }

    function resolveDiscardDown() {
        var pd = gameState.pendingDiscardDown;
        var p = gameState.players[gameState.activeIdx];
        if (!pd || !p || p.type !== 'human' || gameState.selectionMode !== 'DISCARD_DOWN') return;
        if (gameState.selectedIdxs.length !== pd.needToDiscard) return;
        var idxs = gameState.selectedIdxs.slice().sort(function (a, b) { return b - a; });
        for (var i = 0; i < idxs.length; i++) {
            var card = p.hand.splice(idxs[i], 1)[0];
            gameState.lastDiscardByPlayerId = p.id;
            gameState.discard.push(card);
        }
        gameState.pendingDiscardDown = null;
        gameState.selectionMode = null;
        gameState.selectedIdxs = [];
        endTurnContinue();
        updateUI();
    }

    function checkPossession(s) {
        var ghosts = s.filter(function (g) { return !g.isWall; });
        var cnt = { '♠': 0, '♥': 0, '♣': 0, '♦': 0 };
        for (var i = 0; i < ghosts.length; i++) {
            if (ghosts[i].s !== '★') cnt[ghosts[i].s]++;
        }
        return cnt['♠'] >= 3 || cnt['♥'] >= 3 || cnt['♣'] >= 3 || cnt['♦'] >= 3;
    }

    /** In Dark Ritual, 3+ ghosts same suit = Possessed immediately (not just at end of turn). */
    function checkPossessionInstantIfDark(player) {
        if (!gameState.darkMode || !player || player.isDead) return false;
        if (!checkPossession(player.shadow)) return false;
        log(player.name + ' POSSESSED! (Dark ritual: 3 same suit—instant.)');
        handleDeath(player);
        return true;
    }

    function gameOver(msg) {
        gameState.isGameOver = true;
        if (aiTimer) clearTimeout(aiTimer);
        showAlertModal(msg, 'Game Over', resetGameSetup);
    }

    function startAITurn(ai) {
        if (gameState.isGameOver) return;
        if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; }
        updateUI();
        gameState.lastDiscardByPlayerId = ai.id;
        aiTimer = setTimeout(function () {
            if (gameState.isGameOver) return;
            gameState.lastDiscardByPlayerId = ai.id;
            if (ai.class && ai.class.name === 'THE ORACLE' && ai.candle.length > 0) {
                if (Math.random() < 0.5) {
                    var t = ai.candle.shift();
                    ai.candle.push(t);
                    log(ai.name + ' (THE ORACLE) put top card on bottom.');
                }
            }
            var aiGhostCount = ai.shadow.filter(function (g) { return !g.isWall; }).length;
            var burn = aiGhostCount;
            if (ai.class && ai.class.name === 'THE VESSEL' && burn > 0) burn = Math.max(0, burn - 1);
            for (var i = 0; i < burn; i++) {
                if (ai.candle.length) { gameState.lastDiscardByPlayerId = ai.id; gameState.discard.push(ai.candle.shift()); }
                else {
                    if (handleDeath(ai)) return;
                    endTurn();
                    return;
                }
            }
            if (burn > 0) log('AI Burned ' + burn + ' card' + (burn === 1 ? '' : 's') + '. Candle: ' + ai.candle.length);
            if (ai.candle.length) ai.hand.push(ai.candle.shift());
            updateUI();
            aiTimer = setTimeout(function () {
                if (gameState.isGameOver) return;
                var targets = getNeighbours(ai);
                var t = Math.random() > 0.5 ? targets.left : targets.right;
                var numCard = null;
                for (var h = 0; h < ai.hand.length; h++) {
                    if (!ai.hand[h].isFace && ai.hand[h].r !== 'JOKER') {
                        numCard = ai.hand[h];
                        break;
                    }
                }
                if (numCard && t) {
                    checkSaltInterrupt(ai, t, numCard, function () {
                        var cardCopy = { r: numCard.r, s: numCard.s, val: numCard.val, isFace: numCard.isFace };
                        if (ai.class && ai.class.name === 'THE WARLOCK' && (numCard.isFace || numCard.r === 'JOKER')) cardCopy.val = 10;
                        cardCopy.hauntedBy = ai.id;
                        var architectHasWall = t.shadow.some(function (g) { return g.isWall; });
                        if (t.class && t.class.name === 'THE CRYPTKEEPER' && architectHasWall) {
                            var wallIdx = -1;
                            for (var w = 0; w < t.shadow.length; w++) { if (t.shadow[w].isWall) { wallIdx = w; break; } }
                            var wall = t.shadow.splice(wallIdx, 1)[0];
                            gameState.lastDiscardByPlayerId = t.id;
                            gameState.discard.push(cardCopy);
                            gameState.discard.push(wall);
                            ai.hand.splice(ai.hand.indexOf(numCard), 1);
                            log(t.name + ' (THE CRYPTKEEPER) Wall blocked AI Haunt! Ghost and Wall → The Dark.');
                            finishAction();
                            return;
                        }
                        t.shadow.push(cardCopy);
                        ai.hand.splice(ai.hand.indexOf(numCard), 1);
                        if (ai.class && ai.class.name === 'THE MEDDLER' && t.candle.length > 0) {
                            var top = t.candle.shift();
                            t.candle.push(top);
                            log(ai.name + ' (THE MEDDLER) put ' + t.name + "'s top Candle on bottom.");
                        }
                        log('AI Haunted ' + t.name);
                        if (checkPossessionInstantIfDark(t)) return;
                        finishAction();
                    });
                } else {
                    log('AI Passed');
                    finishAction();
                }
            }, 1000);
        }, 500);
    }

    function goBackToSetup() {
        var classModal = document.getElementById('class-modal');
        var setupModal = document.getElementById('setup-modal');
        if (classModal) classModal.style.display = 'none';
        if (setupModal) setupModal.style.display = 'flex';
        gameState.players.forEach(function (p) { p.class = null; });
    }

    function setViewAllPlayers(showAll) {
        gameState.showAllPlayers = !!showAll;
        gameState.viewPreferenceSet = true;
        updateUI();
    }

    function setRitualTheme(theme) {
        document.body.classList.remove('ritual-theme-fire', 'ritual-theme-blood');
        document.body.classList.add(theme === 'blood' ? 'ritual-theme-blood' : 'ritual-theme-fire');
        try { localStorage.setItem('finalFlickerRitualTheme', theme === 'blood' ? 'blood' : 'fire'); } catch (e) {}
    }

    window.resetGameSetup = resetGameSetup;
    window.setViewAllPlayers = setViewAllPlayers;
    window.setRitualTheme = setRitualTheme;
    window.addPlayerSlot = addPlayerSlot;
    window.removePlayerSlot = removePlayerSlot;
    window.clearAllSetupNames = clearAllSetupNames;
    window.togglePlayerType = togglePlayerType;
    window.startClassSelection = startClassSelection;
    window.endIntermission = endIntermission;
    window.resolveSalt = resolveSalt;
    window.resolveSaltCounter = resolveSaltCounter;
    window.resolvePhantomCancel = resolvePhantomCancel;
    window.resolvePhantomCancelWithCard = resolvePhantomCancelWithCard;
    window.resolveMimeRedirect = resolveMimeRedirect;
    window.resolveMimeRedirectWithCard = resolveMimeRedirectWithCard;
    window.resolveCryptkeeperBlock = resolveCryptkeeperBlock;
    window.resolveUsererSwap = resolveUsererSwap;
    window.resolveOracle = resolveOracle;
    window.resolveSeerChoice = resolveSeerChoice;
    window.actionHaunt = actionHaunt;
    window.actionBanish = actionBanish;
    window.actionFlicker = actionFlicker;
    window.actionCast = actionCast;
    window.actionSeance = actionSeance;
    window.actionClass = actionClass;
    window.actionPanic = actionPanic;
    window.endTurn = endTurn;
    window.cancelTargetMode = cancelTargetMode;
    window.resolveDiscardDown = resolveDiscardDown;
    window.openCheatsheet = openCheatsheet;
    window.closeCheatsheet = closeCheatsheet;
    window.showAlertModal = showAlertModal;
    window.closeAlertModal = closeAlertModal;
    window.showClassDesc = showClassDesc;
    window.closeClassDesc = closeClassDesc;
    window.ghostSelected = ghostSelected;
    window.queenExhume = queenExhume;
    window.queenRekindle = queenRekindle;
    window.closeHandView = closeHandView;
    window.resolvePriestDraw = resolvePriestDraw;
    window.closeGrimoireRejectionModal = closeGrimoireRejectionModal;
    window.setGrimoireRejection = setGrimoireRejection;
    window.goBackToSetup = goBackToSetup;
    window.chooseDarkMode = chooseDarkMode;
    window.showManual = showManual;
    window.gameState = gameState;
    window.getSerializedState = getSerializedState;
    window.applyState = applyState;
    window.pickClasses = pickClasses;
    window.doDeckAndDealAndPickClasses = doDeckAndDealAndPickClasses;
    function closeActionsModal() {
        var m = document.getElementById('actions-modal');
        if (m) m.style.display = 'none';
    }
    function openActionsModal() {
        var m = document.getElementById('actions-modal');
        if (m) m.style.display = 'flex';
    }
    function actionFromModal(fn) {
        if (typeof fn === 'function') fn();
        closeActionsModal();
    }
    window.closeActionsModal = closeActionsModal;
    window.openActionsModal = openActionsModal;
    window.actionFromModal = actionFromModal;

    function toggleLog() {
        var panel = document.getElementById('log-panel');
        if (panel) panel.classList.toggle('collapsed');
    }
    window.toggleLog = toggleLog;

    window.addEventListener('resize', function () {
        drawTableSurface();
        var zones = ['player-shadow-left', 'player-shadow-right'];
        for (var z = 0; z < zones.length; z++) {
            var sDiv = document.getElementById(zones[z]);
            if (sDiv) updateShadowColumns(sDiv);
        }
    });
    document.addEventListener('click', function (e) {
        hideCardEffectTooltip();
        if ((e.target.closest('button') || e.target.closest('a')) && typeof window.playSFX === 'function') {
            window.playSFX('click');
        }
    });
    document.addEventListener('DOMContentLoaded', function () {
        drawTableSurface();
        var muteBtn = document.getElementById('btn-mute');
        if (muteBtn && typeof window.toggleMute === 'function') {
            muteBtn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                if (typeof window.playSFX === 'function') window.playSFX('click');
                window.toggleMute();
            });
        }
        if (typeof window.updateMuteButton === 'function') window.updateMuteButton();

        if (loadGameState()) {
            var setupModal = document.getElementById('setup-modal');
            if (setupModal) setupModal.style.display = 'none';
            if (typeof window.startBackgroundMusic === 'function') window.startBackgroundMusic();
            updateUI();
            if (gameState.isGameOver) return;
            var p = gameState.players[gameState.activeIdx];
            if (p && p.type === 'human') {
                if (gameState.turnPhase === 'ACTION') updateUI();
            } else if (p && p.type === 'ai') {
                startAITurn(p);
            }
            return;
        }
        var list = document.getElementById('player-setup-list');
        if (list && list.children.length === 0) {
            addPlayerSlot();
            addPlayerSlot();
        }
    });

    (function initRitualTheme() {
        try {
            var t = localStorage.getItem('finalFlickerRitualTheme');
            document.body.classList.add(t === 'blood' ? 'ritual-theme-blood' : 'ritual-theme-fire');
        } catch (e) {
            document.body.classList.add('ritual-theme-fire');
        }
    })();

    (function initDarkPreviewTooltip() {
        var el = document.getElementById('dark-preview-card');
        if (!el) return;
        el.addEventListener('mouseenter', function (ev) {
            if (gameState.turnPhase === 'SETUP' || gameState.discard.length === 0) return;
            var top = gameState.discard[gameState.discard.length - 1];
            if (top && !top.isWall) showCardEffectTooltip(top, ev);
        });
        el.addEventListener('mouseleave', function () {
            hideCardEffectTooltip();
        });
    })();
})();
