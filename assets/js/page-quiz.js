/* Realm HQ · quiz.html
   Extracted from inline <script> so the CSP can drop script-src unsafe-inline. */

// ============ QUIZ ENGINE ============
const QUESTIONS = [
  {
    q: "Field call. It's 3:17am, you're on the Great Flats of Bungonia. What's in the bottle?",
    options: [
      { l: "Sparkling water. Hydration first.", correct: false },
      { l: "Nuttar water. Obviously.", correct: true },
      { l: "Whatever Max left in the ute.", correct: false },
      { l: "Nothing. I don't drink on ops.", correct: false }
    ]
  },
  {
    q: "You've been asked when Shadow Realm was established. Correct response?",
    options: [
      { l: "Officially unofficial · founded when it needed to be.", correct: false },
      { l: "EST Day 5. Anyone claiming Day 4 is fabricating.", correct: true },
      { l: "Somewhere around late Crestwood era.", correct: false },
      { l: "That information is above your clearance.", correct: false }
    ]
  },
  {
    q: "Realm Hunting protocol. You spot something worth hunting. First move?",
    options: [
      { l: "Post it. Content first, hunt second.", correct: false },
      { l: "Radio Crawfish. Confirm coordinates.", correct: false },
      { l: "File it under the Boneyard. Return at 3:17am.", correct: true },
      { l: "Full send. Ask questions later.", correct: false }
    ]
  },
  {
    q: "Someone in public says the phrase HOT MUTT. Correct reaction?",
    options: [
      { l: "Politely ignore. Not everyone's cleared.", correct: false },
      { l: "Respond with CLASSIFICATION: COOKED and walk off.", correct: true },
      { l: "Ask them to explain the joke.", correct: false },
      { l: "Call it in as a possible leak.", correct: false }
    ]
  },
  {
    q: "The Man With The Crooked Eye is in the pub. What do you do?",
    options: [
      { l: "Nothing. He was never there.", correct: true },
      { l: "Buy him a drink. Rules are rules.", correct: false },
      { l: "Take a photo for the Vault.", correct: false },
      { l: "Radio it in immediately.", correct: false }
    ]
  },
  {
    q: "Someone asks what Realm Certified actually means. Approved answer?",
    options: [
      { l: "It's a lifestyle standard. Look it up.", correct: false },
      { l: "A wearable clearance level. Merch-backed.", correct: false },
      { l: "If you have to ask, you already aren't.", correct: true },
      { l: "It's a bit complicated · I can send a PDF.", correct: false }
    ]
  }
];

const STATE = {
  index: 0,
  answers: new Array(QUESTIONS.length).fill(null),
  photoDataUrl: null,
  name: ""
};

// Elements
const $ = (id) => document.getElementById(id);
const quizPanel = $("quizPanel");
const identityPanel = $("identityPanel");
const certPanel = $("certPanel");

function renderQuestion() {
  const item = QUESTIONS[STATE.index];
  $("quizStep").textContent = "QUESTION " + String(STATE.index + 1).padStart(2, "0") + " / 06";
  $("quizBar").style.width = ((STATE.index) / QUESTIONS.length * 100) + "%";
  $("quizQTitle").textContent = item.q;

  const opts = $("quizOptions");
  opts.innerHTML = "";
  const letters = ["A", "B", "C", "D"];
  item.options.forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "quiz-option";
    btn.setAttribute("data-letter", letters[i]);
    btn.textContent = opt.l;
    if (STATE.answers[STATE.index] === i) btn.classList.add("is-selected");
    btn.addEventListener("click", () => {
      STATE.answers[STATE.index] = i;
      [...opts.children].forEach(c => c.classList.remove("is-selected"));
      btn.classList.add("is-selected");
      $("quizNext").disabled = false;
    });
    opts.appendChild(btn);
  });

  $("quizBack").disabled = STATE.index === 0;
  $("quizNext").disabled = STATE.answers[STATE.index] === null;
  $("quizNext").textContent = STATE.index === QUESTIONS.length - 1 ? "Submit answers →" : "Next →";
}

$("quizBack").addEventListener("click", () => {
  if (STATE.index > 0) { STATE.index--; renderQuestion(); }
});
$("quizNext").addEventListener("click", () => {
  if (STATE.answers[STATE.index] === null) return;
  if (STATE.index < QUESTIONS.length - 1) {
    STATE.index++;
    renderQuestion();
  } else {
    // Move to identity step
    quizPanel.hidden = true;
    identityPanel.hidden = false;
    window.scrollTo({ top: identityPanel.offsetTop - 60, behavior: "smooth" });
  }
});

// Identity step
$("identityBack").addEventListener("click", () => {
  identityPanel.hidden = true;
  quizPanel.hidden = false;
  renderQuestion();
  window.scrollTo({ top: quizPanel.offsetTop - 60, behavior: "smooth" });
});

function checkIdentityReady() {
  const hasName = ($("quizName").value || "").trim().length >= 2;
  $("identitySubmit").disabled = !hasName;
}

$("quizName").addEventListener("input", checkIdentityReady);

$("quizPhoto").addEventListener("change", (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    STATE.photoDataUrl = ev.target.result;
    const preview = $("quizPreview");
    preview.style.backgroundImage = "url(" + STATE.photoDataUrl + ")";
    $("quizUpload").classList.add("has-image");
    $("quizUploadLabel").textContent = "PHOTO LOCKED IN · TAP TO REPLACE";
  };
  reader.readAsDataURL(file);
});

$("identitySubmit").addEventListener("click", () => {
  STATE.name = ($("quizName").value || "").trim().toUpperCase();
  issueCertificate();
});

function issueCertificate() {
  // Score
  let score = 0;
  STATE.answers.forEach((ans, i) => {
    if (ans !== null && QUESTIONS[i].options[ans].correct) score++;
  });

  let status, desc, classification, level;
  if (score >= 6) {
    level = "LEVEL 05";
    status = "REALM CERTIFIED · EST DAY 5";
    classification = "COOKED";
    desc = "Top clearance. Registered under EST Day 5 protocol. Direct line to Realm HQ. Priority merch, unreleased transmissions, and Crestwood weather updates whether you want them or not. Carry the crest in public without hesitation.";
  } else if (score >= 5) {
    level = "LEVEL 04";
    status = "REALM CERTIFIED";
    classification = "COOKED";
    desc = "Cleared for full Realm activity. Boneyard access granted. May carry the crest in public without further authorisation. First-line access to drops, transmissions, and the occasional Hot Mutt sighting.";
  } else if (score >= 3) {
    level = "LEVEL 03";
    status = "PROVISIONAL CLEARANCE";
    classification = "MID·COOKED";
    desc = "Realm-adjacent tendencies confirmed. Cleared for transmissions and outer Boneyard perimeter. Full field readiness not yet demonstrated. Do not attempt Bungonia solo. Reassessment permitted after EST Day 6.";
  } else if (score >= 1) {
    level = "LEVEL 02";
    status = "APPLICANT · UNDER REVIEW";
    classification = "UNVERIFIED";
    desc = "Filed for clearance. Sitting in the waiting room next to the fridge. Realm HQ is deciding whether you are Realm-adjacent or just lost. Loiter near transmissions. Try again after EST Day 6.";
  } else {
    level = "BONEYARD";
    status = "ACCESS DENIED · FILED UNDER BONEYARD";
    classification = "RAW";
    desc = "Assessment failed. Operative is not currently Realm Certified. Recommend loitering near Realm HQ transmissions until frequencies align. Do not attempt to purchase merch under false pretences. Reapply EST Day 6.";
  }

  $("certName").textContent = STATE.name || "OPERATIVE UNKNOWN";
  $("certStatus").textContent = level + " · " + status;
  $("certDesc").textContent = desc;
  $("certClass").textContent = classification;
  $("certFileRef").textContent = "RC-" + String(Math.floor(1000 + Math.random() * 8999));
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  $("certDate").textContent = pad(d.getDate()) + "·" + pad(d.getMonth() + 1) + "·" + d.getFullYear();

  // Persist to the register (best-effort). The certificate renders regardless;
  // on success we swap in the stable file ref and a public verification line.
  persistCertificate({ name: STATE.name, rank: status, level: level, classification: classification, score: score });

  const photoEl = $("certPhoto");
  if (STATE.photoDataUrl) {
    photoEl.classList.remove("empty");
    photoEl.style.backgroundImage = "url(" + STATE.photoDataUrl + ")";
    photoEl.textContent = "";
  } else {
    photoEl.classList.add("empty");
    photoEl.style.backgroundImage = "";
    photoEl.innerHTML = "NO PHOTO<br />ON FILE";
  }

  identityPanel.hidden = true;
  certPanel.hidden = false;
  window.scrollTo({ top: certPanel.offsetTop - 60, behavior: "smooth" });
}

function persistCertificate(info) {
  var BASE = 'https://exujdeqbxjjqnigqphgr.supabase.co/functions/v1';
  var APIKEY = 'sb_publishable__NHmUVigcA0TziMQnZvB0A_kFTfZ1Kz';
  var payload = {
    action: 'issue',
    operative_name: info.name || 'OPERATIVE UNKNOWN',
    rank: info.rank,
    level: info.level,
    classification: info.classification,
    score: info.score
  };
  try { fetch(BASE + '/certificate', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': APIKEY },
    body: JSON.stringify(payload)
  }).then(function (r) { return r.ok ? r.json() : null; }).then(function (res) {
    if (res && res.ok && res.certificate) {
      var c = res.certificate;
      $("certFileRef").textContent = c.file_ref || $("certFileRef").textContent;
      var v = $("certVerify");
      if (v) v.textContent = 'VERIFY · ID ' + String(c.id).slice(0, 8);
    }
  }).catch(function () {}); } catch (e) {}
}

$("certRestart").addEventListener("click", () => {
  STATE.index = 0;
  STATE.answers = new Array(QUESTIONS.length).fill(null);
  STATE.photoDataUrl = null;
  STATE.name = "";
  $("quizName").value = "";
  $("quizPreview").style.backgroundImage = "";
  $("quizUpload").classList.remove("has-image");
  $("quizUploadLabel").textContent = "TAP TO UPLOAD OPERATIVE PHOTO";
  certPanel.hidden = true;
  identityPanel.hidden = true;
  quizPanel.hidden = false;
  renderQuestion();
  checkIdentityReady();
  window.scrollTo({ top: quizPanel.offsetTop - 60, behavior: "smooth" });
});

// Cache the last rendered canvas so Share can reuse it
let CERT_CANVAS = null;

function safeCertName(){
  const s = (STATE.name || "operative").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return s || "operative";
}

function renderCert(){
  const target = document.getElementById("certificate");
  return html2canvas(target, {
    backgroundColor: "#08070a",
    scale: 2,
    useCORS: true,
    logging: false
  });
}

// Reveal Share button if the platform supports sharing files
(function(){
  const shareBtn = document.getElementById("certShare");
  if (!shareBtn) return;
  try {
    const testFile = new File([new Blob(["probe"], {type:"image/png"})], "probe.png", {type:"image/png"});
    if (navigator.canShare && navigator.canShare({ files: [testFile] })) {
      shareBtn.hidden = false;
    }
  } catch (_){ /* no share support */ }
})();

$("certDownload").addEventListener("click", () => {
  const btn = $("certDownload");
  btn.disabled = true;
  btn.textContent = "Rendering...";
  renderCert().then((canvas) => {
    CERT_CANVAS = canvas;
    const link = document.createElement("a");
    link.download = "realm-certified-" + safeCertName() + ".png";
    link.href = canvas.toDataURL("image/png");
    link.click();
    btn.disabled = false;
    btn.textContent = "Download PNG";
  }).catch(() => {
    btn.disabled = false;
    btn.textContent = "Download PNG";
    alert("Download failed. Try screenshotting the certificate instead.");
  });
});

const shareBtnEl = document.getElementById("certShare");
if (shareBtnEl) {
  shareBtnEl.addEventListener("click", async () => {
    shareBtnEl.disabled = true;
    shareBtnEl.textContent = "Rendering...";
    try {
      const canvas = CERT_CANVAS || await renderCert();
      CERT_CANVAS = canvas;
      const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
      if (!blob) throw new Error("blob failed");
      const file = new File([blob], "realm-certified-" + safeCertName() + ".png", { type:"image/png" });
      if (navigator.canShare && navigator.canShare({ files:[file] })) {
        await navigator.share({
          files:[file],
          title:"Realm Certified",
          text:"Officially unofficial. Realm HQ, EST Day 5."
        });
      } else {
        throw new Error("share not supported");
      }
    } catch (e) {
      if (e && e.name !== "AbortError") {
        alert("Share cancelled. Use Download PNG instead.");
      }
    } finally {
      shareBtnEl.disabled = false;
      shareBtnEl.textContent = "Share";
    }
  });
}

// Init
renderQuestion();
checkIdentityReady();
