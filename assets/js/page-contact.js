/* Realm HQ · contact.html
   Extracted from inline <script> so the CSP can drop script-src unsafe-inline. */

(function () {
  var form = document.getElementById('contactForm');
  if (!form) return;
  var btn = document.getElementById('contactSubmit');
  var status = document.getElementById('contactStatus');
  var CONTACT_URL = 'https://exujdeqbxjjqnigqphgr.supabase.co/functions/v1/contact';
  var APIKEY = 'sb_publishable__NHmUVigcA0TziMQnZvB0A_kFTfZ1Kz';
  var loadedAt = Date.now();

  function setStatus(msg, tone){
    if (!status) return;
    status.textContent = msg;
    status.style.color = tone === 'ok' ? '#22D3EE' : tone === 'err' ? '#FF2B9C' : '';
  }

  form.addEventListener('submit', async function(e){
    e.preventDefault();
    var data = new FormData(form);
    var name = String(data.get('Name') || '').trim();
    var email = String(data.get('Email') || '').trim().toLowerCase();
    var type = String(data.get('Subject') || 'General enquiry').trim();
    var message = String(data.get('Message') || '').trim();
    var company = String(data.get('company') || '').trim();

    var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!name || !emailOk || message.length < 2) {
      setStatus('MISSING FIELDS. NAME, EMAIL, MESSAGE ALL REQUIRED.', 'err');
      return;
    }

    btn.disabled = true;
    var original = btn.innerHTML;
    btn.innerHTML = 'DISPATCHING...';
    setStatus('SIGNAL IN TRANSIT...');

    try {
      var res = await fetch(CONTACT_URL, {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'apikey': APIKEY },
        body: JSON.stringify({ name: name, email: email, message: message, type: type, company: company, elapsed_ms: Date.now() - loadedAt })
      });
      var body = await res.json().catch(function(){ return {}; });
      if (res.ok && body.ok) {
        btn.innerHTML = 'TRANSMISSION LOGGED &#10003;';
        setStatus('LOGGED IN THE REGISTER. HQ WILL READ IT NEXT SWEEP.', 'ok');
        form.reset();
      } else {
        btn.disabled = false;
        btn.innerHTML = original;
        setStatus('DESK REJECTED THE TRANSMISSION. TRY AGAIN OR EMAIL HQ.', 'err');
      }
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = original;
      setStatus('SIGNAL DROPPED. CHECK CONNECTION AND RETRY.', 'err');
    }
  });
})();
