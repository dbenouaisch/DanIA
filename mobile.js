(function () {
  var root = document.documentElement;
  var header = document.querySelector('header');
  var nav = header && header.querySelector('nav');
  if (!nav) return;
  nav.id = nav.id || 'menu-principal';
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'nav-toggle';
  btn.setAttribute('aria-controls', nav.id);
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-label', 'Ouvrir le menu');
  btn.innerHTML = '<span class="bars" aria-hidden="true"></span>';
  nav.parentNode.insertBefore(btn, nav);
  function setOpen(open) {
    root.classList.toggle('nav-open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
  }
  btn.addEventListener('click', function () { setOpen(!root.classList.contains('nav-open')); });
  nav.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { setOpen(false); } });
  window.addEventListener('resize', function () { if (window.innerWidth > 900) setOpen(false); });
})();
