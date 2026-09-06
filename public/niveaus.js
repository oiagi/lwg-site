const { LEVELS, SKILLS } = window.LWG_NIVEAUS_DATA;

const LEVEL_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const LEVEL_INDEX = { A1: 0, A2: 1, B1: 2, B2: 3, C1: 4, C2: 5 };

// Tracks selected level per skill (keyed by skill id)
const selections = {};

function lang() {
  return window.LWG_I18N ? window.LWG_I18N.getLang() : 'de';
}

// ── i18n for dynamic strings ──────────────────────────────────────
const UI = {
  resultHeading: { en: 'Your language profile', de: 'Ihr Sprachprofil' },
  resultOverallLabel: { en: 'overall level', de: 'Gesamtniveau' },
  resultNoteAll: {
    en: (l) => `All five skills are at level ${l}.`,
    de: (l) => `Alle fünf Fertigkeiten liegen auf dem Niveau ${l}.`,
  },
  resultNoteRange: {
    en: (overall, strong, strongL, weak, weakL) =>
      `Your overall level is around ${overall}. Your ${strong} is the strongest (${strongL}) and your ${weak} is the weakest (${weakL}).`,
    de: (overall, strong, strongL, weak, weakL) =>
      `Ihr Gesamtniveau liegt bei ${overall}. ${strong} ist Ihre stärkste Fertigkeit (${strongL}), ${weak} die schwächste (${weakL}).`,
  },
  resultCtaText: {
    en: "Not sure about your level? We're happy to help you find the right course.",
    de: 'Unsicher über Ihr Niveau? Wir helfen Ihnen gerne dabei, den richtigen Kurs zu finden.',
  },
  resultCtaBtn: { en: 'Book a free consultation →', de: 'Beratungsgespräch anfragen →' },
  hint: {
    en: 'Please select a level for each skill.',
    de: 'Bitte wählen Sie für jede Fertigkeit ein Niveau.',
  },
  seeResult: { en: 'See my result →', de: 'Ergebnis anzeigen →' },
  introHeading: { en: 'How self-assessment works', de: 'So funktioniert die Selbsteinschätzung' },
  introBody: {
    en: 'For each of the five skills, select the level that best describes you. Click a level to read its description, then choose the highest one that applies to you. At the end you will see your language profile.',
    de: 'Wählen Sie für jede der fünf Fertigkeiten das Niveau, das Sie am besten beschreibt. Klicken Sie auf eine Stufe, um die Beschreibung zu lesen, und wählen Sie die höchste, in der Sie sich wiedererkennen. Am Ende sehen Sie Ihr Sprachprofil.',
  },
  sourcesHeading: { en: 'Sources', de: 'Quellen' },
  tabOverview: { en: 'Overview', de: 'Übersicht' },
  tabAssessment: { en: 'Self-assessment', de: 'Selbsteinschätzung' },
  title: { en: 'Language Levels', de: 'Sprachniveaus' },
  subtitle: {
    en: 'The six levels of the Common European Framework of Reference.',
    de: 'Die sechs Stufen des Gemeinsamen Europäischen Referenzrahmens.',
  },
};

function ui(key, args) {
  const entry = UI[key];
  if (!entry) return key;
  const val = entry[lang()];
  return typeof val === 'function' ? val(...(args || [])) : val || key;
}

// ── Tab switching ─────────────────────────────────────────────────
function initTabs() {
  const tabs = document.querySelectorAll('.tab[data-tab]');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
        t.tabIndex = -1;
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      tab.tabIndex = 0;
      document.querySelectorAll('.tab-content').forEach((panel) => {
        panel.hidden = panel.id !== `tab-${tab.dataset.tab}`;
      });
    });
    tab.addEventListener('keydown', (e) => {
      const idx = Array.from(tabs).indexOf(tab);
      if (e.key === 'ArrowRight') {
        tabs[(idx + 1) % tabs.length].click();
        tabs[(idx + 1) % tabs.length].focus();
      }
      if (e.key === 'ArrowLeft') {
        tabs[(idx - 1 + tabs.length) % tabs.length].click();
        tabs[(idx - 1 + tabs.length) % tabs.length].focus();
      }
    });
  });
}

// ── Overview tab ──────────────────────────────────────────────────
function renderOverview() {
  const grid = document.getElementById('niveauGrid');
  if (!grid) return;
  const l = lang();
  grid.innerHTML = LEVELS.map(
    (level) =>
      `<div class="niveau-card" data-group="${level.group}">` +
      `<div class="niveau-badge">${level.id}</div>` +
      `<div class="niveau-group-label">${level.groupLabel[l]}</div>` +
      `<p class="niveau-desc">${level.globalScale[l]}</p>` +
      `</div>`
  ).join('');
}

// ── Assessment tab ────────────────────────────────────────────────
function renderAssessment() {
  const container = document.getElementById('skillSections');
  if (!container) return;
  const l = lang();
  container.innerHTML = SKILLS.map((skill) => {
    const rows = LEVEL_ORDER.map((levelId) => {
      const selected = selections[skill.id] === levelId;
      return (
        `<button class="level-option${selected ? ' selected' : ''}" ` +
        `data-skill="${skill.id}" data-level="${levelId}" ` +
        `role="radio" aria-checked="${selected ? 'true' : 'false'}" type="button">` +
        `<span class="level-option-badge">${levelId}</span>` +
        `<span class="level-option-content">` +
        `<span class="level-option-indicator" aria-hidden="true"></span>` +
        `<span class="level-option-text">${skill.descriptors[levelId][l]}</span>` +
        `</span>` +
        `</button>`
      );
    }).join('');
    return (
      `<div class="skill-section">` +
      `<div class="skill-header"><h3 class="skill-name">${skill.label[l]}</h3></div>` +
      `<div role="radiogroup" aria-label="${skill.label[l]}">${rows}</div>` +
      `</div>`
    );
  }).join('');

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.level-option');
    if (!btn) return;
    const { skill: skillId, level: levelId } = btn.dataset;
    selections[skillId] = levelId;
    updateAssessmentState();
    renderAssessment();
    scrollToNextSkill(skillId);
  });
}

function scrollToNextSkill(skillId) {
  const sections = document.querySelectorAll('.skill-section');
  const idx = SKILLS.findIndex((s) => s.id === skillId);
  if (idx < 0 || idx >= sections.length - 1) return;
  setTimeout(() => {
    sections[idx + 1].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 80);
}

function updateAssessmentState() {
  const allSelected = SKILLS.every((s) => selections[s.id] !== undefined);
  const btn = document.getElementById('assessmentSubmit');
  const hint = document.getElementById('assessmentHint');
  if (btn) btn.disabled = !allSelected;
  if (hint) hint.classList.toggle('hidden', allSelected);
}

// ── Result computation ────────────────────────────────────────────
function computeResult() {
  const indices = SKILLS.map((s) => LEVEL_INDEX[selections[s.id]] ?? 0);
  const avg = indices.reduce((a, b) => a + b, 0) / indices.length;
  const overall = LEVEL_ORDER[Math.min(Math.round(avg), 5)];
  const max = Math.max(...indices);
  const min = Math.min(...indices);
  return {
    overall,
    indices,
    range: max - min,
    strongestSkill: SKILLS[indices.indexOf(max)],
    strongestLevel: LEVEL_ORDER[max],
    weakestSkill: SKILLS[indices.lastIndexOf(min)],
    weakestLevel: LEVEL_ORDER[min],
  };
}

function renderResult() {
  const r = computeResult();
  const l = lang();
  const card = document.getElementById('resultCard');
  const profileEl = document.getElementById('resultProfile');
  const overallEl = document.getElementById('resultOverall');
  if (!card || !profileEl || !overallEl) return;

  profileEl.innerHTML = SKILLS.map((skill, i) => {
    const levelId = selections[skill.id];
    const pct = (((r.indices[i] + 1) / 6) * 100).toFixed(1);
    return (
      `<div class="result-row">` +
      `<span class="result-skill-label">${skill.label[l]}</span>` +
      `<div class="result-bar-track"><div class="result-bar-fill" style="width:${pct}%"></div></div>` +
      `<span class="result-level-badge">${levelId}</span>` +
      `</div>`
    );
  }).join('');

  const note =
    r.range === 0
      ? ui('resultNoteAll', [r.overall])
      : ui('resultNoteRange', [
          r.overall,
          r.strongestSkill.label[l],
          r.strongestLevel,
          r.weakestSkill.label[l],
          r.weakestLevel,
        ]);

  overallEl.innerHTML =
    `<div class="result-overall-level">${r.overall}</div>` +
    `<div class="result-overall-label">${ui('resultOverallLabel')}</div>` +
    `<p class="result-overall-note">${note}</p>`;

  const h2 = card.querySelector('h2');
  if (h2) h2.textContent = ui('resultHeading');
  const ctaText = card.querySelector('[data-i18n="niveaus-result-cta-text"]');
  if (ctaText) ctaText.textContent = ui('resultCtaText');
  const ctaBtn = card.querySelector('[data-i18n="niveaus-result-cta-btn"]');
  if (ctaBtn) ctaBtn.textContent = ui('resultCtaBtn');

  card.hidden = false;
  setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
}

// ── Static text sync ──────────────────────────────────────────────
function syncStaticText() {
  const map = {
    '[data-i18n="niveaus-title"]': 'title',
    '[data-i18n="niveaus-subtitle"]': 'subtitle',
    '[data-i18n="niveaus-tab-overview"]': 'tabOverview',
    '[data-i18n="niveaus-tab-assessment"]': 'tabAssessment',
    '[data-i18n="niveaus-assessment-intro-heading"]': 'introHeading',
    '[data-i18n="niveaus-assessment-intro-body"]': 'introBody',
    '[data-i18n="niveaus-hint"]': 'hint',
    '[data-i18n="niveaus-see-result"]': 'seeResult',
    '[data-i18n="niveaus-result-heading"]': 'resultHeading',
    '[data-i18n="niveaus-result-cta-text"]': 'resultCtaText',
    '[data-i18n="niveaus-result-cta-btn"]': 'resultCtaBtn',
    '[data-i18n="niveaus-sources-heading"]': 'sourcesHeading',
  };
  Object.entries(map).forEach(([selector, key]) => {
    document.querySelectorAll(selector).forEach((el) => {
      el.textContent = ui(key);
    });
  });
}

// ── Boot ──────────────────────────────────────────────────────────
function init() {
  initTabs();
  renderOverview();
  renderAssessment();
  updateAssessmentState();
  syncStaticText();

  const submitBtn = document.getElementById('assessmentSubmit');
  if (submitBtn) {
    submitBtn.addEventListener('click', () => {
      if (!submitBtn.disabled) renderResult();
    });
  }

  document.addEventListener('lwg:language-applied', () => {
    renderOverview();
    const resultHidden = document.getElementById('resultCard')?.hidden ?? true;
    renderAssessment();
    if (!resultHidden) renderResult();
    updateAssessmentState();
    syncStaticText();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
