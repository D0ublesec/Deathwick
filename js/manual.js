/* Manual view only — class selector, diagram buttons */
(function () {
    var CLASSES = window.CLASSES;
    var getClassImageFilename = window.getClassImageFilename;
    if (!CLASSES) return;

    var EXTENDED_CLASS_NAMES = ['THE FUNERAL BELL', 'THE LICH', 'THE GRAVEDIGGER'];
    var POOL_20 = CLASSES.filter(function (c) { return EXTENDED_CLASS_NAMES.indexOf(c.name) < 0; });

    var CLASS_IMAGES_BASE = 'images/cards/classes/';
    var CARD_IMAGE_EXT = '.png';

    var STORAGE_KEY = 'finalflicker_manual_picked';
    var manualPoolSize = 20;

    var manualClassPool = POOL_20.slice();
    var currentManualPair = [];
    var pickedClasses = [];

    function updatePoolStatus() {
        var el = document.getElementById('pool-status');
        if (el) el.textContent = 'Drawing from ' + manualClassPool.length + ' classes (' + (manualPoolSize === 20 ? '2–6 player' : '7+ player') + ' pool).';
    }

    function updatePoolButtons() {
        var btn20 = document.getElementById('manual-pool-20');
        var btn38 = document.getElementById('manual-pool-38');
        if (btn20) btn20.classList.toggle('selected', manualPoolSize === 20);
        if (btn38) btn38.classList.toggle('selected', manualPoolSize === 38);
    }

    window.setManualClassPool = function (size) {
        manualPoolSize = size === 38 ? 38 : 20;
        manualClassPool = (manualPoolSize === 38 ? CLASSES : POOL_20).slice();
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

    function renderPickedClasses() {
        var res = document.getElementById('result-area');
        if (pickedClasses.length === 0) {
            res.style.display = 'none';
            res.innerHTML = '';
            return;
        }
        res.style.display = 'block';
        var html = '<p class="picked-classes-heading">Selected classes (reference until Reset):</p>';
        pickedClasses.forEach(function (cls, idx) {
            var label = (cls.playerLabel || ('Player ' + (idx + 1)));
            var safeLabel = label.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
            html += '<div class="picked-class-entry">' +
                '<label class="picked-class-player-label">Player:</label>' +
                '<input type="text" class="picked-class-player-input" value="' + safeLabel + '" data-idx="' + idx + '" placeholder="Player ' + (idx + 1) + '">' +
                '<strong class="picked-class-name">' + cls.name + '</strong>' +
                '<p class="picked-class-desc">' + cls.desc + '</p></div>';
        });
        res.innerHTML = html;
        res.querySelectorAll('.picked-class-player-input').forEach(function (input) {
            input.addEventListener('change', function () {
                setPlayerLabel(parseInt(input.getAttribute('data-idx'), 10), input.value);
                renderPickedClasses();
            });
            input.addEventListener('blur', function () {
                setPlayerLabel(parseInt(input.getAttribute('data-idx'), 10), input.value);
                renderPickedClasses();
            });
        });
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
        document.getElementById('name-0').textContent = currentManualPair[0].name;
        document.getElementById('desc-0').textContent = currentManualPair[0].desc;
        document.getElementById('name-1').textContent = currentManualPair[1].name;
        document.getElementById('desc-1').textContent = currentManualPair[1].desc;
        document.getElementById('name-2').textContent = currentManualPair[2].name;
        document.getElementById('desc-2').textContent = currentManualPair[2].desc;
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
        document.getElementById('selection-area').style.display = 'none';
        saveToStorage();
        renderPickedClasses();
        updatePoolStatus();
    };

    window.resetPoolManual = function () {
        manualClassPool = (manualPoolSize === 38 ? CLASSES : POOL_20).slice();
        pickedClasses = [];
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
            grid.innerHTML += '<div class="class-card" data-class-name="' + nameEsc + '" data-class-desc="' + descEsc + '">' +
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
    updatePoolStatus();
    loadFromStorage();
    updatePoolStatus();
    updatePoolButtons();

    (function initCardPreview() {
        var preview = document.getElementById('grimoire-card-preview');
        var previewImg = preview && preview.querySelector('.grimoire-card-preview-img');
        var backdrop = preview && preview.querySelector('.grimoire-card-preview-backdrop');
        var manualView = document.getElementById('manual-view');
        if (!preview || !previewImg || !backdrop || !manualView) return;

        var cardSelector = '.grimoire-card-img, .manual-class-card-img, .reference-card-img';

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
        manualView.addEventListener('click', function (e) {
            var img = e.target.closest ? e.target.closest(cardSelector) : null;
            if (img) {
                e.preventDefault();
                show(img.src, img.alt);
            }
        });

        backdrop.addEventListener('click', hide);

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && preview.classList.contains('visible')) hide();
        });
    })();
})();
