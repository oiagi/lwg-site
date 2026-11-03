(function () {
  /* Drives both token forms: course feedback (the default) and the
     pre-course questionnaire, which sets data-form-api and
     data-anonymous="false" on #main. */
  const root = document.getElementById('main');
  const formApi = root?.dataset.formApi || '/api/feedback';
  const isAnonymous = root?.dataset.anonymous !== 'false';
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

  /* For the absence calendar (questionnaire only): the course's lesson
     dates, today, and the span of days that may be marked, all as
     'YYYY-MM-DD' in Europe/Zurich, straight from the API. The month each
     calendar is showing survives a re-render (language switch). */
  let lessonDates = new Set();
  let todayIso = null;
  let dateWindow = null;
  const calendarView = {};

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

  /* "anonymous · about 3–5 minutes", or just "about 5 minutes" */
  function renderMeta() {
    const set = questionSet();
    if (!set) return;
    const minutes = t('feedbackEstimated', 'about {minutes}').replace('{minutes}', set.minutes);
    metaLine.textContent = isAnonymous
      ? t('feedbackAnonymous', 'anonymous') + ' · ' + minutes
      : minutes;
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

  /* ── Date ranges (planned absences) ─────────────────────────────────
     A month calendar. The first tap picks the first day away, the second
     the last day (the same day twice = a single day). Ranges are listed
     as chips with a remove button; overlapping or touching ranges merge,
     exactly as the server merges them. Lesson days carry a dot. State is
     answers[id] = [{ from, to }], rebuilt from scratch on every render.  */
  const DAY_MS = 86400000;

  function isoParts(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return { y, m, d };
  }

  function isoFromUtc(date) {
    return date.toISOString().slice(0, 10);
  }

  function isoAddDays(iso, days) {
    const { y, m, d } = isoParts(iso);
    return isoFromUtc(new Date(Date.UTC(y, m - 1, d + days)));
  }

  function mergeDateRanges(ranges) {
    const sorted = [...ranges].sort((a, b) => a.from.localeCompare(b.from));
    const out = [];
    for (const range of sorted) {
      const last = out[out.length - 1];
      if (last && range.from <= isoAddDays(last.to, 1)) {
        if (range.to > last.to) last.to = range.to;
      } else {
        out.push({ from: range.from, to: range.to });
      }
    }
    return out;
  }

  function formatIso(iso, style) {
    const { y, m, d } = isoParts(iso);
    return new Intl.DateTimeFormat(currentLang() === 'de' ? 'de-CH' : 'en-GB', {
      ...style,
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(y, m - 1, d)));
  }

  function formatDateRange(range) {
    const style = { day: 'numeric', month: 'short', year: 'numeric' };
    return range.from === range.to
      ? formatIso(range.from, style)
      : formatIso(range.from, style) + ' – ' + formatIso(range.to, style);
  }

  /* Monday-first short weekday names, e.g. Mo Di Mi … / Mon Tue Wed … */
  function weekdayNames() {
    const fmt = new Intl.DateTimeFormat(currentLang() === 'de' ? 'de-CH' : 'en-GB', {
      weekday: 'short',
      timeZone: 'UTC',
    });
    // 2024-01-01 was a Monday.
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2024, 0, 1 + i))));
  }

  function initialMonth(question) {
    if (calendarView[question.id]) return calendarView[question.id];
    const base = todayIso || isoFromUtc(new Date());
    const firstLesson = [...lessonDates].sort().find((d) => d >= base);
    const { y, m } = isoParts(firstLesson || base);
    calendarView[question.id] = { y, m };
    return calendarView[question.id];
  }

  function renderDateRanges(question) {
    const wrap = fieldset(question, 'date-field');
    addHint(wrap, question.hint);

    const maxRanges = question.maxRanges || 30;
    const ranges = () => (Array.isArray(answers[question.id]) ? answers[question.id] : []);
    const setRanges = (list) => {
      if (list.length) answers[question.id] = list;
      else delete answers[question.id];
    };
    let pendingStart = null;
    const view = initialMonth(question);

    const calendar = document.createElement('div');
    calendar.className = 'date-calendar';

    /* Header: ‹ month year › */
    const header = document.createElement('div');
    header.className = 'date-header';
    const prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'date-nav';
    prev.textContent = '‹';
    prev.setAttribute('aria-label', t('feedbackCalendarPrev', 'previous month'));
    const monthLabel = document.createElement('span');
    monthLabel.className = 'date-month';
    monthLabel.setAttribute('aria-live', 'polite');
    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'date-nav';
    next.textContent = '›';
    next.setAttribute('aria-label', t('feedbackCalendarNext', 'next month'));
    header.append(prev, monthLabel, next);

    const weekdays = document.createElement('div');
    weekdays.className = 'date-weekdays';
    weekdays.setAttribute('aria-hidden', 'true');
    for (const name of weekdayNames()) {
      const cell = document.createElement('span');
      cell.textContent = name;
      weekdays.appendChild(cell);
    }

    const grid = document.createElement('div');
    grid.className = 'date-grid';
    grid.setAttribute('role', 'group');
    grid.setAttribute('aria-label', question.label);

    const status = document.createElement('p');
    status.className = 'date-status';
    status.setAttribute('aria-live', 'polite');

    const chips = document.createElement('ul');
    chips.className = 'date-ranges';

    const isSelected = (iso) => ranges().some((r) => iso >= r.from && iso <= r.to);
    const isPickable = (iso) =>
      (!todayIso || iso >= todayIso) &&
      (!dateWindow || (iso >= dateWindow.from && iso <= dateWindow.to));

    function renderStatus(message) {
      status.textContent =
        message ||
        (pendingStart
          ? t(
              'feedbackCalendarPickEnd',
              'Now tap the last day, or the same day again for a single day.'
            )
          : t('feedbackCalendarPickStart', 'Tap the first day you will be away.'));
      status.classList.toggle('date-status--warn', Boolean(message));
    }

    function renderChips() {
      chips.textContent = '';
      const list = ranges();
      if (!list.length) {
        const li = document.createElement('li');
        li.className = 'date-ranges-empty';
        li.textContent = t('feedbackCalendarNone', 'no dates chosen yet');
        chips.appendChild(li);
        return;
      }
      for (const range of list) {
        const li = document.createElement('li');
        li.className = 'date-chip';
        const text = document.createElement('span');
        text.textContent = formatDateRange(range);
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'date-chip-remove';
        remove.textContent = '×';
        remove.setAttribute(
          'aria-label',
          t('feedbackCalendarRemove', 'remove') + ': ' + formatDateRange(range)
        );
        remove.addEventListener('click', () => {
          setRanges(list.filter((r) => r !== range));
          renderGrid();
          renderChips();
          renderStatus();
        });
        li.append(text, remove);
        chips.appendChild(li);
      }
    }

    function pick(iso) {
      clearError(question);
      if (!pendingStart) {
        pendingStart = iso;
        renderGrid();
        renderStatus();
        return;
      }
      const from = pendingStart < iso ? pendingStart : iso;
      const to = pendingStart < iso ? iso : pendingStart;
      pendingStart = null;
      const merged = mergeDateRanges([...ranges(), { from, to }]);
      if (merged.length > maxRanges) {
        renderGrid();
        renderStatus(
          t('feedbackCalendarMax', 'You can add at most {n} periods.').replace(
            '{n}',
            String(maxRanges)
          )
        );
        return;
      }
      setRanges(merged);
      renderGrid();
      renderChips();
      renderStatus();
    }

    function renderGrid() {
      const { y, m } = view;
      monthLabel.textContent = new Intl.DateTimeFormat(currentLang() === 'de' ? 'de-CH' : 'en-GB', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(Date.UTC(y, m - 1, 1)));
      grid.textContent = '';
      // Monday = 0 … Sunday = 6
      const offset = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
      for (let i = 0; i < offset; i += 1) {
        const blank = document.createElement('span');
        blank.className = 'date-day date-day--blank';
        grid.appendChild(blank);
      }
      const daysInMonth = Math.round((Date.UTC(y, m, 1) - Date.UTC(y, m - 1, 1)) / DAY_MS);
      for (let d = 1; d <= daysInMonth; d += 1) {
        const iso = isoFromUtc(new Date(Date.UTC(y, m - 1, d)));
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'date-day';
        btn.dataset.date = iso;
        btn.textContent = String(d);
        const lesson = lessonDates.has(iso);
        const selected = isSelected(iso);
        if (lesson) btn.classList.add('date-day--lesson');
        if (selected) btn.classList.add('date-day--selected');
        if (iso === pendingStart) btn.classList.add('date-day--pending');
        if (iso === todayIso) btn.classList.add('date-day--today');
        btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
        btn.setAttribute(
          'aria-label',
          formatIso(iso, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) +
            (lesson ? ', ' + t('feedbackCalendarLesson', 'lesson day') : '')
        );
        if (!isPickable(iso)) {
          btn.disabled = true;
          btn.classList.add('date-day--outside');
        } else {
          btn.addEventListener('click', () => pick(iso));
        }
        grid.appendChild(btn);
      }
      // Stay inside the window the server accepts.
      prev.disabled =
        Boolean(dateWindow) &&
        isoFromUtc(new Date(Date.UTC(y, m - 1, 1))) <= dateWindow.from.slice(0, 7) + '-01';
      next.disabled =
        Boolean(dateWindow) && isoFromUtc(new Date(Date.UTC(y, m, 1))) > dateWindow.to;
    }

    function shiftMonth(delta) {
      const date = new Date(Date.UTC(view.y, view.m - 1 + delta, 1));
      view.y = date.getUTCFullYear();
      view.m = date.getUTCMonth() + 1;
      renderGrid();
    }
    prev.addEventListener('click', () => shiftMonth(-1));
    next.addEventListener('click', () => shiftMonth(1));

    calendar.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && pendingStart) {
        pendingStart = null;
        renderGrid();
        renderStatus();
      }
    });

    calendar.append(header, weekdays, grid);
    if (lessonDates.size) {
      const legend = document.createElement('p');
      legend.className = 'date-legend';
      const dot = document.createElement('span');
      dot.className = 'date-legend-dot';
      dot.setAttribute('aria-hidden', 'true');
      legend.append(dot, document.createTextNode(' ' + t('feedbackCalendarLesson', 'lesson day')));
      calendar.appendChild(legend);
    }
    calendar.appendChild(status);

    renderGrid();
    renderChips();
    renderStatus();

    wrap.append(calendar, chips);
    addError(wrap, question, t('feedbackChoiceRequired', 'Please choose an answer.'));
    return wrap;
  }

  const RENDERERS = {
    scale: renderScale,
    nps: renderScale,
    choice: renderChoice,
    multi: renderMulti,
    text: renderText,
    dateranges: renderDateRanges,
    daterange: renderDateRange,
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

  /* ── One date window, e.g. when a continuation course should start ──
     Two native date fields. The answer is stored once a first day exists;
     a missing last day means a single day. Nothing is pre-seeded, so a
     hidden follow-up can forget it again (see applyConditions).         */
  function renderDateRange(question) {
    const wrap = fieldset(question, 'daterange-field');
    addHint(wrap, question.hint || (question.required ? '' : t('feedbackOptional', 'optional')));

    const stored = answers[question.id];
    const row = document.createElement('div');
    row.className = 'daterange-row';

    const makeInput = (key, labelKey, fallback) => {
      const label = document.createElement('label');
      label.className = 'daterange-part';
      const text = document.createElement('span');
      text.className = 'daterange-part-label';
      text.textContent = t(labelKey, fallback);
      const input = document.createElement('input');
      input.type = 'date';
      input.className = 'daterange-input';
      input.id = 'date-' + key + '-' + question.id;
      if (dateWindow) {
        input.min = dateWindow.from;
        input.max = dateWindow.to;
      } else if (todayIso) {
        input.min = todayIso;
      }
      input.value = (stored && stored[key]) || '';
      label.append(text, input);
      row.appendChild(label);
      return input;
    };
    const fromInput = makeInput('from', 'feedbackDateFrom', 'from');
    const toInput = makeInput('to', 'feedbackDateTo', 'to');

    const update = () => {
      const from = fromInput.value;
      const to = toInput.value;
      // The last day cannot come before the first (the server would swap
      // them anyway, this just keeps the picker honest).
      toInput.min = from || dateWindow?.from || todayIso || '';
      if (from) answers[question.id] = { from, to: to || from };
      else delete answers[question.id];
      clearError(question);
    };
    for (const input of [fromInput, toInput]) {
      input.addEventListener('input', update);
      input.addEventListener('change', update);
    }

    wrap.appendChild(row);
    addError(wrap, question, t('feedbackDateRequired', 'Please choose a date.'));
    return wrap;
  }

  /* ── Conditional questions ──────────────────────────────────────── */
  /* Mirrors conditionMet in functions/api/_feedback.js. A controller that
     is null or unanswered never shows a follow-up (`null < 7` is true in
     JS, hence the type checks); a multi only counts once ticked, as
     renderMulti stores [] before anything is chosen. */
  function conditionMet(question) {
    const condition = question.showIf;
    if (!condition) return true;
    const answer = answers[condition.id];
    if (condition.values) return condition.values.includes(answer);
    if (condition.below !== undefined)
      return typeof answer === 'number' && answer < condition.below;
    if (condition.any) return Array.isArray(answer) && answer.length > 0;
    return false;
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
        // Every typed field, so a two-input date window forgets both days.
        const fields = card?.querySelectorAll('textarea, input[type="text"], input[type="date"]');
        for (const field of fields || []) field.value = '';
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
    if (question.type === 'multi' || question.type === 'dateranges') {
      return Array.isArray(value) && value.length > 0;
    }
    if (question.type === 'daterange') return Boolean(value?.from && value?.to);
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
      el?.closest('.question-card')
        ?.querySelector('input, textarea, button.date-day:not([disabled])')
        ?.focus();
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
      const res = await fetch(formApi, {
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
      const res = await fetch(formApi + '?token=' + encodeURIComponent(token));
      if (!res.ok) {
        // 404/410 mean the token itself is no good; anything else is our
        // problem, so don't tell the student their link is invalid.
        showOnly(res.status >= 500 ? unavailable : errorState);
        return;
      }
      const data = await res.json();
      questions = data.questions;
      course = data.course || null;
      lessonDates = new Set(Array.isArray(data.lessons) ? data.lessons : []);
      todayIso = data.today || null;
      dateWindow = data.window?.from && data.window?.to ? data.window : null;
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
