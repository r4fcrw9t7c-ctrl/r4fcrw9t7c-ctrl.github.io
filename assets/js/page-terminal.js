/* Realm HQ · terminal.html
   Extracted from inline <script> so the CSP can drop script-src unsafe-inline. */

(function(){
  var BASE = 'https://exujdeqbxjjqnigqphgr.supabase.co/functions/v1';
  var APIKEY = 'sb_publishable__NHmUVigcA0TziMQnZvB0A_kFTfZ1Kz';
  var SITE = location.origin;
  var SS_KEY = 'realm_session';
  var loadedAt = Date.now();

  function api(path, payload){
    return fetch(BASE + '/' + path, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'apikey': APIKEY },
      body: JSON.stringify(payload || {})
    }).then(function(r){ return r.json().then(function(j){ return { status:r.status, body:j }; }); });
  }
  function show(id){ document.getElementById(id).classList.remove('hidden'); }
  function hide(id){ document.getElementById(id).classList.add('hidden'); }
  function setMsg(id, text, tone){ var el=document.getElementById(id); el.textContent=text||''; el.className='msg'+(tone?(' '+tone):''); }
  function getSession(){ try{ return localStorage.getItem(SS_KEY); }catch(e){ return null; } }
  function setSession(t){ try{ localStorage.setItem(SS_KEY, t); }catch(e){} }
  function clearSession(){ try{ localStorage.removeItem(SS_KEY); }catch(e){} }

  // ---- Request link ----
  var reqForm = document.getElementById('reqForm');
  reqForm.addEventListener('submit', function(e){
    e.preventDefault();
    var email = document.getElementById('email').value.trim().toLowerCase();
    var company = reqForm.querySelector('[name=company]').value;
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ setMsg('reqMsg','ENTER A VALID LINE.','err'); return; }
    var btn=document.getElementById('reqBtn'); btn.disabled=true; setMsg('reqMsg','TRANSMITTING...');
    api('magic-link', { email:email, company:company, elapsed_ms: Date.now()-loadedAt }).then(function(res){
      // Generic success regardless · never reveal whether the line exists.
      setMsg('reqMsg','IF THAT LINE IS ON THE REGISTER, A LINK IS INBOUND. CHECK YOUR MAIL.','ok');
    }).catch(function(){ setMsg('reqMsg','SIGNAL DROPPED. RETRY.','err'); btn.disabled=false; });
  });

  // ---- Render dashboard ----
  function render(m){
    hide('requestPanel'); hide('verifyPanel'); show('dashPanel');
    document.getElementById('tierTag').textContent = 'CLEARANCE · ' + String(m.tier||'').toUpperCase().replace('_',' ');
    document.getElementById('dashHello').textContent = m.username ? ('Operative ' + m.username + '.') : 'Operative record.';
    document.getElementById('mEmail').textContent = m.email || '·';
    var ownerLink = document.getElementById('ownerCommandLink');
    if (m.is_admin && !ownerLink) {
      ownerLink = document.createElement('a');
      ownerLink.id = 'ownerCommandLink'; ownerLink.href = '/admin'; ownerLink.className = 'btn ghost';
      ownerLink.textContent = 'HQ COMMAND · OWNER';
      document.getElementById('dashPanel').appendChild(ownerLink);
    }
    if (!m.is_admin && ownerLink) ownerLink.remove();
    document.getElementById('mTier').textContent = String(m.tier||'grunt').toUpperCase().replace('_',' ');
    document.getElementById('mVault').textContent = m.vault_access ? 'UNSEALED' : 'SEALED';
    document.getElementById('mVault').className = 'v' + (m.vault_access ? ' gold':'');
    document.getElementById('mSince').textContent = m.member_since ? new Date(m.member_since).toISOString().slice(0,10) : '·';

    var code = m.referral_code || '·';
    var codeEl = document.getElementById('mCode'); codeEl.textContent = code;
    var shareLink = SITE + '/?ref=' + encodeURIComponent(code);
    codeEl.onclick = function(){ navigator.clipboard && navigator.clipboard.writeText(code); };
    document.getElementById('copyLink').onclick = function(){
      if(navigator.clipboard){ navigator.clipboard.writeText(shareLink); setMsg('dashMsg','SHARE LINK COPIED.','ok'); }
    };
    var count = m.referral_count||0, need = m.referral_needed_for_vault;
    document.getElementById('mProg').style.width = Math.min(100, (count/2)*100) + '%';
    document.getElementById('mRefText').textContent = m.vault_access
      ? (count>=2 ? (count + ' enlistments logged. Vault unsealed by referral.') : 'Vault unsealed on your clearance tier.')
      : (count + ' of 2 enlistments logged. ' + need + ' more unseals the Vault for free.');

    var vaultPanel=document.getElementById('vaultPanel');
    if(m.vault_access){
      document.getElementById('vaultHead').textContent='Vault unsealed.';
      document.getElementById('vaultText').textContent='Your clearance is cleared for the Vault. Look, log, and leave.';
    } else {
      document.getElementById('vaultHead').textContent='Vault sealed.';
      document.getElementById('vaultText').textContent='Reach Elite clearance or log two enlistments to unseal the Vault.';
      document.getElementById('vaultBtn').classList.add('hidden');
    }

    var billingPanel=document.getElementById('billingPanel');
    if(!m.has_billing){ document.getElementById('billingBtn').classList.add('hidden'); }
    if(m.moderation_status === 'suspended'){
      document.getElementById('vaultHead').textContent = 'Access suspended.';
      document.getElementById('vaultText').textContent = 'HQ has suspended restricted access. Your payment plan is unchanged. Billing and cancellation remain available below. Contact HQ for a review.';
      document.getElementById('mRefText').textContent = 'Restricted access is suspended. Referrals do not override moderation.';
    }
  }

  document.getElementById('logoutBtn').addEventListener('click', function(){
    var s=getSession(); api('session',{ action:'logout', session:s }).catch(function(){});
    clearSession(); location.href='terminal';
  });
  document.getElementById('billingBtn').addEventListener('click', function(){
    var s=getSession(); if(!s) return;
    setMsg('dashMsg','OPENING BILLING PORTAL...');
    api('billing-portal',{ session:s }).then(function(res){
      if(res.status===200 && res.body.url){ location.href=res.body.url; return; }
      if(res.body.code==='unconfigured'){ setMsg('dashMsg','BILLING PORTAL NOT YET CONFIGURED. EMAIL HQ.','err'); }
      else if(res.body.code==='no_customer'){ setMsg('dashMsg','NO BILLING ACCOUNT ON THIS LINE.','err'); }
      else { setMsg('dashMsg','BILLING DESK BUSY. RETRY.','err'); }
    }).catch(function(){ setMsg('dashMsg','SIGNAL DROPPED. RETRY.','err'); });
  });

  // ---- Boot: verify token from magic link, else resume session ----
  var qs = new URLSearchParams(location.search);
  var token = qs.get('token'), email = qs.get('email');
  if(token && email){
    hide('requestPanel'); show('verifyPanel');
    api('session',{ action:'verify', token:token, email:email.toLowerCase() }).then(function(res){
      if(res.status===200 && res.body.session){
        setSession(res.body.session);
        history.replaceState({}, '', 'terminal');
        render(res.body.member);
      } else {
        hide('verifyPanel'); show('requestPanel');
        setMsg('reqMsg', (res.body && res.body.error ? res.body.error.toUpperCase() : 'LINK EXPIRED') + '. REQUEST A NEW LINK.','err');
      }
    }).catch(function(){ hide('verifyPanel'); show('requestPanel'); setMsg('reqMsg','SIGNAL DROPPED. RETRY.','err'); });
  } else {
    var s = getSession();
    if(s){
      api('session',{ action:'me', session:s }).then(function(res){
        if(res.status===200 && res.body.member){ render(res.body.member); }
        else { clearSession(); }
      }).catch(function(){});
    }
  }
})();
