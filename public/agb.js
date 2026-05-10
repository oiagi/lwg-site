import { AGB_UPDATED, renderAgbLegalHtml } from '/agb-content.js';

function renderAgb() {
  const lang = window.LWG_I18N?.getLang() || document.documentElement.lang || 'de';
  document.querySelector('h1').textContent =
    lang === 'en' ? 'Terms & Conditions' : 'Allgemeine Geschäftsbedingungen';
  document.querySelector('.legal-meta').textContent = AGB_UPDATED[lang] || AGB_UPDATED.de;
  document.getElementById('agb-content').innerHTML = renderAgbLegalHtml(lang);
  window.LWG_I18N?.localizeInternalLinks?.(document.getElementById('agb-content'));
}

document.addEventListener('lwg:language-applied', renderAgb);
renderAgb();
