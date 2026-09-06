// Single source of truth for page copy and routing.
//
// Consumed server-side by _render.js to produce language-correct HTML. The
// browser no longer needs any of this: public/i18n.js keeps only the runtime
// strings for JS-rendered widgets.
//
// `text` keys are CSS selectors; values are { en, de } strings that may contain
// HTML. The selector subset used here is the one HTMLRewriter supports: tag,
// #id, .class, and descendant combinators.

export const SUPPORTED = ['en', 'de'];

// Slugs are per language. German buyers search in German, so the German URL
// carries the German word — /de/deutschkurse, not /de/german-courses.
//
// English slugs are deliberately unchanged from what the site has always
// served: they hold whatever ranking equity exists. The German ones cost
// nothing to move, because until this branch every /de/ URL served English
// HTML to crawlers anyway.
//
// A slug from the wrong language set is not a 404 — pageForAnySlug resolves it
// and _render.js 301s to the same page's slug in the requested language.
export const ROUTES = {
  '/index.html': { en: '', de: '' },
  '/group-courses.html': { en: 'group-courses', de: 'gruppenkurse' },
  '/enquiry.html': { en: 'enquiry', de: 'anfrage' },
  '/thankyou.html': { en: 'thankyou', de: 'danke' },
  '/impressum.html': { en: 'impressum', de: 'impressum' },
  '/datenschutzerklaerung.html': { en: 'datenschutzerklaerung', de: 'datenschutzerklaerung' },
  '/agb.html': { en: 'agb', de: 'agb' },
  '/modalpartikeln.html': { en: 'modalpartikeln', de: 'modalpartikeln' },
  '/subjunktionen.html': { en: 'subjunktionen', de: 'subjunktionen' },
  '/konjunktionen.html': { en: 'konjunktionen', de: 'konjunktionen' },
  '/niveaus.html': { en: 'niveaus', de: 'niveaus' },
  '/intake.html': { en: 'intake', de: 'intake' },
  '/feedback.html': { en: 'feedback', de: 'feedback' },
};

// One slug -> page lookup per language.
export const PAGE_BY_ROUTE = SUPPORTED.reduce((byLang, lang) => {
  byLang[lang] = Object.entries(ROUTES).reduce((acc, [page, slugs]) => {
    acc[slugs[lang]] = page;
    return acc;
  }, {});
  return byLang;
}, {});

// Pages whose primary audience reads German. Drives <html lang> when no
// prefix resolves, and the hreflang x-default target.
export const DEFAULT_BY_PAGE = {
  '/impressum.html': 'de',
  '/datenschutzerklaerung.html': 'de',
  '/agb.html': 'de',
  '/modalpartikeln.html': 'de',
  '/subjunktionen.html': 'de',
  '/konjunktionen.html': 'de',
  '/niveaus.html': 'de',
};

// Retired language-prefixed slugs. These are also covered by _redirects, but
// whether _redirects or a Function wins for /en/* differs between the local dev
// router and production, so the Function handles them too and the behaviour is
// identical either way.
// Targets go through pagePath so a retired slug lands on the localized URL in
// one hop rather than redirecting into another redirect.
//
// The course pages, the about page and the FAQ were folded into the homepage;
// their slugs in both languages land on the section, in the language the
// prefix asked for. Gymivorbereitung had /de/ as its primary URL, so the bare
// .html form in _redirects goes to /de/#tutoring.
//
// About and the FAQ are now one section: #about is the section, #faq the
// questions block inside it, so both anchors still resolve. /info used to
// point at the course-structure section, which was folded into the FAQ answer
// about how long a level takes.
const home = (hash) => (lang) => `/${lang}/#${hash}`;

export const LEGACY_SLUG_REDIRECTS = {
  info: home('faq'),
  redepartikeln: (lang) => pagePath('/modalpartikeln.html', lang),
  contact: (lang) => pagePath('/enquiry.html', lang),
  booking: (lang) => pagePath('/enquiry.html', lang),
  scheduling: (lang) => pagePath('/enquiry.html', lang),

  'german-courses': home('language-courses'),
  deutschkurse: home('language-courses'),
  'swiss-german': home('language-courses'),
  schweizerdeutsch: home('language-courses'),
  'english-courses': home('language-courses'),
  englischkurse: home('language-courses'),
  'english-exams': home('language-courses'),
  'exam-preparation': home('language-courses'),
  pruefungsvorbereitung: home('language-courses'),
  'company-courses': home('language-courses'),
  firmenkurse: home('language-courses'),
  'lunch-time-german': home('language-courses'),
  'kurs-nach-mass': home('language-courses'),
  'online-lessons': home('language-courses'),
  'online-unterricht': home('language-courses'),
  'private-lessons': home('language-courses'),
  einzelunterricht: home('language-courses'),
  gymivorbereitung: home('gymivorbereitung'),
  about: home('about'),
  'ueber-uns': home('about'),
  faq: home('faq'),
};

// Page templates live under public/pages/ rather than at the asset root.
//
// _redirects maps the legacy /german-courses.html URLs to their clean
// equivalents with a 301, and env.ASSETS.fetch() goes through the same asset
// router — so fetching /german-courses.html from a Function returns that 301,
// not the file. Keeping the templates on a path with no redirect rule lets the
// legacy 301s stay exactly as they are.
//
// /pages/* is therefore publicly reachable; it is Disallowed in robots.txt and
// carries X-Robots-Tag: noindex from _headers, which _render.js strips from the
// rendered response.
export const TEMPLATE_DIR = '/pages';

// Extensionless, because Pages 308-redirects /foo.html to /foo and we would
// otherwise depend on env.ASSETS.fetch following that hop.
export function templatePath(page) {
  const slug = page.replace(/\.html$/, '');
  return slug === '/index' ? TEMPLATE_DIR + '/' : TEMPLATE_DIR + slug;
}

export function hasRoute(page) {
  return Object.prototype.hasOwnProperty.call(ROUTES, page);
}

function cleanSlug(slug) {
  return String(slug || '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
}

// Slug (no language prefix, no extension) -> '/file.html' in that language's
// slug set, or null if it is not a slug of that language.
export function pageForSlug(slug, lang) {
  const clean = cleanSlug(slug);
  if (!clean) return '/index.html';
  const table = PAGE_BY_ROUTE[lang] || {};
  return Object.prototype.hasOwnProperty.call(table, clean) ? table[clean] : null;
}

// Same, but across every language. Lets a slug requested under the wrong
// prefix (/de/german-courses) resolve to its page so the caller can 301 to the
// right slug, rather than 404 on a URL that used to work.
export function pageForAnySlug(slug) {
  const clean = cleanSlug(slug);
  if (!clean) return '/index.html';
  for (const lang of SUPPORTED) {
    const page = pageForSlug(clean, lang);
    if (page) return page;
  }
  return null;
}

// '/german-courses.html' + 'de' -> '/de/deutschkurse'
export function pagePath(page, lang) {
  const slug = hasRoute(page) ? ROUTES[page][lang] : page.replace(/^\//, '').replace(/\.html$/, '');
  return '/' + lang + (slug ? '/' + slug : '/');
}

export function defaultLangFor(page) {
  return DEFAULT_BY_PAGE[page] || 'en';
}

function normalisePageKey(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  const route = parts.slice(SUPPORTED.includes(parts[0]) ? 1 : 0).join('/');
  const clean = route.replace(/\/$/, '');
  if (!clean) return '/index.html';
  // Any language's slug, so a link already written as /de/deutschkurse still
  // resolves to its page.
  const known = pageForAnySlug(clean);
  if (known) return known;
  return clean.endsWith('.html') ? '/' + clean : '/' + clean + '.html';
}

// Rewrites an internal href to the language-prefixed clean URL, so the served
// link graph is the canonical one. The templates link to each other as
// /german-courses.html, which 301s — fine for a browser, wasteful for a crawler
// and previously the only internal link graph the site had.
export function localizeHref(href, lang) {
  if (!href) return null;
  if (/^(#|mailto:|tel:|data:|javascript:)/i.test(href)) return null;
  if (/^([a-z][a-z0-9+.-]*:)?\/\//i.test(href)) return null; // absolute / protocol-relative

  const [pathAndQuery, ...hashParts] = href.split('#');
  const hash = hashParts.length ? '#' + hashParts.join('#') : '';
  const [pathname, ...queryParts] = pathAndQuery.split('?');
  const search = queryParts.length ? '?' + queryParts.join('?') : '';
  if (!pathname.startsWith('/')) return null; // relative link, leave alone

  const page = normalisePageKey(pathname);
  if (!hasRoute(page)) return null;

  const localized = pagePath(page, lang) + search + hash;
  return localized === href ? null : localized;
}

// Same treatment for links inside dictionary values. Content inserted with
// setInnerContent() is not re-parsed by HTMLRewriter, so those hrefs would
// otherwise keep pointing at the .html URLs.
export function localizeHtmlLinks(html, lang) {
  return String(html).replace(/href="([^"]+)"/g, (match, href) => {
    const localized = localizeHref(href, lang);
    return localized ? `href="${localized}"` : match;
  });
}

export const nav = {
  skip: { en: 'Skip to content', de: 'Zum Inhalt springen' },
  menu: { en: 'menu', de: 'Menü' },
  close: { en: 'close', de: 'Schliessen' },
  home: { en: 'Home', de: 'Start' },
  offer: { en: 'courses & tutoring', de: 'Kurse & Nachhilfe' },
  languageCourses: { en: 'language courses', de: 'Sprachkurse' },
  tutoring: { en: 'tutoring', de: 'Nachhilfe' },
  gymivorbereitung: { en: 'Gymivorbereitung', de: 'Gymivorbereitung' },
  faq: { en: 'FAQ', de: 'Häufige Fragen' },
  levels: { en: 'your level', de: 'Ihr Niveau' },
  reviews: { en: 'reviews', de: 'Stimmen' },
  about: { en: 'about', de: 'Über uns' },
  // The section header, and the three ways in under it.
  enquiry: { en: 'enquiry', de: 'Anfrage' },
  enquiryForm: { en: 'make an enquiry', de: 'Anfrage senden' },
  groupCourses: { en: 'group courses', de: 'Gruppenkurse' },
  bookCall: { en: 'book a call', de: 'Gespräch buchen' },
  materials: { en: 'learning materials', de: 'Lernmaterialien' },
  modalpartikeln: { en: 'modal particles', de: 'Modalpartikeln' },
  subjunktionen: { en: 'subjunctions', de: 'Subjunktionen' },
  konjunktionen: { en: 'conjunctions', de: 'Konjunktionen' },
  niveaus: { en: 'find your level', de: 'Niveau herausfinden' },
  legalLabel: { en: 'Legal pages', de: 'Rechtliche Seiten' },
  impressum: { en: 'Imprint', de: 'Impressum' },
  privacy: { en: 'Privacy Policy', de: 'Datenschutzerklärung' },
  terms: { en: 'Terms & Conditions', de: 'AGB' },
  language: { en: 'Language', de: 'Sprache' },
};

export const common = {
  updated: { en: 'Updated: 3 May 2026', de: 'Stand: 3. Mai 2026' },
  email: { en: 'Email', de: 'E-Mail' },
};

export const pages = {
  '/index.html': {
    title: {
      en: 'Learning with Gioia — Language Courses & Tutoring in Zürich',
      de: 'Learning with Gioia — Sprachkurse & Nachhilfe in Zürich',
    },
    description: {
      en: 'Language courses, exam preparation, tutoring and Gymivorbereitung in Zürich. One-to-one and small-group lessons, taught exclusively by native-speaking teachers.',
      de: 'Sprachen lernen, Sprachprüfungsvorbereitung, Nachhilfe und Gymivorbereitung in Zürich. Individual- und Kleingruppenunterricht, ausschliesslich von muttersprachlichen Lehrpersonen.',
    },
    text: {
      // The visible wordmark is an SVG, so this screen-reader heading is the
      // page's only h1 — it has to be in the reader's language.
      'h1.sr-only': {
        en: 'Learning with Gioia — language courses, exam preparation, tutoring and Gymivorbereitung in Zürich',
        de: 'Learning with Gioia — Sprachkurse, Sprachprüfungsvorbereitung, Nachhilfe und Gymivorbereitung in Zürich',
      },
      '.hero-tagline': {
        en: '<em>Languages, exam preparation, tutoring &amp; Gymivorbereitung</em><span class="sep" aria-hidden="true">·</span><em>Zürich</em>',
        de: '<em>Sprachen, Sprachprüfungsvorbereitung, Nachhilfe &amp; Gymivorbereitung</em><span class="sep" aria-hidden="true">·</span><em>Zürich</em>',
      },
      '.hero-lede': {
        en: 'One-to-one and small-group lessons.',
        de: 'Individual- und Kleingruppenunterricht.',
      },
      '#hero-cta-enquiry': { en: 'make an enquiry', de: 'Anfrage senden' },
      '#hero-cta-offer': { en: 'what we offer', de: 'Unser Angebot' },

      // ── Language courses: what, in which format, where, and the rate ──
      '#language-courses .kicker': { en: 'what we offer', de: 'Unser Angebot' },
      '#language-courses .section-title': { en: 'Language courses', de: 'Sprachkurse' },
      '#lc-intro': {
        en: 'Our language courses take place in a personal setting: in our classrooms, at your offices, at your home or online. Language courses are taught exclusively by native-speaking teachers.',
        de: 'Unsere Sprachkurse finden in einem persönlichen Umfeld statt, entweder in unseren Kursräumlichkeiten, direkt bei Ihnen im Büro, bei Ihnen zu Hause oder online. Sprachkurse werden bei uns ausschliesslich von muttersprachlichen Lehrpersonen unterrichtet.',
      },
      '#lc-languages-title': { en: 'Languages', de: 'Sprachen' },
      '#lc-lang-german': { en: '<strong>German</strong>', de: '<strong>Deutsch</strong>' },
      '#lc-lang-swiss': {
        en: '<strong>Swiss German</strong>',
        de: '<strong>Schweizerdeutsch</strong>',
      },
      '#lc-lang-english': { en: '<strong>English</strong>', de: '<strong>Englisch</strong>' },
      '#lc-lang-other': {
        en: '<strong>Other languages</strong> <span>For languages not listed here, send us an enquiry. We will find a suitable teacher within our network.</span>',
        de: '<strong>Andere Sprachen</strong> <span>Für nicht aufgeführte Sprachen schicken Sie uns eine Anfrage. Wir suchen in unserem Netzwerk eine passende Lehrperson.</span>',
      },
      '#lc-lang-exams': {
        en: '<strong>Preparing for a language certificate</strong> <span>Goethe, TELC, FIDE, Cambridge, TOEFL, IELTS and more.</span>',
        de: '<strong>Vorbereitung auf ein Sprachzertifikat</strong> <span>Goethe, TELC, FIDE, Cambridge, TOEFL, IELTS und mehr.</span>',
      },
      '#lc-format-title': { en: 'Format', de: 'Format' },
      '#lc-format-group': {
        en: '<strong>Group</strong> <span>Our group courses have between three and five people, so everybody gets the chance to actively use the target language in the lesson.</span>',
        de: '<strong>Gruppe</strong> <span>In unseren Gruppenkursen sind zwischen drei und fünf Personen. So erhalten alle die Chance, die Zielsprache auch im Unterricht aktiv anzuwenden.</span>',
      },
      '#lc-format-private': {
        en: '<strong>One-to-one</strong> <span>One-to-one lessons offer flexibility and even more time to use the target language.</span>',
        de: '<strong>Einzelunterricht</strong> <span>Einzelunterricht bietet Flexibilität und noch mehr Zeit, die Zielsprache anzuwenden.</span>',
      },
      '#lc-format-company': {
        en: '<strong>Company courses</strong> <span>Our company courses take place at your offices. Ideal for anyone short of time who has to fit lessons around a full diary.</span>',
        de: '<strong>Firmenkurse</strong> <span>Unsere Firmenkurse finden direkt bei Ihnen im Büro statt. Ideal für diejenigen, die nicht viel Zeit haben und den Unterricht mit einem vollen Terminkalender koordinieren müssen.</span>',
      },
      '#lc-format-tailored': {
        en: '<strong>Build your own</strong> <span>If you have something specific in mind, get in touch and we will find a solution that fits.</span>',
        de: '<strong>Build your own</strong> <span>Wenn Sie einen bestimmten Wunsch haben, melden Sie sich und wir finden eine passende Lösung.</span>',
      },
      '#lc-location-title': { en: 'Location', de: 'Ort' },
      '#lc-location-inperson': {
        en: '<strong>In person</strong> <span>Our courses take place in Zürich. Ask us about our locations.</span>',
        de: '<strong>Vor Ort</strong> <span>Unsere Kurse finden in Zürich statt. Fragen Sie nach unseren Standorten.</span>',
      },
      '#lc-location-online': {
        en: '<strong>Online</strong> <span>Would you rather learn from home, or mix in-person lessons with online ones? No problem. All of our courses can also take place online.</span>',
        de: '<strong>Online</strong> <span>Sie wollen lieber von zu Hause aus lernen oder Präsenzunterricht mit Onlinelektionen mischen? Kein Problem, alle unsere Kurse können auch online stattfinden.</span>',
      },
      '#lc-facts-title': {
        en: 'Prices for standard language courses',
        de: 'Preise für reguläre Sprachkurse',
      },
      '#lc-fact-group-label': { en: 'group (3-5)', de: 'Gruppe (3-5)' },
      '#lc-fact-group-value': { en: 'CHF 50', de: 'CHF 50' },
      '#lc-fact-group-unit': { en: 'per person per 60 min', de: 'pro Person pro 60 Min.' },
      '#lc-fact-solo-label': { en: 'private', de: 'Einzelunterricht' },
      '#lc-fact-solo-value': { en: 'CHF 120', de: 'CHF 120' },
      '#lc-fact-solo-unit': { en: 'per 60 min', de: 'pro 60 Min.' },
      '#lc-note': {
        en: 'Company courses and tailored programmes are priced on request.',
        de: 'Firmenkurse und massgeschneiderte Programme: Preis auf Anfrage.',
      },
      '#lc-cta-enquiry': { en: 'make an enquiry', de: 'Anfrage senden' },
      '#lc-cta-courses': { en: 'open group courses', de: 'Offene Gruppenkurse' },

      // ── Tutoring ──
      '#tutoring .kicker': { en: 'tutoring', de: 'Nachhilfe' },
      '#tutoring .section-title': { en: 'Tutoring', de: 'Nachhilfe' },
      '#tu-intro': {
        en: 'We offer tutoring in every subject taught in Swiss schools.',
        de: 'Wir bieten Nachhilfe in allen Fächern an, die an Schweizer Schulen unterrichtet werden.',
      },
      '#tu-levels-title': { en: 'Levels', de: 'Stufen' },
      '#tu-level-primary': {
        en: '<strong>Primary school</strong>',
        de: '<strong>Primarschule</strong>',
      },
      '#tu-level-secondary': {
        en: '<strong>Secondary school</strong>',
        de: '<strong>Sekundarschule</strong>',
      },
      '#tu-level-gymnasium': { en: '<strong>Gymnasium</strong>', de: '<strong>Gymnasium</strong>' },
      '#tu-level-bms': { en: '<strong>BMS</strong>', de: '<strong>BMS</strong>' },
      '#tu-format-title': { en: 'Format', de: 'Format' },
      '#tu-format-group': {
        en: "<strong>Group</strong> <span>Group tutoring is taught in groups of three to seven pupils. Where the pupils' levels differ widely, a smaller group works better, so that every pupil gets the attention they need. Where levels and tasks are similar, a larger group works well.</span>",
        de: '<strong>Gruppe</strong> <span>Nachhilfe in der Gruppe wird in Gruppen von drei bis sieben Schülerinnen und Schülern unterrichtet. Unterscheiden sich die Niveaus stark, eignet sich eine kleinere Gruppe. So kommt jeder Schülerin und jedem Schüler die nötige Aufmerksamkeit zugute. Bei ähnlichen Niveaus und Aufgabenstellungen eignet sich eine grössere Gruppe.</span>',
      },
      '#tu-format-private': {
        en: '<strong>One-to-one</strong> <span>One-to-one lessons offer the most flexibility and allow for an individual pace of learning.</span>',
        de: '<strong>Einzelunterricht</strong> <span>Einzelunterricht bietet am meisten Flexibilität und ermöglicht ein individuelles Lerntempo.</span>',
      },
      '#tu-location-title': { en: 'Location', de: 'Ort' },
      '#tu-location-inperson': {
        en: '<strong>In person</strong> <span>Our courses take place in Zürich. Ask us about our locations.</span>',
        de: '<strong>Vor Ort</strong> <span>Unsere Kurse finden in Zürich statt. Fragen Sie nach unseren Standorten.</span>',
      },
      '#tu-location-online': {
        en: '<strong>Online</strong> <span>All of our courses are also offered fully online, or mixed with in-person lessons.</span>',
        de: '<strong>Online</strong> <span>Alle unsere Kurse werden auch vollständig online oder mit Präsenzunterricht gemischt angeboten.</span>',
      },
      '#tu-facts-title': { en: 'Prices', de: 'Preise' },
      '#tu-fact-group-label': { en: 'group (3-7)', de: 'Gruppe (3-7)' },
      '#tu-fact-group-value': { en: 'CHF 80', de: 'CHF 80' },
      '#tu-fact-group-unit': { en: 'per person per 60 min', de: 'pro Person pro 60 Min.' },
      '#tu-fact-solo-label': { en: 'private', de: 'Einzelunterricht' },
      '#tu-fact-solo-value': { en: 'CHF 120', de: 'CHF 120' },
      '#tu-fact-solo-unit': { en: 'per 60 min', de: 'pro 60 Min.' },
      '#tu-cta-enquiry': { en: 'make an enquiry', de: 'Anfrage senden' },
      '#tu-cta-courses': { en: 'open group courses', de: 'Offene Gruppenkurse' },

      // ── Gymivorbereitung ──
      '#gymivorbereitung .kicker': { en: 'gymivorbereitung', de: 'Gymivorbereitung' },
      '#gymivorbereitung .section-title': {
        en: 'Gymivorbereitung',
        de: 'Gymivorbereitung',
      },
      '#gy-intro': {
        en: 'Step by step to the Gymiprüfung. We are with you all the way there.',
        de: 'Schritt für Schritt zur Gymiprüfung. Wir begleiten Sie auf dem Weg dahin.',
      },
      '#gy-details-title': { en: 'Course details', de: 'Kursdetails' },
      '#gy-fact-duration-label': { en: 'lesson length', de: 'Unterrichtsdauer' },
      '#gy-fact-duration-value': { en: '3 h', de: '3 Std.' },
      '#gy-fact-days-label': { en: 'teaching days', de: 'Anzahl Unterrichtstage' },
      '#gy-fact-days-value': { en: '12 or 20', de: '12 oder 20' },
      '#gy-fact-days-unit': {
        en: '36 and 60 lessons respectively',
        de: '36 bzw. 60 Lektionen',
      },
      '#gy-fact-frequency-label': { en: 'frequency', de: 'Unterrichtsfrequenz' },
      '#gy-fact-frequency-value': { en: '1× or 2×', de: '1× oder 2×' },
      '#gy-fact-frequency-unit': { en: 'per week', de: 'pro Woche' },
      '#gy-fact-subjects-label': { en: 'subjects', de: 'Fächer' },
      '#gy-fact-subjects-value': {
        en: 'Mathematics and German',
        de: 'Mathematik und Deutsch',
      },
      '#gy-fact-size-label': { en: 'group size', de: 'Gruppengrösse' },
      '#gy-fact-size-value': { en: '3–7 children', de: '3–7 Kinder' },
      '#gy-fact-size-unit': {
        en: 'one-to-one available',
        de: 'Einzelunterricht möglich',
      },
      '#gy-fact-place-label': { en: 'location', de: 'Kursort' },
      '#gy-fact-place-value': { en: 'Zürich Seefeld', de: 'Zürich Seefeld' },
      '#gy-fact-place-unit': { en: 'online available', de: 'Online möglich' },
      '#gy-facts-title': { en: 'Prices', de: 'Preise' },
      '#gy-fact-group-label': { en: 'group (3-7)', de: 'Gruppe (3-7)' },
      '#gy-fact-group-value': { en: 'CHF 80', de: 'CHF 80' },
      '#gy-fact-group-unit': { en: 'per person per 60 min', de: 'pro Person pro 60 Min.' },
      '#gy-fact-solo-label': { en: 'private', de: 'Einzelunterricht' },
      '#gy-fact-solo-value': { en: 'CHF 150', de: 'CHF 150' },
      '#gy-fact-solo-unit': { en: 'per 60 min', de: 'pro 60 Min.' },
      '#gy-cta-enquiry': { en: 'make an enquiry', de: 'Anfrage senden' },
      '#gy-cta-courses': { en: 'open group courses', de: 'Offene Gruppenkurse' },

      // The course-structure section this used to hold is now the FAQ answer
      // about how long a level takes; its diagram and sources moved with it.
      '#levels .kicker': { en: 'your level', de: 'Ihr Niveau' },
      '#levels .section-title': {
        en: 'Which level fits you?',
        de: 'Welches Niveau passt zu Ihnen?',
      },
      '.levels-text': {
        en: 'Not sure where to start? Our interactive self-assessment helps you find your current level.',
        de: 'Sie wissen nicht, wo Sie anfangen sollen? Unser interaktives Selbsteinschätzungsraster hilft Ihnen, Ihr aktuelles Niveau zu finden.',
      },
      '#levels-cta': { en: 'find your level', de: 'Niveau herausfinden' },
      '#materials .kicker': { en: 'materials', de: 'Materialien' },
      '#materials .section-title': {
        en: 'Free learning materials',
        de: 'Kostenlose Lernmaterialien',
      },
      '#materials-intro': {
        en: 'Small interactive guides we built for our students. Free for everyone. Reference, quiz and cheat sheet included.',
        de: 'Kleine interaktive Guides, die wir für unsere Lernenden gebaut haben. Kostenlos für alle. Mit Übersicht, Quiz und Spickzettel.',
      },
      '#material-konjunktionen h3': { en: 'Conjunctions', de: 'Konjunktionen' },
      '#material-konjunktionen p': {
        en: 'The five words that connect equal parts.',
        de: 'Die fünf Wörter, die Gleichrangiges verbinden.',
      },
      '#material-modalpartikeln h3': { en: 'Modal particles', de: 'Modalpartikeln' },
      '#material-modalpartikeln p': {
        en: 'The little words that make German come alive.',
        de: 'Die kleinen Wörter, die Deutsch lebendig machen.',
      },
      '#material-subjunktionen h3': { en: 'Subjunctions', de: 'Subjunktionen' },
      '#material-subjunktionen p': {
        en: 'The words that open subordinate clauses and connect thoughts.',
        de: 'Die Wörter, die Nebensätze öffnen und Gedanken verbinden.',
      },
      '#reviews .kicker': { en: 'reviews', de: 'Stimmen' },
      '#reviews .section-title': {
        en: 'What our students say',
        de: 'Was unsere Lernenden sagen',
      },
      '#review-1 blockquote p': {
        en: 'Gioia conveys knowledge very well and accurately. My son appreciates the private lessons.',
        de: 'Gioia vermittelt Wissen sehr gut und präzise. Mein Sohn schätzt den Einzelunterricht.',
      },
      '#review-1 figcaption': { en: '— Pascaline H.', de: '— Pascaline H.' },
      '#review-2 blockquote p': {
        en: 'Gioia is an incredibly kind and dedicated tutor. What I particularly appreciate about her is that she always prepared in advance for the topics I wanted to cover with her, whether they were specific subjects or concrete questions. I also really liked that I could go through not just one subject with her, but several. She always took extra time for this and prepared specifically for each topic. This was extremely helpful for me because it meant I had a dedicated contact person for different subjects. She also often found suitable documents, exercises, or additional materials for me and sent them to me, which was really practical and helped me a lot with my studies.',
        de: 'Gioia ist eine unglaublich liebe und engagierte Nachhilfelehrerin. Was ich an ihr besonders schätze: Sie hat sich immer im Voraus auf die Themen vorbereitet, die ich mit ihr behandeln wollte — seien es bestimmte Fächer oder konkrete Fragen. Sehr gut gefallen hat mir auch, dass ich mit ihr nicht nur ein Fach, sondern mehrere durchgehen konnte. Dafür hat sie sich immer zusätzliche Zeit genommen und sich gezielt auf jedes Thema vorbereitet. Das war enorm hilfreich für mich, denn so hatte ich eine feste Ansprechperson für verschiedene Fächer. Oft hat sie auch passende Unterlagen, Übungen oder zusätzliche Materialien für mich gefunden und mir geschickt — das war wirklich praktisch und hat mir beim Lernen sehr geholfen.',
      },
      '#review-2 figcaption': { en: '— Malena F.', de: '— Malena F.' },
      '#review-3 blockquote p': {
        en: 'Gioia is a very professional, empathetic, patient, and dedicated teacher! 10 out of 10 :-)',
        de: 'Gioia ist eine sehr professionelle, empathische, geduldige und engagierte Lehrerin! 10 von 10 :-)',
      },
      '#review-3 figcaption': { en: '— Miriam H.', de: '— Miriam H.' },
      '#review-form-title': {
        en: 'Had lessons with us? Leave a review',
        de: 'Schon bei uns gelernt? Hinterlassen Sie eine Bewertung',
      },
      'label[for="review-name"]': { en: 'name', de: 'Name' },
      'label[for="review-text"]': { en: 'your review', de: 'Ihre Bewertung' },
      '#err-review-name': {
        en: 'Please enter your name.',
        de: 'Bitte geben Sie Ihren Namen ein.',
      },
      '#err-review-text': {
        en: 'Please write a few words.',
        de: 'Bitte schreiben Sie ein paar Worte.',
      },
      '#review-note': {
        en: 'Reviews are checked before they appear on this page.',
        de: 'Bewertungen werden geprüft, bevor sie auf dieser Seite erscheinen.',
      },
      '#review-submit': { en: 'submit review', de: 'Bewertung senden' },
      '#err-review-submit': {
        en: 'Something went wrong, please try again later.',
        de: 'Etwas ist schiefgelaufen, bitte versuchen Sie es später erneut.',
      },
      '#review-success': {
        en: 'Thank you! Your review will appear here once it has been checked.',
        de: 'Danke! Ihre Bewertung erscheint hier, sobald sie geprüft wurde.',
      },
      '#about .kicker': { en: 'good to know', de: 'Gut zu wissen' },
      '#about .section-title': { en: 'About us', de: 'Über uns' },
      // Opens the section, and the whole argument the school rests on.
      '#about-opening': {
        en: 'We have all learnt a language once before, and we can all do it again at any time.',
        de: 'Wir haben alle schon einmal eine Sprache gelernt und wir können das alle jederzeit wieder tun.',
      },
      '#about-cv-title': { en: 'Education', de: 'Ausbildung' },
      '#about-gioia-cv': {
        en: '<li>Since 2026 — teaching diploma for upper-secondary schools (Russian and Mathematics), University of Zürich.</li><li>2019 — MA in Russian Studies, University College London.</li><li>2015 — BA in Russian Language and Literature, University of Zürich.</li><li>2010 — Matura, Kantonsschule Küsnacht, bilingual German and English.</li>',
        de: '<li>Seit 2026 — Lehrdiplom für Maturitätsschulen (Russisch und Mathematik), Universität Zürich.</li><li>2019 — Master of Arts in Russian Studies, University College London.</li><li>2015 — Bachelor of Arts in Russischer Sprach- und Literaturwissenschaft, Universität Zürich.</li><li>2010 — Matura, Kantonsschule Küsnacht, zweisprachig Deutsch und Englisch.</li>',
      },
      '#faq-heading': { en: 'Frequently asked questions', de: 'Häufige Fragen' },
      '#faq-intro': {
        en: 'The questions we are asked most. Any other questions? Write to us <a href="/enquiry.html">here</a>.',
        de: 'Die häufigsten Fragen. Noch weitere Fragen? Schreiben Sie uns <a href="/enquiry.html">hier</a>.',
      },
      '#faq-courses-title': { en: 'Courses and levels', de: 'Kurse und Niveaus' },
      '#faq-swiss-title': { en: 'German in Switzerland', de: 'Deutsch in der Schweiz' },
      '#faq-online-title': { en: 'Online lessons', de: 'Online-Unterricht' },
      '#faq-gymi-title': { en: 'Gymivorbereitung', de: 'Gymivorbereitung' },
      '#faq-company-title': { en: 'Company courses', de: 'Firmenkurse' },
      // The Q&A lists themselves are added below, once FAQ is declared.
      '#enquiry .section-title': { en: 'Ready to get started?', de: 'Bereit loszulegen?' },
      '.closing-text': {
        en: 'We want to give you confidence and motivation to use your knowledge beyond the classroom.',
        de: 'Wir wollen Sie dabei unterstützen, Ihr Wissen auch ausserhalb des Unterrichts anzuwenden.',
      },
      '#closing-cta-enquiry': { en: 'make an enquiry', de: 'Anfrage senden' },
      '#closing-cta-courses': { en: 'open group courses', de: 'Offene Gruppenkurse' },
      '#closing-cta-call': { en: 'book a 15min call', de: 'Kurzgespräch buchen (15 Min.)' },
      '#call-panel-title': {
        en: 'Book a free 15-minute call',
        de: 'Kostenloses 15-Minuten-Gespräch buchen',
      },
      '#call-cancel': { en: 'close', de: 'schliessen' },
      '#call-panel-note': {
        en: 'Pick a time that suits you. All times are Zürich time (CET/CEST).',
        de: 'Wählen Sie eine passende Zeit. Alle Zeiten in Zürcher Zeit (MEZ/MESZ).',
      },
      'label[for="cb-first-name"]': { en: 'first name *', de: 'Vorname *' },
      'label[for="cb-last-name"]': { en: 'last name *', de: 'Nachname *' },
      'label[for="cb-email"]': { en: 'email *', de: 'E-Mail *' },
      'label[for="cb-phone"]': { en: 'phone', de: 'Telefon' },
      'label[for="cb-topic"]': {
        en: 'what would you like to talk about?',
        de: 'Worüber möchten Sie sprechen?',
      },
      '#err-cb-first-name': {
        en: 'Please enter a first name.',
        de: 'Bitte geben Sie einen Vornamen ein.',
      },
      '#err-cb-last-name': {
        en: 'Please enter a last name.',
        de: 'Bitte geben Sie einen Nachnamen ein.',
      },
      '#err-cb-email': {
        en: 'Please enter a valid email address.',
        de: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
      },
      '#err-cb-consent': {
        en: 'Please accept the terms and conditions.',
        de: 'Bitte akzeptieren Sie die AGB.',
      },
      '#cb-submit': { en: 'book the call', de: 'Gespräch buchen' },
      '#call-success-title': { en: "You're booked in!", de: 'Ihr Termin steht!' },
    },
  },
  '/enquiry.html': {
    title: {
      en: 'Make an Enquiry — Learning with Gioia',
      de: 'Anfrage senden — Learning with Gioia',
    },
    description: {
      en: 'Make a quick enquiry with Learning with Gioia — language courses, exam prep and tutoring in Zürich.',
      de: 'Senden Sie eine kurze Anfrage an Learning with Gioia — für Sprachkurse, Prüfungsvorbereitung und Nachhilfe in Zürich.',
    },
    text: {
      h1: { en: 'make an enquiry', de: 'Anfrage senden' },
      'label[for="lesson-type"]': { en: 'what are you looking for?', de: 'Wonach suchen Sie?' },
      '#lesson-type': {
        en: 'e.g. German A2 course, IELTS exam prep, Maths tutoring — Gymnasium year 9, Gymivorbereitung grade 6...',
        de: 'z. B. Deutschkurs A2, IELTS-Vorbereitung, Mathe-Nachhilfe — Gymnasium 2. Klasse, Gymivorbereitung 6. Klasse...',
        attr: 'placeholder',
      },
      '#err-lesson-type': {
        en: 'Please describe what you are looking for.',
        de: 'Bitte beschreiben Sie, wonach Sie suchen.',
      },
      '.section-label': { en: 'your details', de: 'Ihre Angaben' },
      'label[for="lead-first"]': { en: 'first name', de: 'Vorname' },
      'label[for="lead-last"]': { en: 'last name', de: 'Nachname' },
      'label[for="lead-email"]': { en: 'email', de: 'E-Mail' },
      '#label-lead-phone': { en: 'phone', de: 'Telefon' },
      'label[for="preferred-contact"]': {
        en: 'preferred contact method',
        de: 'Bevorzugte Kontaktart',
      },
      '#err-lead-first': {
        en: 'Please enter a first name.',
        de: 'Bitte geben Sie einen Vornamen ein.',
      },
      '#err-lead-last': {
        en: 'Please enter a last name.',
        de: 'Bitte geben Sie einen Nachnamen ein.',
      },
      '#err-lead-email': {
        en: 'Please enter an email address.',
        de: 'Bitte geben Sie eine E-Mail-Adresse ein.',
      },
      '#err-lead-phone': {
        en: 'Please enter a phone number.',
        de: 'Bitte geben Sie eine Telefonnummer ein.',
      },
      '#err-preferred-contact': {
        en: 'Please select a preferred contact method.',
        de: 'Bitte wählen Sie eine bevorzugte Kontaktart.',
      },
      '#preferred-contact option[value="Phone"]': { en: 'Phone', de: 'Telefon' },
      '#preferred-contact option[value="Either"]': { en: 'Either', de: 'Beides' },
      '#submit-btn': { en: 'send enquiry ->', de: 'Anfrage senden ->' },
      '#submit-error': {
        en: 'Something went wrong — please try again or email us at <a href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
        de: 'Etwas ist schiefgelaufen — bitte versuchen Sie es erneut oder schreiben Sie uns an <a href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
      },
    },
  },
  '/group-courses.html': {
    title: {
      en: 'Open Group Courses — Learning with Gioia',
      de: 'Offene Gruppenkurse — Learning with Gioia',
    },
    description: {
      en: 'Currently bookable German, Swiss German and English group courses in Zürich and online. Maximum 5 people, running from 3, places first come first served.',
      de: 'Aktuell buchbare Deutsch-, Schweizerdeutsch- und Englischkurse in Zürich und online. Maximal 5 Personen, Durchführung ab 3, Plätze nach Eingang der Anmeldungen.',
    },
    text: {
      h1: { en: 'open group courses', de: 'offene Gruppenkurse' },
      '.courses-intro': {
        en: 'Small group courses with a maximum of 5 people. Booking requests are handled first come, first served. We work hard to confirm your booking request as soon as possible.',
        de: 'Kleine Gruppenkurse mit maximal 5 Personen. Wir bearbeiten Buchungsanfragen der Reihe nach und bestätigen Ihre Buchungsanfrage so schnell wie möglich.',
      },
      '#courses-status': { en: 'loading courses...', de: 'Kurse werden geladen...' },
      '#empty-state p': {
        en: 'currently there are no spots available in planned or ongoing group courses :(',
        de: 'Aktuell sind leider keine Plätze in geplanten oder laufenden Gruppenkursen verfügbar :(',
      },
      '#empty-state .enquiry-link': { en: 'make an enquiry ->', de: 'Anfrage senden ->' },
      '#booking-title': { en: 'your details', de: 'Ihre Angaben' },
      '#booking-cancel': { en: 'cancel', de: 'Abbrechen' },
      '#label-booking-request': { en: 'booking request', de: 'Buchungsanfrage' },
      '#label-slot-preferences': { en: 'course preferences', de: 'Kurspräferenzen' },
      'label[for="bf-preferred-level"]': {
        en: 'desired level *',
        de: 'gewünschtes Niveau *',
      },
      'label[for="bf-preferred-location"]': {
        en: 'desired location *',
        de: 'gewünschter Ort *',
      },
      '#bf-preferred-location option[value="online"]': {
        en: 'Online',
        de: 'Online',
      },
      '#bf-preferred-location option[value="classroom"]': {
        en: 'Classroom',
        de: 'Kursraum',
      },
      '#bf-preferred-location option[value="teacher\'s home"]': {
        en: "Teacher's home",
        de: 'Bei der Lehrperson',
      },
      '#bf-preferred-location option[value="company"]': {
        en: 'Company',
        de: 'Firma',
      },
      'label[for="bf-preferred-start-date"]': {
        en: 'preferred start date',
        de: 'gewünschtes Startdatum',
      },
      'label[for="bf-reduced-lessons-ok"]': {
        en: 'reduced course length *',
        de: 'reduzierte Kursdauer *',
      },
      '#bf-reduced-lessons-ok option[value="yes"]': {
        en: 'Yes, I am okay with a reduced number of lessons if fewer than three people sign up.',
        de: 'Ja, ich bin mit weniger Lektionen einverstanden, falls sich weniger als drei Personen anmelden.',
      },
      '#bf-reduced-lessons-ok option[value="no"]': {
        en: 'No, I only want to join if at least three people sign up.',
        de: 'Nein, ich möchte nur teilnehmen, wenn sich mindestens drei Personen anmelden.',
      },
      '#reduced-lessons-hint': {
        en: 'Should fewer than three people sign up, the number of lessons will be reduced to match the monetary value of a course for a group of three. The adjusted lesson count is rounded down.',
        de: 'Falls sich weniger als drei Personen anmelden, wird die Anzahl Lektionen so reduziert, dass sie dem monetären Wert eines Kurses für drei Personen entspricht. Die angepasste Lektionenzahl wird abgerundet.',
      },
      '#label-personal': { en: 'personal information', de: 'Persönliche Angaben' },
      '#label-emergency': { en: 'emergency contact', de: 'Notfallkontakt' },
      '#label-billing': { en: 'billing', de: 'Rechnung' },
      '#booking-payment-note': {
        en: "What happens after your booking? We will review your request and confirm your spot. Then we will send you the invoice for your booking. Once we receive your payment you're all booked in.",
        de: 'Was passiert nach Ihrer Buchungsanfrage? Wir prüfen Ihre Anfrage und bestätigen Ihren Platz. Dann schicken wir Ihnen die Rechnung für Ihre Buchung. Sobald Ihre Zahlung eingegangen ist, ist Ihr Platz gebucht.',
      },
      'label[for="bf-first-name"]': { en: 'first name *', de: 'Vorname *' },
      'label[for="bf-last-name"]': { en: 'last name *', de: 'Nachname *' },
      'label[for="bf-gender"]': { en: 'salutation *', de: 'Anrede *' },
      '#bf-gender option[value="female"]': { en: 'Ms', de: 'Frau' },
      '#bf-gender option[value="male"]': { en: 'Mr', de: 'Herr' },
      '#bf-gender option[value="other"]': { en: 'Other', de: 'Andere' },
      'label[for="bf-gender-note"]': { en: 'please specify *', de: 'bitte angeben *' },
      'label[for="bf-email"]': { en: 'email *', de: 'E-Mail *' },
      'label[for="bf-phone"]': { en: 'phone *', de: 'Telefon *' },
      'label[for="bf-street"]': { en: 'street *', de: 'Strasse *' },
      'label[for="bf-street-number"]': { en: 'number *', de: 'Nummer *' },
      'label[for="bf-postcode"]': { en: 'postcode *', de: 'Postleitzahl *' },
      'label[for="bf-city"]': { en: 'city *', de: 'Ort *' },
      'label[for="bf-ec-name"]': { en: 'name', de: 'Name' },
      'label[for="bf-ec-relationship"]': { en: 'relationship', de: 'Beziehung' },
      '#bf-ec-relationship': {
        en: 'e.g. partner, parent',
        de: 'z. B. Partner/in, Elternteil',
        attr: 'placeholder',
      },
      'label[for="bf-ec-phone"]': { en: 'phone', de: 'Telefon' },
      'label[for="bf-ec-email"]': { en: 'email', de: 'E-Mail' },
      'label[for="bf-billing-name"]': { en: 'billing name *', de: 'Rechnungsname *' },
      'label[for="bf-billing-email"]': {
        en: 'billing email *',
        de: 'Rechnungs-E-Mail *',
      },
      'label[for="bf-billing-phone"]': { en: 'billing phone *', de: 'Rechnungstelefon *' },
      'label[for="bf-billing-street"]': { en: 'street *', de: 'Strasse *' },
      'label[for="bf-billing-street-number"]': { en: 'number *', de: 'Nummer *' },
      'label[for="bf-billing-postcode"]': { en: 'postcode *', de: 'Postleitzahl *' },
      'label[for="bf-billing-city"]': { en: 'city *', de: 'Ort *' },
      '.booking-checkbox span': {
        en: 'billing address differs from personal address',
        de: 'Rechnungsadresse weicht von persönlicher Adresse ab',
      },
      '#err-first-name': {
        en: 'Please enter a first name.',
        de: 'Bitte geben Sie einen Vornamen ein.',
      },
      '#err-last-name': {
        en: 'Please enter a last name.',
        de: 'Bitte geben Sie einen Nachnamen ein.',
      },
      '#err-gender': {
        en: 'Please select a salutation.',
        de: 'Bitte wählen Sie eine Anrede aus.',
      },
      '#err-gender-note': {
        en: 'Please specify your salutation.',
        de: 'Bitte geben Sie Ihre Anrede an.',
      },
      '#err-email': {
        en: 'Please enter a valid email address.',
        de: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
      },
      '#err-consent': {
        en: 'Please accept the terms to continue.',
        de: 'Bitte akzeptieren Sie die AGB, um fortzufahren.',
      },
      '#err-reduced-lessons-ok': {
        en: 'Please select whether you are okay with a reduced course length.',
        de: 'Bitte wählen Sie aus, ob Sie mit einer reduzierten Kursdauer einverstanden sind.',
      },
      '#err-preferred-level': {
        en: 'Please select your desired level.',
        de: 'Bitte wählen Sie Ihr gewünschtes Niveau aus.',
      },
      '#err-preferred-location': {
        en: 'Please select your desired location.',
        de: 'Bitte wählen Sie Ihren gewünschten Ort aus.',
      },
      '#booking-submit': { en: 'request spot ->', de: 'Platz anfragen ->' },
      '#success-state h2': { en: 'thank you.', de: 'Danke.' },
      '#success-state p': {
        en: 'Your booking request has been received. We will confirm your request shortly.',
        de: 'Ihre Buchungsanfrage ist eingegangen. Wir bestätigen Ihre Anfrage so schnell wie möglich.',
      },
    },
  },
  '/thankyou.html': {
    title: { en: 'Thank You — Learning with Gioia', de: 'Danke — Learning with Gioia' },
    description: {
      en: 'Your enquiry has been received. We will be in touch shortly.',
      de: 'Ihre Anfrage ist bei uns eingetroffen. Wir melden uns bald.',
    },
    text: {
      '#success-state h1': { en: 'thank you.', de: 'Danke.' },
      '#thankyou-body': {
        en: "We've received your message and will contact you shortly to discuss your enquiry.",
        de: 'Wir haben Ihre Nachricht erhalten und melden uns bald, um Ihre Anfrage zu besprechen.',
      },
      '#thankyou-contact': {
        en: 'If you have any questions in the meantime, write to us at <a class="thankyou-link" href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
        de: 'Wenn Sie in der Zwischenzeit Fragen haben, schreiben Sie uns an <a class="thankyou-link" href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
      },
      '#success-state .home-link': { en: 'back to home', de: 'Zurück zur Startseite' },
      '#error-state h2': { en: 'something went wrong.', de: 'Etwas ist schiefgelaufen.' },
      '#error-state p': {
        en: 'Your enquiry may not have been received. Please try again or email us directly at <a class="thankyou-link thankyou-link--error" href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
        de: 'Ihre Anfrage konnte möglicherweise nicht gesendet werden. Bitte versuchen Sie es erneut oder schreiben Sie uns direkt an <a class="thankyou-link thankyou-link--error" href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
      },
      '#error-state .home-link': { en: 'try again', de: 'Erneut versuchen' },
    },
  },
  '/impressum.html': {
    title: {
      en: 'Imprint — Learning with Gioia',
      de: 'Impressum — Learning with Gioia',
    },
    description: {
      en: 'Legal information for Learning with Gioia / Birukoff World, sole proprietorship in Zürich.',
      de: 'Impressum von Learning with Gioia / Birukoff World, Einzelfirma in Zürich.',
    },
    text: {
      h1: { en: 'Imprint', de: 'Impressum' },
      '.legal-meta': common.updated,
      '#legal-1 h2': { en: 'Provider', de: 'Anbieterin' },
      '#legal-1 address': {
        en: '<strong>Birukoff World</strong><br>Sole proprietorship<br>Wildbachstrasse 65<br>8008 Zürich<br>Switzerland',
        de: '<strong>Birukoff World</strong><br>Einzelfirma<br>Wildbachstrasse 65<br>8008 Zürich<br>Schweiz',
      },
      '#legal-2 h2': { en: 'Contact', de: 'Kontakt' },
      '#legal-3 h2': { en: 'Register', de: 'Register' },
      '#legal-3 p': {
        en: 'UID: CHE-396.783.072<br>Commercial register entry: CH-020.1.105.662-3',
        de: 'UID: CHE-396.783.072<br>Handelsregistereintrag: CH-020.1.105.662-3',
      },
      '#legal-4 h2': { en: 'Responsibility', de: 'Verantwortung' },
      '#legal-4 p': {
        en: 'Birukoff World is responsible for the content of this website. Despite careful checks, we accept no liability for the content of external links. The operators of linked pages are solely responsible for their content.',
        de: 'Birukoff World ist für die Inhalte dieser Website verantwortlich. Trotz sorgfältiger Kontrolle übernehmen wir keine Haftung für Inhalte externer Links. Für den Inhalt verlinkter Seiten sind ausschliesslich deren Betreiberinnen und Betreiber verantwortlich.',
      },
    },
  },
  '/datenschutzerklaerung.html': {
    title: {
      en: 'Privacy Policy — Learning with Gioia',
      de: 'Datenschutzerklärung — Learning with Gioia',
    },
    description: {
      en: 'How Learning with Gioia collects, uses and stores personal data: which forms, which processors, how long data is kept, and your rights under Swiss law.',
      de: 'Wie Learning with Gioia Personendaten erhebt, nutzt und speichert: welche Formulare, welche Dienstleister, Aufbewahrungsdauer und Ihre Rechte.',
    },
    text: {
      h1: { en: 'Privacy Policy', de: 'Datenschutzerklärung' },
      '.legal-meta': common.updated,
      '#legal-1 h2': { en: 'Controller', de: 'Verantwortliche Stelle' },
      '#legal-1 address': {
        en: '<strong>Birukoff World</strong><br>Sole proprietorship<br>Wildbachstrasse 65<br>8008 Zürich<br>Switzerland<br><a href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>',
        de: '<strong>Birukoff World</strong><br>Einzelfirma<br>Wildbachstrasse 65<br>8008 Zürich<br>Schweiz<br><a href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>',
      },
      '#legal-2 h2': { en: 'Principle', de: 'Grundsatz' },
      '#legal-2 p': {
        en: 'We process personal data only insofar as this is necessary to operate this website, answer enquiries, organise courses and provide our services. We comply with the Swiss Data Protection Act (DSG) and, where applicable, further data protection regulations.',
        de: 'Wir bearbeiten Personendaten nur soweit dies für den Betrieb dieser Website, die Beantwortung von Anfragen, die Organisation von Kursen und die Erbringung unserer Dienstleistungen erforderlich ist. Dabei beachten wir das Schweizer Datenschutzgesetz (DSG) und, soweit anwendbar, weitere Datenschutzvorschriften.',
      },
      '#legal-3 h2': { en: 'Data processed', de: 'Bearbeitete Daten' },
      '#legal-3 div': {
        en: '<p>Depending on how you use the website and our services, we may process in particular the following data:</p><ul class="legal-list"><li>Contact details such as name, email address, telephone number and address.</li><li>Information about desired courses, language level, learning goals, bookings, appointments and participation.</li><li>Administrative course and billing data where required for providing our services.</li><li>Technical data such as IP address, browser, device, date, time and pages accessed.</li></ul>',
        de: '<p>Je nach Nutzung der Website und unserer Dienstleistungen können insbesondere folgende Daten bearbeitet werden:</p><ul class="legal-list"><li>Kontaktangaben wie Name, E-Mail-Adresse, Telefonnummer und Adresse.</li><li>Angaben zu gewünschten Kursen, Sprachniveau, Lernzielen, Buchungen, Terminen und Teilnahme.</li><li>Administrative Kurs- und Rechnungsdaten, soweit sie für die Durchführung unserer Dienstleistungen erforderlich sind.</li><li>Technische Daten wie IP-Adresse, Browser, Gerät, Datum, Uhrzeit und aufgerufene Seiten.</li></ul>',
      },
      '#legal-4 h2': { en: 'Purposes', de: 'Zwecke' },
      '#legal-4 div': {
        en: '<p>We use personal data in particular for the following purposes:</p><ul class="legal-list"><li>Processing and answering enquiries.</li><li>Planning, providing and managing lessons, courses and appointments.</li><li>Communication with prospective clients, clients, customers and teachers.</li><li>Sending confirmations, course information, schedules and certificates.</li><li>Operating, securing, troubleshooting and improving the website.</li><li>Fulfilling legal, accounting and contractual obligations.</li></ul>',
        de: '<p>Wir verwenden Personendaten insbesondere für folgende Zwecke:</p><ul class="legal-list"><li>Bearbeitung und Beantwortung von Anfragen.</li><li>Planung, Durchführung und Verwaltung von Unterricht, Kursen und Terminen.</li><li>Kommunikation mit Interessentinnen, Interessenten, Kundinnen, Kunden und Lehrpersonen.</li><li>Versand von Bestätigungen, Kursinformationen, Terminplänen und Zertifikaten.</li><li>Betrieb, Sicherheit, Fehleranalyse und Verbesserung der Website.</li><li>Erfüllung gesetzlicher, buchhalterischer und vertraglicher Pflichten.</li></ul>',
      },
      '#legal-5 h2': { en: 'Forms', de: 'Formulare' },
      '#legal-5 p': {
        en: 'When you submit an enquiry, intake or other form, we store and process the data you enter. This data is used to answer your enquiry, organise suitable courses or appointments and manage our business relationship.',
        de: 'Wenn Sie ein Anfrage-, Intake- oder anderes Formular absenden, speichern und bearbeiten wir die von Ihnen eingegebenen Daten. Diese Daten werden verwendet, um Ihre Anfrage zu beantworten, passende Kurse oder Termine zu organisieren und unsere Geschäftsbeziehung zu verwalten.',
      },
      '#legal-6 h2': { en: 'Service providers', de: 'Dienstleister' },
      '#legal-6 div': {
        en: '<p>We may use carefully selected service providers for the operation of our website and services, in particular:</p><ul class="legal-list"><li>Cloudflare for hosting, delivery, security and server functions.</li><li>Supabase for database and authentication functions.</li><li>Resend for sending transactional emails.</li><li>Google Calendar for appointment and course planning.</li><li>Google Fonts for displaying the fonts used.</li></ul><p>Personal data may also be disclosed to countries outside Switzerland and the European Economic Area. In such cases, we pay attention to appropriate safeguards or legally provided grounds for transfer.</p>',
        de: '<p>Für den Betrieb unserer Website und Dienstleistungen können wir sorgfältig ausgewählte Dienstleister einsetzen, insbesondere:</p><ul class="legal-list"><li>Cloudflare für Hosting, Auslieferung, Sicherheit und Serverfunktionen.</li><li>Supabase für Datenbank- und Authentifizierungsfunktionen.</li><li>Resend für den Versand transaktionaler E-Mails.</li><li>Google Calendar für Termin- und Kursplanung.</li><li>Google Fonts für die Darstellung der verwendeten Schriftarten.</li></ul><p>Dabei können Personendaten auch in Länder ausserhalb der Schweiz und des Europäischen Wirtschaftsraums bekanntgegeben werden. In solchen Fällen achten wir auf angemessene Garantien oder gesetzlich vorgesehene Grundlagen für die Übermittlung.</p>',
      },
      '#legal-7 h2': { en: 'Cookies and logs', de: 'Cookies und Logs' },
      '#legal-7 p': {
        en: 'This website may use technically necessary cookies, local browser data and server log data to provide functions, prevent misuse, analyse errors and ensure the security of the service. We do not use our own tracking or analytics cookies for advertising purposes.',
        de: 'Diese Website kann technisch notwendige Cookies, lokale Browserdaten und Server-Logdaten verwenden, um Funktionen bereitzustellen, Missbrauch zu verhindern, Fehler zu analysieren und die Sicherheit des Angebots zu gewährleisten. Wir verwenden keine eigenen Tracking- oder Analyse-Cookies zu Werbezwecken.',
      },
      '#legal-8 h2': { en: 'Retention', de: 'Aufbewahrung' },
      '#legal-8 p': {
        en: 'We retain personal data only for as long as required for the stated purposes, as long as statutory retention obligations exist, or as long as legitimate interests such as documentation, evidence preservation and contract processing require it.',
        de: 'Wir bewahren Personendaten nur so lange auf, wie es für die genannten Zwecke erforderlich ist, gesetzliche Aufbewahrungspflichten bestehen oder berechtigte Interessen wie Dokumentation, Beweissicherung und Vertragsabwicklung dies erfordern.',
      },
      '#legal-9 h2': { en: 'Your rights', de: 'Ihre Rechte' },
      '#legal-9 p': {
        en: 'Within the scope of applicable data protection law, you may request information about your personal data, have inaccurate data corrected, request deletion or restriction of processing and object to processing. Please contact us at <a href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
        de: 'Sie können im Rahmen des anwendbaren Datenschutzrechts Auskunft über Ihre Personendaten verlangen, unrichtige Daten berichtigen lassen, die Löschung oder Einschränkung der Bearbeitung verlangen und einer Bearbeitung widersprechen. Bitte kontaktieren Sie uns dafür unter <a href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
      },
      '#legal-10 h2': { en: 'Changes', de: 'Änderungen' },
      '#legal-10 p': {
        en: 'We may amend this privacy policy at any time, in particular if our data processing, the services used or legal requirements change. The version published on this website applies.',
        de: 'Wir können diese Datenschutzerklärung jederzeit anpassen, insbesondere wenn sich unsere Datenbearbeitungen, die eingesetzten Dienste oder rechtliche Anforderungen ändern. Es gilt die jeweils auf dieser Website veröffentlichte Fassung.',
      },
    },
  },
};

pages['/agb.html'] = {
  title: { en: 'Terms & Conditions — Learning with Gioia', de: 'AGB — Learning with Gioia' },
  description: {
    en: 'Terms and conditions for courses at Learning with Gioia: registration, course fees and payment, cancellation terms, minimum group size, and liability.',
    de: 'AGB für Kurse bei Learning with Gioia: Anmeldung, Kursgebühren und Zahlung, Stornobedingungen, Mindestteilnehmerzahl und Haftung.',
  },
};

// ── FAQ ──────────────────────────────────────────────────────────
//
// One source for both the rendered Q&A accordion on the homepage and the
// FAQPage schema, so the two can never disagree — Google treats marked-up
// answers that are not on the page as a violation, and an assistant quoting a
// stale answer is worse still.
//
// Every answer here is taken from something the site already commits to: the
// AGB (cancellation ladder, minimum group size), the offer section (formats,
// exams, lesson counts) or the course-structure section (hours per level).
// The course-structure diagram, which used to be its own homepage section. It
// answers "how long does it take", so it now lives inside that answer. Rendered
// as `extra`, not as part of the answer text: the FAQPage markup should carry
// the prose an assistant can quote, not a table of divs.
function structureFigure(lang) {
  const hours =
    lang === 'de'
      ? 'ca. 100 bis 150 Std. angeleitetes Lernen'
      : 'approx. 100 to 150 h guided learning';
  const part = lang === 'de' ? '32 Std.' : '32 h';
  const etc = lang === 'de' ? 'usw.' : 'etc.';
  const label =
    lang === 'de'
      ? 'Ein vollständiges Niveau, zum Beispiel A1, teilt sich in die Teilniveaus A1.1, A1.2 und A1.3 mit je 32 Stunden angeleitetem Lernen. Das gleiche Muster setzt sich für weitere Niveaus fort.'
      : 'One full level, for example A1, splits into the partial levels A1.1, A1.2 and A1.3 of 32 hours of guided learning each. The same pattern continues for further levels.';
  return (
    `<figure class="structure-diagram" aria-label="${label}">` +
    `<div class="structure-level"><span class="structure-level__code">A1</span>` +
    `<span class="structure-level__hours">${hours}</span></div>` +
    '<span class="structure-arrow" aria-hidden="true">→</span>' +
    ['A1.1', 'A1.2', 'A1.3']
      .map(
        (code) =>
          `<div class="structure-part"><span class="structure-part__code">${code}</span>` +
          `<span class="structure-part__hours">${part}</span></div>`
      )
      .join('') +
    `<span class="structure-etc">${etc}</span>` +
    '</figure>'
  );
}

const HOURS_SOURCES =
  '<ul class="detail-sources">' +
  '<li>** The International Language Institute of Massachusetts. 08 May 2025. How Much Time Does It Take to Learn a Language? [online]. Available from: <a href="https://ili.edu/news/how-much-time-does-it-take-to-learn-a-language/">ili.edu</a> [Accessed 03 April 2026].</li>' +
  '<li>Pearson Global Scale of English Research Series. May 2017. How long does it take to learn a language? Insights from research on language learning. [online]. Available from: <a href="https://www.pearson.com/content/dam/one-dot-com/one-dot-com/pearson-languages/en-gb/blogs/GSE-learning-hours-report.pdf">pearson.com</a> [Accessed 03 April 2026].</li>' +
  '<li>Conti, Gianfranco. 18 April 2025. How Long Does It Take to Learn a Language? Understanding the Factors That Make Some Languages Harder Than Others. [online]. Available from: <a href="https://gianfrancoconti.com/2025/04/18/how-long-does-it-take-to-learn-a-language-understanding-the-factors-that-make-some-languages-harder-than-others/">gianfrancoconti.com</a> [Accessed 03 April 2026].</li>' +
  '</ul>';

function hoursExtra(lang) {
  const note =
    lang === 'de'
      ? 'Oft kommt es vor, dass man schneller vorankommt als gedacht. In diesem Fall ist es nicht nötig, sich an rigide Strukturen zu halten. Blöcke können auch übersprungen werden.'
      : 'It often happens that people progress faster than expected. In that case there is no need to stick to a rigid structure: blocks can be skipped.';
  return `<div class="faq-extra">${structureFigure(lang)}<p>${note}</p>${HOURS_SOURCES}</div>`;
}

export const FAQ = {
  // Gioia's own answers, rendered at the top of the About section. Questions
  // are put to her, so they address her as Sie; the answers are first person.
  personal: [
    {
      q: {
        en: 'What did you study, and how does it help you teach?',
        de: 'Was haben Sie studiert und wie hilft Ihnen das beim Unterrichten?',
      },
      a: {
        en: 'I studied Russian language and literature at the University of Zürich. Although my degree focused on linguistics in the Russian language, it is a field that cuts across languages and applies to every one of them equally. Alongside Russian, my academic career also took me through Spanish, French, Arabic and, briefly, Italian and Persian. So I know only too well what the first few weeks in a completely unfamiliar language feel like, and I try to accompany you on your way to greater confidence in your target language.',
        de: 'Ich habe an der Universität Zürich Russische Sprach- und Literaturwissenschaft studiert. Obwohl mein Studium auf die russische Sprache ausgerichtet war, habe ich mich umfassend mit Linguistik befasst. Linguistik ist ein sprachübergreifendes Gebiet und kann auf jede Sprache gleichermassen angewendet werden. Ausser Russisch habe ich in meiner akademischen Laufbahn auch Spanisch, Französisch, Arabisch und kurz auch Italienisch und Persisch gelernt. Ich verstehe also nur allzu gut, wie sich die ersten paar Wochen in einer komplett fremden Sprache anfühlen, und versuche, Sie auf Ihrem Weg zu mehr Sicherheit in der Zielsprache zu begleiten.',
      },
    },
    {
      q: {
        en: 'Why did you start teaching German?',
        de: 'Warum haben Sie angefangen, Deutsch zu unterrichten?',
      },
      a: {
        en: 'To answer that I have to rewind a little. I was already tutoring on the side throughout my time at Gymnasium and all the way through university. I then moved to London to continue my studies, lived there for many years and, after my Master’s, worked in the financial sector. When I came back to my home city of Zürich I was not sure which direction to take, and started teaching again. I realised that teaching is the one profession I keep returning to whenever I think about changing course, and really the only one where I forget most of what is going on around me.',
        de: 'Um diese Frage zu beantworten, muss ich etwas zurückspulen. Ich habe bereits in meiner Zeit am Gymnasium und während meiner Studienzeit immer nebenbei Nachhilfe unterrichtet. Für mein Studium zog ich dann irgendwann nach London, lebte dort viele Jahre und arbeitete nach meinem Master im Finanzsektor. Nachdem ich in meine Heimatstadt Zürich zurückgekehrt war, wusste ich nicht genau, in welche Richtung es gehen sollte, und begann wieder zu unterrichten. Ich habe gemerkt, dass das Unterrichten der einzige Beruf ist, zu dem ich immer wieder zurückkehre, wenn ich darüber nachdenke, mich umzuorientieren, und eigentlich auch der einzige, bei dem ich das meiste um mich herum vergesse.',
      },
    },
    {
      q: {
        en: 'How does your earlier work experience help you teach?',
        de: 'Wie hilft Ihnen Ihre frühere Arbeitserfahrung beim Unterrichten?',
      },
      a: {
        en: 'Finance and school do not pair naturally for most. Even so, many of the skills that matter in finance serve you well in teaching: diplomacy, a professional manner, presentation skills, listening and holding an interesting conversation, improvising where necessary. Explaining complex matters to someone is something I did often in my previous job. And not least the coordinating and structuring of lesson plans, timetables, appointments and deadlines, and staying calm when something does not go as planned.',
        de: 'Finanzsektor und Schule passen für die meisten nicht allzu gut zusammen. Dennoch kommen einem viele Fähigkeiten, die im Finanzbereich wichtig sind, tatsächlich auch beim Unterrichten zugute: Diplomatie, professionelles Auftreten, Präsentationsfähigkeiten, Zuhören und interessante Gespräche führen, Improvisation, wenn nötig. Auch das Erklären von komplexen Sachverhalten für Lernende ist etwas, das ich in meinem früheren Beruf oft angewendet habe. Und nicht zuletzt das Koordinieren und Strukturieren von Lektionsplänen und Stundenplänen, Terminen und Fristen — und Ruhe zu bewahren, wenn etwas nicht so läuft wie geplant.',
      },
    },
    {
      q: {
        en: 'What do you love most about teaching?',
        de: 'Was lieben Sie am Unterrichten am meisten?',
      },
      a: {
        en: 'Teaching lets me forget all the stress of everyday life. In the lesson I concentrate entirely on my pupils and try to give them as much as I can. That can be tiring at times, but the selflessness of it is very liberating. And there is nothing better than seeing them improve over the time we spend together. It always delights me to hear that someone suddenly understands a street sign they had walked past every day and never been able to place. Or that they have started speaking German with people in everyday life, when before they could not form a sentence. Or that they watched a series in German and understood all of it, read a book in German and told me about it… The list is endless.',
        de: 'Das Unterrichten lässt mich allen Alltagsstress vergessen. In der Lektion konzentriere ich mich voll und ganz auf meine Schülerinnen und Schüler und versuche, ihnen so viel wie möglich mitzugeben. Das kann auch manchmal anstrengend sein, aber die Selbstlosigkeit daran ist sehr befreiend. Und es ist das Schönste, zu sehen, wie sie sich über die Zeit, die wir miteinander verbringen, verbessern. Es freut mich immer enorm, zu hören, wenn jemand zum Beispiel plötzlich ein Strassenschild versteht, das er oder sie täglich gesehen und nie einordnen konnte. Oder wenn jemand im Alltag Deutsch zu sprechen beginnt, obwohl vorher kein Satz möglich war. Oder eine Serie auf Deutsch schaut und alles versteht, ein Buch auf Deutsch liest und darüber berichtet … Die Liste ist endlos.',
      },
    },
  ],

  courses: [
    {
      q: {
        en: 'Which courses do you offer?',
        de: 'Welche Kurse bieten Sie an?',
      },
      a: {
        en: 'We offer language courses, one-to-one lessons, tutoring and Gymivorbereitung. If your target language, or the kind of course you are looking for, is not listed, do get in touch. We will try to find the right course for you, or to put one together.',
        de: 'Wir bieten Sprachkurse, Einzelunterricht, Nachhilfe und Gymivorbereitung. Sollte Ihre Zielsprache oder die Kursart, nach der Sie suchen, nicht aufgelistet sein, melden Sie sich gerne bei uns. Wir versuchen, für Sie den passenden Kurs zu finden oder zusammenzustellen.',
      },
    },
    {
      q: {
        en: 'How long does it take to learn German?',
        de: 'Wie lange dauert es, Deutsch zu lernen?',
      },
      a: {
        en: 'There is unfortunately no single answer to this question. What is true is that on average it takes around 100 to 150 guided group hours**, plus a similar amount of independent study, to move up one level — from A0 to A1, for example. Our regular group courses are divided into three blocks per language level.',
        de: 'Leider gibt es keine einheitliche Antwort auf diese Frage. Es ist aber so, dass man im Schnitt ca. 100 bis 150** angeleitete Gruppenstunden plus eine ähnliche Menge an selbständigem Lernen aufwenden muss, um ein Niveau weiterzukommen, also z. B. um von A0 zu A1 zu gelangen. Unsere regulären Gruppenkurse sind in drei Blöcke pro Sprachniveau aufgeteilt.',
      },
      extra: { en: hoursExtra('en'), de: hoursExtra('de') },
    },
    {
      q: {
        en: 'How do I find out my language level?',
        de: 'Wie finde ich mein Sprachniveau heraus?',
      },
      a: {
        en: 'We follow the six levels of the Common European Framework of Reference (CEFR). Our <a href="/niveaus.html">self-assessment grid</a> lets you get a rough sense of where you stand. If you would prefer a formal placement test, contact us and we will help you find the right level.',
        de: 'Wir halten uns an die sechs Stufen des Gemeinsamen Europäischen Referenzrahmens (GER). Mit unserem <a href="/niveaus.html">Selbsteinschätzungsraster</a> können Sie ungefähr einschätzen, wo Sie stehen. Wenn Sie einen formellen Einstufungstest bevorzugen, kontaktieren Sie uns. Wir helfen Ihnen, das richtige Niveau zu finden.',
      },
    },
    {
      q: {
        en: 'Should I take private or group lessons?',
        de: 'Soll ich Privat- oder Gruppenunterricht nehmen?',
      },
      a: {
        en: 'It depends on what you are looking for. Private lessons suit you above all if you want to work towards one particular goal and would rather not have to fit around group dynamics or stronger and weaker fellow learners. Group lessons can often open up new perspectives, give you the chance to meet people, and either challenge you or show you that you already know more than you thought. Both formats are excellent ways to learn a language, and they mix well over the course of your learning.',
        de: 'Es kommt darauf an, was Sie suchen. Privatlektionen eignen sich vor allem, wenn Sie an einem ganz bestimmten Ziel arbeiten wollen und sich nicht nach Gruppendynamiken oder stärkeren oder schwächeren Mitlernenden richten möchten. Gruppenunterricht kann Ihnen oft neue Perspektiven aufzeigen, die Möglichkeit bieten, neue Kontakte zu knüpfen, und Sie herausfordern oder Ihnen auch teilweise zeigen, dass Sie vielleicht doch schon mehr wissen, als Sie dachten. Beide Formate eignen sich hervorragend, um eine Sprache zu lernen, und lassen sich im Sprachlernweg auch gut mischen.',
      },
    },
    {
      q: {
        en: 'How big are the groups?',
        de: 'Wie gross sind die Gruppen?',
      },
      a: {
        en: 'Open group courses take a maximum of five people, and run from three. Gymivorbereitung groups run from three to seven people. If you want a group of exactly your colleagues or friends, we can set that up as a private group.',
        de: 'Offene Gruppenkurse finden ab drei Teilnehmenden statt und haben maximal fünf Teilnehmende. Wenn Sie als Gruppe von Kolleginnen, Kollegen oder Freundinnen und Freunden lernen möchten, richten wir das als geschlossene Gruppe ein.',
      },
    },
    {
      q: {
        en: 'What happens if fewer than three people sign up?',
        de: 'Was passiert, wenn sich weniger als drei Personen anmelden?',
      },
      a: {
        en: 'A group course runs from three participants. If fewer sign up, we either merge the course, postpone it, or — if you agree — run it with fewer lessons. If the school cancels a course, the full amount is refunded.',
        de: 'Bei weniger Anmeldungen legen wir Kurse mit Ihrem Einverständnis zusammen, verschieben sie oder führen sie modifiziert durch. Sagt die Schule einen Kurs ab, wird der volle Betrag rückerstattet.',
      },
    },
    {
      q: {
        en: 'Which exams do you prepare for?',
        de: 'Auf welche Prüfungen bereiten Sie vor?',
      },
      a: {
        en: 'TELC, Goethe, FIDE, Cambridge, TOEFL, IELTS. We practise with the real exam formats, so nothing on the day is a surprise.',
        de: 'TELC, Goethe, FIDE, Cambridge, TOEFL, IELTS. Wir üben mit den echten Prüfungsformaten, damit am Prüfungstag nichts überraschend kommt.',
      },
    },
  ],

  // Why German is hard to pick up here, and why Swiss German is worth it
  // anyway. Its own group: it is the question this school exists to answer,
  // and it is what people search for.
  swiss: [
    {
      q: {
        en: 'I do not like German and/or Swiss German. Should I still learn it?',
        de: 'Ich mag Deutsch und/oder Schweizerdeutsch nicht, sollte ich es trotzdem lernen?',
      },
      a: {
        en: 'Our answer is yes. Even if the language does not particularly appeal to you, we will try to give you a way into it. Why? We believe it can only be a good thing to at least understand another language, and better still to speak it. In Zürich the language of everyday life simply is Swiss German and, however annoying that may be, people speak their mother tongue, consciously or not. Being able at least to understand it can only help you find your feet in Switzerland more easily. The same goes for standard German, which is indispensable in writing.',
        de: 'Unsere Antwort ist: ja. Auch wenn Ihnen die Sprache nicht besonders zusagt, werden wir versuchen, Ihnen einen Zugang zur Sprache zu vermitteln. Warum? Wir glauben, dass es nur positiv sein kann, eine weitere Sprache mindestens zu verstehen und noch mehr, sie zu sprechen. In Zürich ist die vorwiegend verwendete Alltagssprache nun einmal Schweizerdeutsch, und so sehr es nerven mag, die Leute sprechen, bewusst oder unbewusst, ihre Muttersprache. Es kann Ihnen nur helfen, sie zumindest zu verstehen, um sich in der Schweiz einfacher zurechtzufinden. Ebenso das Hochdeutsche, das im Schriftverkehr unabdingbar ist.',
      },
    },
    {
      q: {
        en: 'Why is it so difficult to learn German in Switzerland?',
        de: 'Warum ist es so schwierig, in der Schweiz Deutsch zu lernen?',
      },
      a: {
        en: 'Staying on the same subject: one of the official national languages is indeed standard German. What people in German-speaking Switzerland actually speak day to day, however, is largely Swiss German. That is a reality which unfortunately cannot be changed, and it makes learning standard German immensely harder. A key factor in learning a language is the casual, everyday exposure to it outside the classroom, and the prevalence of Swiss German makes that difficult to arrange here. Alongside our courses we therefore also try to provide material that closes this gap between what is learnt and where it is used.',
        de: 'Wir bleiben beim Thema. Eine der offiziellen Landessprachen ist zwar Hochdeutsch. Was aber im Alltag von den Einwohnerinnen und Einwohnern der Deutschschweiz grösstenteils gesprochen wird, ist Schweizerdeutsch. Es ist eine Realität, die sich leider nicht ändern lässt. Das erschwert aber das Lernen des Hochdeutschen immens. Ein Schlüsselfaktor beim Lernen einer Sprache ist die beiläufige alltägliche Auseinandersetzung mit dieser ausserhalb des Unterrichts. Und das ist in der Schweiz durch die Prävalenz des Schweizerdeutschen leider nicht so einfach zu gestalten. Wir versuchen im Zusammenhang mit unseren Kursen auch Inhalte zu vermitteln, um diese Diskrepanz zwischen Gelerntem und der Anwendung dessen im Alltag auszugleichen.',
      },
    },
  ],

  online: [
    {
      q: {
        en: 'Can I learn online?',
        de: 'Kann ich online lernen?',
      },
      a: {
        en: 'Yes, any course we offer can also be taught online.',
        de: 'Ja, jeder unserer Kurse kann auch online stattfinden.',
      },
    },
    {
      q: {
        en: 'I am not in Switzerland. Can I still take lessons?',
        de: 'Ich bin nicht in der Schweiz. Kann ich trotzdem Unterricht nehmen?',
      },
      a: {
        en: 'Yes. Lesson times are arranged in Zürich time, and we can usually find a slot that works across European time zones. For anything further afield, tell us your window and we will aim to find a suitable time.',
        de: 'Ja. Die Zeiten richten sich nach Zürcher Zeit, und innerhalb Europas findet sich fast immer ein passender Termin. Bei grösseren Zeitverschiebungen sagen Sie uns Ihr Zeitfenster, dann suchen wir eine passende Zeit.',
      },
    },
    {
      q: {
        en: 'What do I need for an online lesson?',
        de: 'Was brauche ich für eine Online-Lektion?',
      },
      a: {
        en: 'A stable internet connection, a device with a camera and microphone, and somewhere you can speak out loud. Materials are shared digitally.',
        de: 'Eine stabile Internetverbindung, ein Gerät mit Kamera und Mikrofon und einen Ort, an dem Sie laut sprechen können. Die Materialien erhalten Sie digital.',
      },
    },
  ],

  gymi: [
    {
      q: {
        en: 'When should we start preparing for the Gymiprüfung?',
        de: 'Wann sollten wir mit der Gymivorbereitung beginnen?',
      },
      a: {
        en: 'The earlier the better. The road to Gymnasium starts long before exam day. We teach Mathematics and German across 12 or 20 teaching days of three hours each — 36 and 60 lessons respectively — once or twice a week. Tell us your child’s school year and target exam date and we will suggest a timeline.',
        de: 'Je früher, desto besser. Der Weg ans Gymnasium beginnt lange vor der Prüfung. Üblicherweise starten Vorbereitungskurse bereits im März des Prüfungsvorjahres. Unterrichtet wird an 12 oder 20 Unterrichtstagen à drei Stunden, also 36 bzw. 60 Lektionen, ein- oder zweimal pro Woche. Intensivkurse in den Ferienzeiten stehen ebenfalls zur Auswahl. Kontaktieren Sie uns, um einen passenden Zeitplan zu finden.',
      },
    },
    {
      q: {
        en: 'Group or one-to-one for Gymivorbereitung?',
        de: 'Gruppe oder Einzelunterricht für die Gymivorbereitung?',
      },
      a: {
        en: 'Groups of three to seven children work well when a child is broadly on track and needs exam practice. One-to-one is the better choice when there are specific gaps to close, or when exam nerves are the main obstacle.',
        de: 'Gruppen von drei bis sieben Kindern eignen sich gut, wenn ein Kind grundsätzlich auf Kurs ist und lediglich Prüfungstraining braucht. Einzelunterricht ist die bessere Wahl, wenn gezielt Lücken zu schliessen sind oder die Prüfungsangst im Vordergrund steht.',
      },
    },
    {
      q: {
        en: 'What does a Gymivorbereitung lesson cover?',
        de: 'Was wird in der Gymivorbereitung geübt?',
      },
      a: {
        en: 'Closing gaps in the underlying material, practising with the exam format itself, and building the calm needed to perform under time pressure. The balance between those three is set per child.',
        de: 'Unterrichtet werden die Fächer Mathematik und Deutsch. Das Ziel ist es, Lücken im Stoff zu schliessen, mit dem Prüfungsformat zu üben und Ruhe aufzubauen. Je nach Kind fällt der Fokus auf diese verschiedenen Aspekte unterschiedlich aus.',
      },
    },
  ],

  company: [
    {
      q: {
        en: 'Do you teach at our offices?',
        de: 'Unterrichten Sie bei uns im Büro?',
      },
      a: {
        en: 'Yes. In-house training at your offices is the most common arrangement. We can also teach in our classroom or online, and mix the three across a single programme if your team is split across sites.',
        de: 'Ja, wir unterrichten bei Bedarf direkt bei Ihnen im Büro oder online.',
      },
    },
    {
      q: {
        en: 'How much does a company course cost?',
        de: 'Was kostet ein Firmenkurs?',
      },
      a: {
        en: 'Pricing is on request, because it depends on group size, lesson length, location and how much bespoke material the programme needs. A level typically takes around 100 lessons, commonly at two 60-minute lessons per week.',
        de: 'Den Preis erstellen wir auf Anfrage. Er hängt von Gruppengrösse, Lektionsdauer, Ort und dem Umfang an massgeschneidertem Material ab. Ein Niveau umfasst typischerweise rund 100 Lektionen, üblicherweise zwei Lektionen à 60 Minuten pro Woche.',
      },
    },
    {
      q: {
        en: 'Can the course content be specific to our industry?',
        de: 'Können die Inhalte auf unsere Branche zugeschnitten werden?',
      },
      a: {
        en: 'That is the point of an in-house course. We build the programme around your industry, your everyday work and the situations your people actually face: client meetings, phone calls, written correspondence, small talk in the corridor.',
        de: 'Selbstverständlich. Wir bauen das Programm um Ihre Branche, Ihren Arbeitsalltag und die Situationen, die für Sie relevant sind, auf. Kundengespräche, Telefonate, Korrespondenz, Small Talk im Gang.',
      },
    },
    {
      q: {
        en: 'Can you teach Swiss German to relocating employees?',
        de: 'Unterrichten Sie Schweizerdeutsch für zuziehende Mitarbeitende?',
      },
      a: {
        en: 'Yes, and it is one of the things we are asked for most. Standard German gets a new arrival through the working day. Swiss German is what opens the door to the lunch table, the corridor and the team apéro.',
        de: 'Ja, wir unterrichten Schweizerdeutsch. Hochdeutsch hilft einem im Schriftverkehr. Schweizerdeutsch öffnet Türen am Mittagstisch, im Gang, am Team-Apéro und auch sonst im Alltagsleben.',
      },
    },
    {
      q: {
        en: 'How is invoicing handled?',
        de: 'Wie läuft die Rechnungsstellung und Anmeldung?',
      },
      a: {
        en: 'We invoice the company directly, and can issue one invoice for the whole programme or per participant. Companies can also be given a booking code so employees enrol themselves in the right course without going through your HR inbox.',
        de: 'Die Rechnung wird an die Firma adressiert, wahlweise eine Rechnung für das ganze Programm oder für individuelle Teilnehmende. Wir erstellen bei Bedarf auch Kursbuchungscodes, damit Mitarbeitende sich direkt über unsere Website anmelden können.',
      },
    },
  ],
};

// Renders a group of Q&As as a native accordion, collapsed by default so the
// homepage stays scannable. The answer is in the HTML either way, which is what
// the FAQPage markup and the assistants that quote it need; a reader opens it
// with one click and no JavaScript.
//
// `extra` is block content that belongs to the answer but not inside its <p>,
// and not in the structured data either — a figure or a source list, which a
// quoted answer is better off without.
export function faqHtml(items, lang) {
  return items
    .map(
      (item) =>
        `<details class="faq-item"><summary><h3>${item.q[lang]}</h3></summary>` +
        `<p>${item.a[lang]}</p>${item.extra ? item.extra[lang] : ''}</details>`
    )
    .join('');
}

// The rendered lists live on the homepage. Added here rather than inside the
// pages literal because they need FAQ, which is declared after it.
Object.assign(pages['/index.html'].text, {
  '#about-personal-list': { en: faqHtml(FAQ.personal, 'en'), de: faqHtml(FAQ.personal, 'de') },
  '#faq-courses-list': { en: faqHtml(FAQ.courses, 'en'), de: faqHtml(FAQ.courses, 'de') },
  '#faq-swiss-list': { en: faqHtml(FAQ.swiss, 'en'), de: faqHtml(FAQ.swiss, 'de') },
  '#faq-online-list': { en: faqHtml(FAQ.online, 'en'), de: faqHtml(FAQ.online, 'de') },
  '#faq-gymi-list': { en: faqHtml(FAQ.gymi, 'en'), de: faqHtml(FAQ.gymi, 'de') },
  '#faq-company-list': { en: faqHtml(FAQ.company, 'en'), de: faqHtml(FAQ.company, 'de') },
});

Object.assign(pages, {
  '/intake.html': {
    title: {
      en: 'Student Intake — Learning with Gioia',
      de: 'Schülerangaben — Learning with Gioia',
    },
    text: {
      '#intake-loading': { en: 'loading...', de: 'Wird geladen...' },
      '#intake-content h1': { en: 'your details', de: 'Ihre Angaben' },
      '.intake-intro': {
        en: 'Please fill in or confirm the information below so we can keep your records up to date. Fields marked * are required.',
        de: 'Bitte füllen Sie die folgenden Angaben aus oder bestätigen Sie sie, damit wir Ihre Daten aktuell halten können. Felder mit * sind erforderlich.',
      },
      '#intake-label-student': {
        en: 'student information',
        de: 'Schülerangaben',
      },
      'label[for="if-first-name"]': { en: 'first name *', de: 'Vorname *' },
      'label[for="if-last-name"]': { en: 'last name *', de: 'Nachname *' },
      'label[for="if-gender"]': { en: 'salutation *', de: 'Anrede *' },
      '#if-gender option[value="female"]': { en: 'Ms', de: 'Frau' },
      '#if-gender option[value="male"]': { en: 'Mr', de: 'Herr' },
      '#if-gender option[value="other"]': { en: 'Other', de: 'Andere' },
      'label[for="if-gender-note"]': { en: 'please specify *', de: 'bitte angeben *' },
      'label[for="if-email"]': { en: 'email *', de: 'E-Mail *' },
      'label[for="if-phone"]': { en: 'phone *', de: 'Telefon *' },
      'label[for="if-street"]': { en: 'street *', de: 'Strasse *' },
      'label[for="if-street-number"]': { en: 'number *', de: 'Nummer *' },
      'label[for="if-postcode"]': { en: 'postcode *', de: 'Postleitzahl *' },
      'label[for="if-city"]': { en: 'city *', de: 'Ort *' },
      '#intake-label-emergency': {
        en: 'emergency contact',
        de: 'Notfallkontakt',
      },
      'label[for="if-ec-name"]': { en: 'name', de: 'Name' },
      'label[for="if-ec-relationship"]': { en: 'relationship', de: 'Beziehung' },
      '#if-ec-relationship': {
        en: 'e.g. partner, parent',
        de: 'z. B. Partner/in, Elternteil',
        attr: 'placeholder',
      },
      'label[for="if-ec-phone"]': { en: 'phone', de: 'Telefon' },
      'label[for="if-ec-email"]': { en: 'email', de: 'E-Mail' },
      '#intake-label-billing': {
        en: 'billing',
        de: 'Rechnung',
      },
      '.intake-checkbox span': {
        en: 'billing address differs from personal address',
        de: 'Rechnungsadresse weicht von persönlicher Adresse ab',
      },
      'label[for="if-billing-first-name"]': {
        en: 'billing first name *',
        de: 'Rechnungsvorname *',
      },
      'label[for="if-billing-last-name"]': {
        en: 'billing last name *',
        de: 'Rechnungsnachname *',
      },
      'label[for="if-billing-email"]': {
        en: 'billing email *',
        de: 'Rechnungs-E-Mail *',
      },
      'label[for="if-billing-street"]': { en: 'street *', de: 'Strasse *' },
      'label[for="if-billing-street-number"]': { en: 'number *', de: 'Nummer *' },
      'label[for="if-billing-postcode"]': { en: 'postcode *', de: 'Postleitzahl *' },
      'label[for="if-billing-city"]': { en: 'city *', de: 'Ort *' },
      '#err-first-name': {
        en: 'Please enter a first name.',
        de: 'Bitte geben Sie einen Vornamen ein.',
      },
      '#err-last-name': {
        en: 'Please enter a last name.',
        de: 'Bitte geben Sie einen Nachnamen ein.',
      },
      '#err-gender': {
        en: 'Please select a salutation.',
        de: 'Bitte wählen Sie eine Anrede aus.',
      },
      '#err-gender-note': {
        en: 'Please specify your salutation.',
        de: 'Bitte geben Sie Ihre Anrede an.',
      },
      '#intake-submit-btn': { en: 'save details ->', de: 'Angaben speichern ->' },
      '#submit-error': {
        en: 'Something went wrong — please try again or email us at <a href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
        de: 'Etwas ist schiefgelaufen — bitte versuchen Sie es erneut oder schreiben Sie uns an <a href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
      },
      '#intake-thanks h2': { en: 'thank you.', de: 'Danke.' },
      '#intake-thanks p': {
        en: "Your details have been saved. We'll be in touch shortly.",
        de: 'Ihre Angaben wurden gespeichert. Wir melden uns bald.',
      },
      '#intake-error h2': {
        en: 'link expired or invalid.',
        de: 'Link abgelaufen oder ungültig.',
      },
      '#intake-error p': {
        en: 'Please contact your teacher for a new link, or email <a href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
        de: 'Bitte kontaktieren Sie Ihre Lehrperson für einen neuen Link oder schreiben Sie an <a href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
      },
    },
  },
  '/feedback.html': {
    title: {
      en: 'Course Feedback — Learning with Gioia',
      de: 'Kursfeedback — Learning with Gioia',
    },
    text: {
      '#feedback-loading': { en: 'loading...', de: 'Wird geladen...' },
      '#feedback-content h1': { en: 'your feedback', de: 'Ihr Feedback' },
      '.intake-intro': {
        en: 'Thank you for taking the time to share your feedback. Your honest opinion helps improve future lessons — there are no right or wrong answers, so please be as open as you like. Only your teacher reads your answers.',
        de: 'Danke, dass Sie sich Zeit für Ihr Feedback nehmen. Ihre ehrliche Meinung hilft uns, den Unterricht besser zu machen — es gibt keine richtigen oder falschen Antworten, sagen Sie also ruhig offen, was Sie denken. Ihre Antworten liest nur Ihre Lehrperson.',
      },
      '#feedback-time': {
        en: 'estimated time: 3-5 minutes',
        de: 'Dauer: 3-5 Minuten',
      },
      '#feedback-submit-btn': { en: 'send feedback ->', de: 'Feedback senden ->' },
      '#submit-error': {
        en: 'Something went wrong — please try again or email us at <a href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
        de: 'Etwas ist schiefgelaufen — bitte versuchen Sie es erneut oder schreiben Sie uns an <a href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
      },
      '#feedback-thanks h2': { en: 'thank you.', de: 'Danke.' },
      '#feedback-thanks p': {
        en: 'Your honest feedback helps us improve our lessons for everyone. We read every response carefully and genuinely appreciate both the compliments and the suggestions.',
        de: 'Ihr ehrliches Feedback hilft uns, den Unterricht für alle besser zu machen. Wir lesen jede Antwort aufmerksam und freuen uns über Lob genauso wie über Verbesserungsvorschläge.',
      },
      '#feedback-done h2': { en: 'already answered.', de: 'Bereits beantwortet.' },
      '#feedback-done p': {
        en: 'This feedback has already been submitted — thank you. If you would like to add something, just email <a href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
        de: 'Dieses Feedback wurde bereits abgeschickt — danke. Wenn Sie noch etwas ergänzen möchten, schreiben Sie einfach an <a href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
      },
      '#feedback-unavailable h2': {
        en: 'not right now.',
        de: 'Gerade nicht möglich.',
      },
      '#feedback-unavailable p': {
        en: 'We could not load your feedback form just now — your link is still fine. Please try again in a few minutes, or email <a href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
        de: 'Wir konnten Ihr Feedback-Formular gerade nicht laden — Ihr Link ist weiterhin gültig. Bitte versuchen Sie es in ein paar Minuten noch einmal oder schreiben Sie an <a href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
      },
      '#feedback-error h2': {
        en: 'link expired or invalid.',
        de: 'Link abgelaufen oder ungültig.',
      },
      '#feedback-error p': {
        en: 'Please contact your teacher for a new link, or email <a href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
        de: 'Bitte kontaktieren Sie Ihre Lehrperson für einen neuen Link oder schreiben Sie an <a href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
      },
    },
  },
  '/modalpartikeln.html': {
    title: {
      en: 'German Modal Particles Explained | Learning with Gioia',
      de: 'Modalpartikeln — Deutsch lernen | Learning with Gioia',
    },
    description: {
      en: 'Learn German modal particles interactively: reference with examples, quiz and cheat sheet. A free learning resource from Learning with Gioia.',
      de: 'Lernen Sie deutsche Modalpartikeln interaktiv: Übersicht mit Beispielen, Quiz und Spickzettel. Kostenloses Lernmittel von Learning with Gioia.',
    },
    text: {
      '.page-header h1': { en: 'Modal particles', de: 'Modalpartikeln' },
      '.page-header p': {
        en: 'The little words that make German come alive.',
        de: 'Die kleinen Wörter, die Deutsch lebendig machen.',
      },
      '.tab[data-tab="reference"]': { en: 'Reference', de: 'Übersicht' },
      '.tab[data-tab="quiz"]': { en: 'Quiz', de: 'Quiz' },
      '.tab[data-tab="cheatsheet"]': { en: 'Cheat sheet', de: 'Spickzettel' },
      '.position-note h2': { en: 'Position in the sentence', de: 'Stellung im Satz' },
      '.position-note p': {
        en: 'Modal particles always stand in the <strong>middle field</strong> of the sentence — usually before <em>auch</em> or <em>nicht</em>, before modal and local details, and before words or information that belong directly to the verb.',
        de: 'Modalpartikeln stehen immer im <strong>Mittelfeld</strong> des Satzes — meist vor <em>auch</em> oder <em>nicht</em>, bzw. vor Modal- und Lokalangaben und vor den <em>Verbgefährten</em> (Wörter und Informationen, die direkt zum Verb gehören oder direkt mit ihm verbunden sind).',
      },
    },
  },
  '/subjunktionen.html': {
    title: {
      en: 'German Subjunctions (Subordinating Conjunctions) | Learning with Gioia',
      de: 'Subjunktionen — Deutsch lernen | Learning with Gioia',
    },
    description: {
      en: 'Learn German subjunctions interactively: meaning, subordinate-clause word order, examples, quiz and cheat sheet.',
      de: 'Lernen Sie deutsche Subjunktionen interaktiv: Bedeutung, Nebensatzstellung, Beispiele, Quiz und Spickzettel.',
    },
    text: {
      '.page-header h1': { en: 'Subjunctions', de: 'Subjunktionen' },
      '.page-header p': {
        en: 'The words that open subordinate clauses and connect thoughts.',
        de: 'Die Wörter, die Nebensätze öffnen und Gedanken verbinden.',
      },
      '.tab[data-tab="reference"]': { en: 'Reference', de: 'Übersicht' },
      '.tab[data-tab="quiz"]': { en: 'Quiz', de: 'Quiz' },
      '.tab[data-tab="cheatsheet"]': { en: 'Cheat sheet', de: 'Spickzettel' },
      '.position-note h2': { en: 'Position in the sentence', de: 'Stellung im Satz' },
      '.position-note p': {
        en: 'Subjunctions introduce <strong>subordinate clauses</strong>. The finite verb normally goes <strong>to the end</strong> of the subordinate clause: <em>Ich bleibe, weil ich lernen muss.</em> When the subordinate clause comes first, the finite verb follows directly in the main clause: <em>Weil ich lernen muss, bleibe ich.</em>',
        de: 'Subjunktionen leiten <strong>Nebensätze</strong> ein. Das finite Verb steht im Nebensatz normalerweise <strong>am Ende</strong>: <em>Ich bleibe, weil ich lernen muss.</em> Wenn der Nebensatz vorne steht, folgt im Hauptsatz direkt das finite Verb: <em>Weil ich lernen muss, bleibe ich.</em>',
      },
    },
  },
  '/niveaus.html': {
    title: {
      en: 'German Language Levels (CEFR) | Learning with Gioia',
      de: 'Sprachniveaus (GER) — Deutsch lernen | Learning with Gioia',
    },
    description: {
      en: 'The six CEFR levels A1 to C2 explained — plus an interactive self-assessment checklist to find your German level.',
      de: 'Die sechs Sprachniveaus A1 bis C2 des GER erklärt – mit interaktivem Selbsteinschätzungsraster für Deutsch.',
    },
  },
  '/konjunktionen.html': {
    title: {
      en: 'German Conjunctions: aber, denn, und, sondern, oder | Learning with Gioia',
      de: 'Konjunktionen — Deutsch lernen | Learning with Gioia',
    },
    description: {
      en: 'Learn the five German conjunctions aber, denn, und, sondern and oder interactively: meaning, word order, examples, quiz and cheat sheet.',
      de: 'Lernen Sie die fünf deutschen Konjunktionen aber, denn, und, sondern und oder interaktiv: Bedeutung, Satzstellung, Beispiele, Quiz und Spickzettel.',
    },
    text: {
      '.page-header h1': { en: 'Conjunctions', de: 'Konjunktionen' },
      '.page-header p': {
        en: 'The five words that connect equal parts.',
        de: 'Die fünf Wörter, die Gleichrangiges verbinden.',
      },
      '.tab[data-tab="reference"]': { en: 'Reference', de: 'Übersicht' },
      '.tab[data-tab="quiz"]': { en: 'Quiz', de: 'Quiz' },
      '.tab[data-tab="cheatsheet"]': { en: 'Cheat sheet', de: 'Spickzettel' },
      '.position-note h2': { en: 'Position in the sentence', de: 'Stellung im Satz' },
      '.position-note p': {
        en: 'These five conjunctions usually connect <strong>equal</strong> words, phrases, or main clauses. Unlike subjunctions, they normally do <strong>not</strong> introduce subordinate clauses and do <strong>not</strong> send the finite verb to the end: <em>Ich lerne, und sie liest.</em> Compare: <em>Ich lerne, weil ich morgen Prüfung habe.</em>',
        de: 'Diese fünf Konjunktionen verbinden meist <strong>gleichrangige</strong> Wörter, Satzteile oder Hauptsätze. Anders als Subjunktionen leiten sie normalerweise <strong>keinen Nebensatz</strong> ein und schicken das finite Verb <strong>nicht ans Ende</strong>: <em>Ich lerne, und sie liest.</em> Vergleiche: <em>Ich lerne, weil ich morgen Prüfung habe.</em>',
      },
    },
  },
});
