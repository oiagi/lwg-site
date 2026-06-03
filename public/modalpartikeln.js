// ========== DATA ==========
const modalpartikelnData = window.LWG_MODALPARTIKELN_DATA || {};
const { particles, categories, categoriesEn, uiCopy, quizQuestions } = modalpartikelnData;

function currentLang() {
  return window.LWG_I18N?.getLang() || document.documentElement.lang || 'de';
}

function ui(key) {
  const value = uiCopy[key];
  return value ? value[currentLang()] || value.de : key;
}

function localizedField(item, field) {
  if (currentLang() === 'en' && item[field + 'En']) return item[field + 'En'];
  if (currentLang() === 'de' && item[field + 'De']) return item[field + 'De'];
  return item[field];
}

const exampleTypeLabels = {
  Aufforderung: { en: 'Request', de: 'Aufforderung' },
  Aufforderungssatz: { en: 'Request', de: 'Aufforderungssatz' },
  Aussagesatz: { en: 'Statement', de: 'Aussagesatz' },
  Ausrufesatz: { en: 'Exclamation', de: 'Ausrufesatz' },
  Frage: { en: 'Question', de: 'Frage' },
  'Ja-Nein-Frage': { en: 'Yes/no question', de: 'Ja-Nein-Frage' },
  'W-Frage': { en: 'W-question', de: 'W-Frage' },
  Wunschsatz: { en: 'Wish', de: 'Wunschsatz' },
};

function localizedExampleType(type) {
  if (!type) return '';
  return exampleTypeLabels[type]?.[currentLang()] || type;
}

// ========== TAB SWITCHING ==========
const tabsEl = document.querySelector('[role="tablist"]');

tabsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-tab]');
  if (!btn) return;
  switchTab(btn.dataset.tab, btn);
});

tabsEl.addEventListener('keydown', (e) => {
  const tabs = Array.from(tabsEl.querySelectorAll('[role="tab"]'));
  const idx = tabs.indexOf(document.activeElement);
  if (idx === -1) return;
  if (e.key === 'ArrowRight') {
    const next = tabs[(idx + 1) % tabs.length];
    next.focus();
    switchTab(next.dataset.tab, next);
    e.preventDefault();
  } else if (e.key === 'ArrowLeft') {
    const prev = tabs[(idx - 1 + tabs.length) % tabs.length];
    prev.focus();
    switchTab(prev.dataset.tab, prev);
    e.preventDefault();
  }
});

function switchTab(tabName, activeBtn) {
  document.querySelectorAll('.tab-content').forEach((p) => {
    p.hidden = true;
  });
  document.getElementById('tab-' + tabName).hidden = false;

  document.querySelectorAll('.tab').forEach((t) => {
    t.classList.remove('active');
    t.setAttribute('aria-selected', 'false');
    t.setAttribute('tabindex', '-1');
  });
  activeBtn.classList.add('active');
  activeBtn.setAttribute('aria-selected', 'true');
  activeBtn.setAttribute('tabindex', '0');

  if (tabName === 'quiz') openQuizTab();
  if (tabName === 'cheatsheet') renderCheatSheet();
}

// ========== REFERENCE CARDS ==========
function renderReference() {
  const grid = document.getElementById('particleGrid');
  grid.innerHTML = particles
    .map((p) => {
      const exHtml = p.examples
        .map((ex) => {
          const deHtml = ex.de.replace(/\{([\wäöüÄÖÜß ]+)\}/g, '<span class="highlight">$1</span>');
          const typeHtml = ex.type
            ? `<div class="example-type">${localizedExampleType(ex.type)}</div>`
            : '';
          return `<div class="example-box">
    ${typeHtml}
    <div class="de">${deHtml}</div>
    <div class="en">${ex.en}</div>
  </div>`;
        })
        .join('');
      const contexts = localizedField(p, 'contexts');
      const contextsHtml = contexts ? `<div class="particle-contexts">${contexts}</div>` : '';

      return `<div class="particle-card" role="button" tabindex="0" aria-expanded="false" data-expand-card>
  <div class="particle-name">${p.name}</div>
  <div class="particle-function">${localizedField(p, 'function')}</div>
  ${contextsHtml}
  <div class="particle-meaning">${localizedField(p, 'meaning')}</div>
  ${exHtml}
  <div class="expand-hint">${ui('expandHint')}</div>
  <div class="tip">${localizedField(p, 'tip')}</div>
</div>`;
    })
    .join('');

  grid.querySelectorAll('[data-expand-card]').forEach((card) => {
    card.addEventListener('click', () => {
      card.classList.toggle('expanded');
      card.setAttribute('aria-expanded', card.classList.contains('expanded'));
    });
  });

  // keyboard support for cards
  grid.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const card = e.target.closest('.particle-card');
      if (card) {
        card.classList.toggle('expanded');
        card.setAttribute('aria-expanded', card.classList.contains('expanded'));
        e.preventDefault();
      }
    }
  });
}

// ========== QUIZ ==========
let quizState = {
  status: 'not_started', // 'in_progress' | 'completed'
  current: 0,
  score: 0,
  answers: [],
  shuffled: [],
};
let selectedQuizParticles = new Set(particles.map((p) => p.name));

function getQuizParticles() {
  const names = new Set();
  quizQuestions.forEach((q) => {
    q.answers.forEach((answer) => names.add(answer.value));
  });
  return particles.map((p) => p.name).filter((name) => names.has(name));
}

function getFilteredQuizQuestions() {
  return quizQuestions.filter((q) =>
    q.answers.some((answer) => selectedQuizParticles.has(answer.value))
  );
}

function renderParticleSelector() {
  const quizParticles = getQuizParticles();
  const selectedCount = quizParticles.filter((name) => selectedQuizParticles.has(name)).length;
  const buttons = quizParticles
    .map((name) => {
      const isSelected = selectedQuizParticles.has(name);
      return `<button class="particle-filter${isSelected ? ' active' : ''}" type="button" data-particle="${name}" aria-pressed="${isSelected}">${name}</button>`;
    })
    .join('');

  return `
<div class="quiz-filter" aria-label="${ui('chooseParticles')}">
  <div class="quiz-filter-header">
    <div>
      <div class="filter-title">${ui('chooseParticles')}</div>
      <div class="filter-count">${selectedCount} ${ui('selectedCount')}</div>
    </div>
    <div class="filter-actions">
      <button class="filter-action" type="button" data-filter-action="all">${ui('allParticles')}</button>
      <button class="filter-action" type="button" data-filter-action="clear">${ui('clearParticles')}</button>
    </div>
  </div>
  <div class="particle-filter-list">${buttons}</div>
</div>
  `;
}

function attachParticleSelectorListeners(area) {
  area.querySelectorAll('.particle-filter').forEach((btn) => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.particle;
      if (selectedQuizParticles.has(name)) {
        selectedQuizParticles.delete(name);
      } else {
        selectedQuizParticles.add(name);
      }
      initQuiz();
    });
  });

  area.querySelectorAll('[data-filter-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.filterAction === 'all') {
        selectedQuizParticles = new Set(getQuizParticles());
      } else {
        selectedQuizParticles.clear();
      }
      initQuiz();
    });
  });
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function openQuizTab() {
  if (quizState.status === 'not_started' || quizState.status === 'completed') {
    initQuiz();
  } else {
    renderQuizQuestion();
  }
}

function initQuiz() {
  const filteredQuestions = getFilteredQuizQuestions();
  quizState = {
    status: 'in_progress',
    current: 0,
    score: 0,
    answers: [],
    shuffled: shuffle(filteredQuestions).slice(0, 10),
  };
  renderQuizQuestion();
}

function renderQuizQuestion() {
  const area = document.getElementById('quizArea');
  const { current, shuffled } = quizState;
  const selectorHtml = renderParticleSelector();

  if (selectedQuizParticles.size === 0) {
    area.innerHTML = `${selectorHtml}<div class="quiz-empty">${ui('noQuestions')}</div>`;
    attachParticleSelectorListeners(area);
    return;
  }

  if (!shuffled.length) {
    area.innerHTML = `${selectorHtml}<div class="quiz-empty">${ui('noMatchingQuestions')}</div>`;
    attachParticleSelectorListeners(area);
    return;
  }

  if (current >= shuffled.length) {
    finishQuiz();
    return;
  }

  const q = shuffled[current];
  const dots = shuffled
    .map((_, i) => {
      let cls = 'quiz-dot';
      if (i < current) cls += quizState.answers[i] ? ' correct' : ' wrong';
      if (i === current) cls += ' current';
      return `<div class="${cls}"></div>`;
    })
    .join('');

  const sentenceHtml = q.sentence.replace('___', '<span class="blank">___</span>');
  const optionsHtml = shuffle(q.options)
    .map((o) => `<button class="option-btn" data-value="${o}">${o}</button>`)
    .join('');

  area.innerHTML = `
${selectorHtml}
<div class="quiz-progress" aria-hidden="true">${dots}</div>
<div class="quiz-card">
  <div class="q-number">${ui('question')} ${current + 1} ${ui('of')} ${shuffled.length}</div>
  <div class="q-sentence">${sentenceHtml}</div>
  <div class="q-translation">${q.translation}</div>
  <div class="q-context">${localizedField(q, 'context')}</div>
  <div class="options" role="group" aria-label="${ui('answers')}">${optionsHtml}</div>
  <div class="explanation-box" id="explanation" role="status" aria-live="polite"></div>
  <button class="action-btn" id="nextBtn">${ui('next')}</button>
</div>
  `;

  attachParticleSelectorListeners(area);

  // Attach listeners to option buttons
  area.querySelectorAll('.option-btn').forEach((btn) => {
    btn.addEventListener('click', () => selectAnswer(btn, btn.dataset.value, q));
  });

  document.getElementById('nextBtn').addEventListener('click', nextQuestion);
}

function selectAnswer(btn, selected, q) {
  const correctValues = q.answers.map((answer) => answer.value);
  const btns = document.querySelectorAll('.option-btn');
  btns.forEach((b) => {
    b.classList.add('disabled');
    if (correctValues.includes(b.dataset.value)) b.classList.add('correct');
    if (b.dataset.value === selected && !correctValues.includes(selected)) b.classList.add('wrong');
  });
  btn.classList.add('selected');

  const isCorrect = correctValues.includes(selected);
  quizState.answers.push(isCorrect);
  if (isCorrect) quizState.score++;

  // Fill blank with answer
  const blank = document.querySelector('.blank');
  if (blank) {
    blank.textContent = isCorrect ? selected : correctValues[0];
    blank.classList.add('is-answered', isCorrect ? 'is-correct' : 'is-wrong');
  }

  const expl = document.getElementById('explanation');
  expl.innerHTML = `<strong>${ui('acceptedAnswers')}:</strong><ul>${q.answers
    .map(
      (answer) =>
        `<li><span class="answer-name">${answer.value}</span> ${localizedField(answer, 'explanation')}</li>`
    )
    .join('')}</ul>`;
  expl.classList.add('visible');

  document.getElementById('nextBtn').classList.add('visible');
}

function nextQuestion() {
  quizState.current++;
  renderQuizQuestion();
}

function finishQuiz() {
  quizState.status = 'completed';
  const area = document.getElementById('quizArea');
  const { score, shuffled } = quizState;
  const total = shuffled.length;
  const resultSet = uiCopy.results[currentLang()] || uiCopy.results.de;
  const messageSet = uiCopy.messages[currentLang()] || uiCopy.messages.de;
  const heading = score >= 8 ? resultSet[0] : score >= 5 ? resultSet[1] : resultSet[2];
  const msg = score >= 8 ? messageSet[0] : score >= 5 ? messageSet[1] : messageSet[2];
  const selectorHtml = renderParticleSelector();

  area.innerHTML = `
${selectorHtml}
<div class="results-card">
  <h2>${heading}</h2>
  <div class="score">${score} / ${total}</div>
  <p class="score-label">${msg}</p>
  <button class="action-btn visible" id="restartBtn">${ui('restart')}</button>
</div>
  `;
  attachParticleSelectorListeners(area);
  document.getElementById('restartBtn').addEventListener('click', initQuiz);
}

// ========== CHEAT SHEET ==========
function renderCheatSheet() {
  const sheet = document.getElementById('cheatSheet');
  if (sheet.innerHTML.trim()) return; // already rendered

  const groups = {};
  particles.forEach((p) => {
    if (!groups[p.category]) groups[p.category] = [];
    groups[p.category].push(p);
  });

  let html = '';
  for (const [cat, items] of Object.entries(groups)) {
    const catInfo = categories[cat];
    const label = currentLang() === 'en' ? categoriesEn[cat] : catInfo.label;
    html += `<div class="cs-group"><h3>${label}</h3>`;
    items.forEach((p) => {
      const ex = p.examples[0];
      const exText = ex.de.replace(/\{([\wäöüÄÖÜß ]+)\}/g, '$1');
      html += `<div class="cs-row">
    <div class="cs-particle">${p.name}</div>
    <div class="cs-function">${localizedField(p, 'function')}</div>
    <div class="cs-example">${exText}</div>
  </div>`;
    });
    html += '</div>';
  }
  sheet.innerHTML = html;
}

// ========== INIT ==========
renderReference();
document.addEventListener('lwg:language-applied', () => {
  renderReference();
  document.getElementById('cheatSheet').innerHTML = '';
  if (!document.getElementById('tab-cheatsheet').hidden) renderCheatSheet();
  if (!document.getElementById('tab-quiz').hidden) renderQuizQuestion();
});
