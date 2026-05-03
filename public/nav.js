// ── Navigation component ────────────────────────────────────────
// Injects the nav overlay, cloud menu, and all associated behavior.
// Include this script at the end of <body> on every page.
// The nav HTML and JS are centralised here to avoid duplication.
(function () {
  'use strict';

  // ── Inject shared HTML ──────────────────────────────────────────
  // Only one overlay div (fixes duplicate overlay bug in several pages)
  const navHTML =
    '<a href="#content" class="skip-link">Skip to content</a>' +
    '<div class="nav-overlay" id="nav-overlay"></div>' +
    '<nav class="nav" id="nav">' +
    '<button class="nav-toggle" id="nav-toggle" type="button" aria-label="Toggle navigation">' +
    '<span class="nav-toggle-label" id="nav-toggle-label">menu</span>' +
    '</button>' +
    '<div class="nav-menu" id="nav-menu">' +
    '<a href="index.html">Home</a>' +
    '<a href="info.html">info</a>' +
    '<a href="enquiry.html">enquiry</a>' +
    '</div>' +
    '</nav>';
  const footerHTML =
    '<footer class="site-footer" aria-label="Rechtliche Seiten">' +
    '<a href="impressum.html">Impressum</a>' +
    '<a href="datenschutzerklaerung.html">Datenschutzerklärung</a>' +
    '<a href="agb.html">AGB</a>' +
    '</footer>';

  // Insert at the very beginning of <body>
  document.body.insertAdjacentHTML('afterbegin', navHTML);
  document.body.insertAdjacentHTML('beforeend', footerHTML);

  // ── References ──────────────────────────────────────────────────
  const navToggle = document.getElementById('nav-toggle');
  const navLabel = document.getElementById('nav-toggle-label');
  const navMenu = document.getElementById('nav-menu');
  const siteFooter = document.querySelector('.site-footer');
  const nav = document.getElementById('nav');
  const overlay = document.getElementById('nav-overlay');
  let menuOpen = false;

  // ── Mark active nav link ────────────────────────────────────────
  const currentPath = window.location.pathname.replace(/\/$/, '') || '/index.html';
  navMenu.querySelectorAll('a').forEach(function (link) {
    const linkPath = new URL(link.href, window.location.href).pathname.replace(/\/$/, '');
    if (
      linkPath === currentPath ||
      (currentPath === '' && linkPath === '/index.html') ||
      (currentPath.endsWith('/') && linkPath === currentPath.slice(0, -1))
    ) {
      link.setAttribute('aria-current', 'page');
    }
  });
  siteFooter.querySelectorAll('a').forEach(function (link) {
    const linkPath = new URL(link.href, window.location.href).pathname.replace(/\/$/, '');
    if (linkPath === currentPath) {
      link.setAttribute('aria-current', 'page');
    }
  });

  // ── Ripple effect ───────────────────────────────────────────────
  function triggerRipple(x, y) {
    const ripple = document.createElement('div');
    ripple.classList.add('ripple');
    const size = Math.max(window.innerWidth, window.innerHeight) * 2.5;
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x - size / 2 + 'px';
    ripple.style.top = y - size / 2 + 'px';
    document.body.appendChild(ripple);
    ripple.addEventListener('animationend', function () {
      ripple.remove();
    });
  }

  // ── Toggle helper ───────────────────────────────────────────────
  function toggleMenu(open, x, y) {
    menuOpen = open;
    navLabel.textContent = menuOpen ? 'close' : 'menu';
    navMenu.classList.toggle('open', menuOpen);
    document.body.classList.toggle('nav-active', menuOpen);
    if (overlay) overlay.classList.toggle('visible', menuOpen);
    if (menuOpen && x !== undefined) triggerRipple(x, y);
  }

  // ── Scroll: hide on scroll-down, reveal on scroll-up ───────────
  let lastScrollY = window.scrollY;
  window.addEventListener('scroll', function () {
    const y = window.scrollY;
    const scrollingDown = y > lastScrollY;
    lastScrollY = y;

    if (y > 60 && scrollingDown) {
      nav.classList.add('hidden');
      if (menuOpen) toggleMenu(false);
    } else if (!scrollingDown) {
      nav.classList.remove('hidden');
    }
  });

  // ── Cloud click ─────────────────────────────────────────────────
  navToggle.addEventListener('click', function (e) {
    e.stopPropagation();
    toggleMenu(!menuOpen, e.clientX, e.clientY);
  });

  // ── Click anywhere to close ─────────────────────────────────────
  document.addEventListener('click', function () {
    if (menuOpen) toggleMenu(false);
  });

  // ── Touch: prevent ghost click delay ────────────────────────────
  if (document.documentElement.getAttribute('data-touch') === 'true') {
    navToggle.addEventListener('touchend', function (e) {
      e.preventDefault();
      toggleMenu(!menuOpen, e.changedTouches[0].clientX, e.changedTouches[0].clientY);
    });
  }

  // ── Skip link: ensure target exists ──────────────────────────────
  if (!document.getElementById('content')) {
    const first = nav.nextElementSibling;
    if (first) first.id = 'content';
  }

  // ── Expose toggleMenu for pages that need it (e.g. logo click) ──
  window.__navToggle = function (x, y) {
    toggleMenu(!menuOpen, x, y);
  };
  window.__navIsOpen = function () {
    return menuOpen;
  };
})();
