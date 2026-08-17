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
  // Declared up here because the scroll-restore below has to keep it in step:
  // a programmatic restore must not read as the reader scrolling down, or the
  // nav bar slides itself away right after the switch.
  let lastScrollY = 0;

  // ── Language switcher: hold the reader's place ──────────────────
  // Switching language used to be an in-place DOM swap, so the reader never
  // moved. It is a real navigation now — the switcher has to be a crawlable
  // link for the German URLs to be discoverable at all — so the reader's place
  // has to be carried across the load by hand.
  //
  // The place is stored as "this far into this section" rather than as a pixel
  // offset: a section's German text is rarely the same height as its English,
  // so a raw scrollY drifts further off the further down the page it is.
  // Section ids come from the template and are identical in both languages.
  //
  // It is deliberately NOT carried as a #hash. A fragment makes the browser
  // navigate to the section, which lands on the section heading rather than
  // where the reader actually was — and with `scroll-behavior: smooth` set in
  // index.css, animates the whole way down. This restores synchronously at the
  // end of <body>, before the first paint, so the page simply appears in the
  // right place: nothing animates and nothing jumps.
  const SCROLL_KEY = 'lwg-switch-scroll';
  let pendingPlace = null;

  function visibleSections() {
    // Panels that page scripts toggle open (#call-panel, #booking-panel) are
    // sections too, and a hidden one reports a zero rect that would otherwise
    // always test as sitting above the reader.
    return [].filter.call(document.querySelectorAll('section[id]'), function (section) {
      return section.getClientRects().length;
    });
  }

  function currentPlace() {
    const y = window.scrollY;
    const place = { y: y, id: '', ratio: 0 };
    visibleSections().forEach(function (section) {
      const rect = section.getBoundingClientRect();
      const top = rect.top + y;
      // The last section starting at or above the viewport top is the one the
      // reader is looking at; above the first section (the hero) there is none,
      // and the plain offset is then exact anyway.
      if (top <= y && rect.height) {
        place.id = section.id;
        place.ratio = Math.min(1, (y - top) / rect.height);
      }
    });
    return place;
  }

  // Exposed because the homepage reviews arrive from /api/reviews after first
  // paint and push everything below #reviews down; index.js re-applies once
  // they have rendered.
  function applyPlace() {
    if (!pendingPlace) return;
    const section = pendingPlace.id && document.getElementById(pendingPlace.id);
    let y = pendingPlace.y;
    if (section) {
      const rect = section.getBoundingClientRect();
      y = rect.top + window.scrollY + pendingPlace.ratio * rect.height;
    }
    // 'instant' rather than the default 'auto', which would inherit
    // `scroll-behavior: smooth` and animate the restore into view.
    window.scrollTo({ top: y, behavior: 'instant' });
    lastScrollY = window.scrollY;
  }
  window.__lwgRestorePlace = applyPlace;

  // Once the reader has moved under their own steam, their position is theirs;
  // never pull them back.
  ['wheel', 'touchmove', 'keydown', 'mousedown'].forEach(function (type) {
    window.addEventListener(
      type,
      function () {
        pendingPlace = null;
      },
      { passive: true, once: true }
    );
  });

  (function restorePlace() {
    let raw = null;
    try {
      raw = sessionStorage.getItem(SCROLL_KEY);
      // Consumed on read: it belongs to this one navigation, and must not fire
      // again on a reload or when the reader comes back via the back button.
      sessionStorage.removeItem(SCROLL_KEY);
    } catch (err) {
      void err; // private browsing: the switch just lands at the top
    }
    if (!raw) return;
    try {
      pendingPlace = JSON.parse(raw);
    } catch (err) {
      void err;
      return;
    }
    // Only for the page the switch was aimed at.
    if (!pendingPlace || pendingPlace.path !== window.location.pathname) {
      pendingPlace = null;
      return;
    }
    applyPlace();

    // Tell the page scripts this load is a continuation of the last one rather
    // than a fresh arrival, so nothing that is meant to animate on first sight
    // replays for content the reader was already looking at. Held for one frame
    // so index.js can settle the reveals before transitions come back.
    const root = document.documentElement;
    root.classList.add('lwg-restoring');
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        root.classList.remove('lwg-restoring');
      });
    });
  })();

  document.querySelectorAll('.language-option[data-lang]').forEach(function (link) {
    // pointerdown fires before the browser acts on the click, and covers
    // middle-click and ctrl/cmd-click; click covers keyboard activation, which
    // produces no pointer event.
    ['pointerdown', 'click'].forEach(function (type) {
      link.addEventListener(type, function () {
        const place = currentPlace();
        place.path = new URL(link.href, window.location.origin).pathname;
        try {
          sessionStorage.setItem(SCROLL_KEY, JSON.stringify(place));
        } catch (err) {
          void err;
        }
      });
    });

    // Remember the choice so the server can honour it on a future visit to an
    // unprefixed URL.
    link.addEventListener('click', function () {
      try {
        localStorage.setItem('lwg-lang', link.dataset.lang);
      } catch (err) {
        void err; // private browsing: the URL prefix still carries the language
      }
    });
  });

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
  lastScrollY = window.scrollY;
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
