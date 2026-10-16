(function () {
  const token = new URLSearchParams(window.location.search).get('token');
  const loading = document.getElementById('feedback-loading');
  const content = document.getElementById('feedback-content');
  const thanks = document.getElementById('feedback-thanks');
  const done = document.getElementById('feedback-done');
  const errorState = document.getElementById('feedback-error');
  const unavailable = document.getElementById('feedback-unavailable');
  const courseBox = document.getElementById('feedback-course');
  const metaLine = document.getElementById('feedback-meta');
  const stepBox = document.getElementById('feedback-step');
  const progress = document.getElementById('feedback-progress');
  const progressBar = document.getElementById('feedback-progress-bar');
  const stepLabel = document.getElementById('feedback-step-label');
  const requiredNote = document.getElementById('feedback-required-note');
  const backBtn = document.getElementById('feedback-back');
  const nextBtn = document.getElementById('feedback-next');
  const submitBtn = document.getElementById('feedback-submit-btn');
  const submitError = document.getElementById('submit-error');

  /* `answers` is keyed by question id and survives stepping back and forth;
     `others` holds the "other: ___" text that sits next to a choice. */
  const answers = {};
  const others = {};
  let questions = null;
  let course = null;
  let currentStep = 0;

  function currentLang() {
    return window.LWG_I18N?.getLang() === 'de' ? 'de' : 'en';
  }

  function t(key, fallback) {
    const value = window.LWG_I18N?.translateRuntime?.(key);
    // translateRuntime hands the key back when it knows no string for it.
    return value && value !== key ? value : fallback;
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

  /* ── Keep the token when the visitor switches language ─────────────
     The language switcher links to the bare page, which would land on
     "link expired or invalid". Answers are not carried over: the switch is
     a full page load. */
  function keepTokenOnLanguageLinks() {
    if (!token) return;
    document.querySelectorAll('.language-option[data-lang]').forEach((link) => {
      const url = new URL(link.getAttribute('href'), window.location.origin);
      url.searchParams.set('token', token);
      url.searchParams.set('lang', link.dataset.lang);
      link.setAttribute('href', url.pathname + url.search);
    });
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

  /* "anonymous · about 3–5 minutes" */
  function renderMeta() {
    const set = questionSet();
    if (!set) return;
    const minutes = t('feedbackEstimated', 'about {minutes}').replace('{minutes}', set.minutes);
    metaLine.textContent = t('feedbackAnonymous', 'anonymous') + ' · ' + minutes;
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

  /* The question text, with a required marker where one is due. */
  function fillLabel(el, question) {
    el.textContent = question.label;
    if (question.required) {
      const mark = document.createElement('span');
      mark.className = 'required-mark';
      mark.setAttribute('aria-hidden', 'true');
      mark.textContent = '*';
      el.appendChild(mark);
    }
  }

  function fieldset(question, extraClass) {
    const el = document.createElement('fieldset');
    el.className = extraClass;
    const legend = document.createElement('legend');
    legend.className = 'field-legend';
    fillLabel(legend, question);
    el.appendChild(legend);
    return el;
  }

  /* ── Numeric scales (every scale on the form runs 1-10) ─────────── */
  function renderScale(question) {
    const wrap = fieldset(question, 'rating-field');
    addHint(wrap, question.hint);

    const scaleRow = document.createElement('div');
    scaleRow.className = 'rating-scale';
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
        applyConditions();
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
    min.textContent = question.min + ' = ' + question.minLabel;
    const max = document.createElement('span');
    max.textContent = question.max + ' = ' + question.maxLabel;
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
        applyConditions();
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
        applyConditions();
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
    fillLabel(label, question);

    const textarea = document.createElement('textarea');
    textarea.id = id;
    textarea.maxLength = question.maxLength || 2000;
    textarea.value = answers[question.id] || '';
    textarea.addEventListener('input', () => {
      answers[question.id] = textarea.value;
    });

    wrap.append(label, textarea);
    addHint(wrap, question.hint || (question.required ? '' : t('feedbackOptional', 'optional')));
    addError(wrap, question, t('feedbackChoiceRequired', 'Please choose an answer.'));
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

  function steps() {
    return questionSet()?.steps || [];
  }

  function stepQuestions(index) {
    return steps()[index]?.questions || [];
  }

  /* ── Conditional questions ──────────────────────────────────────── */
  function conditionMet(question) {
    if (!question.showIf) return true;
    return question.showIf.values.includes(answers[question.showIf.id]);
  }

  /* Show or hide the follow-ups on the current step. A follow-up that
     disappears forgets its answer, so nothing is sent for a question the
     student no longer sees. */
  function applyConditions() {
    for (const question of stepQuestions(currentStep)) {
      if (!question.showIf) continue;
      const card = document.getElementById('card-' + question.id);
      const shown = conditionMet(question);
      setHidden(card, !shown);
      if (!shown && answers[question.id] !== undefined) {
        delete answers[question.id];
        delete others[question.id];
        const field = card?.querySelector('textarea, input');
        if (field) field.value = '';
        clearError(question);
      }
    }
  }

  /* ── Steps ──────────────────────────────────────────────────────── */
  function renderProgress() {
    const total = steps().length;
    const n = currentStep + 1;
    progress.setAttribute('aria-valuemax', String(total));
    progress.setAttribute('aria-valuenow', String(n));
    progressBar.style.width = Math.round((n / total) * 100) + '%';
    stepLabel.textContent = t('feedbackStepOf', 'step {n} of {total}')
      .replace('{n}', String(n))
      .replace('{total}', String(total));
    setHidden(backBtn, currentStep === 0);
    setHidden(nextBtn, currentStep >= total - 1);
    setHidden(submitBtn, currentStep < total - 1);
  }

  function renderStep() {
    stepBox.textContent = '';
    const list = stepQuestions(currentStep);
    let anyRequired = false;
    for (const question of list) {
      const render = RENDERERS[question.type];
      if (!render) continue;
      const card = document.createElement('div');
      card.className = 'question-card';
      card.id = 'card-' + question.id;
      card.appendChild(render(question));
      stepBox.appendChild(card);
      anyRequired = anyRequired || Boolean(question.required);
    }
    setHidden(requiredNote, !anyRequired);
    applyConditions();
    renderProgress();
  }

  function goToStep(index) {
    currentStep = Math.max(0, Math.min(index, steps().length - 1));
    renderStep();
    setErrorVisible(submitError, false);
    content.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  /* ── Validation ─────────────────────────────────────────────────── */
  function isAnswered(question) {
    const value = answers[question.id];
    if (question.type === 'multi') return Array.isArray(value) && value.length > 0;
    if (question.type === 'text') return typeof value === 'string' && value.trim() !== '';
    return value !== undefined && value !== null && value !== '';
  }

  /* Only the current step's visible required questions block the way on. */
  function validateStep() {
    let firstMissing = null;
    for (const question of stepQuestions(currentStep)) {
      if (!question.required || !conditionMet(question)) continue;
      const missing = !isAnswered(question);
      setErrorVisible(document.getElementById(errorId(question)), missing);
      if (missing && !firstMissing) firstMissing = question;
    }
    if (firstMissing) {
      const el = document.getElementById(errorId(firstMissing));
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el?.closest('.question-card')?.querySelector('input, textarea')?.focus();
    }
    return !firstMissing;
  }

  /* ── Submit ─────────────────────────────────────────────────────── */
  async function submit() {
    setErrorVisible(submitError, false);
    if (!validateStep()) return;

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

  nextBtn.addEventListener('click', () => {
    if (validateStep()) goToStep(currentStep + 1);
  });
  backBtn.addEventListener('click', () => goToStep(currentStep - 1));
  submitBtn.addEventListener('click', submit);

  /* Fires once per page load, after i18n.js has settled the language. */
  document.addEventListener('lwg:language-applied', () => {
    keepTokenOnLanguageLinks();
    if (!questions) return;
    renderCourse();
    renderMeta();
    renderStep();
  });

  /* ── Load ───────────────────────────────────────────────────────── */
  (async function load() {
    keepTokenOnLanguageLinks();
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
      renderMeta();
      renderStep();
      showOnly(content);
    } catch {
      // Network failure, not a bad token.
      showOnly(unavailable);
    }
  })();
})();
