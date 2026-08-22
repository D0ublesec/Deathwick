/**
 * Deathwick physical soundboard - large pads for table play on a phone.
 */
(function () {
    var wakeLock = null;
    var statusEl = null;

    function setStatus(msg) {
        if (!statusEl) statusEl = document.getElementById('soundboard-status');
        if (statusEl) statusEl.textContent = msg || '';
    }

    function flashPad(btn) {
        btn.classList.add('is-active');
        setTimeout(function () { btn.classList.remove('is-active'); }, 140);
    }

    function playPad(id, label) {
        if (typeof window.unlockAudio === 'function') window.unlockAudio();
        if (typeof window.playSFX === 'function') {
            window.playSFX(id);
            setStatus('Played: ' + label);
        } else {
            setStatus('Audio unavailable.');
        }
    }

    function buildBoard() {
        var board = document.getElementById('soundboard-board');
        var pads = window.SOUNDBOARD_PADS || [];
        if (!board || !pads.length) return;

        var groups = [];
        var byGroup = {};
        pads.forEach(function (pad) {
            if (!byGroup[pad.group]) {
                byGroup[pad.group] = [];
                groups.push(pad.group);
            }
            byGroup[pad.group].push(pad);
        });

        board.innerHTML = '';
        groups.forEach(function (groupName) {
            var section = document.createElement('section');
            section.className = 'soundboard-group';
            section.setAttribute('aria-label', groupName);

            var h2 = document.createElement('h2');
            h2.textContent = groupName;
            section.appendChild(h2);

            var grid = document.createElement('div');
            grid.className = 'soundboard-pads';

            byGroup[groupName].forEach(function (pad) {
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'soundboard-pad';
                btn.setAttribute('data-sfx', pad.id);
                btn.setAttribute('data-group', pad.group);
                btn.setAttribute('aria-label', pad.label + (pad.hint ? ': ' + pad.hint : ''));

                var label = document.createElement('span');
                label.className = 'soundboard-pad-label';
                label.textContent = pad.label;
                btn.appendChild(label);

                if (pad.hint) {
                    var hint = document.createElement('span');
                    hint.className = 'soundboard-pad-hint';
                    hint.textContent = pad.hint;
                    btn.appendChild(hint);
                }

                function trigger() {
                    flashPad(btn);
                    playPad(pad.id, pad.label);
                }

                btn.addEventListener('click', trigger);

                grid.appendChild(btn);
            });

            section.appendChild(grid);
            board.appendChild(section);
        });
    }

    function syncVolumeUI() {
        var slider = document.getElementById('soundboard-volume');
        var val = document.getElementById('soundboard-volume-value');
        var muteBtn = document.getElementById('soundboard-mute');
        var vol = typeof window.getSFXVolume === 'function' ? window.getSFXVolume() : 80;
        var muted = typeof window.getMuted === 'function' ? window.getMuted() : false;
        if (slider) {
            slider.value = String(vol);
            slider.setAttribute('aria-valuenow', String(vol));
        }
        if (val) val.textContent = String(vol);
        if (muteBtn) {
            muteBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
            muteBtn.textContent = muted ? 'Unmute' : 'Mute';
        }
    }

    async function setWakeLock(on) {
        var btn = document.getElementById('soundboard-wake');
        if (!on) {
            if (wakeLock) {
                try { await wakeLock.release(); } catch (e) {}
                wakeLock = null;
            }
            if (btn) btn.setAttribute('aria-pressed', 'false');
            return;
        }
        if (!('wakeLock' in navigator) || !navigator.wakeLock) {
            setStatus('Keep awake is not supported on this browser.');
            if (btn) btn.setAttribute('aria-pressed', 'false');
            return;
        }
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', function () {
                wakeLock = null;
                if (btn) btn.setAttribute('aria-pressed', 'false');
            });
            if (btn) btn.setAttribute('aria-pressed', 'true');
            setStatus('Screen will stay awake while this tab is visible.');
        } catch (e) {
            setStatus('Could not keep screen awake (try after tapping a sound).');
            if (btn) btn.setAttribute('aria-pressed', 'false');
        }
    }

    function init() {
        statusEl = document.getElementById('soundboard-status');
        buildBoard();
        syncVolumeUI();

        var slider = document.getElementById('soundboard-volume');
        if (slider) {
            slider.addEventListener('input', function () {
                var v = parseInt(slider.value, 10);
                if (typeof window.setSFXVolume === 'function') window.setSFXVolume(v);
                var val = document.getElementById('soundboard-volume-value');
                if (val) val.textContent = String(v);
                slider.setAttribute('aria-valuenow', String(v));
            });
        }

        var muteBtn = document.getElementById('soundboard-mute');
        if (muteBtn) {
            muteBtn.addEventListener('click', function () {
                if (typeof window.unlockAudio === 'function') window.unlockAudio();
                var next = !(typeof window.getMuted === 'function' && window.getMuted());
                if (typeof window.setMuted === 'function') window.setMuted(next);
                syncVolumeUI();
                setStatus(next ? 'Muted.' : 'Unmuted.');
            });
        }

        var wakeBtn = document.getElementById('soundboard-wake');
        if (wakeBtn) {
            wakeBtn.addEventListener('click', function () {
                var on = wakeBtn.getAttribute('aria-pressed') !== 'true';
                setWakeLock(on);
            });
        }

        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'visible' && wakeBtn && wakeBtn.getAttribute('aria-pressed') === 'true') {
                setWakeLock(true);
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
