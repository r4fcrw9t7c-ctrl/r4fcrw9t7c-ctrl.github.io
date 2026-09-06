/* Realm HQ — Portal / site script */
(function () {
  'use strict';

  var portal = document.getElementById('portalStage');
  var enterBtn = document.getElementById('enterBtn');
  var site = document.getElementById('site');
  var stamp = document.getElementById('accessStamp');
  var body = document.body;

  var reduced = false;
  try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var entered = false;

  // JS is present: hide the site behind the portal until ENTER.
  // (With JS off, CSS keeps the site visible and the portal hidden.)
  if (site && portal) site.setAttribute('aria-hidden', 'true');

  // ============ WebAudio transition sound ============
  var audioCtx = null;
  function getCtx() {
    if (audioCtx) return audioCtx;
    try {
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      audioCtx = new C();
      return audioCtx;
    } catch (e) { return null; }
  }

  function playPortalTransition() {
    if (reduced) return;
    var ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }

    var now = ctx.currentTime;
    var master = ctx.createGain();
    master.gain.value = 0.0;
    master.connect(ctx.destination);
    master.gain.linearRampToValueAtTime(0.55, now + 0.05);
    master.gain.linearRampToValueAtTime(0.55, now + 2.6);
    master.gain.linearRampToValueAtTime(0.0, now + 3.4);

    // 1. Deep rising sub — the portal opening
    var sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(38, now);
    sub.frequency.exponentialRampToValueAtTime(120, now + 2.2);
    var subGain = ctx.createGain();
    subGain.gain.value = 0.0;
    subGain.gain.linearRampToValueAtTime(0.65, now + 0.6);
    subGain.gain.linearRampToValueAtTime(0.4, now + 2.4);
    subGain.gain.linearRampToValueAtTime(0.0, now + 3.4);
    sub.connect(subGain).connect(master);
    sub.start(now); sub.stop(now + 3.5);

    // 2. Detuned pad — dark shimmer with green/purple feel
    var pad1 = ctx.createOscillator();
    var pad2 = ctx.createOscillator();
    pad1.type = 'sawtooth'; pad2.type = 'sawtooth';
    pad1.frequency.value = 110;
    pad2.frequency.value = 110 * 1.007; // slight detune
    var padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.setValueAtTime(300, now);
    padFilter.frequency.linearRampToValueAtTime(1400, now + 2.2);
    padFilter.Q.value = 8;
    var padGain = ctx.createGain();
    padGain.gain.value = 0.0;
    padGain.gain.linearRampToValueAtTime(0.14, now + 0.8);
    padGain.gain.linearRampToValueAtTime(0.1, now + 2.4);
    padGain.gain.linearRampToValueAtTime(0.0, now + 3.4);
    pad1.connect(padFilter); pad2.connect(padFilter);
    padFilter.connect(padGain).connect(master);
    pad1.start(now); pad2.start(now); pad1.stop(now + 3.5); pad2.stop(now + 3.5);

    // 3. Static / noise sweep — "signal breaking through"
    var bufSize = ctx.sampleRate * 3.2;
    var noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    var data = noiseBuf.getChannelData(0);
    for (var i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.7;
    var noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    var noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(600, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(4500, now + 2.6);
    noiseFilter.Q.value = 2.5;
    var noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.0;
    noiseGain.gain.linearRampToValueAtTime(0.18, now + 0.4);
    noiseGain.gain.linearRampToValueAtTime(0.28, now + 2.2);
    noiseGain.gain.linearRampToValueAtTime(0.0, now + 3.3);
    noise.connect(noiseFilter).connect(noiseGain).connect(master);
    noise.start(now); noise.stop(now + 3.4);

    // 4. Whoosh — the release / breach at ~2.4s
    var whoosh = ctx.createBufferSource();
    whoosh.buffer = noiseBuf;
    var whooshFilter = ctx.createBiquadFilter();
    whooshFilter.type = 'lowpass';
    whooshFilter.frequency.setValueAtTime(200, now + 2.0);
    whooshFilter.frequency.exponentialRampToValueAtTime(6000, now + 2.6);
    whooshFilter.frequency.exponentialRampToValueAtTime(200, now + 3.4);
    var whooshGain = ctx.createGain();
    whooshGain.gain.setValueAtTime(0.0, now + 2.0);
    whooshGain.gain.linearRampToValueAtTime(0.45, now + 2.5);
    whooshGain.gain.linearRampToValueAtTime(0.0, now + 3.4);
    whoosh.connect(whooshFilter).connect(whooshGain).connect(master);
    whoosh.start(now + 2.0); whoosh.stop(now + 3.5);

    // 5. Chime — the "access granted" ping at ~2.6s
    var chime = ctx.createOscillator();
    chime.type = 'sine';
    chime.frequency.setValueAtTime(880, now + 2.6);
    chime.frequency.exponentialRampToValueAtTime(1320, now + 2.9);
    var chimeGain = ctx.createGain();
    chimeGain.gain.setValueAtTime(0.0, now + 2.6);
    chimeGain.gain.linearRampToValueAtTime(0.22, now + 2.7);
    chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 3.4);
    chime.connect(chimeGain).connect(master);
    chime.start(now + 2.6); chime.stop(now + 3.4);

    setTimeout(function () { try { master.disconnect(); } catch (e) {} }, 4000);
  }

  // ============ Portal entry sequence ============
  function enterRealm() {
    if (entered || !portal || !site) return;
    entered = true;

    if (window.Realm) Realm.track('portal_enter');

    // Kick off audio first (must be inside user gesture)
    playPortalTransition();

    // Reveal the site immediately so the hero is already composited
    // underneath the portal — no black frame at any point during the tear.
    // body.is-entered must be set NOW, not at the end: fx.js and fx2.js
    // gate all scroll effects on it, and arming them late makes the first
    // fold stutter.
    site.setAttribute('aria-hidden', 'false');
    site.classList.add('is-revealed');
    body.classList.add('is-entered');

    var P = window.RealmPortal;
    if (P && typeof P.enter === 'function') {
      // Portal v2 owns phases 2-4 (AUTH → TEAR → SETTLE).
      try { P.enter(); } catch (e) {
        portal.classList.add('is-hidden');
      }
      setTimeout(function () {
        if (stamp) stamp.classList.add('is-shown');
      }, reduced ? 100 : 1310);
    } else {
      // Legacy fallback if portal2.js failed to load.
      portal.classList.add('is-charging');
      setTimeout(function () { portal.classList.add('is-leaving'); }, reduced ? 60 : 700);
      setTimeout(function () { if (stamp) stamp.classList.add('is-shown'); }, reduced ? 100 : 2000);
      setTimeout(function () { portal.classList.add('is-hidden'); }, reduced ? 500 : 3200);
    }

    setTimeout(revealVisible, reduced ? 80 : 300);

    // Hard failsafe: whatever happens above, the portal is gone within 6s
    // of the click. Nobody gets stranded on a black screen.
    setTimeout(function () { portal.classList.add('is-hidden'); }, 6000);
  }

  // Skip affordances: the whole stage is clickable, and Esc works too.
  // Never make someone hunt for the button.
  if (portal) {
    portal.addEventListener('click', function (e) {
      if (entered) return;
      if (e.target.closest && e.target.closest('a')) return;
      enterRealm();
    });
    document.addEventListener('keydown', function (e) {
      if (!entered && e.key === 'Escape') { e.preventDefault(); enterRealm(); }
    });
  }

  if (enterBtn) {
    enterBtn.addEventListener('click', enterRealm);
    enterBtn.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); enterRealm(); }
    });
  }

  document.addEventListener('keydown', function (e) {
    if (entered) return;
    if (e.key === 'Enter' || e.key === ' ') {
      var tag = (document.activeElement && document.activeElement.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      enterRealm();
    }
  });

  // ============ Scroll reveal ============
  var revealEls = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
  function revealVisible() {
    revealEls.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.92) el.classList.add('is-in');
    });
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('is-in'); io.unobserve(entry.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-in'); });
  }

  // ============ In-page anchor scrolling ============
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (!id || id === '#') return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      if (!entered && portal) enterRealm();
      setTimeout(function () {
        target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      }, entered || !portal ? 0 : (reduced ? 100 : 1600));
    });
  });

  // ============ Enlist form ============ (handler moved inline to index.html for real Supabase capture in v7)
  // legacy stub removed

  // ============ Live feed clocks ============
  var feedClock = document.getElementById('feedClock');
  var feedElapsed = document.getElementById('feedElapsed');
  if (feedClock || feedElapsed) {
    var startedAt = Date.now();
    function pad(n) { return n < 10 ? '0' + n : '' + n; }
    function tick() {
      if (feedClock) {
        var d = new Date();
        feedClock.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
      }
      // A running REC counter over a dead feed is a contradiction.
      // The rotator sets data-halt when no clips are cleared.
      if (feedElapsed && !feedElapsed.hasAttribute('data-halt')) {
        var s = Math.floor((Date.now() - startedAt) / 1000);
        feedElapsed.textContent = pad(Math.floor(s / 3600)) + ':' + pad(Math.floor((s % 3600) / 60)) + ':' + pad(s % 60);
      }
    }
    tick();
    setInterval(tick, 1000);
  }

  // ============ Live feed controls ============
  var feedVideo = document.getElementById('feedVideo');
  var feedControls = document.querySelector('.feed-controls');
  var playBtn = document.getElementById('feedPlayBtn');
  var muteBtn = document.getElementById('feedMuteBtn');
  var fsBtn = document.getElementById('feedFsBtn');

  function syncPlayBtn() {
    if (!playBtn || !feedVideo) return;
    var paused = feedVideo.paused;
    var icon = playBtn.querySelector('.feed-btn-icon');
    var lbl = playBtn.querySelector('.feed-btn-lbl');
    if (icon) icon.textContent = paused ? '\u25B6' : '\u25A0\u25A0';
    if (lbl) lbl.textContent = paused ? 'PLAY' : 'PAUSE';
    if (feedControls) feedControls.classList.toggle('is-paused', paused);
  }
  function syncMuteBtn() {
    if (!muteBtn || !feedVideo) return;
    var muted = feedVideo.muted;
    var icon = muteBtn.querySelector('.feed-btn-icon');
    var lbl = muteBtn.querySelector('.feed-btn-lbl');
    if (icon) icon.textContent = muted ? 'MUTED' : 'AUDIO';
    if (lbl) lbl.textContent = muted ? 'UNMUTE' : 'MUTE';
    if (feedControls) feedControls.classList.toggle('is-audible', !muted);
  }

  if (feedVideo && playBtn) {
    playBtn.addEventListener('click', function () {
      if (feedVideo.paused) {
        var p = feedVideo.play();
        if (p && p.catch) p.catch(function () {});
      } else {
        feedVideo.pause();
      }
    });
    feedVideo.addEventListener('play', syncPlayBtn);
    feedVideo.addEventListener('pause', syncPlayBtn);
    syncPlayBtn();
  }

  if (feedVideo && muteBtn) {
    muteBtn.addEventListener('click', function () {
      feedVideo.muted = !feedVideo.muted;
      if (!feedVideo.muted && feedVideo.paused) {
        var p = feedVideo.play();
        if (p && p.catch) p.catch(function () {});
      }
      syncMuteBtn();
    });
    feedVideo.addEventListener('volumechange', syncMuteBtn);
    syncMuteBtn();
  }

  if (feedVideo && fsBtn) {
    fsBtn.addEventListener('click', function () {
      var doc = document;
      var isFs = doc.fullscreenElement || doc.webkitFullscreenElement;
      if (isFs) {
        (doc.exitFullscreen || doc.webkitExitFullscreen).call(doc);
      } else {
        var el = feedVideo;
        var req = el.requestFullscreen || el.webkitRequestFullscreen || el.webkitEnterFullscreen;
        if (req) req.call(el);
      }
    });
  }

  // Touch: tap the video area to toggle controls visibility
  var feedScreen = document.querySelector('.feed-screen');
  if (feedScreen && feedControls) {
    feedScreen.addEventListener('touchstart', function () {
      feedControls.classList.toggle('is-shown');
    }, { passive: true });
  }
})();


/* ---------------------------------------------------------
   Featured Song (music.html) — video + audio player wiring
   --------------------------------------------------------- */
(function () {
  var featuredVideo = document.getElementById('featuredVideo');
  var featuredBtn = document.querySelector('[data-featured-play]');

  // Wire featured-play button to control the video
  if (featuredVideo && featuredBtn) {
    var icon = featuredBtn.querySelector('.featured-play-icon');
    var label = featuredBtn.querySelector('.featured-play-label');

    function setPlayingUI(playing) {
      if (playing) {
        featuredBtn.classList.add('is-playing');
        if (icon) icon.textContent = '❚❚';
        if (label) label.textContent = 'Pause transmission';
      } else {
        featuredBtn.classList.remove('is-playing');
        if (icon) icon.textContent = '▶';
        if (label) label.textContent = 'Play transmission';
      }
    }

    function ensureSrc() {
      if (!featuredVideo.getAttribute('src') && featuredVideo.dataset.src) {
        featuredVideo.setAttribute('src', featuredVideo.dataset.src);
        try { featuredVideo.load(); } catch (e) {}
      }
    }

    featuredBtn.addEventListener('click', function () {
      if (featuredVideo.paused) {
        // Pause any live track audio when video starts
        document.querySelectorAll('.track-live audio').forEach(function (a) { a.pause(); });
        ensureSrc();
        featuredVideo.play();
      } else {
        featuredVideo.pause();
      }
    });

    featuredVideo.addEventListener('play', function () { setPlayingUI(true); });
    featuredVideo.addEventListener('pause', function () { setPlayingUI(false); });
    featuredVideo.addEventListener('ended', function () { setPlayingUI(false); });
  }

  // ---------------------------------------------------------
  // Track audio player — for tracks with class .track-live
  // ---------------------------------------------------------
  var liveTracks = document.querySelectorAll('.track-live');
  liveTracks.forEach(function (track) {
    var audio = track.querySelector('audio.track-audio');
    var playBtn = track.querySelector('.track-play');
    var bar = track.querySelector('.track-progress-bar');
    var fill = track.querySelector('.track-progress-fill');
    var curEl = track.querySelector('.t-cur');
    var durEl = track.querySelector('.t-dur');
    if (!audio || !playBtn) return;

    function fmt(t) {
      if (isNaN(t) || !isFinite(t)) return '0:00';
      var m = Math.floor(t / 60);
      var s = Math.floor(t % 60);
      return m + ':' + (s < 10 ? '0' + s : s);
    }

    playBtn.addEventListener('click', function () {
      if (audio.paused) {
        // Pause other players first
        document.querySelectorAll('audio.track-audio').forEach(function (a) { if (a !== audio) a.pause(); });
        if (featuredVideo && !featuredVideo.paused) featuredVideo.pause();
        audio.play();
      } else {
        audio.pause();
      }
    });

    audio.addEventListener('play', function () {
      track.classList.add('is-playing');
      playBtn.textContent = '❚❚';
      playBtn.setAttribute('aria-label', 'Pause');
    });
    audio.addEventListener('pause', function () {
      track.classList.remove('is-playing');
      playBtn.textContent = '▶';
      playBtn.setAttribute('aria-label', 'Play');
    });
    audio.addEventListener('ended', function () {
      track.classList.remove('is-playing');
      playBtn.textContent = '▶';
      if (fill) fill.style.width = '0%';
      if (curEl) curEl.textContent = '0:00';
    });
    audio.addEventListener('loadedmetadata', function () {
      if (durEl) durEl.textContent = fmt(audio.duration);
    });
    audio.addEventListener('timeupdate', function () {
      if (!audio.duration) return;
      var pct = (audio.currentTime / audio.duration) * 100;
      if (fill) fill.style.width = pct + '%';
      if (curEl) curEl.textContent = fmt(audio.currentTime);
    });

    // Seek on progress-bar click
    if (bar) {
      bar.addEventListener('click', function (e) {
        if (!audio.duration) return;
        var rect = bar.getBoundingClientRect();
        var pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        audio.currentTime = pct * audio.duration;
      });
    }
  });
})();


/* ---------------------------------------------------------
   Live Feed — playlist rotator
   Cycles through data-playlist clips on the #feedVideo element.
   Falls back gracefully if playlist is missing/invalid.
   --------------------------------------------------------- */
(function () {
  var video = document.getElementById('feedVideo');
  if (!video) return;

  var raw = video.getAttribute('data-playlist');
  if (!raw) return;

  var playlist;
  try { playlist = JSON.parse(raw); } catch (e) { console.warn('feed playlist parse failed', e); return; }

  // No clips cleared for release. Hold the poster, retire the transport
  // controls rather than leaving three buttons that do nothing.
  if (!Array.isArray(playlist) || !playlist.length) {
    var screen = video.closest('.feed-screen');
    if (screen) screen.classList.add('is-offline');
    ['feedPlayBtn', 'feedMuteBtn', 'feedFsBtn'].forEach(function (id) {
      var b = document.getElementById(id);
      if (!b) return;
      b.disabled = true;
      b.setAttribute('aria-disabled', 'true');
      b.tabIndex = -1;
    });
    var el = document.getElementById('feedElapsed');
    if (el) { el.setAttribute('data-halt', ''); el.textContent = '--:--:--'; }

    // Everything on this panel claims a live broadcast. Retune the copy
    // so it reads as an outage, not a bug. All of it reverts the moment
    // data-playlist is repopulated.
    var swap = [
      ['#feed .section-kicker', 'LOST TRANSMISSION / CH 001'],
      ['.feed-heading h2',  'CAM STATUS · NOTHING COMING BACK'],
      ['.feed-heading p',   'Eight cameras, eight dead returns. HQ is aware. HQ is not concerned.'],
      ['.feed-chrome-l > span:last-child', 'CH 001 · OFFLINE'],
      ['.feed-fine',        'Feed restores when the cameras do. No timeframe has been offered.']
    ];
    swap.forEach(function (pair) {
      var n = document.querySelector(pair[0]);
      if (n) n.textContent = pair[1];
    });
    var rec = document.querySelector('.feed-rec');
    if (rec) rec.classList.add('is-dead');
    return;
  }

  var camTag = document.getElementById('feedCamTag');
  var opTag  = document.getElementById('feedOpTag');
  var idx = 0;

  function applyHud(entry) {
    if (camTag && entry.tag) camTag.textContent = entry.tag;
    if (opTag  && entry.op)  opTag.textContent  = entry.op;
  }

  function loadCurrent(autoplay) {
    var entry = playlist[idx];
    if (!entry) return;
    // Setting src directly (no <source> children left in the DOM)
    video.src = entry.src;
    applyHud(entry);
    // Force reload of new src
    try { video.load(); } catch (e) {}
    if (autoplay) {
      var p = video.play();
      if (p && typeof p.catch === 'function') {
        p.catch(function () { /* autoplay blocked — user must press Play */ });
      }
    }
  }

  function next() {
    idx = (idx + 1) % playlist.length;
    loadCurrent(true);
  }

  video.addEventListener('ended', next);

  // Also advance if the file errors out (bad codec, missing file)
  video.addEventListener('error', function () {
    // avoid infinite loop if every clip is broken — cap consecutive errors
    if (video._errCount == null) video._errCount = 0;
    video._errCount++;
    if (video._errCount > playlist.length + 1) return;
    setTimeout(next, 300);
  });
  video.addEventListener('playing', function () { video._errCount = 0; });

  // Boot: load first clip
  loadCurrent(true);
})();

/* v5 nav (mobile drawer, nav analytics, status shuffle) moved to
   assets/js/nav.js so every page shares one menu system. */

/* ============================================
   v6 — VHS wipe on live feed clip advance
   ============================================ */
(function initFeedWipe(){
  var video = document.getElementById('feedVideo');
  if (!video) return;
  var wrap = video.closest('.feed-video-wrap');
  if (!wrap) {
    // Wrap the video if the HTML didn't already
    var parent = video.parentNode;
    if (parent && !parent.classList.contains('feed-video-wrap')){
      var w = document.createElement('div');
      w.className = 'feed-video-wrap';
      parent.insertBefore(w, video);
      w.appendChild(video);
      wrap = w;
    }
  }
  if (!wrap) return;
  // Insert wipe overlay if missing
  if (!wrap.querySelector('.vhs-wipe')){
    var overlay = document.createElement('div');
    overlay.className = 'vhs-wipe';
    overlay.setAttribute('aria-hidden', 'true');
    wrap.appendChild(overlay);
  }
  var wiping = false;
  function fireWipe(){
    if (wiping) return;
    wiping = true;
    wrap.classList.add('is-wiping');
    setTimeout(function(){
      wrap.classList.remove('is-wiping');
      wiping = false;
    }, 620);
  }
  // Trigger on ended (clip advance) and on loadeddata after src change
  video.addEventListener('ended', fireWipe);
  video.addEventListener('loadstart', function(){
    // small guard so first-boot doesn't wipe
    if (video._booted) fireWipe();
    video._booted = true;
  });
})();

/* ============================================
   v6 — HOT MUTT attention nudge (re-fire on interaction)
   ============================================ */
(function initHotMuttAttention(){
  var stamp = document.querySelector('.hot-mutt-stamp');
  if (!stamp) return;
  // Reduced motion: skip
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  // On first click anywhere in the page (once) re-pulse the stamp
  var fired = false;
  function nudge(){
    if (fired) return;
    fired = true;
    stamp.classList.remove('hm-attention');
    // force reflow
    void stamp.offsetWidth;
    stamp.classList.add('hm-attention');
  }
  // First interaction re-fires the pulse
  document.addEventListener('click', nudge, { once:true });
})();
