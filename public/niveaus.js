(function () {
  'use strict';

  var LEVEL_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  var LEVEL_INDEX = { A1: 0, A2: 1, B1: 2, B2: 3, C1: 4, C2: 5 };

  // Tracks selected level per skill (keyed by skill id)
  var selections = {};

  function lang() {
    return window.LWG_I18N ? window.LWG_I18N.getLang() : 'de';
  }

  function t(key) {
    return window.LWG_I18N ? window.LWG_I18N.t(key) : key;
  }

  // ── i18n for dynamic strings ──────────────────────────────────────
  var UI = {
    resultHeading: { en: 'Your language profile', de: 'Dein Sprachprofil' },
    resultOverallLabel: { en: 'overall level', de: 'Gesamtniveau' },
    resultNoteAll: {
      en: function (l) {
        return 'All five skills are at level ' + l + '.';
      },
      de: function (l) {
        return 'Alle fünf Fertigkeiten liegen auf dem Niveau ' + l + '.';
      },
    },
    resultNoteRange: {
      en: function (overall, strong, strongL, weak, weakL) {
        return (
          'Your overall level is around ' +
          overall +
          '. Your ' +
          strong +
          ' is the strongest (' +
          strongL +
          ') and your ' +
          weak +
          ' is the weakest (' +
          weakL +
          ').'
        );
      },
      de: function (overall, strong, strongL, weak, weakL) {
        return (
          'Dein Gesamtniveau liegt bei ' +
          overall +
          '. ' +
          strong +
          ' ist deine stärkste Fertigkeit (' +
          strongL +
          '), ' +
          weak +
          ' die schwächste (' +
          weakL +
          ').'
        );
      },
    },
    resultCtaText: {
      en: "Not sure about your level? We're happy to help you find the right course.",
      de: 'Unsicher über dein Niveau? Wir helfen dir gerne dabei, den richtigen Kurs zu finden.',
    },
    resultCtaBtn: { en: 'Book a free consultation →', de: 'Beratungsgespräch anfragen →' },
    hint: {
      en: 'Please select a level for each skill.',
      de: 'Bitte wähle für jede Fertigkeit ein Niveau.',
    },
    hintDone: { en: '', de: '' },
    seeResult: { en: 'See my result →', de: 'Ergebnis anzeigen →' },
    introHeading: { en: 'How self-assessment works', de: 'So funktioniert die Selbsteinschätzung' },
    introBody: {
      en: 'For each of the five skills, select the level that best describes you. Click a level to read its description, then choose the highest one that applies to you. At the end you will see your language profile.',
      de: 'Wähle für jede der fünf Fertigkeiten das Niveau, das dich am besten beschreibt. Klicke auf eine Stufe, um die Beschreibung zu lesen, und wähle die höchste, auf die du dich erkennst. Am Ende siehst du dein Sprachprofil.',
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
    var entry = UI[key];
    if (!entry) return key;
    var val = entry[lang()];
    return typeof val === 'function' ? val.apply(null, args || []) : val || key;
  }

  // ── Tab switching ─────────────────────────────────────────────────
  function initTabs() {
    var tabs = document.querySelectorAll('.tab[data-tab]');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
          t.tabIndex = -1;
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        tab.tabIndex = 0;
        document.querySelectorAll('.tab-content').forEach(function (panel) {
          panel.hidden = panel.id !== 'tab-' + tab.dataset.tab;
        });
      });
      tab.addEventListener('keydown', function (e) {
        var idx = Array.from(tabs).indexOf(tab);
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
    var grid = document.getElementById('niveauGrid');
    if (!grid) return;
    var l = lang();
    var html = NIVEAUS_DATA.LEVELS.map(function (level) {
      return (
        '<div class="niveau-card" data-group="' +
        level.group +
        '">' +
        '<div class="niveau-badge">' +
        level.id +
        '</div>' +
        '<div class="niveau-group-label">' +
        level.groupLabel[l] +
        '</div>' +
        '<p class="niveau-desc">' +
        level.globalScale[l] +
        '</p>' +
        '</div>'
      );
    }).join('');
    grid.innerHTML = html;
  }

  // ── Assessment tab ────────────────────────────────────────────────
  function renderAssessment() {
    var container = document.getElementById('skillSections');
    if (!container) return;
    var l = lang();
    var html = NIVEAUS_DATA.SKILLS.map(function (skill) {
      var rows = LEVEL_ORDER.map(function (levelId) {
        var selected = selections[skill.id] === levelId;
        return (
          '<button class="level-option' +
          (selected ? ' selected' : '') +
          '" ' +
          'data-skill="' +
          skill.id +
          '" data-level="' +
          levelId +
          '" ' +
          'role="radio" aria-checked="' +
          (selected ? 'true' : 'false') +
          '">' +
          '<span class="level-option-badge">' +
          levelId +
          '</span>' +
          '<span class="level-option-content">' +
          '<span class="level-option-indicator" aria-hidden="true"></span>' +
          '<span class="level-option-text">' +
          skill.descriptors[levelId][l] +
          '</span>' +
          '</span>' +
          '</button>'
        );
      }).join('');
      return (
        '<div class="skill-section">' +
        '<div class="skill-header">' +
        '<h3 class="skill-name">' +
        skill.label[l] +
        '</h3>' +
        '</div>' +
        '<div role="radiogroup" aria-label="' +
        skill.label[l] +
        '">' +
        rows +
        '</div>' +
        '</div>'
      );
    }).join('');
    container.innerHTML = html;

    container.addEventListener('click', function (e) {
      var btn = e.target.closest('.level-option');
      if (!btn) return;
      var skillId = btn.dataset.skill;
      var levelId = btn.dataset.level;
      selections[skillId] = levelId;
      updateAssessmentState();
      renderAssessment();
      scrollToSkillSection(skillId);
    });
  }

  function scrollToSkillSection(skillId) {
    var sections = document.querySelectorAll('.skill-section');
    var skills = NIVEAUS_DATA.SKILLS;
    var idx = skills.findIndex(function (s) {
      return s.id === skillId;
    });
    if (idx < 0 || idx >= sections.length - 1) return;
    var next = sections[idx + 1];
    if (next) {
      setTimeout(function () {
        next.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 80);
    }
  }

  function updateAssessmentState() {
    var allSelected = NIVEAUS_DATA.SKILLS.every(function (s) {
      return selections[s.id] !== undefined;
    });
    var btn = document.getElementById('assessmentSubmit');
    var hint = document.getElementById('assessmentHint');
    if (btn) btn.disabled = !allSelected;
    if (hint) hint.classList.toggle('hidden', allSelected);
  }

  // ── Result computation ────────────────────────────────────────────
  function computeResult() {
    var indices = NIVEAUS_DATA.SKILLS.map(function (s) {
      return LEVEL_INDEX[selections[s.id]] || 0;
    });
    var sum = indices.reduce(function (a, b) {
      return a + b;
    }, 0);
    var avg = sum / indices.length;
    var rounded = Math.round(avg);
    var overall = LEVEL_ORDER[Math.min(rounded, 5)];

    var maxIdx = indices.indexOf(Math.max.apply(null, indices));
    var minIdx = indices.indexOf(Math.min.apply(null, indices));
    var range = Math.max.apply(null, indices) - Math.min.apply(null, indices);

    return {
      overall: overall,
      indices: indices,
      range: range,
      strongestSkill: NIVEAUS_DATA.SKILLS[maxIdx],
      strongestLevel: LEVEL_ORDER[indices[maxIdx]],
      weakestSkill: NIVEAUS_DATA.SKILLS[minIdx],
      weakestLevel: LEVEL_ORDER[indices[minIdx]],
    };
  }

  function renderResult() {
    var r = computeResult();
    var l = lang();
    var card = document.getElementById('resultCard');
    var profileEl = document.getElementById('resultProfile');
    var overallEl = document.getElementById('resultOverall');
    if (!card || !profileEl || !overallEl) return;

    // Skill bars
    var profileHtml = NIVEAUS_DATA.SKILLS.map(function (skill, i) {
      var levelId = selections[skill.id];
      var pct = (((r.indices[i] + 1) / 6) * 100).toFixed(1);
      return (
        '<div class="result-row">' +
        '<span class="result-skill-label">' +
        skill.label[l] +
        '</span>' +
        '<div class="result-bar-track"><div class="result-bar-fill" style="width:' +
        pct +
        '%"></div></div>' +
        '<span class="result-level-badge">' +
        levelId +
        '</span>' +
        '</div>'
      );
    }).join('');
    profileEl.innerHTML = profileHtml;

    // Overall block
    var note;
    if (r.range === 0) {
      note = ui('resultNoteAll', [r.overall]);
    } else {
      var strongLabel = r.strongestSkill.label[l];
      var weakLabel = r.weakestSkill.label[l];
      note = ui('resultNoteRange', [
        r.overall,
        strongLabel,
        r.strongestLevel,
        weakLabel,
        r.weakestLevel,
      ]);
    }

    overallEl.innerHTML =
      '<div class="result-overall-level">' +
      r.overall +
      '</div>' +
      '<div class="result-overall-label">' +
      ui('resultOverallLabel') +
      '</div>' +
      '<p class="result-overall-note">' +
      note +
      '</p>';

    // Update card static text for current language
    var h2 = card.querySelector('h2');
    if (h2) h2.textContent = ui('resultHeading');
    var ctaText = card.querySelector('[data-i18n="niveaus-result-cta-text"]');
    if (ctaText) ctaText.textContent = ui('resultCtaText');
    var ctaBtn = card.querySelector('[data-i18n="niveaus-result-cta-btn"]');
    if (ctaBtn) ctaBtn.textContent = ui('resultCtaBtn');

    card.hidden = false;
    setTimeout(function () {
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }

  // ── Static text sync (for language switches) ──────────────────────
  function syncStaticText() {
    var map = {
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
    Object.keys(map).forEach(function (selector) {
      document.querySelectorAll(selector).forEach(function (el) {
        el.textContent = ui(map[selector]);
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

    var submitBtn = document.getElementById('assessmentSubmit');
    if (submitBtn) {
      submitBtn.addEventListener('click', function () {
        if (submitBtn.disabled) return;
        renderResult();
      });
    }

    document.addEventListener('lwg:language-applied', function () {
      renderOverview();
      var resultHidden =
        document.getElementById('resultCard') && document.getElementById('resultCard').hidden;
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
})();
