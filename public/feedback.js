(function () {
  const token = new URLSearchParams(window.location.search).get('token');
  const loading = document.getElementById('feedback-loading');
  const content = document.getElementById('feedback-content');
  const thanks = document.getElementById('feedback-thanks');
  const done = document.getElementById('feedback-done');
  const errorState = document.getElementById('feedback-error');
  const unavailable = document.getElementById('feedback-unavailable');
  const courseBox = document.getElementById('feedback-course');
  const sectionsBox = document.getElementById('feedback-sections');
  const submitBtn = document.getElementById('feedback-submit-btn');
  const submitError = document.getElementById('submit-error');

  /* Answers survive a language switch, which re-renders the questions.
     `answers` is keyed by question id; `others` holds the "other: ___"
     text that sits next to a choice. */
  const answers = {};
  const others = {};
  let questions = null;
  let course = null;

  function currentLang() {
    return window.LWG_I18N?.getLang() === 'de' ? 'de' : 'en';
  }

  function t(key, fallback) {
    return window.LWG_I18N?.translateRuntime?.(key) || fallback;
  }

  function setHidden(el, hidden) {
    if (el) el.classList.toggle('is-hidden', hidden);
  }

  function showOnly(panel) {
    for (const el of [loading, content, thanks, done, errorState, unavailable]) {
      setHidden(el, el !== panel);
    }
  }

  function setErrorVisible(el, show) {
    if (el) el.classList.toggle('is-visible-block', show);
  }

  function errorId(question) {
    return 'err-' + question.id;
  }

  function clearError(question) {
    setErrorVisible(document.getElementById(errorId(question)), false);
  }

  /* ── Course context ──────────────────────────────────────────────
     The header names the course, which is why the form never asks. */
  function renderCourse() {
    if (!course) return;
    courseBox.textContent = '';
    const lines = [];
    if (course.course_code) lines.push(course.course_code);
    const name = course.name?.[currentLang()] || course.name?.de || '';
    if (name) lines.push(name);
    if (!lines.length) {
      setHidden(courseBox, true);
      return;
    }
    setHidden(courseBox, false);
    for (const line of lines) {
      const p = document.createElement('p');
      p.textContent = line;
      courseBox.appendChild(p);
    }
  }

  /* ── Shared field chrome ────────────────────────────────────────── */
  function addHint(parent, text) {
    if (!text) return;
    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = text;
    parent.appendChild(hint);
  }

  function addError(parent, question, message) {
    const error = document.createElement('div');
    error.className = 'error';
    error.id = errorId(question);
    error.textContent = message;
    parent.appendChild(error);
  }

  function fieldset(question, extraClass) {
    const el = document.createElement('fieldset');
    el.className = extraClass;
    const legend = document.createElement('legend');
    legend.className = 'field-legend';
    legend.textContent = question.label;
    el.appendChild(legend);
    return el;
  }

  /* ── Numeric scales (1-5 statements and the 0-10 recommendation) ── */
  function renderScale(question) {
    const wrap = fieldset(question, 'rating-field');
    addHint(wrap, question.hint);

    const scaleRow = document.createElement('div');
    scaleRow.className = question.max > 5 ? 'rating-scale rating-scale--wide' : 'rating-scale';
    for (let value = question.min; value <= question.max; value += 1) {
      const label = document.createElement('label');
      label.className = 'rating-option';

      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'q-' + question.id;
      input.value = String(value);
      input.checked = answers[question.id] === value;
      input.addEventListener('change', () => {
        answers[question.id] = value;
        clearError(question);
      });

      const box = document.createElement('span');
      box.className = 'rating-box';
      box.textContent = String(value);

      label.append(input, box);
      scaleRow.appendChild(label);
    }
    wrap.appendChild(scaleRow);

    const endpoints = document.createElement('div');
    endpoints.className = 'rating-endpoints';
    const min = document.createElement('span');
    min.textContent = question.min + ' — ' + question.minLabel;
    const max = document.createElement('span');
    max.textContent = question.maxLabel + ' — ' + question.max;
    endpoints.append(min, max);
    wrap.appendChild(endpoints);

    addError(wrap, question, t('feedbackRatingRequired', 'Please choose a rating.'));
    return wrap;
  }

  /* ── The free-text box that belongs to an "other" option ──────────
     Hidden until "other" is actually picked, rather than shown greyed
     out: an empty box nobody can type in only raises questions.     */
  function renderOtherInput(question, isActive) {
    const placeholder = t('feedbackOtherPlaceholder', 'please tell us');
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'choice-other';
    input.id = 'other-' + question.id;
    input.maxLength = questionSet()?.otherMaxLength || 120;
    input.placeholder = placeholder;
    input.setAttribute('aria-label', question.label + ': ' + placeholder);
    input.value = others[question.id] || '';
    setHidden(input, !isActive());
    input.addEventListener('input', () => {
      others[question.id] = input.value;
    });
    return input;
  }

  /* ── Single choice ──────────────────────────────────────────────── */
  function renderChoice(question) {
    const wrap = fieldset(question, 'choice-field');
    addHint(wrap, question.hint);

    const list = document.createElement('div');
    list.className = 'choice-list';
    let otherInput = null;

    for (const option of question.options) {
      const label = document.createElement('label');
      label.className = 'choice-option';

      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'q-' + question.id;
      input.value = option.value;
      input.checked = answers[question.id] === option.value;
      input.addEventListener('change', () => {
        answers[question.id] = option.value;
        if (otherInput) setHidden(otherInput, option.value !== 'other');
        clearError(question);
      });

      const text = document.createElement('span');
      text.className = 'choice-label';
      text.textContent = option.label;

      label.append(input, text);
      list.appendChild(label);
    }
    wrap.appendChild(list);

    if (question.other) {
      otherInput = renderOtherInput(question, () => answers[question.id] === 'other');
      wrap.appendChild(otherInput);
    }

    addError(wrap, question, t('feedbackChoiceRequired', 'Please choose an answer.'));
    return wrap;
  }

  /* ── Multiple choice ────────────────────────────────────────────── */
  function renderMulti(question) {
    const wrap = fieldset(question, 'choice-field');
    addHint(wrap, question.hint);

    const selected = new Set(answers[question.id] || []);
    answers[question.id] = [...selected];

    const list = document.createElement('div');
    list.className = 'choice-list choice-list--multi';
    let otherInput = null;

    for (const option of question.options) {
      const label = document.createElement('label');
      label.className = 'choice-option';

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = option.value;
      input.checked = selected.has(option.value);
      input.addEventListener('change', () => {
        if (input.checked) selected.add(option.value);
        else selected.delete(option.value);
        answers[question.id] = [...selected];
        if (otherInput) setHidden(otherInput, !selected.has('other'));
        clearError(question);
      });

      const text = document.createElement('span');
      text.className = 'choice-label';
      text.textContent = option.label;

      label.append(input, text);
      list.appendChild(label);
    }
    wrap.appendChild(list);

    if (question.other) {
      otherInput = renderOtherInput(question, () => selected.has('other'));
      wrap.appendChild(otherInput);
    }

    addError(wrap, question, t('feedbackChoiceRequired', 'Please choose an answer.'));
    return wrap;
  }

  /* ── Free text ──────────────────────────────────────────────────── */
  function renderText(question) {
    const wrap = document.createElement('div');
    wrap.className = 'comment-field';

    const id = 'comment-' + question.id;
    const label = document.createElement('label');
    label.setAttribute('for', id);
    label.textContent = question.label;

    const textarea = document.createElement('textarea');
    textarea.id = id;
    textarea.maxLength = question.maxLength || 2000;
    textarea.value = answers[question.id] || '';
    textarea.addEventListener('input', () => {
      answers[question.id] = textarea.value;
    });

    wrap.append(label, textarea);
    addHint(wrap, question.hint || t('feedbackOptional', 'optional'));
    return wrap;
  }

  const RENDERERS = {
    scale: renderScale,
    nps: renderScale,
    choice: renderChoice,
    multi: renderMulti,
    text: renderText,
  };

  function questionSet() {
    if (!questions) return null;
    return questions[currentLang()] || questions.de || questions.en;
  }

  function renderQuestions() {
    const set = questionSet();
    if (!set) return;

    sectionsBox.textContent = '';
    for (const section of set.sections) {
      const heading = document.createElement('p');
      heading.className = 'section-label';
      heading.textContent = section.title;
      sectionsBox.appendChild(heading);

      for (const question of section.questions) {
        const render = RENDERERS[question.type];
        if (render) sectionsBox.appendChild(render(question));
      }
    }
  }

  /* ── Submit ─────────────────────────────────────────────────────── */
  function isAnswered(question) {
    const value = answers[question.id];
    if (question.type === 'multi') return Array.isArray(value) && value.length > 0;
    if (question.type === 'text') return typeof value === 'string' && value.trim() !== '';
    return value !== undefined && value !== null && value !== '';
  }

  function validate() {
    const set = questionSet();
    let firstMissing = null;
    for (const section of set.sections) {
      for (const question of section.questions) {
        if (!question.required) continue;
        const missing = !isAnswered(question);
        setErrorVisible(document.getElementById(errorId(question)), missing);
        if (missing && !firstMissing) firstMissing = question;
      }
    }
    if (firstMissing) {
      const el = document.getElementById(errorId(firstMissing));
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el?.closest('fieldset')?.querySelector('input')?.focus();
    }
    return !firstMissing;
  }

  async function submit() {
    setErrorVisible(submitError, false);
    if (!validate()) return;

    const originalLabel = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.dataset.loading = '';
    submitBtn.textContent = t('feedbackSubmitting', 'sending…');

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, answers, other: others }),
      });
      if (res.status === 409) {
        showOnly(done);
        return;
      }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      showOnly(thanks);
    } catch {
      setErrorVisible(submitError, true);
    } finally {
      submitBtn.disabled = false;
      delete submitBtn.dataset.loading;
      submitBtn.textContent = originalLabel;
    }
  }

  submitBtn.addEventListener('click', submit);

  /* Re-render the header and the questions in the newly chosen language. */
  document.addEventListener('lwg:language-applied', () => {
    renderCourse();
    renderQuestions();
  });

  /* ── Load ───────────────────────────────────────────────────────── */
  (async function load() {
    if (!token) {
      showOnly(errorState);
      return;
    }
    try {
      const res = await fetch('/api/feedback?token=' + encodeURIComponent(token));
      if (!res.ok) {
        // 404/410 mean the token itself is no good; anything else is our
        // problem, so don't tell the student their link is invalid.
        showOnly(res.status >= 500 ? unavailable : errorState);
        return;
      }
      const data = await res.json();
      questions = data.questions;
      course = data.course || null;
      if (data.submitted) {
        showOnly(done);
        return;
      }
      renderCourse();
      renderQuestions();
      showOnly(content);
    } catch {
      // Network failure, not a bad token.
      showOnly(unavailable);
    }
  })();
})();
