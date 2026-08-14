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
  '/german-courses.html': { en: 'german-courses', de: 'deutschkurse' },
  '/swiss-german.html': { en: 'swiss-german', de: 'schweizerdeutsch' },
  '/gymivorbereitung.html': { en: 'gymivorbereitung', de: 'gymivorbereitung' },
  '/english-courses.html': { en: 'english-courses', de: 'englischkurse' },
  '/exam-preparation.html': { en: 'exam-preparation', de: 'pruefungsvorbereitung' },
  '/company-courses.html': { en: 'company-courses', de: 'firmenkurse' },
  '/lunch-time-german.html': { en: 'lunch-time-german', de: 'kurs-nach-mass' },
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
  // Gymivorbereitung is bought by German-speaking parents in canton Zürich, and
  // _redirects + sitemap.xml already treat /de/ as its primary URL. Listing it
  // here settles the three-way x-default contradiction in favour of German.
  '/gymivorbereitung.html': 'de',
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
export const LEGACY_SLUG_REDIRECTS = {
  info: (lang) => `/${lang}/#offer-details`,
  'english-exams': (lang) => pagePath('/english-courses.html', lang),
  redepartikeln: (lang) => pagePath('/modalpartikeln.html', lang),
  contact: (lang) => pagePath('/enquiry.html', lang),
  booking: (lang) => pagePath('/enquiry.html', lang),
  scheduling: (lang) => pagePath('/enquiry.html', lang),
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
  germanCourses: { en: 'German courses', de: 'Deutschkurse' },
  swissGerman: { en: 'Swiss German', de: 'Schweizerdeutsch' },
  gymivorbereitung: { en: 'Gymivorbereitung', de: 'Gymivorbereitung' },
  englishCourses: { en: 'English courses', de: 'Englischkurse' },
  examPreparation: { en: 'Exam preparation', de: 'Prüfungsvorbereitung' },
  companyCourses: { en: 'Company courses', de: 'Firmenkurse' },
  lunchTimeGerman: { en: 'Build your own', de: 'Build your own' },
  courseStructure: { en: 'course structure', de: 'Kursstruktur' },
  levels: { en: 'your level', de: 'Dein Niveau' },
  reviews: { en: 'reviews', de: 'Stimmen' },
  about: { en: 'about', de: 'Über uns' },
  start: { en: 'get started', de: 'Loslegen' },
  groupCourses: { en: 'group courses', de: 'Gruppenkurse' },
  enquiry: { en: 'enquiry', de: 'Anfrage' },
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
      '#offer .kicker': { en: 'what we offer', de: 'Unser Angebot' },
      '#offer .section-title': { en: 'Courses &amp; tutoring', de: 'Kurse &amp; Nachhilfe' },
      '#offer-german h3': { en: 'German courses', de: 'Deutschkurse' },
      '#offer-german p': {
        en: 'German for everyday life, work and study, from complete beginner (A0) to advanced (C2). Taught exclusively by native speakers.',
        de: 'Deutsch für Alltag, Beruf und Studium, von A0 bis C2. Unterrichtet ausschliesslich von Muttersprachlerinnen und Muttersprachlern.',
      },
      '#offer-swiss h3': { en: 'Swiss German', de: 'Schweizerdeutsch' },
      '#offer-swiss p': {
        en: 'Our Swiss German courses taught by native speakers will help you follow conversations, join in… and finally feel at home in Swiss everyday life!',
        de: 'Unsere Schweizerdeutschkurse, unterrichtet von Muttersprachlerinnen und Muttersprachlern, helfen dir, Gesprächen zu folgen, mitzureden … und dich im Schweizer Alltag endlich zuhause zu fühlen!',
      },
      '#offer-gymi h3': { en: 'Gymivorbereitung', de: 'Gymivorbereitung' },
      '#offer-gymi p': {
        en: 'The road to Gymnasium starts long before exam day. We prepare pupils step by step: closing gaps, practising with the exam format, and building the calm confidence it takes to perform on the day. In small groups or one-to-one, always tailored to your child.',
        de: 'Der Weg ans Gymnasium beginnt lange vor dem Prüfungstag. Wir bereiten Schülerinnen und Schüler Schritt für Schritt vor: Lücken schliessen, mit dem Prüfungsformat üben und die nötige Ruhe und Sicherheit aufbauen. In kleinen Gruppen oder im Einzelunterricht, immer abgestimmt auf dein Kind.',
      },
      '#offer-english h3': { en: 'English courses', de: 'Englischkurse' },
      '#offer-english p': {
        en: 'English for school, work and everyday life, from beginner (A1) to advanced (C2). Tutoring from primary school to university.',
        de: 'Englisch für Schule, Beruf und Alltag, von A1 bis C2. Nachhilfe von der Primarschule bis zur Universität.',
      },
      '#offer-exams h3': { en: 'Exam preparation', de: 'Prüfungsvorbereitung' },
      '#offer-exams p': {
        en: 'Targeted preparation for Cambridge, TOEFL, IELTS, TELC and Goethe exams. We practise with the real exam formats, so you walk in knowing exactly what to expect.',
        de: 'Gezielte Vorbereitung auf Cambridge, TOEFL, IELTS, TELC und Goethe. Wir üben mit den echten Prüfungsformaten, damit du genau weisst, was dich erwartet.',
      },
      '#offer-company h3': { en: 'Company courses', de: 'Firmenkurse' },
      '#offer-company p': {
        en: 'Language training for teams, at your offices or ours. Built around your industry, your everyday work and the situations your people actually face.',
        de: 'Sprachtraining für Teams, bei euch im Büro oder bei uns. Abgestimmt auf eure Branche, euren Arbeitsalltag und die Situationen, die bei euch wirklich vorkommen.',
      },
      '#offer-lunch h3': { en: 'Build your own', de: 'Build your own' },
      '#offer-lunch p': {
        en: 'Lunchtime German, intensive German, Swiss German and German combined, business English. You name it, we got you. A course experience tailored exactly to your needs and availability — lessons that fit into your lunch break, your summer holiday, or whatever your schedule looks like.',
        de: 'Lunchtime German, Intensivdeutsch, Schweizerdeutsch und Deutsch kombiniert, Business-Englisch. Sag uns, was du brauchst — wir machen es möglich. Ein Kurserlebnis, das genau auf deine Bedürfnisse und deine Verfügbarkeit zugeschnitten ist — Unterricht, der in deine Mittagspause, deine Sommerferien oder deinen Zeitplan passt.',
      },
      '#offer .offer-card__cta': { en: 'learn more →', de: 'mehr erfahren →' },
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
        en: 'We offer schedules and programmes tailored to your individual needs, do not hesitate to contact us about your desired course today!',
        de: 'Wir bieten Stundenpläne und Programme, die auf deine individuellen Bedürfnisse zugeschnitten sind. Zögere nicht, uns noch heute für deinen Wunschkurs zu kontaktieren!',
      },
      '#levels .kicker': { en: 'your level', de: 'Dein Niveau' },
      '#levels .section-title': {
        en: 'Which level fits you?',
        de: 'Welches Niveau passt zu dir?',
      },
      '.levels-text': {
        en: 'Not sure where to start? The six CEFR levels, A1 to C2, describe what you can do in a language. Our interactive self-assessment helps you find your current level, the perfect starting point for choosing the right course.',
        de: 'Du weisst nicht, wo du starten sollst? Die sechs Niveaus des GER, A1 bis C2, beschreiben, was du in einer Sprache kannst. Unser interaktives Selbsteinschätzungsraster hilft dir, dein aktuelles Niveau zu finden, der perfekte Ausgangspunkt für den passenden Kurs.',
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
      '.about-text': {
        en: 'tbc',
        de: 'tbc',
      },
      '#start .section-title': { en: 'Ready to get started?', de: 'Bereit loszulegen?' },
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
      en: 'Book open spots in small group language courses in Zürich.',
      de: 'Freie Plätze in Kleingruppen-Sprachkursen in Zürich direkt anfragen.',
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
      '#error-state h1': { en: 'something went wrong.', de: 'Etwas ist schiefgelaufen.' },
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
      en: 'Privacy policy for Learning with Gioia / Birukoff World.',
      de: 'Datenschutzerklärung von Learning with Gioia / Birukoff World.',
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
    en: 'Terms and conditions of Learning with Gioia / Birukoff World.',
    de: 'Allgemeine Geschäftsbedingungen von Learning with Gioia / Birukoff World.',
  },
};

// ── Course detail pages ─────────────────────────────────────────
// They share the tailored-programme note and CTAs; heading, intro and
// meta always differ. Courses with a non-standard structure (exam
// preparation, lunch time German) pass `facts` to override individual
// fact rows.
export const courseFacts = {
  '.kicker': { en: 'courses & tutoring', de: 'Kurse & Nachhilfe' },
  '#fact-duration-label': { en: 'course duration', de: 'Kursdauer' },
  '#fact-duration-value': { en: '4 months', de: '4 Monate' },
  '#fact-lessons-label': { en: 'lessons of 60 min', de: 'Lektionen à 60 Min.' },
  '#fact-group-label': { en: 'group (3-5)', de: 'Gruppe (3-5)' },
  '#fact-group-unit': { en: 'per person', de: 'pro Person' },
  '#fact-solo-label': { en: 'private', de: 'Einzelunterricht' },
  '#fact-solo-unit': { en: 'total', de: 'gesamt' },
  '#course-tailored': {
    en: 'You prefer a different schedule or programme? We offer <a href="/lunch-time-german.html">fully tailored programmes</a>. Contact us today to find the best schedule for you.',
    de: 'Du wünschst dir einen anderen Zeitplan oder ein anderes Programm? Wir bieten <a href="/lunch-time-german.html">vollständig massgeschneiderte Programme</a>. Kontaktiere uns noch heute, damit wir den passenden Plan für dich finden.',
  },
  '#course-cta-enquiry': { en: 'make an enquiry', de: 'Anfrage senden' },
  '#course-cta-courses': { en: 'open group courses', de: 'Offene Gruppenkurse' },
};

function coursePage(entry) {
  return {
    title: entry.title,
    description: entry.description,
    text: Object.assign(
      { h1: entry.h1, '#course-intro': entry.intro },
      courseFacts,
      entry.facts || {}
    ),
  };
}

Object.assign(pages, {
  '/german-courses.html': coursePage({
    title: {
      en: 'German Courses in Zürich — Learning with Gioia',
      de: 'Deutschkurse in Zürich — Learning with Gioia',
    },
    description: {
      en: 'German courses in Zürich from A0 to C2, taught by native speakers. 32 lessons of 60 minutes over 4 months — CHF 1600 in a group, CHF 3840 one-to-one.',
      de: 'Deutschkurse in Zürich von A0 bis C2, unterrichtet von Muttersprachlerinnen und Muttersprachlern. 32 Lektionen à 60 Minuten in 4 Monaten — CHF 1600 in der Gruppe, CHF 3840 im Einzelunterricht.',
    },
    h1: { en: 'German courses', de: 'Deutschkurse' },
    intro: {
      en: 'German for everyday life, work and study, from complete beginner (A0) to advanced (C2). Taught exclusively by native speakers with linguistics degrees and formal teaching qualifications.',
      de: 'Deutsch für Alltag, Beruf und Studium, von A0 bis C2. Unterrichtet ausschliesslich von Muttersprachlerinnen und Muttersprachlern mit sprachwissenschaftlichem Studium und formaler Lehrqualifikation.',
    },
  }),
  '/swiss-german.html': coursePage({
    title: {
      en: 'Swiss German Courses in Zürich — Learning with Gioia',
      de: 'Schweizerdeutschkurse in Zürich — Learning with Gioia',
    },
    description: {
      en: 'Swiss German courses in Zürich taught by native speakers. 32 lessons of 60 minutes over 4 months — CHF 1600 in a group, CHF 3840 one-to-one.',
      de: 'Schweizerdeutschkurse in Zürich, unterrichtet von Muttersprachlerinnen und Muttersprachlern. 32 Lektionen à 60 Minuten in 4 Monaten — CHF 1600 in der Gruppe, CHF 3840 im Einzelunterricht.',
    },
    h1: { en: 'Swiss German', de: 'Schweizerdeutsch' },
    intro: {
      en: 'Our Swiss German courses taught by native speakers will help you follow conversations, join in… and finally feel at home in Swiss everyday life!',
      de: 'Unsere Schweizerdeutschkurse, unterrichtet von Muttersprachlerinnen und Muttersprachlern, helfen dir, Gesprächen zu folgen, mitzureden … und dich im Schweizer Alltag endlich zuhause zu fühlen!',
    },
  }),
  '/gymivorbereitung.html': coursePage({
    title: {
      en: 'Gymivorbereitung in Zürich — Learning with Gioia',
      de: 'Gymivorbereitung in Zürich — Learning with Gioia',
    },
    description: {
      en: 'Gymivorbereitung in Zürich, in small groups or one-to-one. 12 lessons of 90 minutes over 3 months — CHF 80 per person per 60 minutes in a group, CHF 120 one-to-one.',
      de: 'Gymivorbereitung in Zürich, in kleinen Gruppen oder im Einzelunterricht. 12 Lektionen à 90 Minuten in 3 Monaten — CHF 80 pro Person pro 60 Minuten in der Gruppe, CHF 120 im Einzelunterricht.',
    },
    h1: { en: 'Gymivorbereitung', de: 'Gymivorbereitung' },
    intro: {
      en: 'The road to Gymnasium starts long before exam day. We prepare pupils step by step: closing gaps, practising with the exam format, and building the calm confidence it takes to perform on the day. In small groups or one-to-one, always tailored to your child.',
      de: 'Der Weg ans Gymnasium beginnt lange vor dem Prüfungstag. Wir bereiten Schülerinnen und Schüler Schritt für Schritt vor: Lücken schliessen, mit dem Prüfungsformat üben und die nötige Ruhe und Sicherheit aufbauen. In kleinen Gruppen oder im Einzelunterricht, immer abgestimmt auf dein Kind.',
    },
    facts: {
      '#fact-duration-value': { en: '3 months', de: '3 Monate' },
      '#fact-lessons-label': { en: 'lessons of 90 min', de: 'Lektionen à 90 Min.' },
      '#fact-group-label': { en: 'group (3-7)', de: 'Gruppe (3-7)' },
      '#fact-group-unit': { en: 'per 60 min, per person', de: 'pro 60 Min., pro Person' },
      '#fact-solo-unit': { en: 'per 60 min', de: 'pro 60 Min.' },
    },
  }),
  '/english-courses.html': coursePage({
    title: {
      en: 'English Courses in Zürich — Learning with Gioia',
      de: 'Englischkurse in Zürich — Learning with Gioia',
    },
    description: {
      en: 'English courses and tutoring in Zürich, from beginner (A1) to advanced (C2). 32 lessons of 60 minutes over 4 months — CHF 1600 in a group, CHF 3840 one-to-one.',
      de: 'Englischkurse und Nachhilfe in Zürich, von A1 bis C2. 32 Lektionen à 60 Minuten in 4 Monaten — CHF 1600 in der Gruppe, CHF 3840 im Einzelunterricht.',
    },
    h1: { en: 'English courses', de: 'Englischkurse' },
    intro: {
      en: 'English for school, work and everyday life, from beginner (A1) to advanced (C2). Tutoring from primary school to university, always tailored to what you need next.',
      de: 'Englisch für Schule, Beruf und Alltag, von A1 bis C2. Nachhilfe von der Primarschule bis zur Universität, immer abgestimmt auf das, was als Nächstes ansteht.',
    },
  }),
  '/exam-preparation.html': coursePage({
    title: {
      en: 'Exam Preparation in Zürich — Learning with Gioia',
      de: 'Prüfungsvorbereitung in Zürich — Learning with Gioia',
    },
    description: {
      en: 'Preparation for Cambridge, TOEFL, IELTS, TELC and Goethe exams in Zürich. 40 lessons of 60 minutes over 5 months — CHF 2000 in a group, CHF 4800 one-to-one.',
      de: 'Vorbereitung auf Cambridge, TOEFL, IELTS, TELC und Goethe in Zürich. 40 Lektionen à 60 Minuten in 5 Monaten — CHF 2000 in der Gruppe, CHF 4800 im Einzelunterricht.',
    },
    h1: { en: 'Exam preparation', de: 'Prüfungsvorbereitung' },
    intro: {
      en: 'Targeted preparation for Cambridge, TOEFL, IELTS, TELC and Goethe exams. We practise with the real exam formats, so you walk in knowing exactly what to expect.',
      de: 'Gezielte Vorbereitung auf Cambridge, TOEFL, IELTS, TELC und Goethe. Wir üben mit den echten Prüfungsformaten, damit du genau weisst, was dich erwartet.',
    },
    facts: { '#fact-duration-value': { en: '5 months', de: '5 Monate' } },
  }),
  '/company-courses.html': coursePage({
    title: {
      en: 'Company Language Courses in Zürich — Learning with Gioia',
      de: 'Firmenkurse in Zürich — Learning with Gioia',
    },
    description: {
      en: 'Language courses for companies and teams in Zürich, at your offices or ours. Around 100 lessons per level, suggested 2 × 60 minutes per week — pricing on request.',
      de: 'Sprachkurse für Firmen und Teams in Zürich, bei euch im Büro oder bei uns. Rund 100 Lektionen pro Niveau, empfohlen 2 × 60 Minuten pro Woche — Preis auf Anfrage.',
    },
    h1: { en: 'Company courses', de: 'Firmenkurse' },
    intro: {
      en: 'Language training for teams, at your offices or ours. We build the programme around your industry, your everyday work and the situations your people actually face — from client meetings to small talk in the corridor.',
      de: 'Sprachtraining für Teams, bei euch im Büro oder bei uns. Wir bauen das Programm rund um eure Branche, euren Arbeitsalltag und die Situationen auf, die bei euch wirklich vorkommen — vom Kundengespräch bis zum Small Talk auf dem Gang.',
    },
    facts: {
      '#fact-lessons-label': { en: 'suggested lessons', de: 'Empfohlene Lektionen' },
      '#fact-lessons-value': { en: 'approx. 100', de: 'ca. 100' },
      '#fact-lessons-unit': { en: 'per level', de: 'pro Niveau' },
      '#fact-frequency-label': { en: 'suggested frequency', de: 'Empfohlener Rhythmus' },
      '#fact-frequency-value': { en: '2 × 60 min', de: '2 × 60 Min.' },
      '#fact-frequency-unit': { en: 'per week', de: 'pro Woche' },
      '#fact-price-label': { en: 'pricing', de: 'Preis' },
      '#fact-price-value': { en: 'on request', de: 'auf Anfrage' },
      '#course-structure-note': {
        en: 'Not sure how many lessons your team needs? Our <a href="/index.html#offer-details">guidance on course structure</a> shows how a full level breaks down.',
        de: 'Unsicher, wie viele Lektionen euer Team braucht? Unsere <a href="/index.html#offer-details">Hinweise zur Kursstruktur</a> zeigen, wie sich ein vollständiges Niveau aufteilt.',
      },
    },
  }),
  '/lunch-time-german.html': coursePage({
    title: {
      en: 'Build Your Own German Course in Zürich — Learning with Gioia',
      de: 'Build Your Own: Deutschkurs nach Mass in Zürich — Learning with Gioia',
    },
    description: {
      en: 'Build your own German course in Zürich: lunchtime German, intensive German, Swiss German and German combined, business English — tailored to your needs and availability. Lessons of 60, 90 or 120 minutes — CHF 50 per 60 minutes in a group, CHF 120 one-to-one.',
      de: 'Dein Kurs nach Mass in Zürich: Lunchtime German, Intensivdeutsch, Schweizerdeutsch und Deutsch kombiniert, Business-Englisch — abgestimmt auf deine Bedürfnisse und deine Verfügbarkeit. Lektionen à 60, 90 oder 120 Minuten — CHF 50 pro 60 Minuten in der Gruppe, CHF 120 im Einzelunterricht.',
    },
    h1: { en: 'Build your own', de: 'Build your own' },
    intro: {
      en: 'Lunchtime German, intensive German, Swiss German and German combined, business English. You name it, we got you. A course experience tailored exactly to your needs and availability — lessons that fit into your lunch break, your summer holiday, or whatever your schedule looks like.',
      de: 'Lunchtime German, Intensivdeutsch, Schweizerdeutsch und Deutsch kombiniert, Business-Englisch. Sag uns, was du brauchst — wir machen es möglich. Ein Kurserlebnis, das genau auf deine Bedürfnisse und deine Verfügbarkeit zugeschnitten ist — Unterricht, der in deine Mittagspause, deine Sommerferien oder deinen Zeitplan passt.',
    },
    facts: {
      '#fact-duration-value': { en: 'flexible', de: 'flexibel' },
      '#fact-lessons-label': { en: 'lesson length', de: 'Lektionsdauer' },
      '#fact-lessons-value': { en: '60, 90, 120 min', de: '60, 90, 120 Min.' },
      '#fact-lessons-unit': { en: 'or as you need it', de: 'oder wie du es brauchst' },
      '#fact-group-unit': { en: 'per 60 min, per person', de: 'pro 60 Min., pro Person' },
      '#fact-solo-unit': { en: 'per 60 min', de: 'pro 60 Min.' },
    },
  }),
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
      '#intake-thanks h1': { en: 'thank you.', de: 'Danke.' },
      '#intake-thanks p': {
        en: "Your details have been saved. We'll be in touch shortly.",
        de: 'Deine Angaben wurden gespeichert. Wir melden uns bald.',
      },
      '#intake-error h1': {
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
      '#feedback-thanks h1': { en: 'thank you.', de: 'Danke.' },
      '#feedback-thanks p': {
        en: 'Your honest feedback helps us improve our lessons for everyone. We read every response carefully and genuinely appreciate both the compliments and the suggestions.',
        de: 'Dein ehrliches Feedback hilft uns, den Unterricht für alle besser zu machen. Wir lesen jede Antwort aufmerksam und freuen uns über Lob genauso wie über Verbesserungsvorschläge.',
      },
      '#feedback-done h1': { en: 'already answered.', de: 'Bereits beantwortet.' },
      '#feedback-done p': {
        en: 'This feedback has already been submitted — thank you. If you would like to add something, just email <a href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
        de: 'Dieses Feedback wurde bereits abgeschickt — danke. Wenn du noch etwas ergänzen möchtest, schreib einfach an <a href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
      },
      '#feedback-unavailable h1': {
        en: 'not right now.',
        de: 'Gerade nicht möglich.',
      },
      '#feedback-unavailable p': {
        en: 'We could not load your feedback form just now — your link is still fine. Please try again in a few minutes, or email <a href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
        de: 'Wir konnten dein Feedback-Formular gerade nicht laden — dein Link ist weiterhin gültig. Bitte versuche es in ein paar Minuten noch einmal oder schreibe an <a href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
      },
      '#feedback-error h1': {
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
