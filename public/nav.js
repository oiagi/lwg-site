// ── Navigation component ────────────────────────────────────────
// Injects the nav overlay, cloud menu, and all associated behavior.
// Include this script at the end of <body> on every page.
// The nav HTML and JS are centralised here to avoid duplication.
(function () {
  'use strict';

  const i18n = window.LWG_I18N;
  function tr(key) {
    return i18n ? i18n.t(key) : key;
  }

  function href(page) {
    return i18n ? i18n.href(page, i18n.getLang()) : page;
  }

  // ── Inject shared HTML ──────────────────────────────────────────
  // Only one overlay div (fixes duplicate overlay bug in several pages)
  const navHTML =
    '<a href="#content" class="skip-link">' +
    tr('skip') +
    '</a>' +
    '<div class="language-switcher site-language" aria-label="' +
    tr('language') +
    '">' +
    '<button type="button" class="language-option" data-lang="en">EN</button>' +
    '<span aria-hidden="true">/</span>' +
    '<button type="button" class="language-option" data-lang="de">DE</button>' +
    '</div>' +
    '<div class="nav-overlay" id="nav-overlay"></div>' +
    '<nav class="nav" id="nav">' +
    '<button class="nav-toggle" id="nav-toggle" type="button" aria-label="Toggle navigation">' +
    '<span class="nav-toggle-label" id="nav-toggle-label">' +
    tr('menu') +
    '</span>' +
    '</button>' +
    '<div class="nav-menu" id="nav-menu">' +
    '<a href="' +
    href('/index.html') +
    '" data-page="/index.html" data-nav-key="home">' +
    tr('home') +
    '</a>' +
    '<a href="' +
    href('/info.html') +
    '" data-page="/info.html" data-nav-key="info">' +
    tr('info') +
    '</a>' +
    '<a href="' +
    href('/group-courses.html') +
    '" data-page="/group-courses.html" data-nav-key="groupCourses">' +
    tr('groupCourses') +
    '</a>' +
    '<a href="' +
    href('/enquiry.html') +
    '" data-page="/enquiry.html" data-nav-key="enquiry">' +
    tr('enquiry') +
    '</a>' +
    '<div class="nav-section" aria-labelledby="nav-materials-label">' +
    '<span class="nav-section-label" id="nav-materials-label" data-nav-key="materials">' +
    tr('materials') +
    '</span>' +
    '<div class="nav-submenu">' +
    '<a href="' +
    href('/modalpartikeln.html') +
    '" data-page="/modalpartikeln.html" data-nav-key="modalpartikeln">' +
    tr('modalpartikeln') +
    '</a>' +
    '</div>' +
    '</div>' +
    '</div>' +
    '</nav>';
  const footerHTML =
    '<footer class="site-footer" aria-label="' +
    tr('legalLabel') +
    '">' +
    '<a href="' +
    href('/impressum.html') +
    '" data-page="/impressum.html" data-nav-key="impressum">' +
    tr('impressum') +
    '</a>' +
    '<a href="' +
    href('/datenschutzerklaerung.html') +
    '" data-page="/datenschutzerklaerung.html" data-nav-key="privacy">' +
    tr('privacy') +
    '</a>' +
    '<a href="' +
    href('/agb.html') +
    '" data-page="/agb.html" data-nav-key="terms">' +
    tr('terms') +
    '</a>' +
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
  const siteLanguage = document.querySelector('.site-language');
  const languageOptions = document.querySelectorAll('.language-option');
  let menuOpen = false;

  function syncNavLanguage() {
    const lang = i18n ? i18n.getLang() : document.documentElement.lang || 'en';
    document.querySelectorAll('[data-nav-key]').forEach(function (el) {
      el.textContent = tr(el.dataset.navKey);
    });
    document.querySelectorAll('[data-page]').forEach(function (el) {
      el.href = href(el.dataset.page);
    });
    document.querySelectorAll('.skip-link').forEach(function (el) {
      el.textContent = tr('skip');
    });
    if (siteFooter) siteFooter.setAttribute('aria-label', tr('legalLabel'));
    if (siteLanguage) siteLanguage.setAttribute('aria-label', tr('language'));
    navLabel.textContent = menuOpen ? tr('close') : tr('menu');
    languageOptions.forEach(function (button) {
      const active = button.dataset.lang === lang;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  // ── Mark active nav link ────────────────────────────────────────
  function normalisePath(path) {
    if (i18n) return i18n.normalisePageKey(path);
    const trimmed = path.replace(/\/$/, '') || '/index.html';
    if (trimmed === '' || trimmed === '/') return '/index.html';
    return trimmed.includes('.') ? trimmed : trimmed + '.html';
  }
  const currentPath = normalisePath(window.location.pathname);
  navMenu.querySelectorAll('a').forEach(function (link) {
    const linkPath = normalisePath(new URL(link.href, window.location.href).pathname);
    if (
      linkPath === currentPath ||
      (currentPath.endsWith('/') && linkPath === currentPath.slice(0, -1))
    ) {
      link.setAttribute('aria-current', 'page');
    }
  });
  siteFooter.querySelectorAll('a').forEach(function (link) {
    const linkPath = normalisePath(new URL(link.href, window.location.href).pathname);
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

  languageOptions.forEach(function (button) {
    button.addEventListener('click', function (e) {
      e.stopPropagation();
      if (i18n) i18n.setLang(button.dataset.lang);
      syncNavLanguage();
    });
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

  document.addEventListener('lwg:language-applied', syncNavLanguage);
  syncNavLanguage();

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
