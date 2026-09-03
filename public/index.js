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

  // On a language switch nav.js has already restored the reader's position by
  // the time this runs, so everything they were looking at is sitting at
  // opacity 0 waiting to be revealed. Settle it synchronously — the
  // .lwg-restoring class suppresses the transition for this frame — rather
  // than leaving it to the observer, whose first callback lands a frame or two
  // later and would fade the reader's own screen back in at them.
  if (document.documentElement.classList.contains('lwg-restoring')) {
    revealed.forEach(function (el) {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) el.classList.add('in-view');
    });
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

// ── Reviews: live list + submission form ────────────────────────
// Approved reviews are loaded from /api/reviews and replace the static
// fallback markup. Each review is shown in the page language when a
// translation exists, otherwise in its original language.
(function () {
  'use strict';

  let loadedReviews = null;

  function currentLang() {
    return (window.LWG_I18N && window.LWG_I18N.getLang()) || document.documentElement.lang || 'en';
  }

  function renderReviews() {
    const grid = document.querySelector('.reviews-grid');
    if (!grid || !loadedReviews || !loadedReviews.length) return;
    const lang = currentLang();
    grid.textContent = '';
    loadedReviews.forEach(function (review) {
      const figure = document.createElement('figure');
      figure.className = 'review reveal in-view';
      const blockquote = document.createElement('blockquote');
      const p = document.createElement('p');
      p.textContent = lang === review.language ? review.text : review.translation || review.text;
      blockquote.appendChild(p);
      const figcaption = document.createElement('figcaption');
      figcaption.textContent = '— ' + review.name;
      figure.appendChild(blockquote);
      figure.appendChild(figcaption);
      grid.appendChild(figure);
    });
  }

  // ── Clamp long reviews behind a read-more toggle ────────────────
  function reviewToggleLabel(collapsed) {
    if (window.LWG_I18N) {
      return window.LWG_I18N.translateRuntime(collapsed ? 'reviewReadMore' : 'reviewReadLess');
    }
    return collapsed ? 'read more' : 'show less';
  }

  function applyReviewClamps() {
    document.querySelectorAll('.reviews-grid .review').forEach(function (figure) {
      const p = figure.querySelector('blockquote p');
      if (!p) return;
      const oldToggle = figure.querySelector('.review-toggle');
      if (oldToggle) oldToggle.remove();
      figure.classList.add('review--clamped');
      if (p.scrollHeight <= p.clientHeight + 1) {
        figure.classList.remove('review--clamped');
        return;
      }
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'review-toggle';
      btn.setAttribute('aria-expanded', 'false');
      btn.textContent = reviewToggleLabel(true);
      btn.addEventListener('click', function () {
        const collapsed = figure.classList.toggle('review--clamped');
        btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        btn.textContent = reviewToggleLabel(collapsed);
      });
      figure.insertBefore(btn, figure.querySelector('figcaption'));
    });
  }

  fetch('/api/reviews')
    .then(function (res) {
      if (!res.ok) throw new Error('Server error');
      return res.json();
    })
    .then(function (reviews) {
      loadedReviews = reviews;
      renderReviews();
      applyReviewClamps();
      // #about, #faq and #enquiry sit below #reviews, so filling the grid pushes them
      // down after first paint. nav.js holds the reader's place across a
      // language switch; re-apply it now that the page is its final height.
      // It is a no-op unless a switch just happened and the reader has not
      // moved since.
      if (window.__lwgRestorePlace) window.__lwgRestorePlace();
    })
    .catch(function () {
      /* keep the static fallback reviews */
    });

  document.addEventListener('lwg:language-applied', function () {
    renderReviews();
    applyReviewClamps();
  });
  applyReviewClamps();

  // ── Submission form ─────────────────────────────────────────────
  const form = document.getElementById('review-form');
  if (!form) return;

  function showErr(id, show) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('is-visible-block', show);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    const name = document.getElementById('review-name').value.trim();
    const text = document.getElementById('review-text').value.trim();
    showErr('err-review-name', !name);
    showErr('err-review-text', !text);
    if (!name || !text) return;

    const btn = document.getElementById('review-submit');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = window.LWG_I18N
      ? window.LWG_I18N.translateRuntime('reviewSubmitting')
      : 'sending…';
    showErr('err-review-submit', false);

    fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name,
        text: text,
        language: currentLang(),
        website: document.getElementById('review-website').value,
      }),
    })
      .then(function (res) {
        if (!res.ok) throw new Error('Server error');
        form.hidden = true;
        document.getElementById('review-success').hidden = false;
      })
      .catch(function () {
        btn.disabled = false;
        btn.textContent = originalText;
        showErr('err-review-submit', true);
      });
  });
})();
