/* ============================================================
   REALM HQ — FX v6 ENGINE
   Loads last, after fx4.js, on all 15 pages.

   30. SURVEILLANCE    — CAM/REC HUD over photos on hover
   31. CLEARANCE GAUGE — right-edge depth meter, LVL 01→05
   32. SIGNAL TRACE    — oscilloscope beside the header status
   33. FOCUS RETICLE   — pure CSS (see fx5.css)
   34. EXFIL TOAST     — copying text logs an incident
   35. TARGET LOCK     — brackets on hash-navigated sections
   36. LINK INK        — pure CSS (see fx5.css)
   37. TUBE FLICKER    — one mono label dips, occasionally
   38. SIGNAL LOST TAB — document.title swaps while the tab is hidden

   Same contract as fx3/fx4: every effect is feature-detected and
   isolated in try/catch at the boot call site. Nothing here hides
   content to animate it in, so there is nothing to force visible —
   every effect is additive decoration over an already-rendered page.
   ============================================================ */
(function () {
  'use strict';

  var reduced = false;
  try { reduced = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var fine = false;
  try { fine = matchMedia('(hover:hover) and (pointer:fine)').matches; } catch (e) {}

  var GOLD = '#D4AF37';

  /* Homepage holds everything until the portal has finished, same
     gate fx3 and fx4 use so the layers stay in step. */
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
    setTimeout(function () { mo.disconnect(); go(); }, 20000);
  }

  function each(sel, fn, root) {
    var n = (root || document).querySelectorAll(sel);
    for (var i = 0; i < n.length; i++) fn(n[i], i);
  }
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  /* Everything HQ stamps is in Sydney time, whatever the operative's
     own clock says. Falls back to local if Intl is missing. */
  function aest() {
    try {
      return new Intl.DateTimeFormat('en-AU', {
        timeZone: 'Australia/Sydney', hour12: false,
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).format(new Date());
    } catch (e) { return '--:--:--'; }
  }
  /* position:relative only where it changes nothing else. A host that
     is already positioned keeps whatever it had. */
  function anchor(host, cls) {
    try {
      if (getComputedStyle(host).position === 'static') host.classList.add(cls);
    } catch (e) { host.classList.add(cls); }
  }

  /* ============================================================
     30. SURVEILLANCE
     Same image filter as fx4's SIGNAL LOCK so the two agree on
     what counts as a photo. Logos, crests and the portal are out.
     Timestamp only ticks while the pointer is actually over the
     photo — one interval, cleared on leave.
     ============================================================ */
  var SKIP_IMG = '.crest img, .logo img, .site-logo img, [class*="crest"] img,' +
                 '.portal-stage img, .hdr-logo img, .hdr-brand img, .hdr-lite-brand img';
  var CAM_TAGS = ['RC-SURV', 'BONEYARD CAM', 'FIELD UNIT', 'HQ INTERNAL', 'CRESTWOOD FEED'];

  function surveillance() {
    if (!fine) return; // hover-only effect; touch never sees it

    var skip = [];
    try { each(SKIP_IMG, function (n) { skip.push(n); }); } catch (e) {}

    var idx = 0;
    function consider(img) {
      if (skip.indexOf(img) !== -1) return;
      if (img.closest('.fx5-nocam')) return;
      var host = img.parentElement;
      if (!host || host === document.body) return;
      if (host.querySelector('.fx5-cam')) return;
      var bw = img.clientWidth || parseInt(img.getAttribute('width') || '0', 10);
      var bh = img.clientHeight || parseInt(img.getAttribute('height') || '0', 10);
      if (!bw) {
        // No box yet — the image has not arrived. Try again when it does.
        if (!img.complete) img.addEventListener('load', function () { consider(img); }, { once: true });
        return;
      }
      if (bw < 64) return;
      if (bh && bh < 90) return;
      // Decorative echoes are pointer-events:none — nothing can ever hover them.
      if (getComputedStyle(host).pointerEvents === 'none') return;

      idx++;
      var n = idx;
      var cam = el('div', 'fx5-cam');
      cam.setAttribute('aria-hidden', 'true');
      cam.innerHTML =
        '<i></i><i></i><i></i><i></i>' +
        '<b class="cam-id">CAM ' + pad(n) + ' · REC</b>' +
        '<b class="cam-time"></b>' +
        '<b class="cam-tag">' + CAM_TAGS[n % CAM_TAGS.length] + '</b>' +
        '<b class="cam-lvl">LVL ' + pad(1 + (n * 7) % 5) + ' · EYES ONLY</b>' +
        '<span class="cam-scan"></span>';
      anchor(host, 'fx5-camhost');
      host.classList.add('fx5-camhost');
      // A host that already carries its own badge (the drop photo's
      // clearance tag sits top-left) gets the HUD row moved to the foot.
      if (host.children.length > 1) cam.classList.add('is-busy');
      host.appendChild(cam);

      var t = cam.querySelector('.cam-time'), idEl = cam.querySelector('.cam-id'), timer = null;
      var label = 'CAM ' + pad(n) + ' \u00B7 REC';
      function tick() { t.textContent = aest() + ' AEST'; }
      host.addEventListener('mouseenter', function () {
        // Measure on entry, not at boot — lazy images have no height yet.
        var h = host.clientHeight || 240, w = host.clientWidth || 240;
        var tight = h < 150 || w < 200; // op portraits are ~78x150
        cam.classList.toggle('is-tight', tight);
        idEl.textContent = tight ? 'REC' : label;
        cam.style.setProperty('--fx5-h', h + 'px');
        tick();
        if (!timer) timer = setInterval(tick, 1000);
      });
      host.addEventListener('mouseleave', function () {
        if (timer) { clearInterval(timer); timer = null; }
      });
    }
    each('img', consider);
  }

  /* ============================================================
     31. CLEARANCE GAUGE
     Level = scroll depth in fifths. Pages shorter than ~1.6
     viewports never show it — a meter that cannot move is noise.
     Passive scroll listener, work throttled to one rAF.
     ============================================================ */
  function clearanceGauge() {
    if (document.querySelector('.fx5-gauge')) return;
    var doc = document.documentElement;
    function tall() { return (doc.scrollHeight || 0) > innerHeight * 1.6; }
    if (!tall()) return;

    var g = el('div', 'fx5-gauge');
    g.setAttribute('aria-hidden', 'true');
    g.innerHTML =
      '<span class="g-lbl">CLEARANCE</span>' +
      '<span class="g-pips"><i></i><i></i><i></i><i></i><i></i></span>' +
      '<span class="g-lvl">LVL 01</span>';
    document.body.appendChild(g);

    var pips = g.querySelectorAll('.g-pips i');
    var lvlEl = g.querySelector('.g-lvl');
    var level = 0, queued = false;

    function compute() {
      queued = false;
      var max = doc.scrollHeight - innerHeight;
      if (max <= 0) return;
      var p = Math.min(1, Math.max(0, (scrollY || doc.scrollTop) / max));
      var lv = Math.min(5, 1 + Math.floor(p * 5));
      if (lv === level) return;
      level = lv;
      for (var i = 0; i < pips.length; i++) pips[i].classList.toggle('lit', i < lv);
      lvlEl.textContent = 'LVL ' + pad(lv);
      if (!reduced) {
        lvlEl.classList.remove('is-relock');
        void lvlEl.offsetWidth; // restart the animation
        lvlEl.classList.add('is-relock');
      }
    }
    function onScroll() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(compute);
    }
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll);
    compute();
    // Fade in one frame later so the transition actually plays.
    requestAnimationFrame(function () { g.classList.add('is-on'); });
  }

  /* ============================================================
     32. SIGNAL TRACE
     A tiny scrolling oscilloscope. Baseline jitter with a heartbeat
     every ~1.8s; when the header status word changes (fx2 #20 does
     that every 4–8s) the trace throws a large spike so the two
     read as one instrument. ~30fps, pauses when the tab is hidden.
     ============================================================ */
  function signalTrace() {
    if (reduced) return;
    var status = document.querySelector('.hdr-lite-status') ||
                 document.querySelector('header .hdr-status');
    if (!status || status.querySelector('.fx5-trace')) return;
    var dot = status.querySelector('.dot');
    var word = status.querySelector('.status-word');

    var c = el('canvas', 'fx5-trace');
    c.setAttribute('aria-hidden', 'true');
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var W = 44, H = 14;
    c.width = W * dpr; c.height = H * dpr;
    var ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    status.insertBefore(c, dot || status.firstChild);

    var buf = new Array(W), head = 0, t = 0, spike = 0, beat = 0;
    for (var i = 0; i < W; i++) buf[i] = 0;

    // Trigger a spike whenever fx2 rewrites the status word.
    if (word && typeof MutationObserver === 'function') {
      new MutationObserver(function () { spike = 1; })
        .observe(word, { childList: true, characterData: true, subtree: true });
    }

    var last = 0, hidden = false, raf = 0;
    function sample() {
      t++;
      var v = (Math.random() - 0.5) * 0.18;         // noise floor
      beat++;
      if (beat > 54) { beat = 0; v += 0.55; }        // regular pulse
      else if (beat === 1) v -= 0.3;                 // its trough
      if (spike > 0) { v += spike * (Math.random() > 0.5 ? 1 : -1); spike -= 0.22; if (spike < 0) spike = 0; }
      buf[head] = Math.max(-1, Math.min(1, v));
      head = (head + 1) % W;
    }
    function draw(now) {
      raf = 0;
      if (hidden) return;
      if (now - last >= 33) {
        last = now;
        sample();
        ctx.clearRect(0, 0, W, H);
        ctx.strokeStyle = GOLD;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (var x = 0; x < W; x++) {
          var y = H / 2 - buf[(head + x) % W] * (H / 2 - 1);
          if (x === 0) ctx.moveTo(x + 0.5, y); else ctx.lineTo(x + 0.5, y);
        }
        ctx.stroke();
        // fade the tail so the line reads as a sweep, not a wall
        var grad = ctx.createLinearGradient(0, 0, W, 0);
        grad.addColorStop(0, 'rgba(11,11,15,.85)');
        grad.addColorStop(0.55, 'rgba(11,11,15,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
      }
      raf = requestAnimationFrame(draw);
    }
    function start() { if (!raf && !hidden) raf = requestAnimationFrame(draw); }
    document.addEventListener('visibilitychange', function () {
      hidden = document.hidden;
      if (!hidden) start();
    });
    // The canvas is display:none under 1100px — don't burn frames on it.
    var mq = null;
    try { mq = matchMedia('(max-width:1100px)'); } catch (e) {}
    function gate() {
      hidden = document.hidden || (mq && mq.matches);
      if (!hidden) start();
    }
    if (mq && mq.addEventListener) mq.addEventListener('change', gate);
    gate();
  }

  /* ============================================================
     34. EXFIL TOAST
     Purely observational — the clipboard is never touched. Fires
     for selections over 12 characters, at most once every 3s.
     ============================================================ */
  function exfilToast() {
    var toast = null, hideT = 0, lastAt = 0, count = 0;
    function show(chars) {
      if (!toast) {
        toast = el('div', 'fx5-toast');
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        document.body.appendChild(toast);
      }
      count++;
      toast.innerHTML =
        'EXFILTRATION LOGGED · ' + aest() + ' AEST' +
        '<small>' + chars + ' chars · incident ' + pad(count) + ' · HQ is aware</small>';
      clearTimeout(hideT);
      // force a frame between mount and .is-in so the transition runs
      toast.classList.remove('is-in');
      void toast.offsetWidth;
      toast.classList.add('is-in');
      hideT = setTimeout(function () { toast.classList.remove('is-in'); }, 2600);
    }
    document.addEventListener('copy', function () {
      var now = Date.now();
      if (now - lastAt < 3000) return;
      var s = '';
      try { s = String(window.getSelection ? getSelection() : ''); } catch (e) {}
      if (s.replace(/\s+/g, ' ').trim().length < 12) return;
      lastAt = now;
      show(s.length);
    });
  }

  /* ============================================================
     35. TARGET LOCK
     Runs on load (if there is a hash) and on every hashchange —
     the homepage nav links to #personnel, #tiers and #enlist so
     this fires a lot there. Brackets are injected, animated, and
     torn out 2s later so the DOM stays clean.
     ============================================================ */
  function targetLock() {
    var active = null, clearT = 0;
    function lock() {
      var id = (location.hash || '').slice(1);
      if (!id) return;
      var target = null;
      try { target = document.getElementById(decodeURIComponent(id)); } catch (e) {}
      if (!target) return;
      release();
      anchor(target, 'fx5-tlhost');
      var nodes = [];
      for (var i = 0; i < 4; i++) {
        var b = el('i', 'fx5-tl'); b.setAttribute('aria-hidden', 'true');
        target.appendChild(b); nodes.push(b);
      }
      active = { target: target, nodes: nodes };
      clearT = setTimeout(release, 2100);
    }
    function release() {
      clearTimeout(clearT);
      if (!active) return;
      active.nodes.forEach(function (n) { try { n.remove(); } catch (e) {} });
      active.target.classList.remove('fx5-tlhost');
      active = null;
    }
    addEventListener('hashchange', lock);
    // Same-hash clicks don't fire hashchange; catch those too.
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (a && a.getAttribute('href') === location.hash) setTimeout(lock, 60);
    });
    if (location.hash) setTimeout(lock, 400); // let scroll restoration land first
  }

  /* ============================================================
     37. TUBE FLICKER
     Picks one mono label currently on screen and dips it once.
     Every 18–40s. Never the same element twice running, never
     while the tab is hidden, never under reduced motion.
     ============================================================ */
  var TUBE_SEL = '[class*="kicker"], [class*="eyebrow"], [class*="-id"], [class*="-tag"],' +
                 '[class*="classification"], [class*="stamp"], .hdr-brand-txt small, .status-word';

  function tubeFlicker() {
    if (reduced) return;
    var lastEl = null;
    function candidates() {
      var out = [];
      each(TUBE_SEL, function (n) {
        if (n === lastEl) return;
        if (n.closest('.portal-stage, .hdr-drawer, .fx5-cam')) return;
        var r = n.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) return;
        if (r.bottom < 0 || r.top > innerHeight) return;
        var ff = '';
        try { ff = getComputedStyle(n).fontFamily; } catch (e) {}
        if (!/mono/i.test(ff)) return;
        if (!n.textContent.trim()) return;
        out.push(n);
      });
      return out;
    }
    function fire() {
      if (!document.hidden) {
        var c = candidates();
        if (c.length) {
          var n = c[Math.floor(Math.random() * c.length)];
          lastEl = n;
          n.classList.add('fx5-tube');
          setTimeout(function () { n.classList.remove('fx5-tube'); }, 600);
        }
      }
      schedule();
    }
    function schedule() { setTimeout(fire, 18000 + Math.random() * 22000); }
    schedule();
  }

  /* ============================================================
     38. SIGNAL LOST TAB
     The tab title goes dark when the visitor leaves and comes
     back when they do. Zero cost, and the one effect on this
     page most likely to get screenshotted.
     ============================================================ */
  function signalLostTab() {
    var original = document.title, swapped = false, t = 0;
    document.addEventListener('visibilitychange', function () {
      clearTimeout(t);
      if (document.hidden) {
        document.title = '\u25AA SIGNAL LOST \u00B7 RETURN TO HQ'; swapped = true;
      } else if (swapped) {
        document.title = '\u25AA SIGNAL RESTORED';
        t = setTimeout(function () { if (!document.hidden) { document.title = original; swapped = false; } }, 1400);
      }
    });
  }

  /* ============================================================
     BOOT — each effect isolated. One failure never cascades.
     ============================================================ */
  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    // Not tied to the page having rendered — safe before the portal.
    try { signalLostTab(); } catch (e) {}
    try { exfilToast(); } catch (e) {}
    whenEntered(function () {
      try { surveillance(); } catch (e) {}
      try { clearanceGauge(); } catch (e) {}
      try { signalTrace(); } catch (e) {}
      try { targetLock(); } catch (e) {}
      try { tubeFlicker(); } catch (e) {}
    });
  });
})();
