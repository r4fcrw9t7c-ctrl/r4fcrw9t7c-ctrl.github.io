/* ============================================================
   REALM HQ — FX v4 ENGINE
   Loads last, after fx.js and fx2.js, on all 15 pages.
   Every effect is feature-detected and wrapped in try/catch at
   the boot call site, so one failure can never take the page
   down with it.
   ============================================================ */
(function () {
  'use strict';

  var docEl = document.documentElement;
  var reduced = false, isTouch = false;
  try { reduced = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  try { isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window; } catch (e) {}
  var narrow = function () { return window.innerWidth < 900; };

  function track(ev, props) {
    try { if (window.Realm && Realm.track) Realm.track(ev, props); } catch (e) {}
    try { if (window.plausible) window.plausible(ev, props ? { props: props } : undefined); } catch (e) {}
  }

  /* Homepage holds all scroll work until the portal is done. */
  function gated() {
    return !!document.getElementById('portalStage') &&
           !document.body.classList.contains('is-entered');
  }
  function whenEntered(fn) {
    if (!gated()) { fn(); return; }
    var done = false;
    function go() { if (done) return; done = true; try { fn(); } catch (e) {} }
    var mo = new MutationObserver(function () {
      if (document.body.classList.contains('is-entered')) { mo.disconnect(); go(); }
    });
    mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    setTimeout(function () { mo.disconnect(); go(); }, 20000); // never strand
  }

  /* ============================================================
     1. VIEW TRANSITIONS
     fx2 already intercepts internal links and runs a glitch-fade.
     Where the browser supports startViewTransition we let it drive
     instead, which keeps the header pinned across the navigation.
     ============================================================ */
  function viewTransitions() {
    if (reduced) return;
    if (!document.startViewTransition) return;   // fx2's fade stays as the fallback
    // Capture-phase listener beats fx2's bubble-phase handler, so the
    // glitch-fade never fires on browsers that can do this properly.
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a');
      if (!a || e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      if (a.target && a.target !== '_self') return;
      if (a.hasAttribute('download')) return;
      var href = a.getAttribute('href') || '';
      if (!href || href.charAt(0) === '#') return;
      if (/^(mailto:|tel:|javascript:)/i.test(href)) return;
      var url;
      try { url = new URL(a.href, location.href); } catch (err) { return; }
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.hash) return;

      e.preventDefault();
      e.stopPropagation();
      var went = false;
      function go() { if (!went) { went = true; location.href = a.href; } }
      try {
        document.startViewTransition(function () { go(); });
      } catch (err) { go(); }
      setTimeout(go, 900); // failsafe
    }, true);
  }

  /* ============================================================
     2. TEXT MASK REVEALS
     fx.js's decrypt pass claims single-node h1/h2/.section-kicker
     of 46 chars or fewer. We deliberately take the complement so
     the two effects never fight over the same element.
     ============================================================ */
  function maskReveals() {
    if (reduced) return;
    if (!('IntersectionObserver' in window)) return;
    var cand = document.querySelectorAll('h1, h2');
    var list = [];
    for (var i = 0; i < cand.length; i++) {
      var el = cand[i];
      if (el.closest('#fxVeil') || el.closest('.portal-stage') || el.closest('#fx3Override')) continue;
      if (el.dataset.fx3Mask) continue;
      var txt = el.textContent.trim();
      if (!txt) continue;
      // fx.js owns this one — leave it alone.
      if (el.childElementCount === 0 && txt.length <= 46) continue;
      // Nested markup we cannot safely re-wrap per line: wrap whole.
      el.dataset.fx3Mask = '1';
      var inner = document.createElement('span');
      while (el.firstChild) inner.appendChild(el.firstChild);
      var mask = document.createElement('span');
      mask.className = 'fx3-mask';
      mask.appendChild(inner);
      el.appendChild(mask);
      list.push(mask);
    }
    if (!list.length) return;

    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        en.target.classList.add('is-in');
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
    list.forEach(function (m) { io.observe(m); });

    // Safety net: nothing stays hidden, ever.
    setTimeout(function () { list.forEach(function (m) { m.classList.add('is-in'); }); }, 4500);
  }

  /* ============================================================
     3. CTA RUBBER-BAND RELEASE
     fx2 supplies the magnetic pull. This adds the overshoot on
     exit so the button snaps back with tension rather than
     sliding home.
     ============================================================ */
  function rubberBand() {
    if (reduced || isTouch || narrow()) return;
    var btns = document.querySelectorAll('.cta, .btn, .enter-btn, .hdr-lite-nav a, button[type="submit"]');
    [].forEach.call(btns, function (b) {
      if (b.dataset.fx3Rb) return;
      b.dataset.fx3Rb = '1';
      b.addEventListener('mouseleave', function () {
        // Read the magnet's current offset, then spring past zero.
        var cs;
        try { cs = getComputedStyle(b).transform; } catch (e) { return; }
        if (!cs || cs === 'none') return;
        var m = cs.match(/matrix\(([^)]+)\)/);
        if (!m) return;
        var parts = m[1].split(',');
        var dx = parseFloat(parts[4]) || 0, dy = parseFloat(parts[5]) || 0;
        if (Math.abs(dx) < 0.6 && Math.abs(dy) < 0.6) return;
        if (!b.animate) return;
        try {
          b.animate([
            { transform: 'translate(' + dx + 'px,' + dy + 'px)' },
            { transform: 'translate(' + (-dx * 0.28) + 'px,' + (-dy * 0.28) + 'px)', offset: 0.45 },
            { transform: 'translate(' + (dx * 0.09) + 'px,' + (dy * 0.09) + 'px)', offset: 0.75 },
            { transform: 'translate(0,0)' }
          ], { duration: 380, easing: 'cubic-bezier(.34,1.56,.5,1)' });
        } catch (e) {}
      }, { passive: true });
    });
  }

  /* ============================================================
     4. NUMBER ROLL-UPS
     Prices must land on the exact original string. We never
     reformat — we interpolate the numeric part and restore the
     literal source text on the final frame.
     ============================================================ */
  function rollUps() {
    if (reduced) return;
    if (!('IntersectionObserver' in window)) return;
    // Leaf nodes only — .tier-price and .field-foot are wrappers.
    var sel = '[data-fx3-count], [data-price], .amt, .field-price, .price, .stat-num, .clearance-level';
    var nodes = document.querySelectorAll(sel);
    var list = [];
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.dataset.fx3Rolled || el.childElementCount > 0) continue;
      var raw = el.textContent.trim();
      var m = raw.match(/(\d[\d,]*)(\.(\d+))?/);
      if (!m) continue;
      el.dataset.fx3Rolled = '1';
      el.dataset.fx3Raw = raw;
      el.classList.add('fx3-num');
      list.push(el);
    }
    if (!list.length) return;

    function roll(el) {
      var raw = el.dataset.fx3Raw;
      var m = raw.match(/(\d[\d,]*)(\.\d+)?/);
      if (!m) { el.textContent = raw; return; }
      var whole = m[1].replace(/,/g, '');
      var target = parseFloat(whole + (m[2] || ''));
      var dp = m[2] ? m[2].length - 1 : 0;
      var t0 = performance.now(), dur = 780;
      function frame(t) {
        var p = Math.min(1, (t - t0) / dur);
        var e = 1 - Math.pow(1 - p, 3);
        if (p >= 1) { el.textContent = raw; return; }   // exact source value, always
        el.textContent = raw.replace(m[0], (target * e).toFixed(dp));
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }

    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        roll(en.target);
      });
    }, { threshold: 0.5 });
    list.forEach(function (el) { io.observe(el); });

    // If the observer never fires, the correct number must still be there.
    setTimeout(function () {
      list.forEach(function (el) { if (el.dataset.fx3Raw) el.textContent = el.dataset.fx3Raw; });
    }, 5000);
  }

  /* ============================================================
     5. AMBIENT AUDIO — synthesised, not sampled.
     A room-tone loop as an asset would be ~200KB of dead weight
     for something 95% of visitors never switch on. Two detuned
     oscillators through a lowpass cost nothing and loop perfectly.
     DEFAULT OFF. ALWAYS. Choice persisted in localStorage.
     ============================================================ */
  function ambientAudio() {
    // Three header variants exist across the site: .hdr-lite (11 pages),
    // .site-header (index) and .subpage-header (music/quiz/contact).
    var host = document.querySelector('.hdr-lite-status') ||
               document.querySelector('header .hdr-status') ||
               document.querySelector('header .hdr-nav');
    if (document.querySelector('.fx3-audio')) return;

    function mk(cls) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'fx3-audio' + (cls ? ' ' + cls : '');
      b.setAttribute('aria-pressed', 'false');
      b.innerHTML = '<i aria-hidden="true"></i><span>AUDIO: OFF</span>';
      return b;
    }

    // The header button is hidden under 1100px, so mobile gets its own
    // copy inside the nav drawer. Both drive the same audio graph.
    var btns = [];
    if (host) { var hb = mk(); host.parentNode.insertBefore(hb, host); btns.push(hb); }
    var foot = document.querySelector('.hdr-drawer-foot');
    if (foot) { var db = mk('fx3-audio-drawer'); foot.parentNode.insertBefore(db, foot); btns.push(db); }
    if (!btns.length) return;

    var ctx = null, drone = null, gain = null, on = false;

    function build() {
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) return false;
      ctx = new C();
      gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(ctx.destination);

      var lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 320; lp.Q.value = 3;
      lp.connect(gain);

      var a = ctx.createOscillator(), b = ctx.createOscillator(), c = ctx.createOscillator();
      a.type = 'sine';     a.frequency.value = 55;
      b.type = 'sine';     b.frequency.value = 55 * 1.004;  // slow beat, ~0.2Hz
      c.type = 'triangle'; c.frequency.value = 110;
      var cg = ctx.createGain(); cg.gain.value = 0.18; c.connect(cg).connect(lp);
      a.connect(lp); b.connect(lp);

      // Very slow filter drift so it never sits perfectly still.
      var lfo = ctx.createOscillator(), lfoGain = ctx.createGain();
      lfo.frequency.value = 0.045; lfoGain.gain.value = 70;
      lfo.connect(lfoGain).connect(lp.frequency);

      [a, b, c, lfo].forEach(function (o) { o.start(); });
      drone = { a: a, b: b, c: c, lfo: lfo };
      return true;
    }

    function tick(freq, vol) {
      if (!on || !ctx) return;
      try {
        var t = ctx.currentTime;
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'square'; o.frequency.value = freq;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol, t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
        o.connect(g).connect(ctx.destination);
        o.start(t); o.stop(t + 0.09);
      } catch (e) {}
    }

    function paint() {
      btns.forEach(function (b) {
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        b.querySelector('span').textContent = 'AUDIO: ' + (on ? 'ON' : 'OFF');
      });
    }

    function setState(next) {
      on = next;
      paint();
      try { localStorage.setItem('realm.audio', on ? '1' : '0'); } catch (e) {}
      if (!on) {
        if (gain && ctx) { try { gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4); } catch (e) {} }
        return;
      }
      if (!ctx && !build()) { setState(false); return; }
      if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
      try { gain.gain.linearRampToValueAtTime(0.035, ctx.currentTime + 1.1); } catch (e) {}
    }

    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        setState(!on);
        track('audio_toggle', { state: on ? 'on' : 'off' });
      });
    });

    // Never autoplay. A stored 'on' only arms the button — the context
    // stays suspended until the visitor's first real gesture.
    var stored = '0';
    try { stored = localStorage.getItem('realm.audio') || '0'; } catch (e) {}
    if (stored === '1') {
      btns.forEach(function (b) {
        b.classList.add('is-on');
        b.querySelector('span').textContent = 'AUDIO: ON';
      });
      var arm = function () {
        document.removeEventListener('pointerdown', arm);
        document.removeEventListener('keydown', arm);
        setState(true);
      };
      document.addEventListener('pointerdown', arm, { once: true });
      document.addEventListener('keydown', arm, { once: true });
    }

    if (!isTouch && !narrow()) {
      document.addEventListener('mouseover', function (e) {
        var a = e.target.closest && e.target.closest('.hdr-lite-nav a, .hdr-nav a');
        if (a) tick(2300, 0.014);
      }, { passive: true });
      document.addEventListener('click', function () { tick(1500, 0.02); }, { passive: true });
    }
  }

  /* ============================================================
     6. CLEARANCE OVERRIDE — type HOTMUTT anywhere.
     No state change, no cookie. Purely a reward for the curious.
     ============================================================ */
  function override() {
    var SEQ = 'hotmutt', buf = '', busy = false;

    document.addEventListener('keydown', function (e) {
      var tag = (document.activeElement && document.activeElement.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement.isContentEditable) return;
      if (e.key.length !== 1) return;
      buf = (buf + e.key.toLowerCase()).slice(-SEQ.length);
      if (buf !== SEQ || busy) return;
      buf = '';
      fire();
    });

    function fire() {
      busy = true;
      track('clearance_override');
      var ov = document.createElement('div');
      ov.id = 'fx3Override';
      ov.setAttribute('aria-hidden', 'true');
      ov.innerHTML =
        '<div class="fx3-ov-inner">' +
        '<div class="fx3-ov-hd">CLEARANCE OVERRIDE</div>' +
        '<div>&gt; root access accepted<br>' +
        '&gt; operative flagged: HOT MUTT<br>' +
        '&gt; file 019 unsealed &mdash; contents missing<br>' +
        '&gt; last seen: the great flats of bungonia, est day 5<br>' +
        '&gt; classification: cooked<br>' +
        '&gt; this never happened.</div>' +
        '</div>';
      document.body.appendChild(ov);
      requestAnimationFrame(function () { ov.classList.add('is-on'); });
      setTimeout(function () {
        ov.classList.remove('is-on');
        setTimeout(function () { try { ov.remove(); } catch (e) {} busy = false; }, 300);
      }, reduced ? 1400 : 3000);
    }
  }

  /* ============================================================
     BOOT — each effect isolated. One failure never cascades.
     ============================================================ */
  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    try { viewTransitions(); } catch (e) {}
    try { ambientAudio(); } catch (e) {}
    try { override(); } catch (e) {}
    try { rubberBand(); } catch (e) {}
    // fx2 mounts #fxRet on first mousemove; give it a beat.
    document.addEventListener('mousemove', function once() {
      document.removeEventListener('mousemove', once);
    }, { passive: true, once: true });

    whenEntered(function () {
      try { maskReveals(); } catch (e) {}
      try { rollUps(); } catch (e) {}
    });
  });
})();
