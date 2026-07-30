// ── Scroll reveal ───────────────────────────────────────────────
// Fades in .reveal elements as they enter the viewport.
(function () {
  'use strict';

  const revealed = document.querySelectorAll('.reveal');
  if (!revealed.length) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealed.forEach(function (el) {
      el.classList.add('in-view');
    });
    return;
  }

  const observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
  );
  revealed.forEach(function (el) {
    observer.observe(el);
  });
})();
