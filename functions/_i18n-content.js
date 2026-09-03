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
const home = (hash) => (lang) => `/${lang}/#${hash}`;

export const LEGACY_SLUG_REDIRECTS = {
  info: home('offer-details'),
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
  courseStructure: { en: 'course structure', de: 'Kursstruktur' },
  levels: { en: 'your level', de: 'Dein Niveau' },
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
      en: 'German and Swiss German courses, Gymivorbereitung, exam preparation and tutoring in Zürich. Native-speaking teachers with linguistics degrees and formal teaching qualifications.',
      de: 'Deutsch- und Schweizerdeutschkurse, Gymivorbereitung, Prüfungsvorbereitung und Nachhilfe in Zürich. Muttersprachliche Lehrpersonen mit sprachwissenschaftlichem Studium und formaler Lehrqualifikation.',
    },
    text: {
      // The visible wordmark is an SVG, so this screen-reader heading is the
      // page's only h1 — it has to be in the reader's language.
      'h1.sr-only': {
        en: 'Learning with Gioia — language courses, exam preparation and tutoring in Zürich',
        de: 'Learning with Gioia — Sprachkurse, Prüfungsvorbereitung und Nachhilfe in Zürich',
      },
      '.hero-tagline': {
        en: '<em>Language courses, exam preparation &amp; tutoring</em><span class="sep" aria-hidden="true">·</span><em>Zürich</em>',
        de: '<em>Sprachkurse, Prüfungsvorbereitung &amp; Nachhilfe</em><span class="sep" aria-hidden="true">·</span><em>Zürich</em>',
      },
      '.hero-lede': {
        en: 'Small groups. Carefully prepared, individually tailored lessons.',
        de: 'Kleine Gruppen. Sorgfältige Vorbereitung, individuell abgestimmter Unterricht.',
      },
      '#hero-cta-enquiry': { en: 'make an enquiry', de: 'Anfrage senden' },
      '#hero-cta-offer': { en: 'what we offer', de: 'Unser Angebot' },

      // ── Language courses: what, in which format, where, and the rate ──
      '#language-courses .kicker': { en: 'what we offer', de: 'Unser Angebot' },
      '#language-courses .section-title': { en: 'Language courses', de: 'Sprachkurse' },
      '#lc-intro': {
        en: 'German, Swiss German and English, from complete beginner (A0) to advanced (C2), in the format and place that suit you.',
        de: 'Deutsch, Schweizerdeutsch und Englisch, von A0 bis C2, im Format und am Ort, die zu dir passen.',
      },
      '#lc-languages-title': { en: 'Languages', de: 'Sprachen' },
      '#lc-lang-german': {
        en: '<strong>German</strong> <span>For everyday life, work and study, taught exclusively by native speakers.</span>',
        de: '<strong>Deutsch</strong> <span>Für Alltag, Beruf und Studium, unterrichtet ausschliesslich von Muttersprachlerinnen und Muttersprachlern.</span>',
      },
      '#lc-lang-swiss': {
        en: '<strong>Swiss German</strong> <span>Follow conversations, join in and feel at home in Swiss everyday life.</span>',
        de: '<strong>Schweizerdeutsch</strong> <span>Gesprächen folgen, mitreden und sich im Schweizer Alltag zuhause fühlen.</span>',
      },
      '#lc-lang-english': {
        en: '<strong>English</strong> <span>For school, work and everyday life, from A1 to C2.</span>',
        de: '<strong>Englisch</strong> <span>Für Schule, Beruf und Alltag, von A1 bis C2.</span>',
      },
      '#lc-lang-exams': {
        en: '<strong>Exam preparation</strong> <span>Goethe, TELC, FIDE, Cambridge, TOEFL, IELTS and more, practised with the real exam formats.</span>',
        de: '<strong>Prüfungsvorbereitung</strong> <span>Goethe, TELC, FIDE, Cambridge, TOEFL, IELTS und mehr, geübt mit den echten Prüfungsformaten.</span>',
      },
      '#lc-format-title': { en: 'Format', de: 'Format' },
      '#lc-format-group': {
        en: '<strong>Group</strong> <span>Three to five people, so everybody gets to speak.</span>',
        de: '<strong>Gruppe</strong> <span>Drei bis fünf Personen, damit alle zu Wort kommen.</span>',
      },
      '#lc-format-private': {
        en: '<strong>Private</strong> <span>One teacher, one learner, and a course built from what you need.</span>',
        de: '<strong>Einzelunterricht</strong> <span>Eine Lehrperson, eine lernende Person und ein Kurs aus dem, was du brauchst.</span>',
      },
      '#lc-format-company': {
        en: '<strong>Company</strong> <span>Training for teams, built around your industry and your everyday work.</span>',
        de: '<strong>Firmenkurse</strong> <span>Training für Teams, aufgebaut um eure Branche und euren Arbeitsalltag.</span>',
      },
      '#lc-format-tailored': {
        en: '<strong>Build your own</strong> <span>Lunchtime German, intensive blocks, combined courses: fully tailored to your schedule.</span>',
        de: '<strong>Build your own</strong> <span>Lunchtime German, Intensivblöcke, kombinierte Kurse: ganz auf deinen Zeitplan zugeschnitten.</span>',
      },
      '#lc-location-title': { en: 'Location', de: 'Ort' },
      '#lc-location-inperson': {
        en: '<strong>In person</strong> <span>In Zürich. Contact us to find out about our locations.</span>',
        de: '<strong>Vor Ort</strong> <span>In Zürich. Frag uns nach unseren Standorten.</span>',
      },
      '#lc-location-online': {
        en: '<strong>Online</strong> <span>The same lessons by video, wherever you are.</span>',
        de: '<strong>Online</strong> <span>Dieselben Lektionen per Video, wo immer du bist.</span>',
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
        en: 'Tutoring in all subjects taught in Swiss schools, from primary school to Matura.',
        de: 'Nachhilfe in allen Fächern der Schweizer Schulen, von der Primarschule bis zur Matura.',
      },
      '#tu-levels-title': { en: 'Levels', de: 'Stufen' },
      '#tu-level-primary': {
        en: '<strong>Primary school</strong> <span>Building the basics and closing gaps early.</span>',
        de: '<strong>Primarschule</strong> <span>Grundlagen aufbauen und Lücken früh schliessen.</span>',
      },
      '#tu-level-secondary': {
        en: '<strong>Secondary school</strong> <span>Keeping up in the subjects that decide the next step.</span>',
        de: '<strong>Sekundarschule</strong> <span>Am Ball bleiben in den Fächern, die über den nächsten Schritt entscheiden.</span>',
      },
      '#tu-level-gymnasium': {
        en: '<strong>Gymnasium</strong> <span>Right through to the Matura exams.</span>',
        de: '<strong>Gymnasium</strong> <span>Bis zur Matura.</span>',
      },
      '#tu-format-title': { en: 'Format', de: 'Format' },
      '#tu-format-group': {
        en: '<strong>Group</strong> <span>Three to seven pupils.</span>',
        de: '<strong>Gruppe</strong> <span>Drei bis sieben Schülerinnen und Schüler.</span>',
      },
      '#tu-format-private': {
        en: '<strong>Private</strong> <span>One teacher, one pupil, at your own pace.</span>',
        de: '<strong>Einzelunterricht</strong> <span>Eine Lehrperson, ein Schüler, im eigenen Tempo.</span>',
      },
      '#tu-location-title': { en: 'Location', de: 'Ort' },
      '#tu-location-inperson': {
        en: '<strong>In person</strong> <span>In Zürich. Contact us to find out about our locations.</span>',
        de: '<strong>Vor Ort</strong> <span>In Zürich. Frag uns nach unseren Standorten.</span>',
      },
      '#tu-location-online': {
        en: '<strong>Online</strong> <span>The same lessons by video, wherever you are.</span>',
        de: '<strong>Online</strong> <span>Dieselben Lektionen per Video, wo immer du bist.</span>',
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
        en: 'Step by step to the Gymiprüfung, in small groups or one-to-one, always tailored to your child.',
        de: 'Schritt für Schritt zur Gymiprüfung, in kleinen Gruppen oder im Einzelunterricht, immer abgestimmt auf dein Kind.',
      },
      '#gy-practice-title': { en: 'What we practise', de: 'Was wir üben' },
      '#gy-practice-gaps': {
        en: '<strong>Closing gaps</strong> <span>In the material the exam is built on.</span>',
        de: '<strong>Lücken schliessen</strong> <span>Im Stoff, auf dem die Prüfung aufbaut.</span>',
      },
      '#gy-practice-format': {
        en: '<strong>The exam format</strong> <span>Practising with the format itself, not only the material.</span>',
        de: '<strong>Das Prüfungsformat</strong> <span>Üben mit dem Format selbst, nicht nur mit dem Stoff.</span>',
      },
      '#gy-practice-calm': {
        en: '<strong>Calm under pressure</strong> <span>The composure it takes to perform on the day.</span>',
        de: '<strong>Ruhe unter Druck</strong> <span>Die Sicherheit, die es am Prüfungstag braucht.</span>',
      },
      '#gy-format-title': { en: 'Format', de: 'Format' },
      '#gy-format-group': {
        en: '<strong>Group</strong> <span>Three to seven children, when it is mainly about exam practice.</span>',
        de: '<strong>Gruppe</strong> <span>Drei bis sieben Kinder, wenn es vor allem um Prüfungstraining geht.</span>',
      },
      '#gy-format-private': {
        en: '<strong>Private</strong> <span>When there are specific gaps to close, or exam nerves are the main obstacle.</span>',
        de: '<strong>Einzelunterricht</strong> <span>Wenn gezielt Lücken zu schliessen sind oder die Prüfungsangst im Vordergrund steht.</span>',
      },
      '#gy-location-title': { en: 'Location', de: 'Ort' },
      '#gy-location-inperson': {
        en: '<strong>In person</strong> <span>In Zürich. Contact us to find out about our locations.</span>',
        de: '<strong>Vor Ort</strong> <span>In Zürich. Frag uns nach unseren Standorten.</span>',
      },
      '#gy-location-online': {
        en: '<strong>Online</strong> <span>The same lessons by video, wherever you are.</span>',
        de: '<strong>Online</strong> <span>Dieselben Lektionen per Video, wo immer du bist.</span>',
      },
      '#gy-facts-title': { en: 'Prices', de: 'Preise' },
      '#gy-fact-group-label': { en: 'group (3-7)', de: 'Gruppe (3-7)' },
      '#gy-fact-group-value': { en: 'CHF 80', de: 'CHF 80' },
      '#gy-fact-group-unit': { en: 'per person per 60 min', de: 'pro Person pro 60 Min.' },
      '#gy-fact-solo-label': { en: 'private', de: 'Einzelunterricht' },
      '#gy-fact-solo-value': { en: 'CHF 150', de: 'CHF 150' },
      '#gy-fact-solo-unit': { en: 'per 60 min', de: 'pro 60 Min.' },
      '#gy-note': {
        en: 'One block runs as 20 lessons of 90 minutes over five months. The earlier you start, the better.',
        de: 'Ein Block umfasst 20 Lektionen à 90 Minuten über fünf Monate. Je früher du beginnst, desto besser.',
      },
      '#gy-cta-enquiry': { en: 'make an enquiry', de: 'Anfrage senden' },
      '#gy-cta-courses': { en: 'open group courses', de: 'Offene Gruppenkurse' },

      '#offer-details .kicker': { en: 'good to know', de: 'Gut zu wissen' },
      '#offer-details .section-title': {
        en: 'Course structure',
        de: 'Kursstruktur',
      },
      '#structure-hours': {
        en: 'Progressing through a full level (e.g. from A0 to A1) typically takes around 100 to 150 hours** of guided learning, alongside a similar amount of independent study.',
        de: 'Um ein vollständiges Sprachniveau abzudecken (z. B. von A0 zu A1), benötigt man in der Regel etwa 100 bis 150 Stunden** angeleitetes Lernen plus eine ähnliche Menge an selbstständigem Lernen.',
      },
      '#structure-suggestion': {
        en: 'Our regular group courses are structured into three blocks per level:',
        de: 'Unsere regulären Gruppenkurse sind in drei Blöcke pro Niveau gegliedert:',
      },
      '#structure-diagram': {
        en: 'One full level, for example A1, splits into the partial levels A1.1, A1.2 and A1.3 of 32 hours of guided learning each. The same pattern continues for further levels.',
        de: 'Ein vollständiges Niveau, zum Beispiel A1, teilt sich in die Teilniveaus A1.1, A1.2 und A1.3 mit je 32 Stunden angeleitetem Lernen. Das gleiche Muster setzt sich für weitere Niveaus fort.',
        attr: 'aria-label',
      },
      '#structure-level-hours': {
        en: 'approx. 100 to 150 h guided learning',
        de: 'ca. 100 bis 150 Std. angeleitetes Lernen',
      },
      '.structure-part__hours': { en: '32 h', de: '32 Std.' },
      '#structure-etc': { en: 'etc.', de: 'usw.' },
      '#structure-cta': {
        en: 'We offer schedules and programmes tailored to your individual needs. Contact us about your desired course!',
        de: 'Wir bieten Stundenpläne und Programme, die auf deine individuellen Bedürfnisse zugeschnitten sind. Kontaktier uns für deinen Wunschkurs!',
      },
      '#levels .kicker': { en: 'your level', de: 'Dein Niveau' },
      '#levels .section-title': {
        en: 'Which level fits you?',
        de: 'Welches Niveau passt zu dir?',
      },
      '.levels-text': {
        en: 'Not sure where to start? Our interactive self-assessment helps you find your current level.',
        de: 'Du weisst nicht, wo anfangen? Unser interaktives Selbsteinschätzungsraster hilft dir, dein aktuelles Niveau zu finden.',
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
        de: 'Schon bei uns gelernt? Hinterlass eine Bewertung',
      },
      'label[for="review-name"]': { en: 'name', de: 'Name' },
      'label[for="review-text"]': { en: 'your review', de: 'Deine Bewertung' },
      '#err-review-name': { en: 'Please enter your name.', de: 'Bitte gib deinen Namen ein.' },
      '#err-review-text': {
        en: 'Please write a few words.',
        de: 'Bitte schreib ein paar Worte.',
      },
      '#review-note': {
        en: 'Reviews are checked before they appear on this page.',
        de: 'Bewertungen werden geprüft, bevor sie auf dieser Seite erscheinen.',
      },
      '#review-submit': { en: 'submit review', de: 'Bewertung senden' },
      '#err-review-submit': {
        en: 'Something went wrong, please try again later.',
        de: 'Etwas ist schiefgelaufen, bitte versuche es später erneut.',
      },
      '#review-success': {
        en: 'Thank you! Your review will appear here once it has been checked.',
        de: 'Danke! Deine Bewertung erscheint hier, sobald sie geprüft wurde.',
      },
      '#about .kicker': { en: 'about', de: 'Über uns' },
      '#about .section-title': {
        en: 'Experience &amp; background',
        de: 'Erfahrung &amp; Hintergrund',
      },
      '#about-lead': {
        en: 'Learning with Gioia was founded by Gioia, born and raised in Zürich and a native speaker of both Swiss German and German.',
        de: 'Learning with Gioia wurde von Gioia gegründet — in Zürich geboren und aufgewachsen, muttersprachlich Schweizerdeutsch und Deutsch.',
      },
      // The former About page, in Gioia's own words.
      '#about-gioia-body': {
        en: 'I am Gioia, and I have loved languages for as long as I can remember. Along the way I have learnt English, French, Russian, Arabic and Spanish, and made a start on Italian, Chinese, Japanese and Farsi. So I understand what the first weeks of a new language feel like from the inside.',
        de: 'Ich bin Gioia, und Sprachen haben mich fasziniert, seit ich denken kann. Ich habe Englisch, Französisch, Russisch, Arabisch und Spanisch gelernt und Italienisch, Chinesisch, Japanisch und Farsi angefangen. Wie sich die ersten Wochen einer neuen Sprache anfühlen, kann ich also sehr gut nachvollziehen.',
      },
      '#about-gioia-body-2': {
        en: 'I also know what it is to arrive in a foreign country and want to belong without giving up who you are. I studied Russian language and literature at UZH, then Russian Studies at UCL. I spent a lot of time in Eastern Europe throughout my studies and lived in London for seven years before coming home to Zürich. What I want most is that the language stays interesting to you after the lesson ends.',
        de: 'Ich weiss auch, wie es ist, in einem fremden Land anzukommen und dazugehören zu wollen, ohne die eigene Identität aufzugeben. Ich habe an der UZH Russische Sprach- und Literaturwissenschaft studiert, danach Russian Studies am UCL. Während des Studiums war ich viel in Osteuropa unterwegs und habe sieben Jahre in London gelebt, bevor ich nach Zürich zurückgekehrt bin. Mein Ziel ist es, Freude am Erlernen der Sprache über den Unterricht hinaus zu vermitteln.',
      },
      // Closes the section: everyone has done this once already.
      '#about-gioia-pull': {
        en: 'Everyone has learnt a language once already, as a small child. And everyone can learn another one.',
        de: 'Jeder hat schon einmal eine Sprache gelernt, und zwar als Kleinkind. Und jeder kann eine weitere Sprache lernen.',
      },
      '#about-gioia-cv': {
        en: '<li>In progress: teaching diploma (Lehrdiplom), University of Zürich — Russian and Mathematics.</li><li>2019 — MA in Russian Studies, University College London.</li><li>2015 — BA in Russian Language and Literature, University of Zürich.</li><li>2010 — Matura, Kantonsschule Küsnacht, bilingual German and English.</li>',
        de: '<li>Laufend: Lehrdiplom Universität Zürich — Russisch und Mathematik.</li><li>2019 — Master of Arts in Russian Studies, University College London.</li><li>2015 — Bachelor of Arts in Russischer Sprach- und Literaturwissenschaft, Universität Zürich.</li><li>2010 — Matura, Kantonsschule Küsnacht, zweisprachig Deutsch und Englisch.</li>',
      },
      '#about-approach-body': {
        en: 'Every course is tailored to the people taking it. That is easier said than done. That is why the groups stay small.',
        de: 'Jeder Kurs wird genau auf die Schüler zugeschnitten. Das ist einfacher gesagt als getan. Deshalb sind die Gruppen klein.',
      },
      '#about-approach-list': {
        en: '<li>Small groups, so everybody gets to speak.</li><li>Material built around your work, your studies or your everyday life.</li><li>A clear structure: A1 to C2 of the CEFR, with each level split into blocks of 32 lessons.</li><li>Lessons in our classrooms, at your offices, at home, or online, whichever is most convenient.</li>',
        de: '<li>Kleine Gruppen, damit alle zu Wort kommen.</li><li>Material rund um deinen Beruf, dein Studium oder deinen Alltag.</li><li>Klare Struktur: A1 bis C2 des GER, jedes Niveau unterteilt in Blöcke von 32 Lektionen.</li><li>Unterricht in unseren Kursräumen, direkt im Büro, zu Hause oder online, je nachdem, wie es bequem ist.</li>',
      },
      '#faq .kicker': { en: 'good to know', de: 'Gut zu wissen' },
      '#faq .section-title': { en: 'Frequently asked questions', de: 'Häufige Fragen' },
      '#faq-intro': {
        en: 'The questions we are asked most. Any other questions? Write us <a href="/enquiry.html">here</a>.',
        de: 'Die häufigsten Fragen. Noch weitere Fragen? Schreib uns <a href="/enquiry.html">hier</a>.',
      },
      '#faq-courses-title': { en: 'Courses and levels', de: 'Kurse und Niveaus' },
      '#faq-online-title': { en: 'Online lessons', de: 'Online-Unterricht' },
      '#faq-gymi-title': { en: 'Gymivorbereitung', de: 'Gymivorbereitung' },
      '#faq-company-title': { en: 'Company courses', de: 'Firmenkurse' },
      // The Q&A lists themselves are added below, once FAQ is declared.
      '#enquiry .section-title': { en: 'Ready to get started?', de: 'Bereit loszulegen?' },
      '.closing-text': {
        en: 'We want to give you confidence and motivation to use your knowledge beyond the classroom.',
        de: 'Wir wollen dich dabei unterstützen, dein Wissen auch ausserhalb des Unterrichts anzuwenden.',
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
        de: 'Wähle eine passende Zeit. Alle Zeiten in Zürcher Zeit (MEZ/MESZ).',
      },
      'label[for="cb-first-name"]': { en: 'first name *', de: 'Vorname *' },
      'label[for="cb-last-name"]': { en: 'last name *', de: 'Nachname *' },
      'label[for="cb-email"]': { en: 'email *', de: 'E-Mail *' },
      'label[for="cb-phone"]': { en: 'phone', de: 'Telefon' },
      'label[for="cb-topic"]': {
        en: 'what would you like to talk about?',
        de: 'Worüber möchtest du sprechen?',
      },
      '#err-cb-first-name': {
        en: 'Please enter a first name.',
        de: 'Bitte gib einen Vornamen ein.',
      },
      '#err-cb-last-name': {
        en: 'Please enter a last name.',
        de: 'Bitte gib einen Nachnamen ein.',
      },
      '#err-cb-email': {
        en: 'Please enter a valid email address.',
        de: 'Bitte gib eine gültige E-Mail-Adresse ein.',
      },
      '#err-cb-consent': {
        en: 'Please accept the terms and conditions.',
        de: 'Bitte akzeptiere die AGB.',
      },
      '#cb-submit': { en: 'book the call', de: 'Gespräch buchen' },
      '#call-success-title': { en: "You're booked in!", de: 'Dein Termin steht!' },
    },
  },
  '/enquiry.html': {
    title: {
      en: 'Make an Enquiry — Learning with Gioia',
      de: 'Anfrage senden — Learning with Gioia',
    },
    description: {
      en: 'Make a quick enquiry with Learning with Gioia — language courses, exam prep and tutoring in Zürich.',
      de: 'Sende eine kurze Anfrage an Learning with Gioia — für Sprachkurse, Prüfungsvorbereitung und Nachhilfe in Zürich.',
    },
    text: {
      h1: { en: 'make an enquiry', de: 'Anfrage senden' },
      'label[for="lesson-type"]': { en: 'what are you looking for?', de: 'Wonach suchst du?' },
      '#lesson-type': {
        en: 'e.g. German A2 course, IELTS exam prep, Maths tutoring — Gymnasium year 9, Gymivorbereitung grade 6...',
        de: 'z. B. Deutschkurs A2, IELTS-Vorbereitung, Mathe-Nachhilfe — Gymnasium 2. Klasse, Gymivorbereitung 6. Klasse...',
        attr: 'placeholder',
      },
      '#err-lesson-type': {
        en: 'Please describe what you are looking for.',
        de: 'Bitte beschreibe, wonach du suchst.',
      },
      '.section-label': { en: 'your details', de: 'Deine Angaben' },
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
        de: 'Bitte gib einen Vornamen ein.',
      },
      '#err-lead-last': { en: 'Please enter a last name.', de: 'Bitte gib einen Nachnamen ein.' },
      '#err-lead-email': {
        en: 'Please enter an email address.',
        de: 'Bitte gib eine E-Mail-Adresse ein.',
      },
      '#err-lead-phone': {
        en: 'Please enter a phone number.',
        de: 'Bitte gib eine Telefonnummer ein.',
      },
      '#err-preferred-contact': {
        en: 'Please select a preferred contact method.',
        de: 'Bitte wähle eine bevorzugte Kontaktart.',
      },
      '#preferred-contact option[value="Phone"]': { en: 'Phone', de: 'Telefon' },
      '#preferred-contact option[value="Either"]': { en: 'Either', de: 'Beides' },
      '#submit-btn': { en: 'send enquiry ->', de: 'Anfrage senden ->' },
      '#submit-error': {
        en: 'Something went wrong — please try again or email us at <a href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
        de: 'Etwas ist schiefgelaufen — bitte versuche es erneut oder schreibe uns an <a href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
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
        de: 'Kleine Gruppenkurse mit maximal 5 Personen. Wir bearbeiten Buchungsanfragen der Reihe nach und bestätigen deine Buchungsanfrage so schnell wie möglich.',
      },
      '#courses-status': { en: 'loading courses...', de: 'Kurse werden geladen...' },
      '#empty-state p': {
        en: 'currently there are no spots available in planned or ongoing group courses :(',
        de: 'Aktuell sind leider keine Plätze in geplanten oder laufenden Gruppenkursen verfügbar :(',
      },
      '#empty-state .enquiry-link': { en: 'make an enquiry ->', de: 'Anfrage senden ->' },
      '#booking-title': { en: 'your details', de: 'Deine Angaben' },
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
        de: 'Was passiert nach deiner Buchungsanfrage? Wir prüfen deine Anfrage und bestätigen deinen Platz. Dann schicken wir dir die Rechnung für deine Buchung. Sobald deine Zahlung eingegangen ist, ist dein Platz gebucht.',
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
        de: 'Bitte gib einen Vornamen ein.',
      },
      '#err-last-name': {
        en: 'Please enter a last name.',
        de: 'Bitte gib einen Nachnamen ein.',
      },
      '#err-gender': {
        en: 'Please select a salutation.',
        de: 'Bitte wähle eine Anrede aus.',
      },
      '#err-gender-note': {
        en: 'Please specify your salutation.',
        de: 'Bitte gib deine Anrede an.',
      },
      '#err-email': {
        en: 'Please enter a valid email address.',
        de: 'Bitte gib eine gültige E-Mail-Adresse ein.',
      },
      '#err-consent': {
        en: 'Please accept the terms to continue.',
        de: 'Bitte akzeptiere die AGB, um fortzufahren.',
      },
      '#err-reduced-lessons-ok': {
        en: 'Please select whether you are okay with a reduced course length.',
        de: 'Bitte wähle aus, ob du mit einer reduzierten Kursdauer einverstanden bist.',
      },
      '#err-preferred-level': {
        en: 'Please select your desired level.',
        de: 'Bitte wähle dein gewünschtes Niveau aus.',
      },
      '#err-preferred-location': {
        en: 'Please select your desired location.',
        de: 'Bitte wähle deinen gewünschten Ort aus.',
      },
      '#booking-submit': { en: 'request spot ->', de: 'Platz anfragen ->' },
      '#success-state h2': { en: 'thank you.', de: 'Danke.' },
      '#success-state p': {
        en: 'Your booking request has been received. We will confirm your request shortly.',
        de: 'Deine Buchungsanfrage ist eingegangen. Wir bestätigen deine Anfrage so schnell wie möglich.',
      },
    },
  },
  '/thankyou.html': {
    title: { en: 'Thank You — Learning with Gioia', de: 'Danke — Learning with Gioia' },
    description: {
      en: 'Your enquiry has been received. We will be in touch shortly.',
      de: 'Deine Anfrage ist bei uns eingetroffen. Wir melden uns bald.',
    },
    text: {
      '#success-state h1': { en: 'thank you.', de: 'Danke.' },
      '#thankyou-body': {
        en: "We've received your message and will contact you shortly to discuss your enquiry.",
        de: 'Wir haben deine Nachricht erhalten und melden uns bald, um deine Anfrage zu besprechen.',
      },
      '#thankyou-contact': {
        en: 'If you have any questions in the meantime, write to us at <a class="thankyou-link" href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
        de: 'Wenn du in der Zwischenzeit Fragen hast, schreib uns an <a class="thankyou-link" href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
      },
      '#success-state .home-link': { en: 'back to home', de: 'Zurück zur Startseite' },
      '#error-state h2': { en: 'something went wrong.', de: 'Etwas ist schiefgelaufen.' },
      '#error-state p': {
        en: 'Your enquiry may not have been received. Please try again or email us directly at <a class="thankyou-link thankyou-link--error" href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
        de: 'Deine Anfrage konnte möglicherweise nicht gesendet werden. Bitte versuche es erneut oder schreibe uns direkt an <a class="thankyou-link thankyou-link--error" href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
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
      de: 'Wie Learning with Gioia Personendaten erhebt, nutzt und speichert: welche Formulare, welche Dienstleister, Aufbewahrungsdauer und deine Rechte.',
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
export const FAQ = {
  courses: [
    {
      q: {
        en: 'What do you teach?',
        de: 'Was unterrichtet ihr?',
      },
      a: {
        en: 'German, Swiss German and English, from complete beginner (A0) to advanced (C2). We also offer tutoring in school subjects and preparation for the Gymiprüfung.',
        de: 'Deutsch, Schweizerdeutsch und Englisch, von A0 bis C2. Dazu kommen Nachhilfe in Schulfächern und die Vorbereitung auf die Gymiprüfung.',
      },
    },
    {
      q: {
        en: 'How long does it take to complete a level in a language course?',
        de: 'Wie lange dauert ein Niveau in einem Sprachkurs?',
      },
      a: {
        en: 'Moving through a full level in a group course, for example from A0 to A1, on average takes around 100 to 150 hours of guided learning, plus a similar amount of independent study. Our regular group courses split each level into three blocks of 32 hours.',
        de: 'Ein vollständiges Niveau in einem Gruppenkurs, zum Beispiel von A0 zu A1, braucht im Durchschnitt etwa 100 bis 150 Stunden angeleitetes Lernen plus eine ähnliche Menge selbstständiges Lernen. Unsere regulären Gruppenkurse teilen jedes Niveau in drei Blöcke à 32 Stunden.',
      },
    },
    {
      q: {
        en: 'How do I know which level I am?',
        de: 'Woher weiss ich, welches Niveau ich habe?',
      },
      a: {
        en: 'Our interactive self-assessment walks you through the six CEFR levels and gives you a profile across listening, reading, speaking and writing. You can also just ask us in a free 15-minute call.',
        de: 'Unser interaktives Selbsteinschätzungsraster führt dich durch die sechs Niveaus des GER und zeigt dir ein Profil für Hören, Lesen, Sprechen und Schreiben. Du kannst uns aber auch einfach in einem kostenlosen 15-Minuten-Gespräch fragen.',
      },
    },
    {
      q: {
        en: 'How big are the groups?',
        de: 'Wie gross sind die Gruppen?',
      },
      a: {
        en: 'Open group courses take a maximum of five people, and run from three. Gymivorbereitung groups run from three to seven people. If you want a group of exactly your colleagues or friends, we can set that up as a private group.',
        de: 'Offene Gruppenkurse haben maximal fünf Teilnehmende und finden ab drei statt. Gymivorbereitungsgruppen laufen mit drei bis sieben. Wenn ihr als Gruppe von Kolleginnen, Kollegen oder Freundinnen und Freunden lernen möchtet, richten wir das als geschlossene Gruppe ein.',
      },
    },
    {
      q: {
        en: 'What happens if fewer than three people sign up?',
        de: 'Was passiert, wenn sich weniger als drei Personen anmelden?',
      },
      a: {
        en: 'A group course runs from three participants. If fewer sign up, we either merge the course, postpone it, or — if you agree — run it with fewer lessons. If the school cancels a course, the full amount is refunded.',
        de: 'Ein Gruppenkurs findet ab drei Teilnehmenden statt. Bei weniger Anmeldungen legen wir Kurse zusammen, verschieben sie oder führen sie — mit deinem Einverständnis — mit weniger Lektionen durch. Sagt die Schule einen Kurs ab, wird der volle Betrag rückerstattet.',
      },
    },
    {
      q: {
        en: 'Which exams do you prepare for?',
        de: 'Auf welche Prüfungen bereitet ihr vor?',
      },
      a: {
        en: 'TELC, Goethe, FIDE, Cambridge, TOEFL, IELTS. We practise with the real exam formats, so nothing on the day is a surprise.',
        de: 'TELC, Goethe, FIDE, Cambridge, TOEFL, IELTS. Wir üben mit den echten Prüfungsformaten, damit am Prüfungstag nichts überraschend kommt.',
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
        de: 'Ja. Die Zeiten richten sich nach Zürcher Zeit, und innerhalb Europas findet sich fast immer ein passender Termin. Bei grösseren Zeitverschiebungen sag uns dein Zeitfenster, dann suchen wir eine passende Zeit.',
      },
    },
    {
      q: {
        en: 'What do I need for an online lesson?',
        de: 'Was brauche ich für eine Online-Lektion?',
      },
      a: {
        en: 'A stable internet connection, a device with a camera and microphone, and somewhere you can speak out loud. Materials are shared digitally.',
        de: 'Eine stabile Internetverbindung, ein Gerät mit Kamera und Mikrofon und einen Ort, an dem du laut sprechen kannst. Die Materialien erhältst du digital.',
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
        en: 'The earlier the better. The road to Gymnasium starts long before exam day. One block of Gymivorbereitung runs as 20 lessons of 90 minutes over five months. Tell us your child’s school year and target exam date and we will suggest a timeline.',
        de: 'Je früher, desto besser. Der Weg ans Gymnasium beginnt lange vor dem Prüfungstag. Ein Block Gymivorbereitung umfasst 20 Lektionen à 90 Minuten über fünf Monate. Sag uns das Schuljahr deines Kindes und den Prüfungstermin, dann schlagen wir einen Zeitplan vor.',
      },
    },
    {
      q: {
        en: 'Group or one-to-one for Gymivorbereitung?',
        de: 'Gruppe oder Einzelunterricht für die Gymivorbereitung?',
      },
      a: {
        en: 'Groups work well when a child is broadly on track and needs exam practice. One-to-one is the better choice when there are specific gaps to close, or when exam nerves are the main obstacle.',
        de: 'Gruppen eignen sich gut, wenn ein Kind grundsätzlich auf Kurs ist und Prüfungstraining braucht. Einzelunterricht ist die bessere Wahl, wenn gezielt Lücken zu schliessen sind oder die Prüfungsangst im Vordergrund steht.',
      },
    },
    {
      q: {
        en: 'What does a Gymivorbereitung lesson cover?',
        de: 'Was wird in der Gymivorbereitung geübt?',
      },
      a: {
        en: 'Closing gaps in the underlying material, practising with the exam format itself, and building the calm needed to perform under time pressure. The balance between those three is set per child.',
        de: 'Lücken im Stoff schliessen, mit dem Prüfungsformat selbst üben und die Ruhe aufbauen, die es unter Zeitdruck braucht. Die Gewichtung dieser drei Teile richtet sich nach dem einzelnen Kind.',
      },
    },
  ],

  company: [
    {
      q: {
        en: 'Do you teach at our offices?',
        de: 'Unterrichtet ihr bei uns im Büro?',
      },
      a: {
        en: 'Yes. In-house training at your offices is the most common arrangement. We can also teach in our classroom or online, and mix the three across a single programme if your team is split across sites.',
        de: 'Ja. Inhouse-Schulungen bei euch im Büro sind der häufigste Fall. Wir unterrichten auch in unserem Kursraum oder online und kombinieren die drei Varianten innerhalb eines Programms, wenn euer Team auf mehrere Standorte verteilt ist.',
      },
    },
    {
      q: {
        en: 'How much does a company course cost?',
        de: 'Was kostet ein Firmenkurs?',
      },
      a: {
        en: 'Pricing is on request, because it depends on group size, lesson length, location and how much bespoke material the programme needs. A level typically takes around 100 lessons, commonly at two 60-minute lessons per week.',
        de: 'Die Preise erstellen wir auf Anfrage, da sie von Gruppengrösse, Lektionsdauer, Ort und dem Umfang an massgeschneidertem Material abhängen. Ein Niveau umfasst typischerweise rund 100 Lektionen, üblicherweise zwei Lektionen à 60 Minuten pro Woche.',
      },
    },
    {
      q: {
        en: 'Can the course content be specific to our industry?',
        de: 'Können die Inhalte auf unsere Branche zugeschnitten werden?',
      },
      a: {
        en: 'That is the point of an in-house course. We build the programme around your industry, your everyday work and the situations your people actually face: client meetings, phone calls, written correspondence, small talk in the corridor.',
        de: 'Genau dafür ist ein Inhouse-Kurs da. Wir bauen das Programm um eure Branche, euren Arbeitsalltag und die Situationen, die bei euch wirklich vorkommen — Kundengespräche, Telefonate, Korrespondenz, Small Talk im Gang.',
      },
    },
    {
      q: {
        en: 'Can you teach Swiss German to relocating employees?',
        de: 'Unterrichtet ihr Schweizerdeutsch für zuziehende Mitarbeitende?',
      },
      a: {
        en: 'Yes, and it is one of the things we are asked for most. Standard German gets a new arrival through the working day. Swiss German is what opens the door to the lunch table, the corridor and the team apéro.',
        de: 'Ja, und das ist eine der häufigsten Anfragen. Mit Hochdeutsch kommt man durch den Arbeitstag. Schweizerdeutsch öffnet die Tür zum Mittagstisch, zum Gang und zum Team-Apéro.',
      },
    },
    {
      q: {
        en: 'How is invoicing handled?',
        de: 'Wie läuft die Rechnungsstellung?',
      },
      a: {
        en: 'We invoice the company directly, and can issue one invoice for the whole programme or per participant. Companies can also be given a booking code so employees enrol themselves in the right course without going through your HR inbox.',
        de: 'Wir stellen der Firma direkt Rechnung, wahlweise eine Rechnung für das ganze Programm oder pro Teilnehmenden. Firmen können ausserdem einen Buchungscode erhalten, mit dem sich Mitarbeitende selbst für den richtigen Kurs anmelden, ohne den Umweg über euer HR-Postfach.',
      },
    },
  ],
};

// Renders a group of Q&As as a native accordion, collapsed by default so the
// homepage stays scannable. The answer is in the HTML either way, which is what
// the FAQPage markup and the assistants that quote it need; a reader opens it
// with one click and no JavaScript.
export function faqHtml(items, lang) {
  return items
    .map(
      (item) =>
        `<details class="faq-item"><summary><h3>${item.q[lang]}</h3></summary><p>${item.a[lang]}</p></details>`
    )
    .join('');
}

// The rendered lists live on the homepage. Added here rather than inside the
// pages literal because they need FAQ, which is declared after it.
Object.assign(pages['/index.html'].text, {
  '#faq-courses-list': { en: faqHtml(FAQ.courses, 'en'), de: faqHtml(FAQ.courses, 'de') },
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
      '#intake-content h1': { en: 'your details', de: 'Deine Angaben' },
      '.intake-intro': {
        en: 'Please fill in or confirm the information below so we can keep your records up to date. Fields marked * are required.',
        de: 'Bitte fülle die folgenden Angaben aus oder bestätige sie, damit wir deine Daten aktuell halten können. Felder mit * sind erforderlich.',
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
        de: 'Bitte gib einen Vornamen ein.',
      },
      '#err-last-name': { en: 'Please enter a last name.', de: 'Bitte gib einen Nachnamen ein.' },
      '#err-gender': {
        en: 'Please select a salutation.',
        de: 'Bitte wähle eine Anrede aus.',
      },
      '#err-gender-note': {
        en: 'Please specify your salutation.',
        de: 'Bitte gib deine Anrede an.',
      },
      '#intake-submit-btn': { en: 'save details ->', de: 'Angaben speichern ->' },
      '#submit-error': {
        en: 'Something went wrong — please try again or email us at <a href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
        de: 'Etwas ist schiefgelaufen — bitte versuche es erneut oder schreibe uns an <a href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
      },
      '#intake-thanks h2': { en: 'thank you.', de: 'Danke.' },
      '#intake-thanks p': {
        en: "Your details have been saved. We'll be in touch shortly.",
        de: 'Deine Angaben wurden gespeichert. Wir melden uns bald.',
      },
      '#intake-error h2': {
        en: 'link expired or invalid.',
        de: 'Link abgelaufen oder ungültig.',
      },
      '#intake-error p': {
        en: 'Please contact your teacher for a new link, or email <a href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
        de: 'Bitte kontaktiere deine Lehrperson für einen neuen Link oder schreibe an <a href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
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
      '#feedback-content h1': { en: 'your feedback', de: 'Dein Feedback' },
      '.intake-intro': {
        en: 'Thank you for taking the time to share your feedback. Your honest opinion helps improve future lessons — there are no right or wrong answers, so please be as open as you like. Only your teacher reads your answers.',
        de: 'Danke, dass du dir Zeit für dein Feedback nimmst. Deine ehrliche Meinung hilft uns, den Unterricht besser zu machen — es gibt keine richtigen oder falschen Antworten, sag also ruhig offen, was du denkst. Deine Antworten liest nur deine Lehrperson.',
      },
      '#feedback-time': {
        en: 'estimated time: 3-5 minutes',
        de: 'Dauer: 3-5 Minuten',
      },
      '#feedback-submit-btn': { en: 'send feedback ->', de: 'Feedback senden ->' },
      '#submit-error': {
        en: 'Something went wrong — please try again or email us at <a href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
        de: 'Etwas ist schiefgelaufen — bitte versuche es erneut oder schreibe uns an <a href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
      },
      '#feedback-thanks h2': { en: 'thank you.', de: 'Danke.' },
      '#feedback-thanks p': {
        en: 'Your honest feedback helps us improve our lessons for everyone. We read every response carefully and genuinely appreciate both the compliments and the suggestions.',
        de: 'Dein ehrliches Feedback hilft uns, den Unterricht für alle besser zu machen. Wir lesen jede Antwort aufmerksam und freuen uns über Lob genauso wie über Verbesserungsvorschläge.',
      },
      '#feedback-done h2': { en: 'already answered.', de: 'Bereits beantwortet.' },
      '#feedback-done p': {
        en: 'This feedback has already been submitted — thank you. If you would like to add something, just email <a href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
        de: 'Dieses Feedback wurde bereits abgeschickt — danke. Wenn du noch etwas ergänzen möchtest, schreib einfach an <a href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
      },
      '#feedback-unavailable h2': {
        en: 'not right now.',
        de: 'Gerade nicht möglich.',
      },
      '#feedback-unavailable p': {
        en: 'We could not load your feedback form just now — your link is still fine. Please try again in a few minutes, or email <a href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
        de: 'Wir konnten dein Feedback-Formular gerade nicht laden — dein Link ist weiterhin gültig. Bitte versuche es in ein paar Minuten noch einmal oder schreibe an <a href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
      },
      '#feedback-error h2': {
        en: 'link expired or invalid.',
        de: 'Link abgelaufen oder ungültig.',
      },
      '#feedback-error p': {
        en: 'Please contact your teacher for a new link, or email <a href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
        de: 'Bitte kontaktiere deine Lehrperson für einen neuen Link oder schreibe an <a href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
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
      de: 'Lerne deutsche Modalpartikeln interaktiv: Übersicht mit Beispielen, Quiz und Spickzettel. Kostenloses Lernmittel von Learning with Gioia.',
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
      de: 'Lerne deutsche Subjunktionen interaktiv: Bedeutung, Nebensatzstellung, Beispiele, Quiz und Spickzettel.',
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
      de: 'Lerne die fünf deutschen Konjunktionen aber, denn, und, sondern und oder interaktiv: Bedeutung, Satzstellung, Beispiele, Quiz und Spickzettel.',
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
