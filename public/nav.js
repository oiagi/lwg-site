// ── Navigation behaviour ────────────────────────────────────────
// The nav, footer and language switcher are rendered server-side by
// functions/_nav-markup.js, so the markup (and the internal link graph) exists
// before any JavaScript runs. This file only wires up the interactions.
(function () {
  'use strict';

  const navToggle = document.getElementById('nav-toggle');
  const navLabel = document.getElementById('nav-toggle-label');
  const navMenu = document.getElementById('nav-menu');
  const nav = document.getElementById('nav');
  const overlay = document.getElementById('nav-overlay');
  let menuOpen = false;

  if (!nav || !navToggle || !navLabel || !navMenu) return;

  const i18n = window.LWG_I18N;
  function tr(key) {
    return i18n ? i18n.t(key) : key;
  }

  // ── Ripple effect ───────────────────────────────────────────────
  function triggerRipple() {
    const ripple = document.createElement('div');
    ripple.classList.add('ripple');
    document.body.appendChild(ripple);
    ripple.addEventListener('animationend', function () {
      ripple.remove();
    });
  }

  // ── Toggle helper ───────────────────────────────────────────────
  function toggleMenu(open, x, y) {
    menuOpen = open;
    navLabel.textContent = menuOpen ? tr('close') : tr('menu');
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

  // The language switcher is a pair of real links; clicking one is a normal
  // navigation, so it needs no handler. Remember the choice so the server can
  // honour it on a future visit to an unprefixed URL.
  document.querySelectorAll('.language-option[data-lang]').forEach(function (link) {
    link.addEventListener('click', function () {
      try {
        localStorage.setItem('lwg-lang', link.dataset.lang);
      } catch (err) {
        void err; // private browsing: the URL prefix still carries the language
      }
    });
  });

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
