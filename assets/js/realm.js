/* =========================================================
   Realm HQ · shared client runtime
   - Canonical clearance / membership model (single source)
   - Provider-neutral analytics event layer (safe no-op)
   - Referral (?ref=) capture and attribution
   Loaded on every page. No secrets. No private data.
   ========================================================= */
(function (window, document) {
  'use strict';

  /* -------------------------------------------------------
     1. CANONICAL CLEARANCE / MEMBERSHIP MODEL
     One shared config consumed by Home, Shop, Quiz, Access,
     Certification, Terminal and Vault. Lore ranks and paid
     plans are ONE linked system: the paid tier sets the
     operative's standing clearance; the quiz proposes a rank
     but does not grant paid entitlements.
     ------------------------------------------------------- */
  var TIERS = {
    grunt: {
      key: 'grunt', name: 'Grunt', clearance: 0, paid: false,
      vault: false, blurb: 'Enlisted, unpaid. On the register, not yet cleared.'
    },
    jackal: {
      key: 'jackal', name: 'Jackal', clearance: 1, paid: true,
      vault: false, blurb: 'Entry clearance. Transmissions and drop calls.'
    },
    brute: {
      key: 'brute', name: 'Brute', clearance: 2, paid: true,
      vault: false, blurb: 'Standing clearance. Early drop access.'
    },
    elite: {
      key: 'elite', name: 'Elite', clearance: 3, paid: true,
      vault: true, blurb: 'Vault access unsealed. Priority drops.'
    },
    realm_certified: {
      key: 'realm_certified', name: 'Realm Certified', clearance: 4, paid: true,
      vault: true, blurb: 'Top classification. Full Vault, priority everything.'
    }
  };
  var TIER_ORDER = ['grunt', 'jackal', 'brute', 'elite', 'realm_certified'];
  // Referral unlock: two confirmed enlistments unseals Vault for a free operative.
  var REFERRAL_VAULT_THRESHOLD = 2;

  function tier(key) { return TIERS[key] || TIERS.grunt; }
  function hasVault(key, referralCount) {
    if (tier(key).vault) return true;
    return (referralCount || 0) >= REFERRAL_VAULT_THRESHOLD;
  }

  /* -------------------------------------------------------
     2. ANALYTICS EVENT LAYER (provider-neutral, safe no-op)
     Configure by setting, before this script loads:
       window.REALM_ANALYTICS = { provider: 'plausible'|'ga4'|'none', id: '...' };
     If no provider/id is set, events are collected into
     window.__realmEvents and logged when ?debug=analytics.
     Never send private personal data (no email, no name).
     ------------------------------------------------------- */
  window.REALM_ANALYTICS = window.REALM_ANALYTICS || { provider: 'plausible', id: 'shadowrealmhq.com' };
  var cfg = window.REALM_ANALYTICS;
  var DEBUG = /(^|[?&])debug=analytics(&|$)/.test(window.location.search);
  window.__realmEvents = window.__realmEvents || [];

  // Plausible is cookieless and carries no personal data. The stub queues custom
  // events fired before the script lands, so Realm.track never drops one.
  function loadPlausible(domain) {
    if (!domain || document.querySelector('script[data-realm-analytics]')) return;
    window.plausible = window.plausible || function () {
      (window.plausible.q = window.plausible.q || []).push(arguments);
    };
    var s = document.createElement('script');
    s.defer = true;
    s.src = 'https://plausible.io/js/script.js';
    s.setAttribute('data-domain', domain);
    s.setAttribute('data-realm-analytics', '');
    (document.head || document.documentElement).appendChild(s);
  }
  if (cfg.provider === 'plausible') loadPlausible(cfg.id);

  var ALLOWED = {
    portal_enter: 1, nav_select: 1, enlist_start: 1, enlist_success: 1,
    enlist_error: 1, referral_detected: 1, quiz_start: 1, quiz_complete: 1,
    quiz_share: 1, cadence_select: 1, checkout_start: 1, checkout_complete: 1,
    checkout_cancel: 1, terminal_login_request: 1, terminal_login_complete: 1,
    vault_file_open: 1, referral_share: 1, billing_portal_open: 1,
    product_view: 1, merch_purchase: 1
  };
  // Keys that must never carry PII; drop anything not whitelisted per event.
  var SAFE_PROP_KEYS = { tier: 1, cadence: 1, product: 1, sku: 1, variant: 1,
    file: 1, code_present: 1, source: 1, reason: 1, method: 1 };

  function sanitize(props) {
    var out = {};
    if (!props) return out;
    Object.keys(props).forEach(function (k) {
      if (SAFE_PROP_KEYS[k]) out[k] = props[k];
    });
    return out;
  }

  function track(event, props) {
    if (!ALLOWED[event]) {
      if (DEBUG) console.warn('[realm-analytics] unknown event dropped:', event);
      return;
    }
    var clean = sanitize(props);
    var record = { event: event, props: clean, t: Date.now() };
    window.__realmEvents.push(record);
    if (DEBUG) console.log('[realm-analytics]', event, clean);

    try {
      if (cfg.provider === 'plausible' && typeof window.plausible === 'function') {
        window.plausible(event, { props: clean });
      } else if (cfg.provider === 'ga4' && typeof window.gtag === 'function') {
        window.gtag('event', event, clean);
      }
      // provider 'none' -> collected only (safe no-op)
    } catch (e) {
      if (DEBUG) console.warn('[realm-analytics] provider error', e);
    }
  }

  /* -------------------------------------------------------
     3. REFERRAL CAPTURE
     Read ?ref=CODE, validate format, persist for the visit,
     expose for enlistment as referred_by, show a restrained
     in-brand acknowledgement.
     ------------------------------------------------------- */
  var REF_RE = /^RC-[A-Z0-9]{4,12}$/;
  var REF_KEY = 'realm_ref';

  function normaliseRef(v) {
    if (!v) return null;
    var c = String(v).trim().toUpperCase();
    return REF_RE.test(c) ? c : null;
  }

  function captureReferral() {
    var params = new URLSearchParams(window.location.search);
    var fromUrl = normaliseRef(params.get('ref'));
    if (fromUrl) {
      try { sessionStorage.setItem(REF_KEY, fromUrl); } catch (e) {}
      try { localStorage.setItem(REF_KEY, fromUrl); } catch (e) {}
      track('referral_detected', { code_present: true });
      acknowledge(fromUrl);
      return fromUrl;
    }
    return getReferral();
  }

  function getReferral() {
    var v = null;
    try { v = sessionStorage.getItem(REF_KEY); } catch (e) {}
    if (!v) { try { v = localStorage.getItem(REF_KEY); } catch (e) {} }
    return normaliseRef(v);
  }

  function acknowledge(code) {
    if (document.getElementById('refAck')) return;
    var el = document.createElement('div');
    el.id = 'refAck';
    el.className = 'ref-ack';
    el.setAttribute('role', 'status');
    el.innerHTML = 'REFERRAL LOGGED · ' + code +
      '<button type="button" class="ref-ack-x" aria-label="Dismiss">✕</button>';
    function mount() {
      document.body.appendChild(el);
      var x = el.querySelector('.ref-ack-x');
      if (x) x.addEventListener('click', function () { el.remove(); });
      setTimeout(function () { if (el.parentNode) el.remove(); }, 9000);
    }
    if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
  }

  /* -------------------------------------------------------
     Public surface
     ------------------------------------------------------- */
  window.Realm = {
    tiers: TIERS,
    tierOrder: TIER_ORDER,
    tier: tier,
    hasVault: hasVault,
    referralVaultThreshold: REFERRAL_VAULT_THRESHOLD,
    track: track,
    getReferral: getReferral,
    captureReferral: captureReferral
  };

  // Auto-capture on load.
  captureReferral();
})(window, document);
