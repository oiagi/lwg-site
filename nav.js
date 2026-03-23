// ── Navigation component ────────────────────────────────────────
// Injects the nav overlay, cloud menu, and all associated behavior.
// Include this script at the end of <body> on every page.
// The nav HTML and JS are centralised here to avoid duplication.
(function () {
  'use strict';

  // ── Inject nav HTML ─────────────────────────────────────────────
  // Only one overlay div (fixes duplicate overlay bug in several pages)
  var navHTML =
    '<div class="nav-overlay" id="nav-overlay"></div>' +
    '<nav class="nav" id="nav">' +
      '<picture>' +
        '<source srcset="cloud.webp" type="image/webp">' +
        '<img class="nav-cloud" id="nav-cloud" src="cloud.png" alt="menu" width="1369" height="868" />' +
      '</picture>' +
      '<div class="nav-menu" id="nav-menu">' +
        '<a href="index.html">Home</a>' +
        '<a href="info.html">info</a>' +
        '<a href="booking.html">book</a>' +
        '<a href="contact.html">contact</a>' +
      '</div>' +
    '</nav>';

  // Insert at the very beginning of <body>
  document.body.insertAdjacentHTML('afterbegin', navHTML);

  // ── References ──────────────────────────────────────────────────
  var navCloud = document.getElementById('nav-cloud');
  var navMenu  = document.getElementById('nav-menu');
  var nav      = document.getElementById('nav');
  var overlay  = document.getElementById('nav-overlay');
  var menuOpen = false;

  // ── Ripple effect ───────────────────────────────────────────────
  function triggerRipple(x, y) {
    var ripple = document.createElement('div');
    ripple.classList.add('ripple');
    var size = Math.max(window.innerWidth, window.innerHeight) * 2.5;
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left  = (x - size / 2) + 'px';
    ripple.style.top   = (y - size / 2) + 'px';
    document.body.appendChild(ripple);
    ripple.addEventListener('animationend', function () { ripple.remove(); });
  }

  // ── Toggle helper ───────────────────────────────────────────────
  function toggleMenu(open, x, y) {
    menuOpen = open;
    navMenu.classList.toggle('open', menuOpen);
    document.body.classList.toggle('nav-active', menuOpen);
    if (overlay) overlay.classList.toggle('visible', menuOpen);
    if (menuOpen && x !== undefined) triggerRipple(x, y);
  }

  // ── Scroll: hide nav + close menu ───────────────────────────────
  window.addEventListener('scroll', function () {
    if (window.scrollY > 10) {
      nav.classList.add('hidden');
      if (menuOpen) toggleMenu(false);
    } else {
      nav.classList.remove('hidden');
    }
  });

  // ── Cloud click ─────────────────────────────────────────────────
  navCloud.addEventListener('click', function (e) {
    e.stopPropagation();
    toggleMenu(!menuOpen, e.clientX, e.clientY);
  });

  // ── Click anywhere to close ─────────────────────────────────────
  document.addEventListener('click', function () {
    if (menuOpen) toggleMenu(false);
  });

  // ── Touch: prevent ghost click delay ────────────────────────────
  if (document.documentElement.getAttribute('data-touch') === 'true') {
    navCloud.addEventListener('touchend', function (e) {
      e.preventDefault();
      toggleMenu(!menuOpen, e.changedTouches[0].clientX, e.changedTouches[0].clientY);
    });
  }

  // ── Expose toggleMenu for pages that need it (e.g. logo click) ──
  window.__navToggle = function (x, y) {
    toggleMenu(!menuOpen, x, y);
  };
  window.__navIsOpen = function () { return menuOpen; };
})();
