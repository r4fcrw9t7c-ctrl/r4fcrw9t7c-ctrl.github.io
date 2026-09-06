/* =========================================================
   REALM HQ — FX ENGINE v1
   Ambient ember field, boot veil, transmission rail, decrypt
   headings, redaction wipes, tilt cards, parallax, magnetics.
   Defensive by design: any failure degrades to a static page.
   ========================================================= */
(function () {
  'use strict';

  var reduced = false;
  try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var docEl = document.documentElement;
  docEl.classList.add('fx');

  var isTouch = false;
  try { isTouch = window.matchMedia('(pointer: coarse)').matches; } catch (e) {}

  var lowPower = false;
  try {
    lowPower = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
               (navigator.deviceMemory && navigator.deviceMemory <= 4);
  } catch (e) {}

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  }

  /* =======================================================
     1. AMBIENT FIELD — embers, shadow smoke, horizon grid
     ======================================================= */
  function ambient() {
    if (reduced) return;
    var cv = document.createElement('canvas');
    cv.id = 'fxAmbient';
    cv.setAttribute('aria-hidden', 'true');
    document.body.appendChild(cv);

    var ctx = cv.getContext('2d', { alpha: true });
    if (!ctx) { cv.remove(); return; }

    var dpr = Math.min(window.devicePixelRatio || 1, isTouch ? 1.5 : 2);
    var W = 0, H = 0;
    var embers = [], motes = [], smoke = [];
    var scrollY = window.pageYOffset || 0;
    var running = true;
    var t = 0;

    function rnd(a, b) { return a + Math.random() * (b - a); }

    function build() {
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = Math.floor(W * dpr); cv.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      var area = W * H;
      var emberCount = Math.round(Math.min(lowPower ? 34 : 90, area / 16000));
      var moteCount = Math.round(Math.min(lowPower ? 40 : 130, area / 11000));

      embers = [];
      for (var i = 0; i < emberCount; i++) {
        embers.push({
          x: rnd(0, W), y: rnd(0, H),
          r: rnd(0.7, 2.4),
          vy: rnd(-0.34, -0.08),
          vx: rnd(-0.13, 0.13),
          a: rnd(0.18, 0.72),
          ph: rnd(0, 6.28),
          sp: rnd(0.006, 0.02),
          d: rnd(0.35, 1)
        });
      }
      motes = [];
      for (var j = 0; j < moteCount; j++) {
        motes.push({
          x: rnd(0, W), y: rnd(0, H),
          r: rnd(0.3, 0.9),
          vy: rnd(-0.06, 0.06),
          vx: rnd(-0.05, 0.05),
          a: rnd(0.05, 0.2),
          d: rnd(0.15, 0.6)
        });
      }
      smoke = [];
      var sc = lowPower ? 3 : 5;
      for (var k = 0; k < sc; k++) {
        smoke.push({
          x: rnd(-0.2, 1.2), y: rnd(-0.1, 1.1),
          r: rnd(0.25, 0.6),
          vx: rnd(-0.00012, 0.00012),
          vy: rnd(-0.00009, 0.00009),
          hue: k % 3,
          a: rnd(0.05, 0.13)
        });
      }
    }

    function draw() {
      if (!running) return;
      t += 1;
      ctx.clearRect(0, 0, W, H);

      var par = (scrollY * 0.06) % (H + 200);

      /* --- shadow smoke: slow drifting coloured nebulae --- */
      for (var s = 0; s < smoke.length; s++) {
        var b = smoke[s];
        b.x += b.vx; b.y += b.vy;
        if (b.x < -0.4) b.x = 1.4; if (b.x > 1.4) b.x = -0.4;
        if (b.y < -0.4) b.y = 1.4; if (b.y > 1.4) b.y = -0.4;
        var cx = b.x * W, cy = b.y * H - par * 0.35;
        var rad = b.r * Math.max(W, H);
        var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        var col = b.hue === 0 ? '212,175,55' : (b.hue === 1 ? '74,43,122' : '44,94,70');
        var puls = b.a * (0.75 + 0.25 * Math.sin(t * 0.0035 + s));
        g.addColorStop(0, 'rgba(' + col + ',' + puls.toFixed(3) + ')');
        g.addColorStop(1, 'rgba(' + col + ',0)');
        ctx.fillStyle = g;
        ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
      }

      /* --- horizon grid: a slow perspective floor far below --- */
      ctx.save();
      ctx.strokeStyle = 'rgba(212,175,55,.055)';
      ctx.lineWidth = 1;
      var hz = H * 0.78 - (par * 0.12);
      for (var gi = 0; gi < 9; gi++) {
        var yy = hz + Math.pow(gi, 1.9) * 9 + ((t * 0.25) % 18);
        if (yy < 0 || yy > H) continue;
        ctx.globalAlpha = Math.max(0, 1 - gi / 9) * 0.7;
        ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke();
      }
      ctx.restore();

      /* --- dust motes --- */
      ctx.fillStyle = 'rgba(232,228,212,1)';
      for (var m = 0; m < motes.length; m++) {
        var p = motes[m];
        p.x += p.vx; p.y += p.vy;
        if (p.x < -5) p.x = W + 5; if (p.x > W + 5) p.x = -5;
        if (p.y < -5) p.y = H + 5; if (p.y > H + 5) p.y = -5;
        ctx.globalAlpha = p.a;
        ctx.beginPath();
        ctx.arc(p.x, (p.y - par * p.d * 0.5 + H) % H, p.r, 0, 6.283);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      /* --- embers: rising gold sparks --- */
      for (var e = 0; e < embers.length; e++) {
        var q = embers[e];
        q.ph += q.sp;
        q.x += q.vx + Math.sin(q.ph) * 0.22;
        q.y += q.vy;
        if (q.y < -12) { q.y = H + 12; q.x = rnd(0, W); }
        if (q.x < -12) q.x = W + 12; if (q.x > W + 12) q.x = -12;

        var yy2 = (q.y - par * q.d + H * 2) % (H + 40) - 20;
        var flick = 0.55 + 0.45 * Math.sin(q.ph * 2.3);
        var alpha = q.a * flick;

        var gg = ctx.createRadialGradient(q.x, yy2, 0, q.x, yy2, q.r * 6);
        gg.addColorStop(0, 'rgba(231,200,119,' + alpha.toFixed(3) + ')');
        gg.addColorStop(0.35, 'rgba(212,175,55,' + (alpha * 0.5).toFixed(3) + ')');
        gg.addColorStop(1, 'rgba(212,175,55,0)');
        ctx.fillStyle = gg;
        ctx.beginPath(); ctx.arc(q.x, yy2, q.r * 6, 0, 6.283); ctx.fill();

        ctx.fillStyle = 'rgba(255,238,190,' + Math.min(1, alpha * 1.25).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(q.x, yy2, q.r * 0.55, 0, 6.283); ctx.fill();
      }

      requestAnimationFrame(draw);
    }

    var rT;
    window.addEventListener('resize', function () {
      clearTimeout(rT); rT = setTimeout(build, 220);
    }, { passive: true });

    window.addEventListener('scroll', function () {
      scrollY = window.pageYOffset || 0;
    }, { passive: true });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { running = false; }
      else if (!running) { running = true; requestAnimationFrame(draw); }
    });

    build();
    requestAnimationFrame(draw);
    setTimeout(function () { cv.classList.add('is-live'); }, 60);
  }

  /* =======================================================
     2. BOOT VEIL + CRT EXIT (subpages only — the homepage
        already has its own portal sequence)
     ======================================================= */
  function veil() {
    if (reduced) return;
    if (document.getElementById('portalStage')) return;

    var v = document.createElement('div');
    v.id = 'fxVeil';
    v.setAttribute('aria-hidden', 'true');
    v.innerHTML =
      '<div class="fx-veil-crt"></div>' +
      '<div class="fx-veil-bar top"></div>' +
      '<div class="fx-veil-bar bot"></div>' +
      '<div class="fx-veil-seam"></div>' +
      '<div class="fx-veil-txt">SIGNAL LOCKED</div>';
    var crt = v.querySelector('.fx-veil-crt');
    crt.style.display = 'none';
    document.body.appendChild(v);

    setTimeout(function () { v.classList.add('is-open'); }, 620);
    setTimeout(function () { v.classList.add('is-done'); }, 1900);

    /* CRT collapse before internal navigation */
    document.addEventListener('click', function (ev) {
      if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      var a = ev.target && ev.target.closest ? ev.target.closest('a') : null;
      if (!a) return;
      var href = a.getAttribute('href');
      if (!href || href.charAt(0) === '#' || a.target === '_blank' || a.hasAttribute('download')) return;
      if (/^(mailto:|tel:|javascript:)/i.test(href)) return;
      var url;
      try { url = new URL(a.href, location.href); } catch (e) { return; }
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.hash) return;

      ev.preventDefault();
      v.classList.remove('is-done', 'is-open');
      v.classList.add('is-collapse');
      crt.style.display = 'block';
      setTimeout(function () { location.href = a.href; }, 380);
      setTimeout(function () { location.href = a.href; }, 1400);
    }, true);

    window.addEventListener('pageshow', function (e) {
      if (e.persisted) {
        v.classList.remove('is-collapse');
        v.classList.add('is-done');
        crt.style.display = 'none';
      }
    });
  }

  /* =======================================================
     3. TRANSMISSION RAIL
     ======================================================= */
  function rail() {
    var r = document.createElement('div');
    r.id = 'fxRail';
    r.setAttribute('aria-hidden', 'true');
    r.innerHTML = '<i></i><b>TRANSMISSION 00%</b>';
    document.body.appendChild(r);
    var bar = r.querySelector('i'), pct = r.querySelector('b');
    var raf = 0;
    function upd() {
      raf = 0;
      var h = document.documentElement.scrollHeight - window.innerHeight;
      var p = h > 0 ? Math.min(1, Math.max(0, (window.pageYOffset || 0) / h)) : 0;
      bar.style.width = (p * 100).toFixed(2) + '%';
      var n = Math.round(p * 100);
      pct.textContent = 'TRANSMISSION ' + (n < 10 ? '0' + n : n) + '%';
    }
    window.addEventListener('scroll', function () {
      if (!raf) raf = requestAnimationFrame(upd);
    }, { passive: true });
    window.addEventListener('resize', upd, { passive: true });
    upd();
  }

  /* =======================================================
     4. CURSOR SPOTLIGHT
     ======================================================= */
  function spotlight() {
    if (reduced || isTouch) return;
    var s = document.createElement('div');
    s.id = 'fxSpot';
    s.setAttribute('aria-hidden', 'true');
    document.body.appendChild(s);
    var tx = window.innerWidth / 2, ty = window.innerHeight / 2, cx = tx, cy = ty, on = false;
    window.addEventListener('mousemove', function (e) {
      tx = e.clientX; ty = e.clientY;
      if (!on) { on = true; s.classList.add('is-live'); }
    }, { passive: true });
    (function loop() {
      cx += (tx - cx) * 0.09; cy += (ty - cy) * 0.09;
      s.style.transform = 'translate3d(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px,0)';
      requestAnimationFrame(loop);
    })();
  }

  /* =======================================================
     5. SECTION ENTRY SWEEPS
     ======================================================= */
  function sections(gate) {
    var nodes = [];
    var sel = 'section, .section, .field-card, .op-card, .lore-term, .contact-card, .tier, .tier-card, .card, .music-banner, .drop-grid, article';
    var all = document.querySelectorAll(sel);
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.closest('#fxVeil')) continue;
      if (el.classList.contains('portal-stage')) continue;
      if (el.dataset.fxDone) continue;
      el.dataset.fxDone = '1';
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
      el.classList.add('fx-sec');
      if (el.classList.contains('reveal')) el.classList.add('fx-noshift');
      nodes.push(el);
    }
    if (!('IntersectionObserver' in window)) {
      nodes.forEach(function (n) { n.classList.add('fx-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        if (gate && gate()) return;
        en.target.classList.add('fx-in');
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.08 });
    nodes.forEach(function (n) { io.observe(n); });

    /* safety net: nothing stays invisible */
    setTimeout(function () {
      nodes.forEach(function (n) {
        var r = n.getBoundingClientRect();
        if (r.top < window.innerHeight) n.classList.add('fx-in');
      });
    }, 4000);
  }

  /* =======================================================
     6. DECRYPT HEADINGS
     ======================================================= */
  var GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&$@/\\<>*+=';
  function decrypt(el) {
    var final = el.textContent;
    var len = final.length;
    var frame = 0;
    var speed = 1.6;
    el.classList.add('fx-busy');
    function step() {
      var out = '';
      var done = 0;
      for (var i = 0; i < len; i++) {
        var ch = final[i];
        if (ch === ' ' || ch === '\n') { out += ch; done++; continue; }
        var reveal = frame / speed - i * 0.9;
        if (reveal > 3) { out += ch; done++; }
        else if (reveal > 0) { out += GLYPHS[(Math.random() * GLYPHS.length) | 0]; }
        else { out += GLYPHS[(Math.random() * GLYPHS.length) | 0]; }
      }
      el.textContent = out;
      frame++;
      if (done >= len) { el.textContent = final; el.classList.remove('fx-busy'); return; }
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function decryptHeadings(gate) {
    if (reduced) return;
    var els = [];
    var cand = document.querySelectorAll('h1, h2, .section-kicker');
    for (var i = 0; i < cand.length; i++) {
      var el = cand[i];
      if (el.childElementCount > 0) continue;
      var txt = el.textContent.trim();
      if (!txt || txt.length > 46) continue;
      if (el.closest('#fxVeil') || el.closest('.portal-stage')) continue;
      els.push(el);
    }
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        if (gate && gate()) return;
        io.unobserve(en.target);
        decrypt(en.target);
      });
    }, { threshold: 0.4 });
    els.forEach(function (e) { io.observe(e); });
  }

  /* =======================================================
     7. REDACTION WIPES on section ledes
     ======================================================= */
  function redactions(gate) {
    if (reduced) return;
    var cand = document.querySelectorAll('.section-lede, .hero-sub, .lore-term-tag, .drop-classification');
    var list = [];
    for (var i = 0; i < cand.length; i++) {
      var el = cand[i];
      if (el.childElementCount > 0) continue;
      if (el.dataset.fxRedact) continue;
      el.dataset.fxRedact = '1';
      var inner = document.createElement('span');
      inner.className = 'fx-redact-inner';
      inner.textContent = el.textContent;
      el.textContent = '';
      el.appendChild(inner);
      el.classList.add('fx-redact');
      list.push(el);
    }
    if (!('IntersectionObserver' in window)) {
      list.forEach(function (n) { n.classList.add('fx-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        if (gate && gate()) return;
        io.unobserve(en.target);
        en.target.classList.add('fx-in');
      });
    }, { threshold: 0.3 });
    list.forEach(function (n) { io.observe(n); });
    setTimeout(function () { list.forEach(function (n) { n.classList.add('fx-in'); }); }, 5000);
  }

  /* =======================================================
     8. TILT CARDS
     ======================================================= */
  function tilt() {
    if (reduced || isTouch) return;
    var cards = document.querySelectorAll('.field-card, .op-card, .lore-term, .contact-card, .drop-photo, .tier, .tier-card');
    for (var i = 0; i < cards.length; i++) {
      (function (c) {
        if (c.dataset.fxTilt) return;
        c.dataset.fxTilt = '1';
        if (getComputedStyle(c).position === 'static') c.style.position = 'relative';
        c.classList.add('fx-tilt');
        var sheen = document.createElement('span');
        sheen.className = 'fx-sheen';
        sheen.setAttribute('aria-hidden', 'true');
        c.appendChild(sheen);

        c.addEventListener('mouseenter', function () { c.classList.add('fx-hot'); });
        c.addEventListener('mousemove', function (e) {
          var r = c.getBoundingClientRect();
          var px = (e.clientX - r.left) / r.width;
          var py = (e.clientY - r.top) / r.height;
          var rx = (0.5 - py) * 9;
          var ry = (px - 0.5) * 11;
          c.style.transform = 'perspective(900px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg) translateZ(6px)';
          c.style.setProperty('--fx-mx', (px * 100).toFixed(1) + '%');
          c.style.setProperty('--fx-my', (py * 100).toFixed(1) + '%');
        });
        c.addEventListener('mouseleave', function () {
          c.classList.remove('fx-hot');
          c.style.transform = '';
        });
      })(cards[i]);
    }
  }

  /* =======================================================
     9. CREST FLOAT + RANDOM GLITCH BURSTS
     ======================================================= */
  function crest() {
    if (reduced) return;
    var imgs = document.querySelectorAll('.hdr-brand img, .hero-portal-echo img');
    for (var i = 0; i < imgs.length; i++) imgs[i].classList.add('fx-crest');

    var targets = document.querySelectorAll('.hdr-brand-txt, .hdr-brand img, .glow');
    if (!targets.length) return;
    (function burst() {
      var wait = 5200 + Math.random() * 12000;
      setTimeout(function () {
        if (!document.hidden) {
          var el = targets[(Math.random() * targets.length) | 0];
          el.classList.add('fx-glitch');
          setTimeout(function () { el.classList.remove('fx-glitch'); }, 460);
        }
        burst();
      }, wait);
    })();
  }

  /* =======================================================
     10. PARALLAX LAYERS
     ======================================================= */
  function parallax() {
    if (reduced || isTouch) return;
    var layers = [];
    var echo = document.querySelector('.hero-portal-echo');
    if (echo) layers.push({ el: echo, k: 0.18 });
    var stamp = document.querySelector('.roster-stamp');
    if (stamp) layers.push({ el: stamp, k: 0.07 });
    if (!layers.length) return;
    layers.forEach(function (l) { l.el.classList.add('fx-parallax'); });
    var raf = 0;
    function upd() {
      raf = 0;
      var y = window.pageYOffset || 0;
      layers.forEach(function (l) {
        l.el.style.transform = 'translate3d(0,' + (y * l.k).toFixed(1) + 'px,0)';
      });
    }
    window.addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(upd); }, { passive: true });
    upd();
  }

  /* =======================================================
     11. MAGNETIC BUTTONS
     ======================================================= */
  function magnets() {
    if (reduced || isTouch) return;
    var btns = document.querySelectorAll('.btn-primary, .enter-btn, .btn.primary');
    for (var i = 0; i < btns.length; i++) {
      (function (b) {
        if (b.dataset.fxMag) return;
        b.dataset.fxMag = '1';
        b.classList.add('fx-mag');
        b.addEventListener('mousemove', function (e) {
          var r = b.getBoundingClientRect();
          var dx = (e.clientX - (r.left + r.width / 2)) / r.width;
          var dy = (e.clientY - (r.top + r.height / 2)) / r.height;
          b.style.transform = 'translate(' + (dx * 12).toFixed(1) + 'px,' + (dy * 8).toFixed(1) + 'px)';
        });
        b.addEventListener('mouseleave', function () { b.style.transform = ''; });
      })(btns[i]);
    }
  }

  /* =======================================================
     BOOT
     ======================================================= */
  ready(function () {
    try { ambient(); } catch (e) {}
    try { veil(); } catch (e) {}
    try { rail(); } catch (e) {}
    try { spotlight(); } catch (e) {}

    try { crest(); } catch (e) {}
    try { parallax(); } catch (e) {}

    function scrollFx() {
      try { sections(null); } catch (e) {}
      try { decryptHeadings(null); } catch (e) {}
      try { redactions(null); } catch (e) {}
      try { tilt(); } catch (e) {}
      try { magnets(); } catch (e) {}
    }

    /* On the homepage everything sits behind the portal until the
       visitor presses ENTER — hold the scroll effects until then, so
       the reveals actually fire in front of their eyes. */
    var portal = document.getElementById('portalStage');
    if (!portal || document.body.classList.contains('is-entered')) {
      scrollFx();
      return;
    }

    var fired = false;
    var go = function () {
      if (fired) return;
      fired = true;
      setTimeout(scrollFx, 500);
    };
    var mo = new MutationObserver(function () {
      if (document.body.classList.contains('is-entered')) { mo.disconnect(); go(); }
    });
    mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    /* fallback: if the portal never reports entry, switch the fx on anyway */
    setTimeout(go, 20000);
  });
})();
