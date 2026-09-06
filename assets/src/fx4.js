/* ============================================================
   REALM HQ — FX v5 ENGINE
   Loads last, after fx3.js, on all 15 pages.

   25. EDGE TRACE   — pure CSS, no JS needed (see fx4.css)
   26. SIGNAL LOCK  — images acquire focus on entry
   27. ROW SCAN     — scanner sweep down list groups
   28. STAMP IMPACT — stamps land with weight
   29. SIBLING DIM  — pure CSS via :has() (see fx4.css)

   Same contract as fx3: every effect is feature-detected and
   isolated in try/catch at the boot call site, so one failure
   can never take the page down with it. Anything that hides an
   element to animate it in also carries a failsafe that forces
   it visible, because an invisible page is worse than a static
   one.
   ============================================================ */
(function () {
  'use strict';

  var reduced = false;
  try { reduced = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var hasIO = typeof IntersectionObserver === 'function';

  /* Homepage holds all scroll work until the portal has finished.
     Mirrors the gate in fx3 so the two layers stay in step. */
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
    setTimeout(function () { mo.disconnect(); go(); }, 20000); // never strand the page
  }

  function each(sel, fn, root) {
    var n = (root || document).querySelectorAll(sel);
    for (var i = 0; i < n.length; i++) fn(n[i], i);
  }

  /* ============================================================
     26. SIGNAL LOCK
     Images resolve out of blur on entry, like a camera acquiring
     the shot.

     Scope is deliberately narrow. fx2's MEDIA WIPE (#16) already
     owns every .fx-media photo, and stacking two entry effects on
     one image just looks indecisive — so those are skipped. What
     is left, and what this was really built for, is the personnel
     grid: surveillance portraits that until now had no entry of
     their own. Hence the low size floor; op portraits run about
     78x150 and still deserve the treatment.
     ============================================================ */
  var SKIP_IMG = '.crest img, .logo img, .site-logo img, [class*="crest"] img,' +
                 '.portal-stage img, .fx-media img, .hdr-logo img';

  function signalLock() {
    if (reduced || !hasIO) return;

    var skip = [];
    try { each(SKIP_IMG, function (n) { skip.push(n); }); } catch (e) {}

    var targets = [];
    each('img', function (img) {
      if (skip.indexOf(img) !== -1) return;
      if (img.closest('.fx4-nolock')) return;
      // Small assets read as broken when they arrive blurred.
      var w = img.getAttribute('width'), h = img.getAttribute('height');
      var bw = img.clientWidth || parseInt(w || '0', 10);
      var bh = img.clientHeight || parseInt(h || '0', 10);
      // Logos and inline badges only. Anything with real picture
      // area is fair game.
      if (bw && bw < 64) return;
      if (bh && bh < 90) return;
      targets.push(img);
    });
    if (!targets.length) return;

    // Hand the image back exactly as we found it. The keyframe ends
    // on opacity:1 with a `both` fill, so leaving the classes on
    // would permanently override any authored resting opacity or
    // hover state — the same trap that caught .field-stamp and
    // .hot-mutt-stamp over in STAMP IMPACT. Stripping the hooks also
    // releases the will-change layer.
    function settle(img) {
      img.classList.add('is-locked');
      var done = false;
      function fin() {
        if (done) return; done = true;
        img.classList.remove('is-locked');
        img.classList.remove('fx4-lock');
      }
      img.addEventListener('animationend', fin, { once: true });
      setTimeout(fin, 1400); // animation is 1050ms
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        settle(en.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });

    targets.forEach(function (img) {
      img.classList.add('fx4-lock');
      io.observe(img);
    });

    // FAILSAFE. If an observer never fires — bfcache oddity, a
    // display:none ancestor, a browser we did not anticipate —
    // force everything visible rather than leave a blank page.
    setTimeout(function () {
      targets.forEach(function (img) {
        if (img.classList.contains('fx4-lock') &&
            !img.classList.contains('is-locked')) {
          try { io.unobserve(img); } catch (e) {}
          settle(img);
        }
      });
    }, 4000);
  }

  /* ============================================================
     27. ROW SCAN
     Groups of sibling rows get read top to bottom by a light
     pass. One-shot per group; the observer releases immediately
     so nothing keeps ticking after the sweep.
     ============================================================ */
  /* .personnel-grid is absent on purpose — its portraits are
     handled by SIGNAL LOCK above, and running both would be two
     effects arguing over the same rows. */
  var SCAN_GROUPS = [
    '.trust-list', '.field-grid', '.tiers-grid',   // index
    '.merch-grid', '.tier-grid',                   // shop
    '.track-list',                                 // music
    '.contact-list', '.enlist-links'               // contact / access
  ];

  function rowScan() {
    if (reduced || !hasIO) return;

    var groups = [];
    SCAN_GROUPS.forEach(function (sel) {
      each(sel, function (g) { if (groups.indexOf(g) === -1) groups.push(g); });
    });
    // Policy, certification and lore pages are walls of prose with
    // no cards to animate. Their block wrappers hold p / .callout
    // children, so the scanner reads down the clauses instead.
    each('.body, .lore-body, .cert-body', function (g) {
      if (groups.indexOf(g) === -1) groups.push(g);
    });
    if (!groups.length) return;

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        var rows = en.target.children, n = Math.min(rows.length, 14);
        for (var i = 0; i < n; i++) {
          (function (row, idx) {
            setTimeout(function () {
              // Bail if the row went away mid-stagger.
              if (!row.isConnected) return;
              var bar = document.createElement('i');
              bar.className = 'fx4-scanbar';
              bar.setAttribute('aria-hidden', 'true');
              row.classList.add('fx4-scan');
              row.appendChild(bar);
              // Force a frame so the animation starts from the
              // declared position rather than being coalesced away.
              void bar.offsetWidth;
              row.classList.add('is-scan');
              // Tear the whole thing back out. Leaving an inert
              // absolutely-positioned child on every row of every
              // grid is exactly the sort of litter that turns into
              // a stacking-context bug three months later.
              setTimeout(function () {
                row.classList.remove('is-scan');
                row.classList.remove('fx4-scan');
                try { bar.remove(); } catch (e) {}
              }, 1100);
            }, 90 + idx * 78);
          })(rows[i], i);
        }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.15 });

    groups.forEach(function (g) { io.observe(g); });
  }

  /* ============================================================
     28. STAMP IMPACT

     Three stamps are deliberately absent from this list:

       .access-stamp   the portal sequence already animates it and
                       two owners would fight over the same node
       .field-stamp    rests at opacity 0 and is revealed by
                       .field-card:hover. Striking it in would nail
                       it permanently visible and kill the reveal.
       .hot-mutt-stamp rests at .72 (.62 on mobile) by design and
                       lifts to 1 on hover. Same problem.

     The lesson generalises, which is why strike() below tears its
     own classes off on completion: an entry animation must hand
     the element back exactly as it found it, not leave it pinned
     to whatever value the last keyframe happened to hold.
     ============================================================ */
  var STAMPS = '.footer-stamp, .roster-stamp, .stamp, .stamp-top';

  function stampImpact() {
    if (reduced || !hasIO) return;

    var targets = [];
    each(STAMPS, function (s) {
      if (s.closest('.portal-stage')) return;
      if (s.classList.contains('access-stamp')) return;
      if (s.classList.contains('field-stamp')) return;
      if (s.classList.contains('hot-mutt-stamp')) return;
      targets.push(s);
    });
    if (!targets.length) return;

    function release(s) {
      s.classList.remove('is-struck');
      s.classList.remove('fx4-stamp');
    }
    function strike(s) {
      s.classList.add('is-struck');
      var done = false;
      function fin() { if (done) return; done = true; release(s); }
      s.addEventListener('animationend', fin, { once: true });
      setTimeout(fin, 900); // animation is 620ms; this is the belt
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        strike(en.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.3 });

    targets.forEach(function (s) {
      s.classList.add('fx4-stamp');
      io.observe(s);
    });

    // Same failsafe contract as the images.
    setTimeout(function () {
      targets.forEach(function (s) {
        if (s.classList.contains('fx4-stamp') &&
            !s.classList.contains('is-struck')) {
          try { io.unobserve(s); } catch (e) {}
          strike(s);
        }
      });
    }, 4000);
  }

  /* ============================================================
     BOOT — each effect isolated. One failure never cascades.
     ============================================================ */
  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    whenEntered(function () {
      try { signalLock(); } catch (e) {}
      try { rowScan(); } catch (e) {}
      try { stampImpact(); } catch (e) {}
    });
  });
})();
