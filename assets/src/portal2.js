/* ============================================================
   REALM HQ — PORTAL v2 ENGINE
   Phases: 0 COLD BOOT · 1 IDLE · 2 AUTH · 3 TEAR · 4 SETTLE

   Loads BEFORE script.js and publishes window.RealmPortal.
   script.js keeps ownership of the audio and of body.is-entered
   (fx.js / fx2.js gate their scroll effects on that class, so it
   must still be set at click time, not at the end of the tear).
   ============================================================ */
(function () {
  'use strict';

  var stage = document.getElementById('portalStage');
  if (!stage) return;

  var reduced = false;
  try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var lowPower = false;
  try { lowPower = window.matchMedia('(max-width:900px)').matches; } catch (e) {}

  var fired = false;      // enter() has run
  var timers = [];
  function later(fn, ms) { var t = setTimeout(function () { try { fn(); } catch (e) {} }, ms); timers.push(t); return t; }
  function clearAll() { timers.forEach(clearTimeout); timers.length = 0; }

  /* ---------- injected furniture ---------- */
  function mk(cls, tag) {
    var el = document.createElement(tag || 'div');
    el.className = cls;
    el.setAttribute('aria-hidden', 'true');
    return el;
  }
  var seam = mk('portal-seam');
  var scan = mk('portal-scan');
  var flash = mk('portal-flash');
  stage.appendChild(seam); stage.appendChild(scan); stage.appendChild(flash);

  /* ============================================================
     HUD TYPEWRITER
     Lines contain nested <span class="hud-ok|hud-hot">, so we type
     the plain text then restore the original markup on completion.
     ============================================================ */
  var huds = [].slice.call(stage.querySelectorAll('.portal-hud'));
  var lineStore = [];
  huds.forEach(function (hud) {
    [].slice.call(hud.querySelectorAll('.hud-line')).forEach(function (ln) {
      lineStore.push({ el: ln, html: ln.innerHTML, text: ln.textContent });
      ln.textContent = '';
    });
  });
  function restoreAll() {
    lineStore.forEach(function (r) { r.el.innerHTML = r.html; });
    huds.forEach(function (h) { h.classList.add('is-live'); });
  }
  function typeLine(rec, speed, done) {
    if (reduced) { rec.el.innerHTML = rec.html; if (done) done(); return; }
    var i = 0, txt = rec.text;
    var caret = document.createElement('span');
    caret.className = 'hud-caret';
    (function step() {
      i += 1;
      rec.el.textContent = txt.slice(0, i);
      rec.el.appendChild(caret);
      if (i < txt.length) { later(step, speed); }
      else { rec.el.innerHTML = rec.html; if (done) done(); }
    })();
  }

  /* ---------- glyph scramble, 3 frames, used on HUD arrival ---------- */
  var GLYPHS = '▚▞█▓▒░/\\|<>#*+=';
  function scramble(el, frames, then) {
    if (reduced) { if (then) then(); return; }
    var real = el.textContent, n = 0;
    (function frame() {
      n += 1;
      if (n > frames) { el.textContent = real; if (then) then(); return; }
      var out = '';
      for (var i = 0; i < real.length; i++) {
        out += real[i] === ' ' ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      el.textContent = out;
      later(frame, 42);
    })();
  }

  /* ============================================================
     LIVE CLOCK — visitor's real local time, ticking.
     ============================================================ */
  var clockEl = null, clockTimer = null;
  function tz() {
    // Short zone abbreviation, e.g. AEST. Falls back to a UTC offset.
    try {
      var s = new Date().toLocaleTimeString('en-AU', { timeZoneName: 'short' });
      var m = s.match(/[A-Z]{2,5}$/);
      if (m) return m[0];
    } catch (e) {}
    var off = -new Date().getTimezoneOffset() / 60;
    return 'UTC' + (off >= 0 ? '+' : '') + off;
  }
  function mountClock() {
    var tr = stage.querySelector('.hud-tr');
    if (!tr) return;
    clockEl = document.createElement('span');
    clockEl.className = 'hud-line hud-clock';
    tr.appendChild(clockEl);
    var zone = tz();
    function pad(n) { return n < 10 ? '0' + n : '' + n; }
    function tick() {
      var d = new Date();
      clockEl.textContent = 'LOCAL ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + ' ' + zone;
    }
    tick();
    clockTimer = setInterval(tick, 1000);
  }

  /* ============================================================
     MICRO-FAULTS — every 7-14s a 90ms tear, and one HUD line
     briefly flips to SIGNAL: DEGRADED before correcting itself.
     ============================================================ */
  var faultTimer = null;
  function scheduleFault() {
    if (reduced || fired) return;
    faultTimer = later(function () {
      if (fired || document.hidden) { scheduleFault(); return; }
      stage.classList.add('is-fault');
      later(function () { stage.classList.remove('is-fault'); }, 110);

      var ok = stage.querySelector('.hud-tr .hud-ok');
      if (ok) {
        var was = ok.textContent, cls = ok.className;
        ok.textContent = 'DEGRADED';
        ok.className = 'hud-hot';
        later(function () { ok.textContent = was; ok.className = cls; }, 620);
      }
      scheduleFault();
    }, 7000 + Math.random() * 7000);
  }

  /* ============================================================
     IDLE PROMPTS — dry, not pushy.
     ============================================================ */
  function mountIdlePrompts() {
    var bl = stage.querySelector('.hud-bl');
    if (!bl) return;
    function add(txt, delay) {
      var s = document.createElement('span');
      s.className = 'hud-line hud-idle';
      s.textContent = txt;
      bl.appendChild(s);
      later(function () { if (!fired) s.classList.add('is-shown'); }, delay);
    }
    add('> operative hesitating', 25000);
    add('> take your time.', 45000);
  }

  /* ============================================================
     AUTH PARTICLE CONVERGENCE
     Short-lived dedicated canvas. Gold motes fly in from the
     stage edges onto the crown. Torn down as soon as it ends.
     ============================================================ */
  function converge(ms) {
    if (reduced) return;
    var cv = document.createElement('canvas');
    cv.className = 'portal-converge';
    cv.setAttribute('aria-hidden', 'true');
    var w = stage.clientWidth, h = stage.clientHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = w * dpr; cv.height = h * dpr;
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    stage.appendChild(cv);
    var ctx = cv.getContext('2d');
    if (!ctx) { cv.remove(); return; }
    ctx.scale(dpr, dpr);

    var N = lowPower ? 34 : 90;
    var cx = w / 2, cy = h / 2, P = [];
    for (var i = 0; i < N; i++) {
      var a = Math.random() * Math.PI * 2;
      var r = Math.max(w, h) * (0.55 + Math.random() * 0.5);
      P.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, d: 0.012 + Math.random() * 0.026, s: 0.8 + Math.random() * 1.6 });
    }
    requestAnimationFrame(function () { cv.classList.add('is-live'); });

    var t0 = performance.now(), raf;
    (function loop(t) {
      if (t - t0 > ms) { try { cv.remove(); } catch (e) {} return; }
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < P.length; i++) {
        var p = P[i];
        p.x += (cx - p.x) * p.d * 2.2;
        p.y += (cy - p.y) * p.d * 2.2;
        var dist = Math.hypot(cx - p.x, cy - p.y);
        ctx.globalAlpha = Math.max(0, Math.min(1, dist / 240)) * 0.9;
        ctx.fillStyle = i % 5 === 0 ? '#fff6da' : '#d4af37';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, 6.2832); ctx.fill();
      }
      raf = requestAnimationFrame(loop);
    })(t0);
  }

  /* ============================================================
     PHASE 0 → 1
     ============================================================ */
  var skipIntro = false;
  try { skipIntro = !!sessionStorage.getItem('realm.entered'); } catch (e) {}

  function goIdle() {
    stage.classList.remove('p-boot');
    stage.classList.add('p-idle');
    mountClock();
    mountIdlePrompts();
    scheduleFault();
  }

  function coldBoot() {
    if (reduced) { restoreAll(); goIdle(); return; }
    stage.classList.add('p-boot');
    // Corners land staggered ~120ms apart behind the scan line.
    huds.forEach(function (hud, hi) {
      later(function () {
        hud.classList.add('is-live');
        var lines = [].slice.call(hud.querySelectorAll('.hud-line'));
        lines.forEach(function (ln, li) {
          var rec = null;
          for (var k = 0; k < lineStore.length; k++) { if (lineStore[k].el === ln) { rec = lineStore[k]; break; } }
          if (!rec) return;
          later(function () {
            typeLine(rec, 14, li === lines.length - 1 ? function () { scramble(ln, 2); } : null);
          }, li * 90);
        });
      }, 140 + hi * 120);
    });
    later(goIdle, 900);
  }

  /* ============================================================
     PHASES 2 → 4  (public: called by script.js on click)
     ============================================================ */
  function enter() {
    if (fired) return;
    fired = true;
    clearTimeout(faultTimer);
    try { sessionStorage.setItem('realm.entered', '1'); } catch (e) {}

    if (reduced) {
      stage.classList.remove('p-boot', 'p-idle');
      stage.classList.add('p-tear');           // reduced-motion rule turns this into a 200ms fade
      later(function () { stage.classList.add('is-hidden'); }, 240);
      return;
    }

    /* --- Phase 2: AUTH (0 → 1100ms) --- */
    stage.classList.remove('p-idle');
    stage.classList.add('p-auth');
    converge(1150);

    var AUTH = [
      '> reading credentials',
      '> cross-referencing boneyard',
      '> clearance: PROVISIONAL',
      '> ACCESS GRANTED'
    ];
    var corners = ['.hud-tl', '.hud-tr', '.hud-bl', '.hud-br'];
    AUTH.forEach(function (txt, i) {
      later(function () {
        var hud = stage.querySelector(corners[i]);
        if (!hud) return;
        var line = hud.querySelector('.hud-line');
        if (!line) return;
        line.textContent = txt;
        line.className = 'hud-line ' + (i === 3 ? 'hud-ok' : '');
        scramble(line, 3);
      }, 90 + i * 240);
    });

    /* --- Phase 3: THE TEAR (1100 → 2400ms) --- */
    later(function () {
      stage.classList.add('p-tear');
      // Flash frame lands at maximum tear, ~200ms in.
      later(function () { flash.classList.add('is-fired'); }, 190);
      // Stamp impact shake — capped at 4px / 190ms by CSS.
      later(function () {
        document.documentElement.classList.add('portal-impact');
        later(function () { document.documentElement.classList.remove('portal-impact'); }, 240);
      }, 210);
    }, 1100);

    /* --- Phase 4: SETTLE --- */
    later(function () { stage.classList.add('is-hidden'); }, 2500);
  }

  /* ============================================================
     FAILSAFE — nothing may ever strand a visitor.
     If any phase throws, force entry within 6s of load.
     ============================================================ */
  var failsafe = setTimeout(function () {
    if (document.body.classList.contains('is-entered')) return;
    if (!stage.classList.contains('p-idle') && !stage.classList.contains('p-boot')) return;
    // Boot never completed — at minimum, make the portal usable.
    restoreAll();
    stage.classList.remove('p-boot');
    stage.classList.add('p-idle');
  }, 6000);

  /* ---------- boot ---------- */
  try {
    if (skipIntro) {
      // Returning visitor in the same session: no cold boot, no theatre.
      restoreAll();
      stage.classList.add('p-idle');
      mountClock();
      scheduleFault();
    } else {
      coldBoot();
    }
  } catch (e) {
    restoreAll();
    stage.classList.add('p-idle');
  }

  window.RealmPortal = {
    enter: enter,
    skipped: skipIntro,
    reduced: reduced,
    teardown: function () { clearAll(); clearTimeout(failsafe); if (clockTimer) clearInterval(clockTimer); }
  };
})();
