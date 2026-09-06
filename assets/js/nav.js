/* =========================================================
   Realm HQ · shared header nav runtime
   Mobile drawer (open/close, ESC, focus trap), nav analytics,
   and the REALM STATUS shuffle. Loaded on every page; every
   block no-ops when its markup is absent.
   ========================================================= */
(function () {
  'use strict';

  // Mobile drawer
  var burger = document.getElementById('hdrBurger');
  var drawer = document.getElementById('hdrDrawer');
  if (burger && drawer) {
    var closeBtn = drawer.querySelector('.hdr-drawer-close');
    var FOCUSABLE = 'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])';
    var lastFocused = null;

    var focusables = function () {
      return Array.prototype.slice.call(drawer.querySelectorAll(FOCUSABLE))
        .filter(function (el) { return el.offsetParent !== null; });
    };

    var openDrawer = function () {
      lastFocused = document.activeElement;
      drawer.classList.add('is-open');
      drawer.setAttribute('aria-hidden', 'false');
      burger.setAttribute('aria-expanded', 'true');
      document.body.classList.add('drawer-open');
      var first = focusables()[0];
      if (first) setTimeout(function () { first.focus(); }, 250);
    };
    var closeDrawer = function () {
      drawer.classList.remove('is-open');
      drawer.setAttribute('aria-hidden', 'true');
      burger.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('drawer-open');
      (lastFocused && lastFocused.focus ? lastFocused : burger).focus();
    };
    burger.addEventListener('click', function () {
      if (drawer.classList.contains('is-open')) closeDrawer(); else openDrawer();
    });
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);

    // ESC to close + Tab focus trap while open
    document.addEventListener('keydown', function (e) {
      if (!drawer.classList.contains('is-open')) return;
      if (e.key === 'Escape') { closeDrawer(); return; }
      if (e.key === 'Tab') {
        var items = focusables();
        if (!items.length) return;
        var first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    // Close when a nav link is clicked
    drawer.querySelectorAll('.hdr-drawer-nav a').forEach(function (a) {
      a.addEventListener('click', function () { setTimeout(closeDrawer, 100); });
    });
  }

  // Analytics: nav selection (no PII, just the label)
  document.querySelectorAll('.hdr-nav a, .hdr-drawer-nav a').forEach(function (a) {
    a.addEventListener('click', function () {
      if (window.Realm) window.Realm.track('nav_select', { source: (a.textContent || '').trim().toLowerCase().slice(0, 24) });
    });
  });

  // REALM STATUS shuffle
  var statusWord = document.getElementById('statusWord');
  if (statusWord && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // Page-appropriate starting word is already in HTML. Extend the pool per page context.
    var pools = {
      default: ['ONLINE', 'MONITORING', 'COOKED', 'AWAKE', 'RECEIVING'],
      signal: ['RECEIVING', 'MONITORING', 'COOKED', 'ONLINE', 'AWAKE'],
      intake: ['OPEN', 'MONITORING', 'AWAKE', 'COOKED', 'ONLINE'],
      desk: ['OPEN', 'MONITORING', 'AWAKE', 'COOKED', 'ONLINE']
    };
    var labelEl = statusWord.parentElement && statusWord.parentElement.querySelector('.label-full');
    var labelFull = (labelEl && labelEl.textContent) || '';
    var pool = pools.default;
    if (/SIGNAL/i.test(labelFull)) pool = pools.signal;
    else if (/INTAKE/i.test(labelFull)) pool = pools.intake;
    else if (/DESK/i.test(labelFull)) pool = pools.desk;
    var idx = 0;
    setInterval(function () {
      statusWord.classList.add('fading');
      setTimeout(function () {
        idx = (idx + 1) % pool.length;
        statusWord.textContent = pool[idx];
        statusWord.classList.remove('fading');
      }, 320);
    }, 8000);
  }
})();
