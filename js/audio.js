/**
 * Deathwick — Audio: music/SFX settings and sound effects.
 * Uses bundled files from audio/*.mp3 when present (e.g. in Electron); otherwise synth fallback.
 */
(function () {
    var STORAGE_KEY = 'finalFlickerAudio';
    var musicVolume = 50;
    var sfxVolume = 80;
    var muted = false;
    var audioCtx = null;
    var AUDIO_BASE = 'audio';

    function getCtx() {
        if (!audioCtx) {
            try {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {}
        }
        return audioCtx;
    }

    function loadSettings() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                var o = JSON.parse(raw);
                if (typeof o.musicVolume === 'number') musicVolume = Math.max(0, Math.min(100, o.musicVolume));
                if (typeof o.sfxVolume === 'number') sfxVolume = Math.max(0, Math.min(100, o.sfxVolume));
                if (typeof o.muted === 'boolean') muted = o.muted;
            }
        } catch (e) {}
    }

    function saveSettings() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ musicVolume: musicVolume, sfxVolume: sfxVolume, muted: muted }));
        } catch (e) {}
    }

    function playTone(freq, duration, type) {
        var ctx = getCtx();
        if (!ctx) return;
        var gain = (sfxVolume / 100) * 0.15;
        var osc = ctx.createOscillator();
        var g = ctx.createGain();
        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.8, ctx.currentTime + duration);
        g.gain.setValueAtTime(gain, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + duration);
    }

    function playFallback(type) {
        var ctx = getCtx();
        if (!ctx) return;
        if (ctx.state === 'suspended') ctx.resume();
        switch (type) {
            case 'draw': playTone(320, 0.08, 'sine'); break;
            case 'burn': playTone(200, 0.12, 'triangle'); break;
            case 'haunt': playTone(180, 0.1, 'sawtooth'); setTimeout(function () { playTone(140, 0.15, 'triangle'); }, 80); break;
            case 'banish': case 'cleanse': playTone(400, 0.08, 'sine'); playTone(520, 0.12, 'sine'); break;
            case 'salt': playTone(600, 0.06, 'sine'); playTone(800, 0.08, 'sine'); break;
            case 'turn': playTone(280, 0.06, 'sine'); break;
            case 'win': playTone(523, 0.15, 'sine'); setTimeout(function () { playTone(659, 0.15, 'sine'); }, 120); setTimeout(function () { playTone(784, 0.2, 'sine'); }, 240); break;
            case 'eliminated': playTone(150, 0.25, 'sawtooth'); break;
            case 'click': playTone(400, 0.04, 'sine'); break;
            default: playTone(300, 0.06, 'sine');
        }
    }

    var SFX_EXTS = ['.wav', '.mp3', '.ogg'];
    function nextSFXExt(ext) {
        var i = SFX_EXTS.indexOf(ext);
        return i >= 0 && i < SFX_EXTS.length - 1 ? SFX_EXTS[i + 1] : null;
    }
    function playSFXWithFile(type, baseName, ext, fallbackOnce, retryKey) {
        retryKey = retryKey || { done: {} };
        var el = new window.Audio();
        el.volume = Math.max(0, Math.min(1, sfxVolume / 100));
        var src = AUDIO_BASE + '/' + baseName + ext;
        function tryNext() {
            if (retryKey.done[ext]) return;
            retryKey.done[ext] = true;
            var next = nextSFXExt(ext);
            if (next) {
                playSFXWithFile(type, baseName, next, fallbackOnce, retryKey);
            } else {
                fallbackOnce();
            }
        }
        el.onerror = tryNext;
        el.oncanplaythrough = function () { el.play().catch(fallbackOnce); };
        el.src = src;
        el.load();
        el.play().catch(function () {
            tryNext();
        });
    }

    window.playSFX = function (type) {
        loadSettings();
        if (muted || sfxVolume <= 0) return;
        var baseName = (type === 'cleanse' ? 'cleanse' : type === 'banish' ? 'banish' : type);
        var fallbackDone = false;
        var fallbackOnce = function () {
            if (fallbackDone) return;
            fallbackDone = true;
            playFallback(type);
        };
        playSFXWithFile(type, baseName, '.wav', fallbackOnce);
    };

    var musicEl = null;
    var musicStarted = false;

    window.startBackgroundMusic = function () {
        loadSettings();
        if (muted) {
            if (musicEl) { musicEl.pause(); musicEl.currentTime = 0; }
            return;
        }
        var ctx = getCtx();
        if (ctx && ctx.state === 'suspended') ctx.resume();
        if (musicEl && !musicEl.paused) return;
        if (musicEl && musicEl.paused) {
            musicEl.volume = Math.max(0, Math.min(1, musicVolume / 100));
            musicEl.play().catch(function () {});
            return;
        }
        musicStarted = true;
        var src = AUDIO_BASE + '/music.mp3';
        var el = new window.Audio();
        el.loop = true;
        el.volume = Math.max(0, Math.min(1, musicVolume / 100));
        el.onerror = function () { musicStarted = false; musicEl = null; };
        el.oncanplaythrough = function () { el.play().catch(function () {}); };
        el.src = src;
        el.load();
        musicEl = el;
        el.play().catch(function () { musicStarted = false; });
    };

    window.stopBackgroundMusic = function () {
        if (musicEl) {
            musicEl.pause();
            musicEl.currentTime = 0;
        }
        musicStarted = false;
    };

    window.getMusicVolume = function () { loadSettings(); return musicVolume; };
    window.getSFXVolume = function () { loadSettings(); return sfxVolume; };
    window.setMusicVolume = function (v) {
        musicVolume = Math.max(0, Math.min(100, v));
        saveSettings();
        if (musicEl) musicEl.volume = Math.max(0, Math.min(1, musicVolume / 100));
    };
    window.setSFXVolume = function (v) { sfxVolume = Math.max(0, Math.min(100, v)); saveSettings(); };

    window.getMuted = function () { loadSettings(); return muted; };
    window.toggleMute = function () {
        loadSettings();
        muted = !muted;
        saveSettings();
        if (muted) {
            if (musicEl) { musicEl.pause(); musicEl.currentTime = 0; }
            musicStarted = false;
        } else {
            if (!musicEl || musicEl.paused) window.startBackgroundMusic();
        }
        updateMuteButton();
    };
    window.updateMuteButton = function () {
        var btn = document.getElementById('btn-mute');
        if (!btn) return;
        loadSettings();
        btn.textContent = muted ? '\uD83D\uDD07' : '\uD83D\uDD0A';
        btn.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
    };

    window.openSettingsModal = function () {
        loadSettings();
        if (typeof window.startBackgroundMusic === 'function') window.startBackgroundMusic();
        var modal = document.getElementById('settings-modal');
        var musicSlider = document.getElementById('music-volume');
        var sfxSlider = document.getElementById('sfx-volume');
        var musicVal = document.getElementById('music-volume-value');
        var sfxVal = document.getElementById('sfx-volume-value');
        if (musicSlider) { musicSlider.value = musicVolume; }
        if (sfxSlider) { sfxSlider.value = sfxVolume; }
        if (musicVal) musicVal.textContent = musicVolume;
        if (sfxVal) sfxVal.textContent = sfxVolume;
        if (musicSlider) musicSlider.oninput = function () { window.setMusicVolume(parseInt(musicSlider.value, 10)); if (musicVal) musicVal.textContent = musicVolume; };
        if (sfxSlider) sfxSlider.oninput = function () { sfxVolume = parseInt(sfxSlider.value, 10); if (sfxVal) sfxVal.textContent = sfxVolume; saveSettings(); };
        if (modal) modal.style.display = 'flex';
    };

    window.closeSettingsModal = function () {
        var modal = document.getElementById('settings-modal');
        if (modal) modal.style.display = 'none';
    };

    loadSettings();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { window.updateMuteButton(); });
    } else {
        window.updateMuteButton();
    }
})();
