/* Manual view only — class selector, diagram buttons */
(function () {
    var CLASSES = window.CLASSES;
    var getClassImageFilename = window.getClassImageFilename;
    if (!CLASSES) return;

    var EXTENDED_CLASS_NAMES = ['THE FUNERAL BELL', 'THE LICH', 'THE GRAVEDIGGER'];
    var TWO_PLAYER_EXCLUDED_CLASS_NAMES = ['THE MIME', 'THE WATCHER', 'THE OCCULTIST', 'THE LICH', 'THE PLAGUE', 'THE VULTURE', 'THE WITNESS'];
    var POOL_20 = CLASSES.filter(function (c) { return EXTENDED_CLASS_NAMES.indexOf(c.name) < 0; });
    var POOL_2 = POOL_20.filter(function (c) { return TWO_PLAYER_EXCLUDED_CLASS_NAMES.indexOf(c.name) < 0; });

    var CLASS_IMAGES_BASE = 'images/cards/classes/';
    var CARD_IMAGE_EXT = '.png';

    var STORAGE_KEY = 'finalflicker_manual_picked';
    var PIN_VISIBLE_KEY = 'finalflicker_manual_pin_visible';
    var manualPoolSize = 20;

    var manualClassPool = POOL_20.slice();
    var currentManualPair = [];
    var pickedClasses = [];
    var pinVisible = true;
    var selectedPinIdx = null;
    var viewerPlayerIdx = null;
    var viewerShowNav = false;
    var returnToPickedFullscreen = false;

    function updatePoolStatus() {
        var el = document.getElementById('pool-status');
        if (!el) return;
        var label = '2–6 player';
        if (manualPoolSize === 2) label = '2-player (restricted)';
        else if (manualPoolSize === 38) label = '7+ player';
        el.textContent = 'Drawing from ' + manualClassPool.length + ' classes (' + label + ' pool).';
    }

    function updatePoolButtons() {
        var btn2 = document.getElementById('manual-pool-2');
        var btn20 = document.getElementById('manual-pool-20');
        var btn38 = document.getElementById('manual-pool-38');
        if (btn2) btn2.classList.toggle('selected', manualPoolSize === 2);
        if (btn20) btn20.classList.toggle('selected', manualPoolSize === 20);
        if (btn38) btn38.classList.toggle('selected', manualPoolSize === 38);
    }

    window.setManualClassPool = function (size) {
        if (size === 38) manualPoolSize = 38;
        else if (size === 2) manualPoolSize = 2;
        else manualPoolSize = 20;
        manualClassPool = (manualPoolSize === 38 ? CLASSES : manualPoolSize === 2 ? POOL_2 : POOL_20).slice();
        updatePoolStatus();
        updatePoolButtons();
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
        var captionHeight = 44;
        var chrome = 120;
        var imgMaxH = 'calc((100vh - ' + (chrome + layout.rows * captionHeight) + 'px) / ' + layout.rows + ')';

        grid.style.setProperty('--picked-cols', layout.cols);
        grid.style.setProperty('--picked-rows', layout.rows);
        grid.style.setProperty('--picked-img-max-h', imgMaxH);
        grid.setAttribute('data-count', String(pickedClasses.length));

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
                    ' selected. Tap a class in the pin bar or class list for a full-screen view.</p>';
            }
        }
        renderPinnedBar();
    }

    function updateChoiceCard(i, cls) {
        var nameEl = document.getElementById('name-' + i);
        var descEl = document.getElementById('desc-' + i);
        var img = document.getElementById('img-' + i);
        if (nameEl) nameEl.textContent = cls.name;
        if (descEl) descEl.textContent = cls.desc;
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
        var sel = currentManualPair[i];
        manualClassPool = manualClassPool.filter(function (c) { return c.name !== sel.name; });
        pickedClasses.push({
            name: sel.name,
            desc: sel.desc,
            playerLabel: 'Player ' + (pickedClasses.length + 1)
        });
        if (selectedPinIdx === null) selectedPinIdx = pickedClasses.length - 1;
        document.getElementById('selection-area').style.display = 'none';
        saveToStorage();
        renderPickedClasses();
        updatePoolStatus();
    };

    window.resetPoolManual = function () {
        manualClassPool = (manualPoolSize === 38 ? CLASSES : manualPoolSize === 2 ? POOL_2 : POOL_20).slice();
        pickedClasses = [];
        selectedPinIdx = null;
        try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
        updatePoolStatus();
        document.getElementById('selection-area').style.display = 'none';
        renderPickedClasses();
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

    function renderClassGrid(classesToShow) {
        var grid = document.getElementById('manual-class-grid');
        if (!grid) return;
        grid.innerHTML = '';
        (classesToShow || CLASSES).forEach(function (cls) {
            var nameEsc = escapeHtml(cls.name);
            var descEsc = escapeHtml(cls.desc);
            var imgName = getClassImageFilename ? getClassImageFilename(cls.name) : null;
            var classFolder = imgName && window.getClassSubfolder ? window.getClassSubfolder(imgName) : '';
            var imgPath = imgName ? CLASS_IMAGES_BASE + (classFolder ? classFolder + '/' : '') + imgName + CARD_IMAGE_EXT : '';
            var imgHtml = imgPath
                ? '<img class="manual-class-card-img" src="' + escapeHtml(imgPath) + '" alt="' + nameEsc + '">'
                : '';
            grid.innerHTML += '<div class="class-card class-card-interactive" data-class-name="' + nameEsc + '" data-class-desc="' + descEsc + '" tabindex="0" role="button" aria-label="View ' + nameEsc + '">' +
                '<span class="class-name">' + nameEsc + '</span>' +
                '<p class="class-desc">' + descEsc + '</p>' +
                (imgHtml ? '<div class="manual-class-card-img-wrap">' + imgHtml + '</div>' : '') +
                '</div>';
        });
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
                var q = (input.value || '').trim().toLowerCase();
                if (!q) {
                    renderClassGrid(CLASSES);
                    return;
                }
                var filtered = CLASSES.filter(function (cls) {
                    return (cls.name && cls.name.toLowerCase().indexOf(q) !== -1) ||
                        (cls.desc && cls.desc.toLowerCase().indexOf(q) !== -1);
                });
                renderClassGrid(filtered);
            });
        }
        renderClassGrid(CLASSES);
    }

    populateManual();
    loadPinVisiblePreference();
    updatePoolStatus();
    loadFromStorage();
    updatePoolStatus();
    updatePoolButtons();

    (function initPinnedBar() {
        var hideBtn = document.getElementById('manual-picked-pin-hide');
        var showBtn = document.getElementById('manual-picked-pin-show');
        var fullscreenBtn = document.getElementById('manual-picked-pin-fullscreen');
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
        renderPinnedBar();
    })();

    (function initPickedFullscreen() {
        var overlay = document.getElementById('manual-picked-fullscreen');
        if (!overlay) return;
        var closeBtn = overlay.querySelector('.manual-picked-fullscreen-close');
        var exitBtn = document.getElementById('manual-picked-fullscreen-exit');
        if (closeBtn) closeBtn.addEventListener('click', closePickedFullscreen);
        if (exitBtn) exitBtn.addEventListener('click', closePickedFullscreen);
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
            if (hash === 'curses' || hash === 'calling') hash = hash === 'curses' ? 'classes' : 'class-selection';
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
        var previewImg = preview && preview.querySelector('.grimoire-card-preview-img');
        var backdrop = preview && preview.querySelector('.grimoire-card-preview-backdrop');
        var manualView = document.getElementById('manual-view');
        if (!preview || !previewImg || !backdrop || !manualView) return;

        var cardSelector = '.grimoire-card-img, .reference-card-img, .choice-card-img';

        function showCardPreviewFromTarget(target) {
            var img = target.closest ? target.closest(cardSelector) : null;
            if (!img) {
                var zoomBtn = target.closest ? target.closest('.choice-card-img-btn') : null;
                if (zoomBtn) img = zoomBtn.querySelector('.choice-card-img');
            }
            if (!img || !img.src) return false;
            if (!manualView.contains(img)) return false;
            show(img.src, img.alt);
            return true;
        }

        function show(src, alt) {
            previewImg.src = src || '';
            previewImg.alt = alt || '';
            preview.classList.add('visible');
            preview.setAttribute('aria-hidden', 'false');
        }

        function hide() {
            preview.classList.remove('visible');
            preview.setAttribute('aria-hidden', 'true');
        }

        /* Preview only on click (no hover) */
        document.addEventListener('click', function (e) {
            if (!showCardPreviewFromTarget(e.target)) return;
            e.preventDefault();
        });

        backdrop.addEventListener('click', hide);

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && preview.classList.contains('visible')) hide();
        });
    })();
})();
