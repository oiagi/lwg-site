// Server-rendered navigation and footer.
//
// Previously built in the browser by public/nav.js, which meant the raw HTML of
// every page contained no navigation, no footer and no internal links at all.
// Rendering it here gives crawlers a real internal link graph, and makes the
// language switcher a crawlable <a href="/de/…"> pair instead of two <button>s —
// the only inbound path to the German URLs besides the sitemap.

import { nav, pagePath } from './_i18n-content.js';

function t(key, lang) {
  const entry = nav[key];
  return entry ? entry[lang] : key;
}

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function navLink(page, key, lang, currentPage, hash) {
  const target = pagePath(page, lang) + (hash ? '#' + hash : '');
  // Section links point at a homepage anchor and never mark as current page.
  const current = !hash && page === currentPage ? ' aria-current="page"' : '';
  return (
    `<a href="${esc(target)}" data-page="${esc(page)}"` +
    (hash ? ` data-hash="${esc(hash)}"` : '') +
    ` data-nav-key="${esc(key)}"${current}>${t(key, lang)}</a>`
  );
}

function navSection(headerLink, subLinks) {
  return `<div class="nav-section">${headerLink}<div class="nav-submenu">${subLinks.join('')}</div></div>`;
}

function languageSwitcher(page, lang) {
  // Real links so both language versions are discoverable; the active one is a
  // <span> because linking a page to itself is noise for crawlers and readers.
  const option = (code, label) =>
    code === lang
      ? `<span class="language-option active" aria-current="true">${label}</span>`
      : `<a class="language-option" href="${esc(pagePath(page, code))}" hreflang="${code}" rel="alternate" data-lang="${code}">${label}</a>`;
  return (
    `<div class="language-switcher site-language" aria-label="${esc(t('language', lang))}">` +
    option('en', 'EN') +
    '<span aria-hidden="true">/</span>' +
    option('de', 'DE') +
    '</div>'
  );
}

export function navMarkup(page, lang) {
  const link = (target, key, hash) => navLink(target, key, lang, page, hash);
  return (
    `<a href="#content" class="skip-link">${t('skip', lang)}</a>` +
    languageSwitcher(page, lang) +
    '<div class="nav-overlay" id="nav-overlay"></div>' +
    '<nav class="nav" id="nav">' +
    '<button class="nav-toggle" id="nav-toggle" type="button" aria-label="Toggle navigation">' +
    `<span class="nav-toggle-label" id="nav-toggle-label">${t('menu', lang)}</span>` +
    '</button>' +
    '<div class="nav-menu" id="nav-menu">' +
    link('/index.html', 'home') +
    navSection(link('/index.html', 'offer', 'offer'), [
      link('/german-courses.html', 'germanCourses'),
      link('/swiss-german.html', 'swissGerman'),
      link('/gymivorbereitung.html', 'gymivorbereitung'),
      link('/english-courses.html', 'englishCourses'),
      link('/exam-preparation.html', 'examPreparation'),
      link('/company-courses.html', 'companyCourses'),
      link('/lunch-time-german.html', 'lunchTimeGerman'),
    ]) +
    link('/index.html', 'courseStructure', 'offer-details') +
    navSection(link('/index.html', 'levels', 'levels'), [link('/niveaus.html', 'niveaus')]) +
    navSection(link('/index.html', 'materials', 'materials'), [
      link('/konjunktionen.html', 'konjunktionen'),
      link('/modalpartikeln.html', 'modalpartikeln'),
      link('/subjunktionen.html', 'subjunktionen'),
    ]) +
    link('/index.html', 'reviews', 'reviews') +
    link('/index.html', 'about', 'about') +
    navSection(link('/index.html', 'start', 'start'), [
      link('/group-courses.html', 'groupCourses'),
    ]) +
    link('/enquiry.html', 'enquiry') +
    '</div>' +
    '</nav>'
  );
}

export function footerMarkup(page, lang) {
  const link = (target, key) => navLink(target, key, lang, page);
  return (
    `<footer class="site-footer" aria-label="${esc(t('legalLabel', lang))}">` +
    link('/impressum.html', 'impressum') +
    link('/datenschutzerklaerung.html', 'privacy') +
    link('/agb.html', 'terms') +
    '</footer>'
  );
}
