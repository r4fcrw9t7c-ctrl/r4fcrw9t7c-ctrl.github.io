/* Realm HQ · index.html
   Extracted from inline <script> so the CSP can drop script-src unsafe-inline. */

(function(){
  var form = document.getElementById('enlistForm');
  if (!form) return;
  var btn = document.getElementById('enlistSubmit');
  var fine = document.getElementById('enlistFine');
  var input = document.getElementById('enlistEmail');
  var hp = document.getElementById('enlistCompany');
  var ENLIST_URL = 'https://exujdeqbxjjqnigqphgr.supabase.co/functions/v1/enlist';
  var APIKEY = 'sb_publishable__NHmUVigcA0TziMQnZvB0A_kFTfZ1Kz';
  var loadedAt = Date.now();

  function setFine(msg, tone){
    if (!fine) return;
    fine.textContent = msg;
    fine.style.color = tone === 'ok' ? '#22D3EE' : tone === 'err' ? '#FF2B9C' : '';
  }

  form.addEventListener('submit', async function(e){
    e.preventDefault();
    var email = String(input.value || '').trim().toLowerCase();
    var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) { setFine('EMAIL FORMAT REJECTED. TRY AGAIN.', 'err'); return; }

    if (window.Realm) Realm.track('enlist_start', { source: 'index_enlist' });

    btn.disabled = true;
    var original = btn.innerHTML;
    btn.innerHTML = 'DISPATCHING...';
    setFine('SIGNAL IN TRANSIT...');

    var payload = {
      email: email,
      source: 'index_enlist',
      company: hp ? hp.value : '',
      elapsed_ms: Date.now() - loadedAt
    };
    var ref = window.Realm ? Realm.getReferral() : null;
    if (ref) payload.referred_by = ref;

    try {
      var res = await fetch(ENLIST_URL, {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'apikey': APIKEY },
        body: JSON.stringify(payload)
      });
      var body = await res.json().catch(function(){ return {}; });
      if (res.ok && body.ok) {
        btn.innerHTML = 'ACCESS APPLIED &#10003;';
        var confirmMsg = body.email_sent ? 'REGISTER UPDATED. CHECK INBOX FOR TRANSMISSION ' + (body.referral_code || '') + '.' : 'REGISTER UPDATED. HQ WILL SIGNAL WHEN THE NEXT DROP LANDS.';
        setFine(confirmMsg, 'ok');
        if (window.Realm) Realm.track('enlist_success', { source: 'index_enlist' });
        form.reset();
      } else {
        btn.disabled = false;
        btn.innerHTML = original;
        setFine('DESK REJECTED THE SIGNAL. TRY AGAIN OR EMAIL HQ.', 'err');
        if (window.Realm) Realm.track('enlist_error', { source: 'index_enlist', reason: 'rejected' });
      }
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = original;
      setFine('SIGNAL DROPPED. CHECK CONNECTION AND RETRY.', 'err');
      if (window.Realm) Realm.track('enlist_error', { source: 'index_enlist', reason: 'network' });
    }
  });
})();

// Live transmissions ticker · progressive enhancement over the static marquee.
(function(){
  var track = document.getElementById('feedTickerTrack');
  if (!track) return;
  var REST = 'https://exujdeqbxjjqnigqphgr.supabase.co/rest/v1';
  var APIKEY = 'sb_publishable__NHmUVigcA0TziMQnZvB0A_kFTfZ1Kz';
  var url = REST + '/transmissions?select=body,kind,pinned,sort&published=eq.true&order=pinned.desc,sort.asc&limit=24';
  fetch(url, { headers:{ 'apikey': APIKEY, 'Accept':'application/json' } })
    .then(function(r){ return r.ok ? r.json() : []; })
    .then(function(list){
      if (!Array.isArray(list) || !list.length) return; // keep static default
      var frag = document.createDocumentFragment();
      // Duplicate once so the marquee loop stays seamless.
      [].concat(list, list).forEach(function(t){
        var s = document.createElement('span');
        s.textContent = String(t.body || '').toUpperCase();
        frag.appendChild(s);
        var sep = document.createElement('span');
        sep.textContent = '+++';
        frag.appendChild(sep);
      });
      track.innerHTML = '';
      track.appendChild(frag);
    })
    .catch(function(){ /* keep static default */ });
})();
