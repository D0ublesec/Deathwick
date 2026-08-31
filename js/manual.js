/* Manual view only - class selector, diagram buttons */
(function () {
    var CLASSES = window.CLASSES;
    var getClassImageFilename = window.getClassImageFilename;
    if (!CLASSES) return;

    var TWO_PLAYER_EXCLUDED_CLASS_NAMES = window.TWO_PLAYER_EXCLUDED_CLASS_NAMES || [
        'THE MIME', 'THE WATCHER', 'THE OCCULTIST', 'THE LICH', 'THE PLAGUE', 'THE VULTURE', 'THE WITNESS',
        'THE FUNERAL BELL', 'THE GRAVEDIGGER'
    ];
    var FOUR_PLAYER_ONLY_CLASS_NAMES = window.FOUR_PLAYER_ONLY_CLASS_NAMES || ['THE OCCULTIST', 'THE WITNESS', 'THE FUNERAL BELL'];
    var getClassPoolBySize = window.getClassPoolBySize || function (poolSize) {
        if (poolSize === 2) {
            return CLASSES.filter(function (c) { return TWO_PLAYER_EXCLUDED_CLASS_NAMES.indexOf(c.name) < 0; });
        }
        if (poolSize === 3) {
            return CLASSES.filter(function (c) { return FOUR_PLAYER_ONLY_CLASS_NAMES.indexOf(c.name) < 0; });
        }
        return CLASSES.slice();
    };
    var POOL_2 = getClassPoolBySize(2);
    var twoPoolSet = {};
    POOL_2.forEach(function (c) { twoPoolSet[c.name] = true; });
    var fourPlusOnlySet = {};
    FOUR_PLAYER_ONLY_CLASS_NAMES.forEach(function (n) { fourPlusOnlySet[n] = true; });
    var threePlusOnlySet = {};
    TWO_PLAYER_EXCLUDED_CLASS_NAMES.forEach(function (n) {
        if (!fourPlusOnlySet[n]) threePlusOnlySet[n] = true;
    });
    var CLASS_POOL_GROUPS = [
        {
            id: 'four-plus-only',
            title: '4+ players only',
            subtitle: '3 classes - need at least 4 players',
            match: function (c) { return !!fourPlusOnlySet[c.name]; }
        },
        {
            id: 'three-plus-only',
            title: '3+ players only',
            subtitle: '6 classes - not in the 2-player pool',
            match: function (c) { return !!threePlusOnlySet[c.name]; }
        },
        {
            id: 'two',
            title: '2-player pool',
            subtitle: POOL_2.length + ' classes - available at every group size',
            match: function (c) { return !!twoPoolSet[c.name]; }
        }
    ];

    var CLASS_IMAGES_BASE = 'images/cards/classes/';
    var CARD_IMAGE_EXT = '.png';

    var STORAGE_KEY = 'finalflicker_manual_picked';
    var PIN_VISIBLE_KEY = 'finalflicker_manual_pin_visible';
    var manualPoolSize = 'plus';

    var manualClassPool = getClassPoolBySize('plus').slice();
    var currentManualPair = [];
    var pickedClasses = [];
    var pinVisible = true;
    var selectedPinIdx = null;
    var viewerPlayerIdx = null;
    var viewerShowNav = false;
    var returnToPickedFullscreen = false;
    var manualPickMode = 'random';
    var manualTrackSearchQuery = '';

    function updatePoolStatus() {
        var el = document.getElementById('pool-status');
        if (!el) return;
        var label = '4+ player';
        if (manualPoolSize === 2) label = '2-player (restricted)';
        else if (manualPoolSize === 3) label = '3-player';
        if (manualPickMode === 'track') {
            el.textContent = pickedClasses.length + ' tracked, ' + manualClassPool.length + ' still available (' + label + ' pool).';
            return;
        }
        el.textContent = 'Drawing from ' + manualClassPool.length + ' classes (' + label + ' pool).';
    }

    function updatePoolButtons() {
        var btn2 = document.getElementById('manual-pool-2');
        var btn3 = document.getElementById('manual-pool-3');
        var btnPlus = document.getElementById('manual-pool-plus');
        if (btn2) btn2.classList.toggle('selected', manualPoolSize === 2);
        if (btn3) btn3.classList.toggle('selected', manualPoolSize === 3);
        if (btnPlus) btnPlus.classList.toggle('selected', manualPoolSize === 'plus');
    }

    window.setManualClassPool = function (size) {
        if (size === 2) manualPoolSize = 2;
        else if (size === 3) manualPoolSize = 3;
        else manualPoolSize = 'plus';
        manualClassPool = getClassPoolBySize(manualPoolSize).slice();
        updatePoolStatus();
        updatePoolButtons();
        renderManualTrackGrid();
    };

    function saveToStorage() {
        try {
            var payload = {
                picked: pickedClasses,
                poolNames: manualClassPool.map(function (c) { return c.name; })
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        } catch (e) {}
    }

    function loadFromStorage() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            var data = JSON.parse(raw);
            if (data.picked && Array.isArray(data.picked) && data.poolNames && Array.isArray(data.poolNames)) {
                pickedClasses = data.picked;
                manualClassPool = CLASSES.filter(function (c) {
                    return data.poolNames.indexOf(c.name) !== -1;
                });
                updatePoolStatus();
                renderPickedClasses();
                renderManualTrackGrid();
            }
        } catch (e) {}
    }

    function setPlayerLabel(idx, label) {
        if (idx >= 0 && idx < pickedClasses.length) {
            pickedClasses[idx].playerLabel = (label || '').trim() || ('Player ' + (idx + 1));
            saveToStorage();
        }
    }

    function loadPinVisiblePreference() {
        try {
            var v = localStorage.getItem(PIN_VISIBLE_KEY);
            if (v === 'false') pinVisible = false;
        } catch (e) {}
    }

    function savePinVisiblePreference() {
        try {
            localStorage.setItem(PIN_VISIBLE_KEY, pinVisible ? 'true' : 'false');
        } catch (e) {}
    }

    function getClassImagePath(className) {
        var imgName = getClassImageFilename ? getClassImageFilename(className) : null;
        if (!imgName) return '';
        var classFolder = window.getClassSubfolder ? window.getClassSubfolder(imgName) : '';
        return CLASS_IMAGES_BASE + (classFolder ? classFolder + '/' : '') + imgName + CARD_IMAGE_EXT;
    }

    function updatePinBarLayout() {
        var pin = document.getElementById('manual-picked-pin');
        var showBtn = document.getElementById('manual-picked-pin-show');
        var hasPicks = pickedClasses.length > 0;

        if (!pin || !showBtn) return;

        if (!hasPicks) {
            pin.hidden = true;
            pin.setAttribute('aria-hidden', 'true');
            showBtn.hidden = true;
            document.body.classList.remove('manual-picked-pin-visible', 'manual-picked-pin-collapsed');
            return;
        }

        if (pinVisible) {
            pin.hidden = false;
            pin.setAttribute('aria-hidden', 'false');
            showBtn.hidden = true;
            document.body.classList.add('manual-picked-pin-visible');
            document.body.classList.remove('manual-picked-pin-collapsed');
        } else {
            pin.hidden = true;
            pin.setAttribute('aria-hidden', 'true');
            showBtn.hidden = false;
            showBtn.textContent = 'Show selected classes (' + pickedClasses.length + ')';
            document.body.classList.remove('manual-picked-pin-visible');
            document.body.classList.add('manual-picked-pin-collapsed');
        }
    }

    function openClassViewer(name, desc, options) {
        options = options || {};
        var viewer = document.getElementById('manual-class-viewer');
        var titleEl = document.getElementById('manual-class-viewer-title');
        var descEl = document.getElementById('manual-class-viewer-desc');
        var imgEl = viewer && viewer.querySelector('.manual-class-viewer-img');
        var playerWrap = document.getElementById('manual-class-viewer-player-wrap');
        var playerInput = document.getElementById('manual-class-viewer-player-input');
        var nav = document.getElementById('manual-class-viewer-nav');
        if (!viewer || !titleEl || !descEl || !imgEl) return;

        var imgPath = getClassImagePath(name);
        imgEl.src = imgPath || '';
        imgEl.alt = name;
        imgEl.hidden = !imgPath;
        titleEl.textContent = name;
        descEl.textContent = desc;

        viewerPlayerIdx = options.playerIdx != null ? options.playerIdx : null;
        viewerShowNav = !!options.showNav && pickedClasses.length > 1;

        if (playerWrap && playerInput) {
            if (viewerPlayerIdx !== null && pickedClasses[viewerPlayerIdx]) {
                var label = pickedClasses[viewerPlayerIdx].playerLabel || ('Player ' + (viewerPlayerIdx + 1));
                playerWrap.hidden = false;
                playerInput.value = label;
                playerInput.placeholder = 'Player ' + (viewerPlayerIdx + 1);
            } else {
                playerWrap.hidden = true;
                playerInput.value = '';
            }
        }

        if (nav) nav.hidden = !viewerShowNav;

        viewer.hidden = false;
        viewer.classList.add('visible');
        viewer.setAttribute('aria-hidden', 'false');
        document.body.classList.add('manual-class-viewer-open');
    }

    function closeClassViewer() {
        var viewer = document.getElementById('manual-class-viewer');
        if (!viewer) return;
        viewer.hidden = true;
        viewer.classList.remove('visible');
        viewer.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('manual-class-viewer-open');
        viewerPlayerIdx = null;
        viewerShowNav = false;
        if (returnToPickedFullscreen) {
            returnToPickedFullscreen = false;
            showPickedFullscreen();
        }
    }

    function openClassViewerAtIdx(idx) {
        if (idx < 0 || idx >= pickedClasses.length) return;
        selectedPinIdx = idx;
        var cls = pickedClasses[idx];
        openClassViewer(cls.name, cls.desc, { playerIdx: idx, showNav: true });
        renderPinnedBar();
    }

    function computeFullscreenLayout(count) {
        var narrow = window.innerWidth <= 640;
        if (count <= 1) return { cols: 1, rows: 1 };
        if (count === 2) return { cols: narrow ? 2 : 2, rows: 1 };
        if (count === 3) return { cols: narrow ? 2 : 3, rows: narrow ? 2 : 1 };
        if (count <= 4) return { cols: 2, rows: 2 };
        if (count <= 6) return { cols: narrow ? 2 : 3, rows: Math.ceil(count / (narrow ? 2 : 3)) };
        if (count <= 9) return { cols: narrow ? 2 : 3, rows: Math.ceil(count / (narrow ? 2 : 3)) };
        if (count <= 12) return { cols: narrow ? 2 : 4, rows: Math.ceil(count / (narrow ? 2 : 4)) };
        return { cols: narrow ? 2 : 4, rows: Math.ceil(count / (narrow ? 2 : 4)) };
    }

    function showPickedFullscreen() {
        var overlay = document.getElementById('manual-picked-fullscreen');
        if (!overlay) return;
        overlay.hidden = false;
        overlay.classList.add('visible');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.classList.add('manual-picked-fullscreen-open');
    }

    function pausePickedFullscreen() {
        var overlay = document.getElementById('manual-picked-fullscreen');
        if (!overlay) return;
        overlay.hidden = true;
        overlay.classList.remove('visible');
        overlay.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('manual-picked-fullscreen-open');
    }

    function buildPickedFullscreenGrid() {
        var grid = document.getElementById('manual-picked-fullscreen-grid');
        if (!grid || pickedClasses.length === 0) return;

        var layout = computeFullscreenLayout(pickedClasses.length);
        var narrow = window.innerWidth <= 640;
        var useScrollLayout = narrow || pickedClasses.length > 4;
        var captionHeight = 44;
        var chrome = narrow ? 200 : 120;
        var imgMaxH;

        if (useScrollLayout) {
            imgMaxH = narrow ? 'min(30dvh, 160px)' : 'min(34dvh, 200px)';
        } else {
            imgMaxH = 'calc((100dvh - ' + (chrome + layout.rows * captionHeight) + 'px) / ' + layout.rows + ')';
        }

        grid.style.setProperty('--picked-cols', layout.cols);
        grid.style.setProperty('--picked-rows', layout.rows);
        grid.style.setProperty('--picked-img-max-h', imgMaxH);
        grid.setAttribute('data-count', String(pickedClasses.length));
        grid.classList.toggle('is-scroll-layout', useScrollLayout);

        grid.innerHTML = '';
        pickedClasses.forEach(function (cls, idx) {
            var imgPath = getClassImagePath(cls.name);
            var playerLabel = cls.playerLabel || ('Player ' + (idx + 1));
            var item = document.createElement('button');
            item.type = 'button';
            item.className = 'manual-picked-fullscreen-item';
            item.setAttribute('aria-label', playerLabel + ': ' + cls.name);
            item.innerHTML =
                (imgPath
                    ? '<img class="manual-picked-fullscreen-img" src="' + escapeHtml(imgPath) + '" alt="' + escapeHtml(cls.name) + '">'
                    : '<div class="manual-picked-fullscreen-no-img">' + escapeHtml(cls.name) + '</div>') +
                '<div class="manual-picked-fullscreen-caption">' +
                '<span class="manual-picked-fullscreen-player">' + escapeHtml(playerLabel) + '</span>' +
                '<span class="manual-picked-fullscreen-class">' + escapeHtml(cls.name) + '</span>' +
                '</div>';
            item.addEventListener('click', function () {
                returnToPickedFullscreen = true;
                pausePickedFullscreen();
                openClassViewerAtIdx(idx);
            });
            grid.appendChild(item);
        });
    }

    function openPickedFullscreen() {
        if (pickedClasses.length === 0) return;
        closeClassViewer();
        returnToPickedFullscreen = false;
        buildPickedFullscreenGrid();
        showPickedFullscreen();
    }

    function closePickedFullscreen() {
        returnToPickedFullscreen = false;
        pausePickedFullscreen();
        var grid = document.getElementById('manual-picked-fullscreen-grid');
        if (grid) grid.innerHTML = '';
    }

    function renderPinnedBar() {
        var list = document.getElementById('manual-picked-pin-list');
        if (!list) return;

        if (selectedPinIdx !== null && selectedPinIdx >= pickedClasses.length) {
            selectedPinIdx = pickedClasses.length > 0 ? 0 : null;
        }

        list.innerHTML = '';
        pickedClasses.forEach(function (cls, idx) {
            var playerLabel = cls.playerLabel || ('Player ' + (idx + 1));
            var shortName = cls.name.replace(/^THE /, '');
            var chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'manual-picked-pin-chip' + (selectedPinIdx === idx ? ' is-selected' : '');
            chip.setAttribute('role', 'tab');
            chip.setAttribute('aria-selected', selectedPinIdx === idx ? 'true' : 'false');
            chip.innerHTML =
                '<span class="manual-picked-pin-chip-player">' + escapeHtml(playerLabel) + '</span>' +
                '<span class="manual-picked-pin-chip-class">' + escapeHtml(shortName) + '</span>';
            chip.addEventListener('click', function () {
                openClassViewerAtIdx(idx);
            });
            list.appendChild(chip);
        });

        updatePinBarLayout();
    }

    function renderPickedClasses() {
        var res = document.getElementById('result-area');
        if (res) {
            if (pickedClasses.length === 0) {
                res.style.display = 'none';
                res.innerHTML = '';
            } else {
                res.style.display = 'block';
                res.innerHTML = '<p class="picked-classes-heading">' + pickedClasses.length + ' class' +
                    (pickedClasses.length === 1 ? '' : 'es') +
                    ' tracked. Tap a class in the pin bar for a full-screen view.</p>';
            }
        }
        renderPinnedBar();
    }

    function updateChoiceCard(i, cls) {
        var nameEl = document.getElementById('name-' + i);
        var descEl = document.getElementById('desc-' + i);
        var img = document.getElementById('img-' + i);
        var cardEl = nameEl ? nameEl.closest('.choice-card') : null;
        if (nameEl) nameEl.textContent = cls.name;
        if (descEl) {
            var witnessPrefix = cls.name === 'THE WITNESS'
                ? 'Cannot win - if only two remain and one is The Witness, both lose. '
                : '';
            descEl.textContent = witnessPrefix + cls.desc;
        }
        if (cardEl) {
            cardEl.classList.toggle('choice-card-witness', cls.name === 'THE WITNESS');
        }
        if (!img) return;
        var imgBtn = img.closest('.choice-card-img-btn');
        var path = getClassImagePath(cls.name);
        img.src = path || '';
        img.alt = cls.name;
        if (imgBtn) {
            imgBtn.hidden = !path;
            imgBtn.setAttribute('aria-label', 'Zoom ' + cls.name + ' card');
        }
    }

    window.drawClassesManual = function () {
        if (manualClassPool.length < 3) {
            alert('Reset required (need at least 3 classes).');
            return;
        }
        var idx1 = Math.floor(Math.random() * manualClassPool.length);
        var idx2 = idx1;
        while (idx2 === idx1) idx2 = Math.floor(Math.random() * manualClassPool.length);
        var idx3 = idx1;
        while (idx3 === idx1 || idx3 === idx2) idx3 = Math.floor(Math.random() * manualClassPool.length);
        currentManualPair = [manualClassPool[idx1], manualClassPool[idx2], manualClassPool[idx3]];
        currentManualPair.forEach(function (cls, i) {
            updateChoiceCard(i, cls);
        });
        document.getElementById('selection-area').style.display = 'grid';
        renderPickedClasses();
    };

    window.pickClassManual = function (i) {
        addPickedClass(currentManualPair[i]);
    };

    function addPickedClass(cls) {
        if (!cls) return;
        manualClassPool = manualClassPool.filter(function (c) { return c.name !== cls.name; });
        pickedClasses.push({
            name: cls.name,
            desc: cls.desc,
            playerLabel: 'Player ' + (pickedClasses.length + 1)
        });
        if (selectedPinIdx === null) selectedPinIdx = pickedClasses.length - 1;
        var selectionArea = document.getElementById('selection-area');
        if (selectionArea) selectionArea.style.display = 'none';
        saveToStorage();
        renderPickedClasses();
        updatePoolStatus();
        renderManualTrackGrid();
    }

    window.addTrackedClassManual = function (className) {
        var cls = null;
        for (var i = 0; i < manualClassPool.length; i++) {
            if (manualClassPool[i].name === className) {
                cls = manualClassPool[i];
                break;
            }
        }
        if (cls) addPickedClass(cls);
    };

    function setManualPickMode(mode) {
        manualPickMode = mode === 'track' ? 'track' : 'random';
        updateManualPickModeUI();
        updatePoolStatus();
        if (manualPickMode === 'track') {
            var selectionArea = document.getElementById('selection-area');
            if (selectionArea) selectionArea.style.display = 'none';
            renderManualTrackGrid();
        }
    }

    function updateManualPickModeUI() {
        var randomPanel = document.getElementById('manual-random-panel');
        var trackPanel = document.getElementById('manual-track-panel');
        var btnRandom = document.getElementById('manual-mode-random');
        var btnTrack = document.getElementById('manual-mode-track');
        if (randomPanel) randomPanel.hidden = manualPickMode !== 'random';
        if (trackPanel) trackPanel.hidden = manualPickMode !== 'track';
        if (btnRandom) {
            btnRandom.classList.toggle('selected', manualPickMode === 'random');
            btnRandom.classList.toggle('secondary', manualPickMode !== 'random');
            btnRandom.setAttribute('aria-selected', manualPickMode === 'random' ? 'true' : 'false');
        }
        if (btnTrack) {
            btnTrack.classList.toggle('selected', manualPickMode === 'track');
            btnTrack.classList.toggle('secondary', manualPickMode !== 'track');
            btnTrack.setAttribute('aria-selected', manualPickMode === 'track' ? 'true' : 'false');
        }
    }

    function renderManualTrackGrid() {
        var grid = document.getElementById('manual-track-grid');
        var empty = document.getElementById('manual-track-empty');
        if (!grid) return;

        if (manualClassPool.length === 0) {
            grid.innerHTML = '';
            if (empty) empty.hidden = false;
            return;
        }
        if (empty) empty.hidden = true;

        var q = (manualTrackSearchQuery || '').trim().toLowerCase();
        var visible = manualClassPool.filter(function (cls) {
            if (!q) return true;
            return (cls.name && cls.name.toLowerCase().indexOf(q) !== -1) ||
                (cls.desc && cls.desc.toLowerCase().indexOf(q) !== -1);
        });

        grid.innerHTML = '';
        if (visible.length === 0) {
            grid.innerHTML = '<p class="manual-track-empty">No available classes match your search.</p>';
            return;
        }

        visible.forEach(function (cls) {
            var nameEsc = escapeHtml(cls.name);
            var descEsc = escapeHtml(cls.desc);
            var imgPath = getClassImagePath(cls.name);
            var card = document.createElement('div');
            card.className = 'manual-track-card';
            card.innerHTML =
                (imgPath
                    ? '<button type="button" class="manual-track-card-img-btn choice-card-img-btn" aria-label="Zoom ' + nameEsc + ' card">' +
                        '<img class="manual-track-card-img choice-card-img" src="' + escapeHtml(imgPath) + '" alt="' + nameEsc + '" loading="lazy">' +
                      '</button>'
                    : '') +
                '<span class="manual-track-card-name">' + nameEsc + '</span>' +
                '<p class="manual-track-card-desc">' + descEsc + '</p>' +
                '<button type="button" class="tool-btn manual-track-card-btn">Track this class</button>';
            card.querySelector('.manual-track-card-btn').addEventListener('click', function () {
                addPickedClass(cls);
            });
            grid.appendChild(card);
        });
    }

    window.resetPoolManual = function () {
        closePickedFullscreen();
        closeClassViewer();
        returnToPickedFullscreen = false;
        manualClassPool = getClassPoolBySize(manualPoolSize).slice();
        pickedClasses = [];
        selectedPinIdx = null;
        try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
        manualTrackSearchQuery = '';
        var trackSearch = document.getElementById('manual-track-search');
        if (trackSearch) trackSearch.value = '';
        updatePoolStatus();
        document.getElementById('selection-area').style.display = 'none';
        renderPickedClasses();
        renderManualTrackGrid();
    };

    function focusClassSelectionTool() {
        var target = document.getElementById('class-selection');
        if (!target) return;
        var section = target.closest('section');
        if (section) {
            section.classList.remove('is-collapsed');
            section.classList.add('is-expanded');
            var btn = section.querySelector('.manual-section-toggle-btn');
            if (btn) btn.setAttribute('aria-expanded', 'true');
        }
        requestAnimationFrame(function () {
            var tool = document.getElementById('class-tool') || target;
            tool.scrollIntoView({ block: 'start' });
        });
    }

    window.resetAndPickAgainManual = function () {
        resetPoolManual();
        focusClassSelectionTool();
        drawClassesManual();
    };

    window.showDiagram = function (c) {
        document.querySelectorAll('.diagram-display').forEach(function (e) { e.classList.remove('active'); });
        var d = document.getElementById('diag-' + c);
        if (d) d.classList.add('active');
    };

    function escapeHtml(s) {
        if (!s) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    var manualClassListPoolFilter = 'all';
    var manualClassSearchQuery = '';

    function classMatchesSearch(cls, q) {
        if (!q) return true;
        return (cls.name && cls.name.toLowerCase().indexOf(q) !== -1) ||
            (cls.desc && cls.desc.toLowerCase().indexOf(q) !== -1);
    }

    function getManualClassListPool() {
        if (manualClassListPoolFilter === 'all') return CLASSES.slice();
        if (manualClassListPoolFilter === '2') return getClassPoolBySize(2);
        if (manualClassListPoolFilter === '3') return getClassPoolBySize(3);
        return getClassPoolBySize('plus');
    }

    function getClassesForGroup(group, poolClasses) {
        var poolSet = {};
        poolClasses.forEach(function (c) { poolSet[c.name] = c; });
        var out = [];
        if (group.names) {
            group.names.forEach(function (name) {
                if (poolSet[name]) out.push(poolSet[name]);
            });
            return out;
        }
        if (group.match) {
            poolClasses.forEach(function (c) {
                if (group.match(c)) out.push(c);
            });
        }
        return out;
    }

    function buildClassCardHtml(cls) {
        var nameEsc = escapeHtml(cls.name);
        var descEsc = escapeHtml(cls.desc);
        var imgName = getClassImageFilename ? getClassImageFilename(cls.name) : null;
        var classFolder = imgName && window.getClassSubfolder ? window.getClassSubfolder(imgName) : '';
        var imgPath = imgName ? CLASS_IMAGES_BASE + (classFolder ? classFolder + '/' : '') + imgName + CARD_IMAGE_EXT : '';
        var imgHtml = imgPath
            ? '<img class="manual-class-card-img" src="' + escapeHtml(imgPath) + '" alt="' + nameEsc + '">'
            : '';
        return '<div class="class-card class-card-interactive" data-class-name="' + nameEsc + '" data-class-desc="' + descEsc + '" tabindex="0" role="button" aria-label="View ' + nameEsc + '">' +
            '<span class="class-name">' + nameEsc + '</span>' +
            '<p class="class-desc">' + descEsc + '</p>' +
            (imgHtml ? '<div class="manual-class-card-img-wrap">' + imgHtml + '</div>' : '') +
            '</div>';
    }

    function renderClassGrid() {
        var grid = document.getElementById('manual-class-grid');
        if (!grid) return;

        var q = (manualClassSearchQuery || '').trim().toLowerCase();
        var poolClasses = getManualClassListPool();
        var html = '';
        var totalShown = 0;

        CLASS_POOL_GROUPS.forEach(function (group) {
            var groupClasses = getClassesForGroup(group, poolClasses).filter(function (cls) {
                return classMatchesSearch(cls, q);
            });
            if (!groupClasses.length) return;
            totalShown += groupClasses.length;
            html += '<div class="manual-class-pool-group" data-pool-group="' + group.id + '">';
            html += '<div class="manual-class-pool-group-head">';
            html += '<h3 class="manual-class-pool-group-title">' + escapeHtml(group.title) + '</h3>';
            html += '<p class="manual-class-pool-group-subtitle">' + escapeHtml(group.subtitle) + '</p>';
            html += '</div>';
            html += '<div class="classes-grid manual-class-pool-group-grid">';
            groupClasses.forEach(function (cls) {
                html += buildClassCardHtml(cls);
            });
            html += '</div></div>';
        });

        if (!totalShown) {
            html = '<p class="manual-class-pool-empty">No classes match this pool or search.</p>';
        }
        grid.innerHTML = html;
    }

    function updateClassPoolFilterButtons() {
        var wrap = document.getElementById('manual-class-pool-filters');
        if (!wrap) return;
        wrap.querySelectorAll('[data-pool-filter]').forEach(function (btn) {
            var val = btn.getAttribute('data-pool-filter');
            var selected = val === manualClassListPoolFilter;
            btn.classList.toggle('selected', selected);
            btn.classList.toggle('secondary', !selected);
        });
    }

    function setManualClassListPoolFilter(filter) {
        manualClassListPoolFilter = filter || 'all';
        updateClassPoolFilterButtons();
        renderClassGrid();
    }

    function populateManual() {
        var section = document.getElementById('classes');
        var grid = document.getElementById('manual-class-grid');
        if (!section || !grid) return;

        var searchWrap = document.getElementById('manual-class-search-wrap');
        if (!searchWrap) {
            var input = document.createElement('input');
            input.type = 'search';
            input.placeholder = 'Search classes by name or description…';
            input.id = 'manual-class-search';
            input.className = 'manual-class-search-input';
            input.setAttribute('aria-label', 'Search classes');
            var wrap = document.createElement('div');
            wrap.id = 'manual-class-search-wrap';
            wrap.className = 'manual-class-search-wrap';
            wrap.appendChild(input);
            section.insertBefore(wrap, grid);
            input.addEventListener('input', function () {
                manualClassSearchQuery = input.value || '';
                renderClassGrid();
            });
        }

        var poolFilters = document.getElementById('manual-class-pool-filters');
        if (poolFilters) {
            poolFilters.querySelectorAll('[data-pool-filter]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    setManualClassListPoolFilter(btn.getAttribute('data-pool-filter'));
                });
            });
        }
        updateClassPoolFilterButtons();
        renderClassGrid();
    }

    populateManual();
    loadPinVisiblePreference();
    updatePoolStatus();
    loadFromStorage();
    updatePoolStatus();
    updatePoolButtons();
    updateManualPickModeUI();
    renderManualTrackGrid();

    (function initManualPickMode() {
        var btnRandom = document.getElementById('manual-mode-random');
        var btnTrack = document.getElementById('manual-mode-track');
        var search = document.getElementById('manual-track-search');
        if (btnRandom) btnRandom.addEventListener('click', function () { setManualPickMode('random'); });
        if (btnTrack) btnTrack.addEventListener('click', function () { setManualPickMode('track'); });
        if (search) {
            search.addEventListener('input', function () {
                manualTrackSearchQuery = search.value || '';
                renderManualTrackGrid();
            });
        }
    })();

    (function initPinnedBar() {
        var hideBtn = document.getElementById('manual-picked-pin-hide');
        var showBtn = document.getElementById('manual-picked-pin-show');
        var fullscreenBtn = document.getElementById('manual-picked-pin-fullscreen');
        var clearBtn = document.getElementById('manual-picked-pin-clear');
        var pickAgainBtn = document.getElementById('manual-picked-pin-pick-again');
        if (hideBtn) {
            hideBtn.addEventListener('click', function () {
                pinVisible = false;
                savePinVisiblePreference();
                updatePinBarLayout();
            });
        }
        if (showBtn) {
            showBtn.addEventListener('click', function () {
                pinVisible = true;
                savePinVisiblePreference();
                updatePinBarLayout();
            });
        }
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', openPickedFullscreen);
        }
        if (clearBtn) {
            clearBtn.addEventListener('click', resetPoolManual);
        }
        if (pickAgainBtn) {
            pickAgainBtn.addEventListener('click', resetAndPickAgainManual);
        }
        renderPinnedBar();
    })();

    (function initPickedFullscreen() {
        var overlay = document.getElementById('manual-picked-fullscreen');
        if (!overlay) return;
        var closeBtn = overlay.querySelector('.manual-picked-fullscreen-close');
        var exitBtn = document.getElementById('manual-picked-fullscreen-exit');
        var clearBtn = document.getElementById('manual-picked-fullscreen-clear');
        var pickAgainBtn = document.getElementById('manual-picked-fullscreen-pick-again');
        if (closeBtn) closeBtn.addEventListener('click', closePickedFullscreen);
        if (exitBtn) exitBtn.addEventListener('click', closePickedFullscreen);
        if (clearBtn) clearBtn.addEventListener('click', resetPoolManual);
        if (pickAgainBtn) pickAgainBtn.addEventListener('click', resetAndPickAgainManual);
    })();

    (function initClassViewer() {
        var viewer = document.getElementById('manual-class-viewer');
        if (!viewer) return;

        var backdrop = viewer.querySelector('.manual-class-viewer-backdrop');
        var closeBtn = viewer.querySelector('.manual-class-viewer-close');
        var playerInput = document.getElementById('manual-class-viewer-player-input');
        var prevBtn = document.getElementById('manual-class-viewer-prev');
        var nextBtn = document.getElementById('manual-class-viewer-next');
        var grid = document.getElementById('manual-class-grid');

        function bindPlayerInput() {
            if (!playerInput) return;
            playerInput.onchange = function () {
                if (viewerPlayerIdx !== null) {
                    setPlayerLabel(viewerPlayerIdx, playerInput.value);
                    renderPinnedBar();
                }
            };
            playerInput.onblur = function () {
                if (viewerPlayerIdx !== null) {
                    setPlayerLabel(viewerPlayerIdx, playerInput.value);
                    renderPinnedBar();
                }
            };
        }

        bindPlayerInput();

        if (backdrop) backdrop.addEventListener('click', closeClassViewer);
        if (closeBtn) closeBtn.addEventListener('click', closeClassViewer);

        if (prevBtn) {
            prevBtn.addEventListener('click', function () {
                if (viewerPlayerIdx === null) return;
                var nextIdx = viewerPlayerIdx - 1;
                if (nextIdx < 0) nextIdx = pickedClasses.length - 1;
                openClassViewerAtIdx(nextIdx);
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', function () {
                if (viewerPlayerIdx === null) return;
                var nextIdx = viewerPlayerIdx + 1;
                if (nextIdx >= pickedClasses.length) nextIdx = 0;
                openClassViewerAtIdx(nextIdx);
            });
        }

        if (grid) {
            grid.addEventListener('click', function (e) {
                if (e.target.closest && e.target.closest('.manual-class-card-img')) return;
                var card = e.target.closest ? e.target.closest('.class-card') : null;
                if (!card || !grid.contains(card)) return;
                e.preventDefault();
                var nameEl = card.querySelector('.class-name');
                var descEl = card.querySelector('.class-desc');
                if (!nameEl || !descEl) return;
                openClassViewer(nameEl.textContent, descEl.textContent);
            });
            grid.addEventListener('keydown', function (e) {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                var card = e.target.closest ? e.target.closest('.class-card') : null;
                if (!card || !grid.contains(card)) return;
                e.preventDefault();
                var nameEl = card.querySelector('.class-name');
                var descEl = card.querySelector('.class-desc');
                if (!nameEl || !descEl) return;
                openClassViewer(nameEl.textContent, descEl.textContent);
            });
        }

        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') return;
            var gallery = document.getElementById('grimoire-card-preview');
            if (gallery && gallery.classList.contains('visible')) return;
            if (viewer.classList.contains('visible')) {
                closeClassViewer();
                return;
            }
            var pickedFs = document.getElementById('manual-picked-fullscreen');
            if (pickedFs && pickedFs.classList.contains('visible')) {
                closePickedFullscreen();
            }
        });
    })();

    (function initManualCollapsible() {
        var manualView = document.getElementById('manual-view');
        if (!manualView) return;

        var sections = manualView.querySelectorAll('section[id]');

        function toggleSection(section, expand) {
            section.classList.toggle('is-expanded', expand);
            section.classList.toggle('is-collapsed', !expand);
            var btn = section.querySelector('.manual-section-toggle-btn');
            if (btn) btn.setAttribute('aria-expanded', expand ? 'true' : 'false');
        }

        sections.forEach(function (section) {
            var h2 = section.querySelector(':scope > h2');
            if (!h2) return;

            var body = document.createElement('div');
            body.className = 'manual-section-body';
            body.id = section.id + '-body';

            var node = h2.nextElementSibling;
            while (node) {
                var next = node.nextElementSibling;
                body.appendChild(node);
                node = next;
            }

            section.classList.add('manual-section', 'is-collapsed');
            h2.classList.add('manual-section-toggle');

            var titleText = h2.textContent;
            h2.textContent = '';
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'manual-section-toggle-btn';
            btn.setAttribute('aria-expanded', 'false');
            btn.setAttribute('aria-controls', body.id);
            btn.innerHTML = '<span class="manual-section-chevron" aria-hidden="true">&#9654;</span><span class="manual-section-title">' + titleText + '</span>';
            h2.appendChild(btn);
            section.appendChild(body);

            btn.addEventListener('click', function () {
                toggleSection(section, section.classList.contains('is-collapsed'));
            });
        });

        function expandAll() {
            sections.forEach(function (section) { toggleSection(section, true); });
        }

        function collapseAll() {
            sections.forEach(function (section) { toggleSection(section, false); });
        }

        var expandBtn = document.getElementById('manual-expand-all');
        var collapseBtn = document.getElementById('manual-collapse-all');
        if (expandBtn) expandBtn.addEventListener('click', expandAll);
        if (collapseBtn) collapseBtn.addEventListener('click', collapseAll);

        function expandForHash() {
            var hash = location.hash.slice(1);
            if (hash === 'curses') hash = 'classes';
            if (hash === 'calling') hash = 'choose-your-class';
            if (!hash) return;
            var target = document.getElementById(hash);
            if (!target) return;
            var section = target.closest('section');
            if (section) toggleSection(section, true);
            requestAnimationFrame(function () {
                target.scrollIntoView({ block: 'start' });
            });
        }

        expandForHash();
        window.addEventListener('hashchange', expandForHash);
    })();

    (function initCardPreview() {
        var preview = document.getElementById('grimoire-card-preview');
        var previewImg = preview && preview.querySelector('.card-gallery-img');
        var backdrop = preview && preview.querySelector('.card-gallery-backdrop');
        var closeBtn = preview && preview.querySelector('.card-gallery-close');
        var prevBtn = preview && preview.querySelector('.card-gallery-prev');
        var nextBtn = preview && preview.querySelector('.card-gallery-next');
        var captionEl = preview && preview.querySelector('.card-gallery-caption');
        var counterEl = preview && preview.querySelector('.card-gallery-counter');
        var stage = preview && preview.querySelector('.card-gallery-stage');
        var manualView = document.getElementById('manual-view');
        if (!preview || !previewImg || !backdrop || !manualView || !stage) return;

        var sourceSelector = '.grimoire-card-img, .reference-card-img, .choice-card-img, .manual-class-card-img, .manual-class-viewer-img';
        var slides = [];
        var index = 0;
        var drag = null;

        function slideKey(src) {
            if (!src) return '';
            try {
                return new URL(src, location.href).pathname.replace(/\\/g, '/').toLowerCase();
            } catch (err) {
                return String(src).split('?')[0].replace(/\\/g, '/').toLowerCase();
            }
        }

        function fileName(src) {
            var key = slideKey(src);
            var parts = key.split('/');
            return parts[parts.length - 1] || key;
        }

        function collectGallerySlides() {
            var list = [];
            var seen = {};
            function addSlide(src, alt, group) {
                var key = slideKey(src);
                if (!key || seen[key]) return;
                seen[key] = true;
                list.push({ src: src, alt: alt || '', group: group });
            }
            manualView.querySelectorAll('.reference-card-img').forEach(function (img) {
                var src = img.getAttribute('src');
                if (src) addSlide(src, img.alt, 'Reference');
            });
            var grim = document.getElementById('grimoire');
            if (grim) {
                grim.querySelectorAll('.grimoire-card-img:not(.full-deck-card)').forEach(function (img) {
                    var src = img.getAttribute('src');
                    if (src) addSlide(src, img.alt, 'Grimoire');
                });
            }
            CLASS_POOL_GROUPS.forEach(function (group) {
                getClassesForGroup(group, CLASSES).forEach(function (cls) {
                    var path = getClassImagePath(cls.name);
                    if (path) addSlide(path, cls.name, 'Class');
                });
            });
            return list;
        }

        function findSlideIndex(src) {
            var key = slideKey(src);
            var name = fileName(src);
            var i;
            for (i = 0; i < slides.length; i++) {
                if (slideKey(slides[i].src) === key || fileName(slides[i].src) === name) return i;
            }
            var mapped = name.replace(/_(hearts|clubs|diamonds)\.png$/, '_spades.png');
            if (mapped !== name) {
                for (i = 0; i < slides.length; i++) {
                    if (fileName(slides[i].src) === mapped) return i;
                }
            }
            return 0;
        }

        function preloadAround(i) {
            [i - 1, i + 1].forEach(function (n) {
                if (n < 0) n = slides.length - 1;
                if (n >= slides.length) n = 0;
                if (!slides[n]) return;
                var img = new Image();
                img.src = slides[n].src;
            });
        }

        function renderSlide() {
            var slide = slides[index];
            if (!slide) return;
            previewImg.src = slide.src;
            previewImg.alt = slide.alt;
            previewImg.style.transform = '';
            previewImg.classList.remove('is-dragging');
            if (captionEl) captionEl.textContent = slide.alt;
            if (counterEl) {
                counterEl.textContent = slide.group + ' · ' + (index + 1) + ' / ' + slides.length;
            }
            preloadAround(index);
        }

        function goTo(nextIndex) {
            if (!slides.length) return;
            index = (nextIndex + slides.length) % slides.length;
            renderSlide();
        }

        function showAt(src) {
            slides = collectGallerySlides();
            if (!slides.length) return;
            index = findSlideIndex(src);
            renderSlide();
            preview.classList.add('visible');
            preview.setAttribute('aria-hidden', 'false');
            document.body.classList.add('card-gallery-open');
            if (closeBtn) closeBtn.focus();
        }

        function hide() {
            preview.classList.remove('visible');
            preview.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('card-gallery-open');
            previewImg.style.transform = '';
            previewImg.classList.remove('is-dragging');
            drag = null;
        }

        function showCardPreviewFromTarget(target) {
            var img = target.closest ? target.closest(sourceSelector) : null;
            if (!img) {
                var zoomBtn = target.closest ? target.closest('.choice-card-img-btn') : null;
                if (zoomBtn) img = zoomBtn.querySelector('.choice-card-img');
            }
            if (!img || !(img.getAttribute('src') || img.src)) return false;
            if (img.classList.contains('manual-class-viewer-img')) {
                showAt(img.getAttribute('src') || img.src);
                return true;
            }
            if (!manualView.contains(img)) return false;
            showAt(img.getAttribute('src') || img.src);
            return true;
        }

        document.addEventListener('click', function (e) {
            if (!showCardPreviewFromTarget(e.target)) return;
            e.preventDefault();
            e.stopPropagation();
        }, true);

        backdrop.addEventListener('click', hide);
        if (closeBtn) closeBtn.addEventListener('click', hide);
        if (prevBtn) prevBtn.addEventListener('click', function (e) { e.stopPropagation(); goTo(index - 1); });
        if (nextBtn) nextBtn.addEventListener('click', function (e) { e.stopPropagation(); goTo(index + 1); });

        document.addEventListener('keydown', function (e) {
            if (!preview.classList.contains('visible')) return;
            if (e.key === 'Escape') {
                e.preventDefault();
                hide();
                return;
            }
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                goTo(index - 1);
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                goTo(index + 1);
            }
        }, true);

        function onPointerDown(e) {
            if (!preview.classList.contains('visible')) return;
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            if (e.target.closest && e.target.closest('.card-gallery-close, .card-gallery-nav')) return;
            drag = {
                id: e.pointerId,
                x: e.clientX,
                y: e.clientY,
                dx: 0,
                dy: 0,
                moved: false
            };
            previewImg.classList.add('is-dragging');
            try { stage.setPointerCapture(e.pointerId); } catch (err) {}
        }

        function onPointerMove(e) {
            if (!drag || e.pointerId !== drag.id) return;
            drag.dx = e.clientX - drag.x;
            drag.dy = e.clientY - drag.y;
            if (Math.abs(drag.dx) > 8 || Math.abs(drag.dy) > 8) drag.moved = true;
            if (Math.abs(drag.dx) >= Math.abs(drag.dy)) {
                previewImg.style.transform = 'translateX(' + drag.dx + 'px)';
            } else if (drag.dy > 0) {
                previewImg.style.transform = 'translateY(' + drag.dy + 'px)';
            }
        }

        function onPointerUp(e) {
            if (!drag || e.pointerId !== drag.id) return;
            var dx = drag.dx;
            var dy = drag.dy;
            var wasDrag = drag.moved;
            drag = null;
            previewImg.classList.remove('is-dragging');
            previewImg.style.transform = '';
            try { stage.releasePointerCapture(e.pointerId); } catch (err) {}
            if (!wasDrag) return;
            if (dy > 90 && Math.abs(dy) > Math.abs(dx)) {
                hide();
                return;
            }
            if (dx <= -50) goTo(index + 1);
            else if (dx >= 50) goTo(index - 1);
        }

        stage.addEventListener('pointerdown', onPointerDown);
        stage.addEventListener('pointermove', onPointerMove);
        stage.addEventListener('pointerup', onPointerUp);
        stage.addEventListener('pointercancel', onPointerUp);
    })();
})();
