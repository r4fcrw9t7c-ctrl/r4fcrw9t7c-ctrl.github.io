/* Realm HQ · vault.html
   Extracted from inline <script> so the CSP can drop script-src unsafe-inline. */

(function(){
  var BASE = 'https://exujdeqbxjjqnigqphgr.supabase.co/functions/v1';
  var APIKEY = 'sb_publishable__NHmUVigcA0TziMQnZvB0A_kFTfZ1Kz';
  var SS_KEY = 'realm_session';
  var entriesEl = document.getElementById('entries');
  var gateEl = document.getElementById('gate');
  var statusBar = document.getElementById('statusBar');
  var statusText = document.getElementById('statusText');

  function getSession(){ try{ return localStorage.getItem(SS_KEY); }catch(e){ return null; } }
  function api(path, payload){
    return fetch(BASE + '/' + path, { method:'POST', headers:{ 'Content-Type':'application/json', 'apikey':APIKEY }, body: JSON.stringify(payload||{}) })
      .then(function(r){ return r.json().then(function(j){ return { status:r.status, body:j }; }); });
  }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function render(entries, entitled){
    entriesEl.innerHTML='';
    entries.forEach(function(e){
      var wrap=document.createElement('div'); wrap.className='entry';
      var full = entitled && e.body;
      wrap.innerHTML =
        '<div class="entry-head">'
        + '<span class="ref">'+esc(e.file_no||'FILE')+'</span>'
        + '<span class="title">'+esc(e.title)+'</span>'
        + '<span class="lock'+(full?' open':'')+'">'+(full?'OPEN':'SEALED')+'</span>'
        + '</div>'
        + '<div class="entry-body">'
        + '<p class="entry-teaser">'+esc(e.teaser)+'</p>'
        + (full
            ? '<div class="entry-full">'+esc(e.body)+'</div>'
            : '<div class="entry-locked">FULL FILE SEALED · requires <b>Vault access</b>. '
              + (e.min_tier==='realm_certified' ? 'Realm Certified clearance only.' : 'Elite clearance or two enlistments.')
              + '</div>')
        + '</div>';
      var head = wrap.querySelector('.entry-head');
      var body = wrap.querySelector('.entry-body');
      body.style.display='none';
      head.addEventListener('click', function(){ body.style.display = body.style.display==='none' ? 'block' : 'none'; });
      entriesEl.appendChild(wrap);
    });
  }

  var session = getSession();
  // Always load public teasers first so the page is useful with no session.
  api('vault', { action:'teasers' }).then(function(res){
    var teasers = (res.body && res.body.entries) || [];
    render(teasers, false);
    if(!session) return;
    // If signed in, try the entitled list.
    api('vault', { action:'list', session:session }).then(function(r2){
      if(r2.status===200 && r2.body.entitled){
        gateEl.classList.add('hidden');
        statusBar.classList.add('unsealed');
        statusText.textContent='VAULT UNSEALED · FULL FILES OPEN';
        render(r2.body.entries, true);
      }
    }).catch(function(){});
  }).catch(function(){
    entriesEl.innerHTML='<p class="lead">Archive desk unreachable. Retry shortly, or email HQ.</p>';
  });
})();
