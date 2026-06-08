const subjunktionenData = window.LWG_SUBJUNKTIONEN_DATA || {};
const { connectors, categories, categoriesEn, uiCopy, quizQuestions } = subjunktionenData;

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
  document.querySelectorAll('.tab-content').forEach((panel) => {
    panel.hidden = true;
  });
  document.getElementById('tab-' + tabName).hidden = false;

  document.querySelectorAll('.tab').forEach((tab) => {
    tab.classList.remove('active');
    tab.setAttribute('aria-selected', 'false');
    tab.setAttribute('tabindex', '-1');
  });
  activeBtn.classList.add('active');
  activeBtn.setAttribute('aria-selected', 'true');
  activeBtn.setAttribute('tabindex', '0');

  if (tabName === 'quiz') openQuizTab();
  if (tabName === 'cheatsheet') renderCheatSheet();
}

function highlightConnector(text) {
  return text.replace(/\{([^}]+)\}/g, '<span class="highlight">$1</span>');
}

function renderReference() {
  const grid = document.getElementById('connectorGrid');
  grid.innerHTML = connectors
    .map((item) => {
      const exampleHtml = item.examples
        .map(
          (example) => `<div class="example-box">
    <div class="de">${highlightConnector(example.de)}</div>
    <div class="en">${example.en}</div>
  </div>`
        )
        .join('');
      const categoryLabel =
        currentLang() === 'en' ? categoriesEn[item.category] : categories[item.category].label;
      return `<div class="particle-card" role="button" tabindex="0" aria-expanded="false" data-expand-card>
  <div class="particle-name">${item.name}</div>
  <div class="particle-function">${localizedField(item, 'function')}</div>
  <div class="connector-meta">
    <span class="connector-pill">${categoryLabel}</span>
    <span class="connector-pill">${ui('verbFinal')}</span>
  </div>
  <div class="particle-meaning">${localizedField(item, 'meaning')}</div>
  ${exampleHtml}
  <div class="expand-hint">${ui('expandHint')}</div>
  <div class="connector-warning">${localizedField(item, 'tip')}</div>
</div>`;
    })
    .join('');

  grid.querySelectorAll('[data-expand-card]').forEach((card) => {
    card.addEventListener('click', () => toggleCard(card));
  });

  grid.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('.particle-card');
    if (!card) return;
    toggleCard(card);
    e.preventDefault();
  });
}

function toggleCard(card) {
  card.classList.toggle('expanded');
  card.setAttribute('aria-expanded', card.classList.contains('expanded'));
}

let selectedConnectors = new Set(connectors.map((item) => item.name));
let quizState = {
  status: 'not_started',
  current: 0,
  score: 0,
  answers: [],
  shuffled: [],
};

function getQuizConnectors() {
  const names = new Set();
  quizQuestions.forEach((q) => q.answers.forEach((answer) => names.add(answer.value)));
  return connectors.map((item) => item.name).filter((name) => names.has(name));
}

function getFilteredQuizQuestions() {
  return quizQuestions.filter((q) =>
    q.answers.some((answer) => selectedConnectors.has(answer.value))
  );
}

function renderConnectorSelector() {
  const quizConnectors = getQuizConnectors();
  const selectedCount = quizConnectors.filter((name) => selectedConnectors.has(name)).length;
  const buttons = quizConnectors
    .map((name) => {
      const active = selectedConnectors.has(name);
      return `<button class="particle-filter${active ? ' active' : ''}" type="button" data-connector="${name}" aria-pressed="${active}">${name}</button>`;
    })
    .join('');

  return `<div class="quiz-filter" aria-label="${ui('chooseConnectors')}">
  <div class="quiz-filter-header">
    <div>
      <div class="filter-title">${ui('chooseConnectors')}</div>
      <div class="filter-count">${selectedCount} ${ui('selectedCount')}</div>
    </div>
    <div class="filter-actions">
      <button class="filter-action" type="button" data-filter-action="all">${ui('allConnectors')}</button>
      <button class="filter-action" type="button" data-filter-action="clear">${ui('clearConnectors')}</button>
    </div>
  </div>
  <div class="particle-filter-list">${buttons}</div>
</div>`;
}

function attachSelectorListeners(area) {
  area.querySelectorAll('.particle-filter').forEach((btn) => {
    btn.addEventListener('click', () => {
      const name = btn.dataset.connector;
      if (selectedConnectors.has(name)) {
        selectedConnectors.delete(name);
      } else {
        selectedConnectors.add(name);
      }
      initQuiz();
    });
  });

  area.querySelectorAll('[data-filter-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.filterAction === 'all') {
        selectedConnectors = new Set(getQuizConnectors());
      } else {
        selectedConnectors.clear();
      }
      initQuiz();
    });
  });
}

function shuffle(items) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function openQuizTab() {
  if (quizState.status === 'not_started' || quizState.status === 'completed') {
    initQuiz();
  } else {
    renderQuizQuestion();
  }
}

function initQuiz() {
  quizState = {
    status: 'in_progress',
    current: 0,
    score: 0,
    answers: [],
    shuffled: shuffle(getFilteredQuizQuestions()).slice(0, 10),
  };
  renderQuizQuestion();
}

function renderQuizQuestion() {
  const area = document.getElementById('quizArea');
  const selectorHtml = renderConnectorSelector();

  if (selectedConnectors.size === 0) {
    area.innerHTML = `${selectorHtml}<div class="quiz-empty">${ui('noQuestions')}</div>`;
    attachSelectorListeners(area);
    return;
  }

  if (!quizState.shuffled.length) {
    area.innerHTML = `${selectorHtml}<div class="quiz-empty">${ui('noMatchingQuestions')}</div>`;
    attachSelectorListeners(area);
    return;
  }

  if (quizState.current >= quizState.shuffled.length) {
    finishQuiz();
    return;
  }

  const q = quizState.shuffled[quizState.current];
  const dots = quizState.shuffled
    .map((_, i) => {
      let cls = 'quiz-dot';
      if (i < quizState.current) cls += quizState.answers[i] ? ' correct' : ' wrong';
      if (i === quizState.current) cls += ' current';
      return `<div class="${cls}"></div>`;
    })
    .join('');
  const optionsHtml = shuffle(q.options)
    .map((option) => `<button class="option-btn" data-value="${option}">${option}</button>`)
    .join('');

  area.innerHTML = `${selectorHtml}
<div class="quiz-progress" aria-hidden="true">${dots}</div>
<div class="quiz-card">
  <div class="q-number">${ui('question')} ${quizState.current + 1} ${ui('of')} ${quizState.shuffled.length}</div>
  <div class="q-sentence">${q.sentence.replace('___', '<span class="blank">___</span>')}</div>
  <div class="q-translation">${q.translation}</div>
  <div class="q-context">${localizedField(q, 'context')}</div>
  <div class="options" role="group" aria-label="${ui('answers')}">${optionsHtml}</div>
  <div class="explanation-box" id="explanation" role="status" aria-live="polite"></div>
  <button class="action-btn" id="nextBtn">${ui('next')}</button>
</div>`;

  attachSelectorListeners(area);
  area.querySelectorAll('.option-btn').forEach((btn) => {
    btn.addEventListener('click', () => selectAnswer(btn, btn.dataset.value, q));
  });
  document.getElementById('nextBtn').addEventListener('click', nextQuestion);
}

function selectAnswer(btn, selected, question) {
  const correctValues = question.answers.map((answer) => answer.value);
  document.querySelectorAll('.option-btn').forEach((option) => {
    option.classList.add('disabled');
    if (correctValues.includes(option.dataset.value)) option.classList.add('correct');
    if (option.dataset.value === selected && !correctValues.includes(selected)) {
      option.classList.add('wrong');
    }
  });
  btn.classList.add('selected');

  const isCorrect = correctValues.includes(selected);
  quizState.answers.push(isCorrect);
  if (isCorrect) quizState.score++;

  const blank = document.querySelector('.blank');
  if (blank) {
    blank.textContent = isCorrect ? selected : correctValues[0];
    blank.classList.add('is-answered', isCorrect ? 'is-correct' : 'is-wrong');
  }

  const explanation = document.getElementById('explanation');
  explanation.innerHTML = `<strong>${ui('acceptedAnswers')}:</strong><ul>${question.answers
    .map(
      (answer) =>
        `<li><span class="answer-name">${answer.value}</span> ${localizedField(answer, 'explanation')}</li>`
    )
    .join('')}</ul>`;
  explanation.classList.add('visible');
  document.getElementById('nextBtn').classList.add('visible');
}

function nextQuestion() {
  quizState.current++;
  renderQuizQuestion();
}

function finishQuiz() {
  quizState.status = 'completed';
  const area = document.getElementById('quizArea');
  const resultSet = uiCopy.results[currentLang()] || uiCopy.results.de;
  const messageSet = uiCopy.messages[currentLang()] || uiCopy.messages.de;
  const heading =
    quizState.score >= 8 ? resultSet[0] : quizState.score >= 5 ? resultSet[1] : resultSet[2];
  const message =
    quizState.score >= 8 ? messageSet[0] : quizState.score >= 5 ? messageSet[1] : messageSet[2];

  area.innerHTML = `${renderConnectorSelector()}
<div class="results-card">
  <h2>${heading}</h2>
  <div class="score">${quizState.score} / ${quizState.shuffled.length}</div>
  <p class="score-label">${message}</p>
  <button class="action-btn visible" id="restartBtn">${ui('restart')}</button>
</div>`;
  attachSelectorListeners(area);
  document.getElementById('restartBtn').addEventListener('click', initQuiz);
}

function renderCheatSheet() {
  const sheet = document.getElementById('cheatSheet');
  if (sheet.innerHTML.trim()) return;

  const groups = {};
  connectors.forEach((item) => {
    if (!groups[item.category]) groups[item.category] = [];
    groups[item.category].push(item);
  });

  sheet.innerHTML = Object.entries(groups)
    .map(([category, items]) => {
      const label = currentLang() === 'en' ? categoriesEn[category] : categories[category].label;
      const rows = items
        .map((item) => {
          const example = item.examples[0].de.replace(/\{([^}]+)\}/g, '$1');
          return `<div class="cs-row subjunktion-row">
    <div class="cs-particle">${item.name}</div>
    <div class="cs-function">${localizedField(item, 'function')}</div>
    <div class="cs-example">${example}</div>
  </div>`;
        })
        .join('');
      return `<div class="cs-group"><h3>${label}</h3>${rows}</div>`;
    })
    .join('');
}

renderReference();

document.addEventListener('lwg:language-applied', () => {
  renderReference();
  document.getElementById('cheatSheet').innerHTML = '';
  if (!document.getElementById('tab-cheatsheet').hidden) renderCheatSheet();
  if (!document.getElementById('tab-quiz').hidden) renderQuizQuestion();
});
