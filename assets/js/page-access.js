/* Realm HQ · access.html
   Extracted from inline <script> so the CSP can drop script-src unsafe-inline. */

// ---- Post-checkout activation state machine ----
// States: preview | verifying | pending | confirmed | cancelled | expired | failed
// "confirmed" is rendered ONLY after the server (activate → Stripe) verifies a
// paid, register-written session. Direct visits and fabricated query params can
// never reach confirmed: an absent or malformed session_id yields the neutral
// preview recovery state (non-confirmation copy + Terminal and Shop links),
// and any real verification runs entirely server-side.
(function(){
  var BASE = 'https://exujdeqbxjjqnigqphgr.supabase.co/functions/v1';
  var APIKEY = 'sb_publishable__NHmUVigcA0TziMQnZvB0A_kFTfZ1Kz';
  var SESSION_RE = /^cs_[A-Za-z0-9_]+$/;
  var qs = new URLSearchParams(location.search);
  var rawSession = qs.get('session_id') || '';
  // Only a well-formed Stripe checkout session id is trusted. Anything else is
  // treated as no session at all (fabricated params are ignored, not honoured).
  var sessionId = SESSION_RE.test(rawSession) ? rawSession : null;
  var cancelled = qs.get('checkout') === 'cancelled';
  var actEl = document.getElementById('activate');
  var cardHead = document.getElementById('cardHead');
  var titleEl = document.getElementById('actTitle');
  var bodyEl = document.getElementById('actBody');
  var statusEl = document.getElementById('actStatus');
  var actionsEl = document.getElementById('actActions');
  var tagEl = document.getElementById('actTag');

  function link(href, label, primary){
    var a=document.createElement('a'); a.href=href; a.textContent=label;
    a.className='btn'+(primary?' primary':''); return a;
  }
  function shopLink(label){ return link('shop.html', label || 'Return to the Shop'); }
  function emailLink(){ return link('mailto:realmcertified@gmail.com','Email HQ'); }
  function setTag(t){ tagEl.textContent = t; }

  // The card-draft tool is always available. The panel is always shown too:
  // with no real session (direct visit or malformed session_id) it renders a
  // neutral recovery state with Terminal + Shop links, never confirmation.
  cardHead.classList.remove('hidden');
  actEl.classList.remove('hidden');

  function preview(){
    setTag('CLEARANCE DESK');
    titleEl.textContent = 'No active checkout to confirm.';
    bodyEl.textContent = 'This desk confirms a clearance once you return from checkout. You did not arrive from a payment, so there is nothing to verify here. Manage an existing clearance from the Terminal, or view the clearance tiers in the Shop.';
    statusEl.className='status'; statusEl.textContent='AWAITING CHECKOUT';
    actionsEl.innerHTML='';
    actionsEl.appendChild(link('terminal','Open the Terminal', true));
    actionsEl.appendChild(link('shop.html','View clearance tiers'));
  }
  function confirmed(m){
    setTag('CLEARANCE');
    titleEl.textContent = 'Clearance active.';
    bodyEl.textContent = 'Your line is on the register at ' + (m.tier ? String(m.tier).toUpperCase().replace(/_/g,' ') : 'REALM') + ' standing. A confirmation transmission is on its way.';
    statusEl.className='status';
    statusEl.innerHTML = 'ACTIVATED' + (m.vault_access ? ' · VAULT UNSEALED' : '');
    actionsEl.innerHTML='';
    actionsEl.appendChild(link('terminal','Open the Terminal', true));
    if(m.vault_access) actionsEl.appendChild(link('vault.html','Enter the Vault'));
  }
  function pending(){
    setTag('ACTIVATION');
    titleEl.textContent = 'Payment received.';
    bodyEl.textContent = 'HQ is posting your clearance to the register. This usually lands within a minute.';
  }
  function unpaid(){
    setTag('ACTIVATION');
    titleEl.textContent = 'Payment not confirmed.';
    bodyEl.textContent = 'Stripe has not confirmed this payment. If you were charged, email HQ and it will be reconciled by hand.';
    statusEl.className='status err'; statusEl.textContent='UNCONFIRMED';
    actionsEl.innerHTML=''; actionsEl.appendChild(shopLink()); actionsEl.appendChild(emailLink());
  }
  function cancelledState(){
    setTag('CHECKOUT');
    titleEl.textContent = 'Checkout cancelled.';
    bodyEl.textContent = 'No charge was filed. The desk is still open whenever the frequencies align.';
    statusEl.className='status'; statusEl.textContent='NO CHARGE FILED';
    actionsEl.innerHTML=''; actionsEl.appendChild(shopLink('Back to the Shop')); actionsEl.appendChild(link('index.html','Return to HQ'));
  }
  function expired(){
    setTag('CHECKOUT');
    titleEl.textContent = 'Checkout expired.';
    bodyEl.textContent = 'This checkout session lapsed before payment, so no charge was filed. Start a fresh enlistment from the Shop.';
    statusEl.className='status err'; statusEl.textContent='SESSION EXPIRED';
    actionsEl.innerHTML=''; actionsEl.appendChild(shopLink('Start again')); actionsEl.appendChild(emailLink());
  }
  function failed(msg){
    setTag('ACTIVATION');
    titleEl.textContent = 'Could not confirm automatically.';
    bodyEl.textContent = 'Your payment may still have gone through. HQ receives every checkout and will reconcile it. ' + (msg||'');
    statusEl.className='status err'; statusEl.textContent='MANUAL REVIEW';
    actionsEl.innerHTML='';
    actionsEl.appendChild(link('terminal','Open the Terminal', true));
    actionsEl.appendChild(shopLink());
    actionsEl.appendChild(emailLink());
  }

  // No real session: a cancel return shows the cancelled state; anything else
  // (direct visit or malformed session_id) shows the neutral recovery state.
  if(!sessionId){ if(cancelled){ cancelledState(); } else { preview(); } return; }

  var attempts = 0, MAX = 6;
  function poll(){
    attempts++;
    fetch(BASE + '/activate', {
      method:'POST', headers:{ 'Content-Type':'application/json', 'apikey':APIKEY },
      body: JSON.stringify({ session_id: sessionId })
    }).then(function(r){ return r.json().then(function(j){ return {status:r.status, body:j}; }); })
      .then(function(res){
        var b = res.body || {};
        if(res.status===200 && b.state==='active'){ confirmed(b); return; }
        if(res.status===200 && b.state==='unpaid'){ unpaid(); return; }
        if(res.status===200 && b.state==='expired'){ expired(); return; }
        if(res.status===200 && b.state==='processing'){
          pending();
          if(attempts<MAX){ statusEl.innerHTML='<span class="spin"></span> Posting clearance… ('+attempts+')'; setTimeout(poll, 2500); }
          else { failed(); }
          return;
        }
        if(b.code==='unconfigured'){ failed('Checkout verification is not yet configured on this environment.'); return; }
        if(attempts<MAX){ setTimeout(poll, 2500); } else { failed(); }
      })
      .catch(function(){ if(attempts<MAX){ setTimeout(poll, 2500); } else { failed(); } });
  }
  poll();
})();

(function(){
  var canvas = document.getElementById('cardCanvas');
  var ctx = canvas.getContext('2d');
  var W = canvas.width, H = canvas.height;

  // Randomised ID persists in memory only (sandbox blocks storage)
  function makeId(){
    var seg = function(n){ var s = ''; var chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; for(var i=0;i<n;i++){ s+=chars[Math.floor(Math.random()*chars.length)]; } return s; };
    return 'RC-' + seg(3) + '-' + seg(4);
  }
  var currentId = makeId();

  function drawCard(){
    var name = (document.getElementById('opName').value || 'OPERATIVE').toUpperCase();
    var callsign = (document.getElementById('opCallsign').value || '').toUpperCase();
    var clearance = document.getElementById('opClear').value;
    var cell = document.getElementById('opCell').value;
    var clearanceLabel = {'1':'01 · JACKAL','2':'02 · BRUTE','3':'03 · ELITE','4':'04 · SPECIAL OP','5':'05 · REALM CERTIFIED'}[clearance] || '05 · REALM CERTIFIED';

    // Bg
    var grad = ctx.createLinearGradient(0,0,W,H);
    grad.addColorStop(0, '#0e0d15');
    grad.addColorStop(1, '#14111c');
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,W,H);

    // Scanlines
    ctx.fillStyle = 'rgba(255,255,255,0.018)';
    for(var y=0;y<H;y+=4){ ctx.fillRect(0,y,W,1); }

    // Subtle vertical rays
    ctx.fillStyle = 'rgba(255,255,255,0.012)';
    for(var x=0;x<W;x+=8){ ctx.fillRect(x,0,1,H); }

    // Border
    ctx.strokeStyle = 'rgba(212,175,55,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(20,20,W-40,H-40);

    // Inner dashed
    ctx.strokeStyle = 'rgba(212,175,55,0.22)';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([6,4]);
    ctx.strokeRect(38,38,W-76,H-76);
    ctx.setLineDash([]);

    // Top bar
    ctx.fillStyle = '#D4AF37';
    ctx.font = 'bold 24px "JetBrains Mono", monospace';
    ctx.textBaseline = 'top';
    ctx.fillText('REALM HQ · ACCESS CARD', 60, 60);

    ctx.fillStyle = '#a8a8a8';
    ctx.font = '20px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText('CLASSIFIED · INTERNAL', W-60, 60);
    ctx.textAlign = 'left';

    // Divider
    ctx.strokeStyle = 'rgba(212,175,55,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(60, 100); ctx.lineTo(W-60, 100);
    ctx.stroke();

    // Left column - big name
    ctx.fillStyle = '#F5F1E8';
    ctx.font = '600 88px "Cormorant Garamond", serif';
    ctx.fillText(name.slice(0,20), 60, 148);

    if (callsign) {
      ctx.fillStyle = '#D4AF37';
      ctx.font = 'italic 40px "Cormorant Garamond", serif';
      ctx.fillText('"' + callsign.slice(0,14) + '"', 60, 260);
    }

    // Meta rows
    var metaY = 340;
    var rowH = 62;
    var labels = [
      ['CLEARANCE', clearanceLabel],
      ['ASSIGNED CELL', cell],
      ['ID NUMBER', currentId],
      ['STATUS', clearance === '5' ? 'ACTIVE · CERTIFIED' : 'PENDING · UNVERIFIED']
    ];

    labels.forEach(function(pair, i){
      var y = metaY + i * rowH;
      ctx.fillStyle = '#6b6b6b';
      ctx.font = '18px "JetBrains Mono", monospace';
      ctx.fillText(pair[0], 60, y);

      ctx.fillStyle = pair[0] === 'CLEARANCE' ? '#D4AF37' : '#F5F1E8';
      ctx.font = 'bold 24px "JetBrains Mono", monospace';
      ctx.fillText(pair[1], 60, y + 24);

      // Row divider
      ctx.strokeStyle = 'rgba(212,175,55,0.15)';
      ctx.setLineDash([4,3]);
      ctx.beginPath();
      ctx.moveTo(60, y + rowH - 6);
      ctx.lineTo(W-60, y + rowH - 6);
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // Right side seal
    var sx = W - 280, sy = 148;
    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(sx+100, sy+100, 96, 0, Math.PI*2); ctx.stroke();
    ctx.setLineDash([3,3]);
    ctx.beginPath(); ctx.arc(sx+100, sy+100, 82, 0, Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#D4AF37';
    ctx.font = 'bold 20px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('EST', sx+100, sy+82);
    ctx.font = 'italic 40px "Cormorant Garamond", serif';
    ctx.fillText('DAY 5', sx+100, sy+96);
    ctx.font = '14px "JetBrains Mono", monospace';
    ctx.fillStyle = '#a8a8a8';
    ctx.fillText('REALM HQ', sx+100, sy+152);
    ctx.textAlign = 'left';

    // Barcode/signal block
    ctx.fillStyle = 'rgba(212,175,55,0.55)';
    var bx = W - 280, by = sy + 240;
    for(var i=0;i<40;i++){
      var w = 2 + Math.floor(Math.random()*6);
      ctx.fillRect(bx + i*6, by, Math.min(w,4), 60);
    }

    // Footer bar
    ctx.fillStyle = '#6b6b6b';
    ctx.font = '18px "JetBrains Mono", monospace';
    ctx.fillText('ISSUED · REALM HQ · EST DAY 5', 60, H - 68);
    ctx.textAlign = 'right';
    ctx.fillText('CLASSIFICATION: COOKED', W-60, H-68);
    ctx.textAlign = 'left';
  }

  var inputs = ['opName','opCallsign','opClear','opCell'];
  inputs.forEach(function(id){
    document.getElementById(id).addEventListener('input', drawCard);
    document.getElementById(id).addEventListener('change', drawCard);
  });

  var toast = document.getElementById('toast');
  var toastTimer;
  function showToast(msg){
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ toast.classList.remove('show'); }, 3400);
  }

  document.getElementById('btnRandom').addEventListener('click', function(){
    currentId = makeId();
    drawCard();
    showToast('NEW ID ISSUED · ' + currentId);
  });

  document.getElementById('btnDownload').addEventListener('click', function(){
    drawCard();
    try {
      var link = document.createElement('a');
      var slug = (document.getElementById('opName').value || 'operative').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,32);
      link.download = 'realm-hq-access-' + (slug || 'operative') + '.png';
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('CARD FILED · CHECK DOWNLOADS');
    } catch (e) {
      showToast('EXPORT FAILED · TRY AGAIN');
    }
  });

  // Ensure fonts load before first draw
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(drawCard);
  }
  drawCard();
})();
  
