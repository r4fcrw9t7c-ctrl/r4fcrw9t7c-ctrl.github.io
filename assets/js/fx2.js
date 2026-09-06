/* =========================================================
   REALM HQ — FX ENGINE v2
   Targeting reticle, signal interference, section brackets,
   stagger cascades, click pulses, glyph scramble, media wipes.
   Runs after fx.js. Every routine is independently wrapped:
   a failure in one never takes the page down.
   ========================================================= */
(function () {
  'use strict';

  var reduced = false;
  try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var isTouch = false;
  try { isTouch = window.matchMedia('(pointer: coarse)').matches; } catch (e) {}

  var docEl = document.documentElement;

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  }

  function pad(n) { var s = String(Math.abs(Math.round(n))); while (s.length < 4) s = '0' + s; return s; }

  /* =======================================================
     12. TARGETING RETICLE
     ======================================================= */
  function reticle() {
    if (reduced || isTouch) return;
    if (window.innerWidth < 900) return;

    var r = document.createElement('div');
    r.id = 'fxRet';
    r.setAttribute('aria-hidden', 'true');
    r.innerHTML = '<i></i><i></i><i></i><i></i><u></u><b></b>';
    document.body.appendChild(r);
    var label = r.querySelector('b');

    var tx = window.innerWidth / 2, ty = window.innerHeight / 2;
    var cx = tx, cy = ty;
    var live = false, raf = 0;
    var LOCK = 'a, button, [role="button"], input, textarea, select, summary, .btn, .cta, label';

    function loop() {
      cx += (tx - cx) * 0.34;
      cy += (ty - cy) * 0.34;
      r.style.transform = 'translate3d(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px,0)';
      raf = requestAnimationFrame(loop);
    }

    document.addEventListener('mousemove', function (e) {
      tx = e.clientX; ty = e.clientY;
      if (!live) {
        live = true;
        r.classList.add('is-live');
        docEl.classList.add('fx-reticle');
        cx = tx; cy = ty;
        raf = requestAnimationFrame(loop);
      }
      label.textContent = 'X' + pad(e.clientX) + ' Y' + pad(e.clientY);
      var t = e.target && e.target.closest ? e.target.closest(LOCK) : null;
      r.classList.toggle('is-lock', !!t);
    }, { passive: true });

    document.addEventListener('mousedown', function () { r.classList.add('is-down'); }, { passive: true });
    document.addEventListener('mouseup', function () { r.classList.remove('is-down'); }, { passive: true });

    document.addEventListener('mouseleave', function () {
      r.classList.remove('is-live');
    }, { passive: true });
    document.addEventListener('mouseenter', function () {
      if (live) r.classList.add('is-live');
    }, { passive: true });

    /* never strand the visitor without a pointer */
    window.addEventListener('blur', function () { docEl.classList.remove('fx-reticle'); r.classList.remove('is-live'); });
    window.addEventListener('focus', function () { if (live) { docEl.classList.add('fx-reticle'); r.classList.add('is-live'); } });
    window.addEventListener('resize', function () {
      if (window.innerWidth < 900) { docEl.classList.remove('fx-reticle'); r.classList.remove('is-live'); if (raf) cancelAnimationFrame(raf); raf = 0; live = false; }
    }, { passive: true });
  }

  /* =======================================================
     13. SIGNAL INTERFERENCE — rare transmission fault
     ======================================================= */
  var FAULTS = [
    'SIGNAL INTERFERENCE',
    'TRANSMISSION UNSTABLE',
    'CARRIER LOST · RETRYING',
    'REALM HQ · PACKET DROP',
    'UNAUTHORISED LISTENER?',
    'RE-ESTABLISHING LINK'
  ];

  function interference() {
    if (reduced) return;

    var n = document.createElement('div');
    n.id = 'fxNoise';
    n.setAttribute('aria-hidden', 'true');
    n.innerHTML =
      '<span class="fx-static"></span>' +
      '<span class="fx-tear"></span>' +
      '<span class="fx-tear"></span>' +
      '<span class="fx-tear"></span>' +
      '<span class="fx-fault"></span>';
    document.body.appendChild(n);

    var tears = n.querySelectorAll('.fx-tear');
    var fault = n.querySelector('.fx-fault');
    var timer = 0;

    function fire() {
      if (document.hidden) return schedule();
      for (var i = 0; i < tears.length; i++) {
        tears[i].style.setProperty('--t', (8 + Math.random() * 78).toFixed(1) + '%');
        tears[i].style.setProperty('--h', (8 + Math.random() * 34).toFixed(0) + 'px');
      }
      fault.textContent = FAULTS[Math.floor(Math.random() * FAULTS.length)];
      n.classList.remove('is-fire');
      /* force reflow so the animation can restart */
      void n.offsetWidth;
      n.classList.add('is-fire');
      setTimeout(function () { n.classList.remove('is-fire'); }, 600);
      schedule();
    }

    function schedule() {
      clearTimeout(timer);
      /* rare on purpose — a fault you notice, not a strobe you resent */
      timer = setTimeout(fire, 52000 + Math.random() * 68000);
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) clearTimeout(timer); else schedule();
    });

    setTimeout(fire, 19000 + Math.random() * 14000);
  }

  /* =======================================================
     13b. COVERAGE BOOST — reveal blocks on document pages
     that use no <section> markup (lore files, policies,
     certification), which the v1 engine skips entirely.
     ======================================================= */
  function boost() {
    if (reduced) return;
    if (document.querySelectorAll('.fx-sec').length) return;
    if (document.getElementById('portalStage')) return;

    var host = document.querySelector('main') ||
               document.querySelector('.lore-wrap') ||
               document.querySelector('.wrap');
    if (!host || host.dataset.fxBoost) return;
    host.dataset.fxBoost = '1';

    var vh = window.innerHeight || 800;
    var kids = [];

    function collect(parent, depth) {
      var cs = parent.children;
      for (var i = 0; i < cs.length; i++) {
        var c = cs[i];
        var tag = c.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'LINK' || tag === 'BR') continue;
        if (c.id === 'fxVeil' || c.id === 'fxRet' || c.id === 'fxNoise') continue;
        var r = c.getBoundingClientRect();
        if (r.height < 26) continue;
        /* a tall wrapper is a container, not a block: go one level in */
        if (depth < 2 && r.height > vh * 1.15 && c.children.length > 1) { collect(c, depth + 1); continue; }
        kids.push(c);
      }
    }
    collect(host, 0);

    if (kids.length < 2) return;
    if (kids.length > 34) kids = kids.slice(0, 34);

    for (var i = 0; i < kids.length; i++) {
      var el = kids[i];
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
      el.classList.add('fx-sec');
      el.setAttribute('data-fx-stagger', '1');
      el.style.setProperty('--fx-d', ((i % 5) * 80) + 'ms');
    }

    function showAll() { kids.forEach(function (n) { n.classList.add('fx-in'); }); }

    if (!('IntersectionObserver' in window)) { showAll(); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('fx-in');
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -5% 0px', threshold: 0.06 });
    kids.forEach(function (n) { io.observe(n); });

    /* safety net: nothing is ever left invisible */
    setTimeout(showAll, 4500);
  }

  /* =======================================================
     14. SECTION CORNER BRACKETS
     ======================================================= */
  function brackets() {
    if (reduced) return;
    var secs = document.querySelectorAll('section.fx-sec, article.fx-sec, .section.fx-sec');
    for (var i = 0; i < secs.length; i++) {
      var s = secs[i];
      if (s.dataset.fxBr) continue;
      var rect = s.getBoundingClientRect();
      if (rect.height < 260 || rect.width < 320) continue;
      s.dataset.fxBr = '1';
      if (getComputedStyle(s).position === 'static') s.style.position = 'relative';
      var b = document.createElement('span');
      b.className = 'fx-brackets';
      b.setAttribute('aria-hidden', 'true');
      b.innerHTML = '<i></i><i></i><i></i><i></i>';
      s.appendChild(b);
    }
  }

  /* =======================================================
     15. STAGGER CASCADE — sibling groups arrive in sequence
     ======================================================= */
  function stagger() {
    if (reduced) return;
    var groups = {};
    var els = document.querySelectorAll('.fx-sec');
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var p = el.parentElement;
      if (!p) continue;
      var key = p.getAttribute('data-fx-gkey');
      if (!key) { key = 'g' + i + '-' + Math.random().toString(36).slice(2, 7); p.setAttribute('data-fx-gkey', key); }
      (groups[key] = groups[key] || []).push(el);
    }
    Object.keys(groups).forEach(function (k) {
      var list = groups[k];
      if (list.length < 2 || list.length > 12) return;
      for (var j = 0; j < list.length; j++) {
        list[j].setAttribute('data-fx-stagger', '1');
        list[j].style.setProperty('--fx-d', (j * 95) + 'ms');
      }
    });
  }

  /* =======================================================
     16. MEDIA WIPE
     ======================================================= */
  function media() {
    if (reduced) return;
    var imgs = document.querySelectorAll('img, video');
    var list = [];
    for (var i = 0; i < imgs.length; i++) {
      var im = imgs[i];
      if (im.closest('#fxVeil') || im.closest('#fxRet')) continue;
      if (im.dataset.fxMedia) continue;
      var r = im.getBoundingClientRect();
      /* only worthwhile on real imagery, not crests, icons or logos */
      if (r.width < 220 || r.height < 150) continue;
      if (im.closest('.fx-crest')) continue;
      var wrap = im.parentElement;
      if (!wrap) continue;
      im.dataset.fxMedia = '1';
      wrap.classList.add('fx-media');
      list.push(wrap);
    }
    if (!list.length) return;
    if (!('IntersectionObserver' in window)) {
      list.forEach(function (n) { n.classList.add('fx-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('fx-in');
        io.unobserve(en.target);
      });
    }, { threshold: 0.2 });
    list.forEach(function (n) { io.observe(n); });
    setTimeout(function () { list.forEach(function (n) { n.classList.add('fx-in'); }); }, 5000);
  }

  /* =======================================================
     17. CLICK PULSE
     ======================================================= */
  function pulses() {
    if (reduced || isTouch) return;
    document.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      var p = document.createElement('span');
      p.className = 'fx-pulse';
      p.setAttribute('aria-hidden', 'true');
      p.style.left = e.clientX + 'px';
      p.style.top = e.clientY + 'px';
      document.body.appendChild(p);
      setTimeout(function () { if (p.parentNode) p.parentNode.removeChild(p); }, 800);
    }, { passive: true });
  }

  /* =======================================================
     18. GLYPH SCRAMBLE on nav hover
     ======================================================= */
  var GLYPH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&$@/\\<>*+=';

  function scramble(el) {
    if (el.dataset.fxRunning) return;
    var final = el.dataset.fxText || el.textContent;
    el.dataset.fxText = final;
    el.dataset.fxRunning = '1';
    el.classList.add('fx-busy');
    var len = final.length;
    var frame = 0;
    function step() {
      var out = '';
      var settled = 0;
      for (var i = 0; i < len; i++) {
        var ch = final[i];
        if (ch === ' ') { out += ' '; settled++; continue; }
        if (frame / 1.7 - i * 0.7 > 2.2) { out += ch; settled++; }
        else out += GLYPH[(Math.random() * GLYPH.length) | 0];
      }
      el.textContent = out;
      frame++;
      if (settled >= len) {
        el.textContent = final;
        el.classList.remove('fx-busy');
        delete el.dataset.fxRunning;
        return;
      }
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function scrambles() {
    if (reduced || isTouch) return;
    var links = document.querySelectorAll(
      'nav a, .nav a, header a, .site-nav a, .menu a, .hdr-drawer-nav a, ' +
      '.back, footer a, .foot a, .site-foot a'
    );
    for (var i = 0; i < links.length; i++) {
      (function (a) {
        if (a.childElementCount > 0) return;
        var txt = a.textContent.trim();
        if (!txt || txt.length > 24) return;
        if (a.dataset.fxScram) return;
        a.dataset.fxScram = '1';
        a.classList.add('fx-scram');
        a.addEventListener('mouseenter', function () {
          /* lock the width on first hover — measured live, because nav
             links can start life inside a closed drawer at zero width */
          if (!a.dataset.fxW) {
            var w = a.getBoundingClientRect().width;
            if (w) {
              a.dataset.fxW = '1';
              a.style.display = 'inline-block';
              a.style.minWidth = Math.ceil(w) + 'px';
            }
          }
          scramble(a);
        });
      })(links[i]);
    }
  }

  /* =======================================================
     BOOT — run after fx.js has classified the page
     ======================================================= */

  /* =======================================================
     19. HEADER STATUS SHUFFLE
     ======================================================= */
  function status() {
    var el = document.querySelector('[data-fx-status]');
    if (!el || reduced) return;
    var words = [
      'RECEIVING', 'COOKED', 'REALM CERTIFIED', 'HOT MUTT', 'CLASSIFIED',
      'EST DAY 5', 'SIGNAL HELD', 'BONEYARD LIVE', 'NUTTAR WATER', 'EYES ONLY'
    ];
    var i = 0, timer;

    function tick() {
      if (document.hidden) { timer = setTimeout(tick, 6000); return; }
      el.classList.add('is-fading');
      setTimeout(function () {
        i = (i + 1 + Math.floor(Math.random() * 3)) % words.length;
        el.textContent = words[i];
        el.classList.remove('is-fading');
      }, 300);
      timer = setTimeout(tick, 4200 + Math.random() * 3600);
    }
    timer = setTimeout(tick, 5000);
  }

  /* =======================================================
     20. HEADER CONDENSE + SCROLL DEPTH BAR
     ======================================================= */
  function header() {
    var hdr = document.getElementById('hdrLite');
    var bar = document.getElementById('hdrDepth');
    if (!hdr && !bar) return;
    var ticking = false;

    function paint() {
      ticking = false;
      var y = window.pageYOffset || docEl.scrollTop || 0;
      if (hdr) hdr.classList.toggle('is-stuck', y > 90);
      if (bar) {
        var max = (document.body.scrollHeight || 0) - window.innerHeight;
        var p = max > 40 ? Math.min(1, Math.max(0, y / max)) : 0;
        bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
      }
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(paint); }
    }, { passive: true });
    window.addEventListener('resize', paint, { passive: true });
    paint();
  }

  /* =======================================================
     21. CURSOR EMBER TRAIL
     ======================================================= */
  function embers() {
    if (reduced || isTouch) return;
    if (window.innerWidth < 900) return;
    var last = 0, live = 0, px = 0, py = 0;

    document.addEventListener('mousemove', function (e) {
      var now = Date.now();
      var dx = e.clientX - px, dy = e.clientY - py;
      px = e.clientX; py = e.clientY;
      /* only while actually moving, and never more than a handful at once */
      if (now - last < 70 || live > 13) return;
      if (dx * dx + dy * dy < 26) return;
      last = now; live++;

      var s = document.createElement('span');
      s.className = 'fx-ember';
      s.style.left = (e.clientX + (Math.random() * 8 - 4)).toFixed(0) + 'px';
      s.style.top = (e.clientY + (Math.random() * 8 - 4)).toFixed(0) + 'px';
      document.body.appendChild(s);
      setTimeout(function () {
        if (s.parentNode) s.parentNode.removeChild(s);
        live--;
      }, 950);
    }, { passive: true });
  }

  /* =======================================================
     22. POWER-ON SWEEP
     ======================================================= */
  function poweron() {
    if (reduced) return;
    if (!('IntersectionObserver' in window)) return;
    var sel = '.field-card, .op-card, .tier, .tier-card, .contact-card, ' +
              '.drop-photo, .lore-term, .callout, .vault-card, .track-card';
    var cards = document.querySelectorAll(sel);
    if (!cards.length) return;

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var c = en.target;
        io.unobserve(c);
        var sweep = c.querySelector(':scope > .fx-pwr');
        if (!sweep) return;
        setTimeout(function () {
          sweep.classList.add('is-run');
          setTimeout(function () {
            if (sweep.parentNode) sweep.parentNode.removeChild(sweep);
          }, 1200);
        }, Math.random() * 220);
      });
    }, { threshold: 0.25 });

    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      if (c.dataset.fxPwr) continue;
      var r = c.getBoundingClientRect();
      if (r.width < 120 || r.height < 80) continue;
      c.dataset.fxPwr = '1';
      if (getComputedStyle(c).position === 'static') c.style.position = 'relative';
      var sw = document.createElement('span');
      sw.className = 'fx-pwr';
      sw.setAttribute('aria-hidden', 'true');
      sw.innerHTML = '<i></i>';
      c.appendChild(sw);
      io.observe(c);
    }
  }

  /* =======================================================
     23. IDLE PROMPT
     ======================================================= */
  function idle() {
    if (reduced || isTouch) return;
    var el = document.createElement('div');
    el.id = 'fxIdle';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<em>OPERATIVE IDLE \u00b7 </em>AWAITING INPUT<s></s>';
    document.body.appendChild(el);

    var timer;
    function arm() {
      el.classList.remove('is-on');
      clearTimeout(timer);
      timer = setTimeout(function () {
        if (!document.hidden) el.classList.add('is-on');
      }, 62000);
    }
    ['mousemove', 'keydown', 'wheel', 'touchstart', 'click', 'focusin']
      .forEach(function (ev) {
        document.addEventListener(ev, arm, { passive: true });
      });
    document.addEventListener('visibilitychange', arm);
    arm();
  }

  /* =======================================================
     24. PAGE EXIT TRANSITION
     ======================================================= */
  function exits() {
    if (reduced) return;
    if (!('animate' in Element.prototype)) return;

    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (!a) return;
      if (a.target && a.target !== '_self') return;
      if (a.hasAttribute('download')) return;
      var href = a.getAttribute('href') || '';
      if (!href || href.charAt(0) === '#') return;
      if (/^(mailto:|tel:|javascript:)/i.test(href)) return;

      var url;
      try { url = new URL(a.href, location.href); } catch (err) { return; }
      if (url.origin !== location.origin) return;
      /* same page, different hash: let the browser scroll */
      if (url.pathname === location.pathname && url.hash) return;

      e.preventDefault();
      docEl.classList.add('fx-exit');
      var went = false;
      function go() { if (!went) { went = true; location.href = a.href; } }
      setTimeout(go, 270);
      /* never strand the visitor if the animation stalls */
      setTimeout(go, 900);
    });

    /* bfcache restore must not leave the page faded out */
    window.addEventListener('pageshow', function () {
      docEl.classList.remove('fx-exit');
    });
  }

  /* =======================================================
     BOOT
     ======================================================= */
  ready(function () {
    try { reticle(); } catch (e) {}
    try { interference(); } catch (e) {}
    try { pulses(); } catch (e) {}
    try { scrambles(); } catch (e) {}
    try { status(); } catch (e) {}
    try { header(); } catch (e) {}
    try { embers(); } catch (e) {}
    try { idle(); } catch (e) {}
    try { exits(); } catch (e) {}

    /* these depend on fx.js having tagged .fx-sec, so give it a beat.
       On the homepage the portal delays that, hence the second pass. */
    function second() {
      try { boost(); } catch (e) {}
      try { brackets(); } catch (e) {}
      try { stagger(); } catch (e) {}
      try { media(); } catch (e) {}
      try { poweron(); } catch (e) {}
    }
    setTimeout(second, 260);
    setTimeout(second, 1400);

    var portal = document.getElementById('portalStage');
    if (portal && !document.body.classList.contains('is-entered')) {
      var mo = new MutationObserver(function () {
        if (document.body.classList.contains('is-entered')) {
          mo.disconnect();
          setTimeout(second, 700);
        }
      });
      mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }
  });
})();
