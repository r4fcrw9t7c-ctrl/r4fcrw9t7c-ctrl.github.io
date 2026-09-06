/* Realm HQ · shop.html
   Extracted from inline <script> so the CSP can drop script-src unsafe-inline. */

(function(){
  // Price catalogue keyed by tier + cadence
  var PRICES = {
    jackal:          { monthly:{id:'price_1ToIyxJo6iTz2N7aWh5VOcnh', label:'$0.99', cad:'/mo AUD'}, annual:{id:'price_1ToIyxJo6iTz2N7aRC3y8mXl', label:'$9.90', cad:'/yr AUD'}, lifetime:{id:'price_1ToIyxJo6iTz2N7awuj6OHtk', label:'$24.75', cad:'one-off AUD'} },
    brute:           { monthly:{id:'price_1ToIywJo6iTz2N7aXu5j1Vmo', label:'$1.99', cad:'/mo AUD'}, annual:{id:'price_1ToIyxJo6iTz2N7asW7NlFhs', label:'$19.90', cad:'/yr AUD'}, lifetime:{id:'price_1ToIyyJo6iTz2N7au5MW2UbY', label:'$49.75', cad:'one-off AUD'} },
    elite:           { monthly:{id:'price_1ToIyyJo6iTz2N7aVD5uEVIi', label:'$3.49', cad:'/mo AUD'}, annual:{id:'price_1ToIyxJo6iTz2N7aHtX7Iq2V', label:'$34.90', cad:'/yr AUD'}, lifetime:{id:'price_1ToIyyJo6iTz2N7a0Slr2hYp', label:'$87.25', cad:'one-off AUD'} },
    realm_certified: { monthly:{id:'price_1ToIyyJo6iTz2N7aMP2cgVhw', label:'$5.49', cad:'/mo AUD'}, annual:{id:'price_1ToIyzJo6iTz2N7aZlbOj4bF', label:'$54.90', cad:'/yr AUD'}, lifetime:{id:'price_1ToIyzJo6iTz2N7a7nJxOFKF', label:'$137.25', cad:'one-off AUD'} }
  };

  var currentCadence = 'monthly';
  var toggleBtns = document.querySelectorAll('.toggle button');
  var tiers = document.querySelectorAll('.tier');

  function updateCadence(){
    tiers.forEach(function(t){
      var tier = t.dataset.tier;
      var data = PRICES[tier][currentCadence];
      var priceEl = t.querySelector('[data-price]');
      var cadEl = t.querySelector('[data-cadence-label]');
      var btn = t.querySelector('[data-checkout]');
      if (priceEl) priceEl.textContent = data.label;
      if (cadEl) cadEl.textContent = data.cad;
      if (btn) btn.dataset.priceId = data.id;
    });
  }

  toggleBtns.forEach(function(b){
    b.addEventListener('click', function(){
      toggleBtns.forEach(function(x){ x.classList.remove('active'); });
      b.classList.add('active');
      currentCadence = b.dataset.cadence;
      updateCadence();
    });
  });

  var toast = document.getElementById('toast');
  var toastTimer;
  function showToast(msg){
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ toast.classList.remove('show'); }, 4200);
  }

  var BASE = 'https://exujdeqbxjjqnigqphgr.supabase.co';
  var CHECKOUT_URL = BASE + '/functions/v1/checkout';
  var REST_URL = BASE + '/rest/v1';
  var APIKEY = 'sb_publishable__NHmUVigcA0TziMQnZvB0A_kFTfZ1Kz';

  async function startCheckout(priceId, btn){
    if (!priceId) return;
    btn.classList.add('loading');
    try {
      var res = await fetch(CHECKOUT_URL, {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'apikey': APIKEY },
        body: JSON.stringify({ price_id: priceId })
      });
      var data = await res.json();
      if (res.ok && data.url) { window.location.href = data.url; return; }
      if (res.status === 503) {
        showToast('CHECKOUT PENDING FINAL CONFIG · TRANSMIT ORDERS TO hq@shadowrealmhq.com');
      } else {
        showToast('CHECKOUT DESK BUSY · TRY AGAIN OR EMAIL HQ');
      }
    } catch (e) {
      showToast('SIGNAL DROPPED · CHECK CONNECTION AND RETRY');
    } finally {
      btn.classList.remove('loading');
    }
  }

  document.querySelectorAll('[data-checkout]').forEach(function(btn){
    btn.addEventListener('click', function(){ startCheckout(btn.dataset.priceId, btn); });
  });

  // ---- Merch catalogue (progressive enhancement) ----
  // Reads public.catalogue, which carries active, sold_out and unreleased rows.
  // Unreleased units are advertised honestly: no price id, no checkout.
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function money(cents, currency){
    var v = (Number(cents||0)/100).toFixed(2);
    return '$' + v + ' ' + String(currency||'aud').toUpperCase();
  }
  function renderMerch(products){
    var grid = document.getElementById('merchGrid');
    if (!grid) return;
    grid.innerHTML = '';
    products.forEach(function(p, i){
      var unit = String(i+1).padStart(2,'0');
      var soldOut = p.status === 'sold_out' || (p.inventory != null && p.inventory <= 0);
      var unreleased = p.status === 'unreleased';
      var buyable = !soldOut && !unreleased && p.status === 'active' && p.stripe_price_id;
      var state = soldOut ? 'FILED' : unreleased ? 'UNRELEASED' : 'ISSUED';
      var card = document.createElement('article');
      card.className = 'merch';
      var html =
        '<div class="merch-thumb">' + (p.image ? '' : esc(p.name).toUpperCase()) + '</div>'
        + '<h3 class="merch-title">' + esc(p.name) + '</h3>'
        + '<div class="merch-meta">FIELD KIT · UNIT ' + unit + ' · ' + state + '</div>'
        + '<div class="merch-price">' + money(p.price_cents, p.currency) + '</div>';
      if (buyable) {
        html += '<button class="merch-buy" data-price-id="' + esc(p.stripe_price_id) + '">Acquire unit</button>';
      } else if (soldOut) {
        html += '<div class="merch-status soldout">SOLD OUT · FILED IN THE BONEYARD</div>';
      } else if (unreleased) {
        html += '<div class="merch-status incoming">DROP INCOMING · NOT FOR SALE</div>';
      } else {
        html += '<button class="merch-buy" disabled>PENDING FINAL CONFIG</button>';
      }
      card.innerHTML = html;
      if (p.image) {
        var thumb = card.querySelector('.merch-thumb');
        thumb.style.backgroundImage = 'url(' + JSON.stringify(p.image).slice(1,-1) + ')';
        thumb.style.backgroundSize = 'cover';
        thumb.style.backgroundPosition = 'center';
      }
      grid.appendChild(card);
    });
    grid.querySelectorAll('.merch-buy[data-price-id]').forEach(function(b){
      b.addEventListener('click', function(){ startCheckout(b.dataset.priceId, b); });
    });
    var note = document.getElementById('merchNote');
    if (note) {
      var anyLive = products.some(function(p){ return p.status==='active' && p.stripe_price_id; });
      note.textContent = anyLive ? 'LIVE · NUMBERED RUNS' : 'CLASSIFIED · DROP INCOMING';
    }
  }
  (function loadMerch(){
    var url = REST_URL + '/catalogue?select=slug,name,description,price_cents,currency,stripe_price_id,image,status,inventory,sort&status=in.(active,sold_out,unreleased)&order=sort.asc';
    fetch(url, { headers:{ 'apikey': APIKEY, 'Accept':'application/json' } })
      .then(function(r){ return r.ok ? r.json() : []; })
      .then(function(list){ if (Array.isArray(list) && list.length) renderMerch(list); })
      .catch(function(){ /* keep static honest default */ });
  })();

  // Handle cancel return
  var qs = new URLSearchParams(window.location.search);
  if (qs.get('checkout') === 'cancelled') {
    showToast('CHECKOUT CANCELLED · NO CHARGE FILED');
  }
})();
  
