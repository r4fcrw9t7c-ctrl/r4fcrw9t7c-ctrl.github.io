/* Realm HQ · music.html
   Extracted from inline <script> so the CSP can drop script-src unsafe-inline. */

// Simple track expand/collapse
document.querySelectorAll('.track').forEach(function (row) {
  var btn = row.querySelector('.track-play');
  if (!btn) return;
  btn.addEventListener('click', function () {
    var open = row.classList.contains('is-open');
    document.querySelectorAll('.track.is-open').forEach(function (o) {
      if (o !== row) o.classList.remove('is-open');
    });
    row.classList.toggle('is-open', !open);
    btn.textContent = row.classList.contains('is-open') ? '■' : '▶';
  });
});
