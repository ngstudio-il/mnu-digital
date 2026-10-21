// @ts-nocheck
// Interactive bits of the landing page: QR art, spotlight, live demo, marquee, language cycle.
export function runLanding() {
// Decorative QR-style pattern (not a scannable code)
document.querySelectorAll('canvas.qr').forEach(function (c, k) {
  var x = c.getContext('2d'), n = 25, seed = 7 + k * 13;
  function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
  x.fillStyle = '#fff'; x.fillRect(0, 0, n, n); x.fillStyle = '#1a2526';
  for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) if (rnd() > .52) x.fillRect(i, j, 1, 1);
  [[0, 0], [n - 7, 0], [0, n - 7]].forEach(function (p) {
    x.fillStyle = '#fff'; x.fillRect(p[0] - 1, p[1] - 1, 9, 9);
    x.fillStyle = '#1a2526'; x.fillRect(p[0], p[1], 7, 7);
    x.fillStyle = '#fff'; x.fillRect(p[0] + 1, p[1] + 1, 5, 5);
    x.fillStyle = '#1a2526'; x.fillRect(p[0] + 2, p[1] + 2, 3, 3);
  });
});

// Header shadow once the page scrolls
(function () {
  var h = document.querySelector('header');
  function f() { h.classList.toggle('scrolled', window.scrollY > 8); }
  window.addEventListener('scroll', f, { passive: true }); f();
})();

// Cursor spotlight on glass panels
document.querySelectorAll('.spot').forEach(function (el) {
  el.addEventListener('pointermove', function (e) {
    var r = el.getBoundingClientRect();
    el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    el.style.setProperty('--my', (e.clientY - r.top) + 'px');
  });
});

// Menu data shared by the live demo and the marquee
var MENU = [
  { id: 'bread', img: '/assets/food/bread-sq.jpg', full: '/assets/food/bread.jpg', price: 12, on: true, cat: 'starters',
    en: ['Sourdough & dips', 'Warm sourdough, tahini, tomato salsa'], he: ['לחם מחמצת ומטבלים', 'לחם חם, טחינה וסלסת עגבניות'], ar: ['خبز مخمّر مع غموس', 'خبز دافئ، طحينة وصلصة طماطم'] },
  { id: 'salad', img: '/assets/food/salad-sq.jpg', full: '/assets/food/salad.jpg', price: 16, on: true, cat: 'starters',
    en: ['Goat cheese salad', 'Frisée, walnuts, balsamic'], he: ['סלט גבינת עיזים', 'פריזה, אגוזי מלך ובלסמי'], ar: ['سلطة جبن الماعز', 'فريزيه، جوز وبلسميك'] },
  { id: 'salmon', img: '/assets/food/salmon-sq.jpg', full: '/assets/food/salmon.jpg', price: 29, on: true, cat: 'mains',
    en: ['Grilled salmon', 'Lemon, dill, olive oil'], he: ['סלמון צלוי', 'לימון, שמיר ושמן זית'], ar: ['سلمون مشوي', 'ليمون، شبت وزيت زيتون'] },
  { id: 'fries', img: '/assets/food/fries-sq.jpg', full: '/assets/food/fries.jpg', price: 9, on: true, cat: 'mains',
    en: ['Crinkle fries', 'Sea salt, chipotle aioli'], he: ['צ׳יפס גלי', 'מלח ים ואיולי צ׳יפוטלה'], ar: ['بطاطا مقلية', 'ملح البحر وأيولي تشيبوتلي'] },
  { id: 'espresso', img: '/assets/food/espresso-sq.jpg', full: '/assets/food/espresso.jpg', price: 4, on: true, cat: 'coffee',
    en: ['Espresso', 'Single origin, double shot'], he: ['אספרסו', 'זן יחיד, כפול'], ar: ['إسبريسو', 'محصول واحد، جرعة مزدوجة'] }
];
var CATS = { starters: { en: 'Starters', he: 'ראשונות', ar: 'المقبلات' }, mains: { en: 'Mains', he: 'עיקריות', ar: 'الأطباق الرئيسية' }, coffee: { en: 'Coffee', he: 'קפה', ar: 'القهوة' } };
var SOLD = { en: 'Sold out', he: 'אזל', ar: 'نفد' };
var lang = 'en';

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }

function renderRows() {
  document.getElementById('rows').innerHTML = MENU.map(function (d) {
    return '<div class="row" data-id="' + d.id + '"><img src="' + d.img + '" alt=""><div><b>' + esc(d.en[0]) + '</b><span>' + CATS[d.cat].en + '</span></div>' +
      '<div class="stepper"><button type="button" data-act="dec" aria-label="Lower price of ' + esc(d.en[0]) + '">−</button><output>$' + d.price + '</output><button type="button" data-act="inc" aria-label="Raise price of ' + esc(d.en[0]) + '">+</button></div>' +
      '<button type="button" class="switch" role="switch" data-act="toggle" aria-checked="' + d.on + '" aria-label="' + esc(d.en[0]) + ' available"></button></div>';
  }).join('');
}

function renderGuest(changedId) {
  var g = document.getElementById('guest'), last = '', html = '';
  g.dir = lang === 'en' ? 'ltr' : 'rtl';
  MENU.forEach(function (d) {
    if (d.cat !== last) { html += '<div class="g-cat">' + CATS[d.cat][lang] + '</div>'; last = d.cat; }
    html += '<div class="g-item' + (d.on ? '' : ' out') + (d.id === changedId ? ' flash' : '') + '"><img src="' + d.img + '" alt=""><div><b>' + esc(d[lang][0]) + '</b><p>' + esc(d[lang][1]) + '</p><span class="tag">' + SOLD[lang] + '</span></div><em>$' + d.price + '</em></div>';
  });
  g.innerHTML = html;
}

var syncTimer;
function synced(msg) {
  var s = document.getElementById('sync');
  s.textContent = msg;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(function () { s.textContent = 'All changes are live'; }, 2200);
}

document.getElementById('rows').addEventListener('click', function (e) {
  var btn = e.target.closest('button'); if (!btn) return;
  var row = btn.closest('.row'), d = MENU.filter(function (m) { return m.id === row.dataset.id; })[0];
  var act = btn.dataset.act;
  if (act === 'inc') d.price += 1;
  if (act === 'dec' && d.price > 1) d.price -= 1;
  if (act === 'toggle') { d.on = !d.on; btn.setAttribute('aria-checked', d.on); }
  row.querySelector('output').textContent = '$' + d.price;
  renderGuest(d.id);
  synced(act === 'toggle' ? (d.on ? d.en[0] + ' is back on the menu' : d.en[0] + ' marked sold out') : d.en[0] + ' is now $' + d.price);
});

document.querySelectorAll('.seg button').forEach(function (b) {
  b.addEventListener('click', function () {
    lang = b.dataset.lang;
    document.querySelectorAll('.seg button').forEach(function (o) { o.setAttribute('aria-pressed', o === b); });
    renderGuest();
    synced('Guest menu switched to ' + { en: 'English', he: 'Hebrew', ar: 'Arabic' }[lang]);
  });
});

renderRows();
renderGuest();

// Photo marquee (list doubled for a seamless loop)
(function () {
  var langs = ['en', 'he', 'ar', 'en', 'he'];
  var items = MENU.map(function (d, i) {
    var l = langs[i];
    return '<figure class="shot"><img src="' + d.full + '" alt="' + esc(d.en[0]) + '"><span class="lang-tag">' + { en: 'English', he: 'עברית', ar: 'العربية' }[l] + '</span>' +
      '<figcaption dir="' + (l === 'en' ? 'ltr' : 'rtl') + '"><b>' + esc(d[l][0]) + '</b><em>$' + d.price + '</em></figcaption></figure>';
  }).join('');
  document.getElementById('track').innerHTML = items + items;
})();

// Language tile: cycle one dish name through languages
(function () {
  var seq = [['Grilled salmon', 'English', 'ltr'], ['סלמון צלוי', 'עברית', 'rtl'], ['سلمون مشوي', 'العربية', 'rtl']], i = 0;
  var w = document.getElementById('word'), l = document.getElementById('word-lang');
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  setInterval(function () {
    w.classList.add('swap');
    setTimeout(function () { i = (i + 1) % seq.length; w.textContent = seq[i][0]; w.dir = seq[i][2]; l.textContent = seq[i][1]; w.classList.remove('swap'); }, 350);
  }, 2400);
})();
}
