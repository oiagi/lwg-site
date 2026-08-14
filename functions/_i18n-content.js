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
  '/online-lessons.html': { en: 'online-lessons', de: 'online-unterricht' },
  '/private-lessons.html': { en: 'private-lessons', de: 'einzelunterricht' },
  '/about.html': { en: 'about', de: 'ueber-uns' },
  '/faq.html': { en: 'faq', de: 'faq' },
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
  onlineLessons: { en: 'Online lessons', de: 'Online-Unterricht' },
  privateLessons: { en: 'Private lessons', de: 'Einzelunterricht' },
  faq: { en: 'FAQ', de: 'Häufige Fragen' },
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
      '#offer-online h3': { en: 'Online lessons', de: 'Online-Unterricht' },
      '#offer-online p': {
        en: 'German and Swiss German by video, taught live by a native speaker. The same courses we teach in Zürich, at the same price, wherever you are.',
        de: 'Deutsch und Schweizerdeutsch per Video, live unterrichtet von einer Muttersprachlerin. Dieselben Kurse wie in Zürich, zum selben Preis, egal wo du bist.',
      },
      '#offer-private h3': { en: 'Private lessons', de: 'Einzelunterricht' },
      '#offer-private p': {
        en: 'One teacher, one learner, and a course built from nothing but what you need — for a fixed exam date, a professional vocabulary, or a schedule that will not hold a weekly slot.',
        de: 'Eine Lehrperson, eine lernende Person und ein Kurs, der nur aus dem besteht, was du brauchst — für einen fixen Prüfungstermin, einen Fachwortschatz oder einen Terminplan, der keinen Wochentermin hergibt.',
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
      '#about-lead': {
        en: 'Learning with Gioia was founded by Gioia, born and raised in Zürich and a native speaker of both Swiss German and German. That is why Swiss German is on this list at all: it has no standard written form and cannot be learnt from a textbook, so it has to come from someone who grew up speaking it.',
        de: 'Learning with Gioia wurde von Gioia gegründet — in Zürich geboren und aufgewachsen, Muttersprachlerin für Schweizerdeutsch und Deutsch. Genau deshalb steht Schweizerdeutsch überhaupt auf dieser Liste: Es hat keine einheitliche Schriftform und lässt sich nicht aus einem Lehrbuch lernen, sondern nur von jemandem, der damit aufgewachsen ist.',
      },
      '#about-more': {
        en: 'Alongside her, a small circle of associate teachers with linguistics degrees and formal teaching qualifications covers the remaining courses and tutoring, and German is taught exclusively by native speakers. Groups stay small — a maximum of five — because a course prepared for the people in the room only works if you know who they are. <a href="/about.html">More about us and how we teach →</a>',
        de: 'Daneben deckt ein kleiner Kreis von Lehrpersonen mit sprachwissenschaftlichem Studium und formaler Lehrqualifikation die übrigen Kurse und die Nachhilfe ab; Deutsch wird ausschliesslich von Muttersprachlerinnen und Muttersprachlern unterrichtet. Die Gruppen bleiben klein — höchstens fünf Personen — weil ein Kurs, der für die Menschen im Raum vorbereitet wird, nur funktioniert, wenn man weiss, wer sie sind. <a href="/about.html">Mehr über uns und unseren Unterricht →</a>',
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

// ── FAQ ──────────────────────────────────────────────────────────
//
// One source for both the rendered Q&A blocks and the FAQPage schema, so the
// two can never disagree — Google treats marked-up answers that are not on the
// page as a violation, and an assistant quoting a stale answer is worse still.
//
// Every answer here is taken from something the site already commits to: the
// AGB (cancellation ladder, minimum group size), the course pages (prices,
// lesson counts) or the homepage course-structure section (hours per level).
export const FAQ = {
  courses: [
    {
      q: {
        en: 'Which languages do you teach?',
        de: 'Welche Sprachen unterrichtet ihr?',
      },
      a: {
        en: 'German, Swiss German and English, from complete beginner (A0) to advanced (C2). We also offer tutoring in school subjects and preparation for the Gymiprüfung.',
        de: 'Deutsch, Schweizerdeutsch und Englisch, von A0 bis C2. Dazu kommen Nachhilfe in Schulfächern und die Vorbereitung auf die Gymiprüfung.',
      },
    },
    {
      q: {
        en: 'How long does it take to complete a level?',
        de: 'Wie lange dauert ein Sprachniveau?',
      },
      a: {
        en: 'Moving through a full level, for example from A0 to A1, usually takes around 100 to 150 hours of guided learning, plus a similar amount of independent study. Our regular group courses split each level into three blocks of 32 hours.',
        de: 'Ein vollständiges Niveau, zum Beispiel von A0 zu A1, braucht in der Regel etwa 100 bis 150 Stunden angeleitetes Lernen plus eine ähnliche Menge selbstständiges Lernen. Unsere regulären Gruppenkurse teilen jedes Niveau in drei Blöcke à 32 Stunden.',
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
        en: 'Open group courses take a maximum of five people, and run from three. Gymivorbereitung groups run from three to seven. If you want a group of exactly your colleagues or friends, we can set that up as a private group.',
        de: 'Offene Gruppenkurse haben maximal fünf Teilnehmende und finden ab drei statt. Gymivorbereitungsgruppen laufen mit drei bis sieben. Wenn ihr als Gruppe von Kolleginnen, Kollegen oder Freundinnen und Freunden lernen möchtet, richten wir das als geschlossene Gruppe ein.',
      },
    },
    {
      q: {
        en: 'What happens if fewer than three people sign up?',
        de: 'Was passiert, wenn sich weniger als drei Personen anmelden?',
      },
      a: {
        en: 'A group course runs from three participants. If fewer sign up, we either merge the course, postpone it, or — if you agree — run it with fewer lessons, scaled to the monetary value of a three-person course. If the school cancels a course, the full amount is refunded.',
        de: 'Ein Gruppenkurs findet ab drei Teilnehmenden statt. Bei weniger Anmeldungen legen wir Kurse zusammen, verschieben sie oder führen sie — mit deinem Einverständnis — mit weniger Lektionen durch, entsprechend dem Gegenwert eines Kurses mit drei Personen. Sagt die Schule einen Kurs ab, wird der volle Betrag rückerstattet.',
      },
    },
    {
      q: {
        en: 'Which exams do you prepare for?',
        de: 'Auf welche Prüfungen bereitet ihr vor?',
      },
      a: {
        en: 'Cambridge, TOEFL, IELTS, TELC and Goethe. We practise with the real exam formats, so nothing on the day is a surprise.',
        de: 'Cambridge, TOEFL, IELTS, TELC und Goethe. Wir üben mit den echten Prüfungsformaten, damit am Prüfungstag nichts überraschend kommt.',
      },
    },
  ],

  online: [
    {
      q: {
        en: 'Can I learn Swiss German online?',
        de: 'Kann ich Schweizerdeutsch online lernen?',
      },
      a: {
        en: 'Yes. Swiss German is mainly a spoken language, which makes it a particularly good fit for one-to-one video lessons: almost all of the time is spent talking. Lessons are taught by a native Swiss German speaker.',
        de: 'Ja. Schweizerdeutsch ist vor allem eine gesprochene Sprache und eignet sich deshalb besonders gut für Einzelunterricht per Video: Fast die ganze Zeit wird gesprochen. Unterrichtet wird von einer Muttersprachlerin.',
      },
    },
    {
      q: {
        en: 'Are online lessons the same price as in-person lessons?',
        de: 'Kosten Online-Lektionen gleich viel wie Unterricht vor Ort?',
      },
      a: {
        en: 'Yes. The same rates apply whether you learn online, in a classroom, or at your company — CHF 1600 per person for a 32-lesson group course, CHF 3840 one-to-one.',
        de: 'Ja. Es gelten dieselben Preise, ob online, im Kursraum oder bei euch in der Firma — CHF 1600 pro Person für einen Kurs mit 32 Lektionen, CHF 3840 im Einzelunterricht.',
      },
    },
    {
      q: {
        en: 'I am not in Switzerland. Can I still take lessons?',
        de: 'Ich bin nicht in der Schweiz. Kann ich trotzdem Unterricht nehmen?',
      },
      a: {
        en: 'Yes. Online lessons are not bound to the canton. Lesson times are arranged in Zürich time, and we can usually find a slot that works across European time zones; for anything further afield, tell us your window and we will see what fits.',
        de: 'Ja. Online-Unterricht ist nicht an den Kanton gebunden. Die Zeiten richten sich nach Zürcher Zeit, und innerhalb Europas findet sich fast immer ein passender Termin. Bei grösseren Zeitverschiebungen sag uns dein Zeitfenster, dann schauen wir, was möglich ist.',
      },
    },
    {
      q: {
        en: 'What do I need for an online lesson?',
        de: 'Was brauche ich für eine Online-Lektion?',
      },
      a: {
        en: 'A stable internet connection, a device with a camera and microphone, and somewhere you can speak out loud. Materials are shared digitally before and after each lesson.',
        de: 'Eine stabile Internetverbindung, ein Gerät mit Kamera und Mikrofon und einen Ort, an dem du laut sprechen kannst. Die Materialien erhältst du digital vor und nach jeder Lektion.',
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
        en: 'The earlier the better — the road to Gymnasium starts long before exam day. Our Gymivorbereitung runs as 12 lessons of 90 minutes over three months, and many families take more than one block. Tell us your child’s school year and target exam date and we will suggest a timeline.',
        de: 'Je früher, desto besser — der Weg ans Gymnasium beginnt lange vor dem Prüfungstag. Unsere Gymivorbereitung umfasst 12 Lektionen à 90 Minuten über drei Monate, und viele Familien buchen mehr als einen Block. Sag uns das Schuljahr deines Kindes und den Prüfungstermin, dann schlagen wir einen Zeitplan vor.',
      },
    },
    {
      q: {
        en: 'Group or one-to-one for Gymivorbereitung?',
        de: 'Gruppe oder Einzelunterricht für die Gymivorbereitung?',
      },
      a: {
        en: 'Groups of three to seven cost CHF 80 per person per 60 minutes and work well when a child is broadly on track and needs exam practice. One-to-one is CHF 120 per 60 minutes and is the better choice when there are specific gaps to close, or when exam nerves are the main obstacle.',
        de: 'Gruppen mit drei bis sieben Kindern kosten CHF 80 pro Person pro 60 Minuten und eignen sich gut, wenn ein Kind grundsätzlich auf Kurs ist und Prüfungstraining braucht. Einzelunterricht kostet CHF 120 pro 60 Minuten und ist die bessere Wahl, wenn gezielt Lücken zu schliessen sind oder die Prüfungsangst im Vordergrund steht.',
      },
    },
    {
      q: {
        en: 'What does a Gymivorbereitung lesson cover?',
        de: 'Was wird in der Gymivorbereitung geübt?',
      },
      a: {
        en: 'Closing gaps in the underlying material, practising with the exam format itself, and building the calm needed to perform under time pressure. The balance between those three is set per child, not per group.',
        de: 'Lücken im Stoff schliessen, mit dem Prüfungsformat selbst üben und die Ruhe aufbauen, die es unter Zeitdruck braucht. Die Gewichtung dieser drei Teile richtet sich nach dem einzelnen Kind, nicht nach der Gruppe.',
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
        en: 'That is the point of an in-house course. We build the programme around your industry, your everyday work and the situations your people actually face — client meetings, phone calls, written correspondence, small talk in the corridor.',
        de: 'Genau dafür ist ein Inhouse-Kurs da. Wir bauen das Programm um eure Branche, euren Arbeitsalltag und die Situationen, die bei euch wirklich vorkommen — Kundengespräche, Telefonate, Korrespondenz, Small Talk im Gang.',
      },
    },
    {
      q: {
        en: 'Can you teach Swiss German to relocating employees?',
        de: 'Unterrichtet ihr Schweizerdeutsch für zuziehende Mitarbeitende?',
      },
      a: {
        en: 'Yes, and it is one of the things we are asked for most. Standard German gets a new arrival through the working day; Swiss German is what makes the lunch table, the corridor and the team apéro stop being a wall. It is taught by a native Swiss German speaker born and raised in Zürich.',
        de: 'Ja, und das ist eine der häufigsten Anfragen. Mit Hochdeutsch kommt man durch den Arbeitstag; Schweizerdeutsch sorgt dafür, dass Mittagstisch, Gang und Team-Apéro keine Mauer mehr sind. Unterrichtet wird von einer in Zürich geborenen und aufgewachsenen Muttersprachlerin.',
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

  booking: [
    {
      q: {
        en: 'How do I book a course?',
        de: 'Wie buche ich einen Kurs?',
      },
      a: {
        en: 'Open group courses can be booked directly from the group courses page — places are handled first come, first served. For anything tailored, send an enquiry or book a free 15-minute call and we will put together a proposal.',
        de: 'Offene Gruppenkurse kannst du direkt auf der Seite Gruppenkurse buchen — die Plätze werden nach Eingang vergeben. Für alles Massgeschneiderte sende uns eine Anfrage oder buche ein kostenloses 15-Minuten-Gespräch, dann erstellen wir dir einen Vorschlag.',
      },
    },
    {
      q: {
        en: 'What are your cancellation terms?',
        de: 'Wie sind die Stornobedingungen?',
      },
      a: {
        en: 'Cancellations must be in writing. Up to 30 days before the course starts it is free; 29 to 15 days before, 50% of the fee; 14 to 7 days before, 75%; from 6 days before, or if you do not attend, the full fee. After the course has started, withdrawal is no longer possible. With a medical certificate we can issue a credit towards a later course.',
        de: 'Abmeldungen müssen schriftlich erfolgen. Bis 30 Tage vor Kursbeginn ist die Stornierung kostenlos, 29 bis 15 Tage vorher kostet sie 50 % der Kursgebühr, 14 bis 7 Tage vorher 75 %, ab 6 Tagen vorher oder bei Nichterscheinen 100 %. Nach Kursbeginn ist ein Rücktritt nicht mehr möglich. Gegen Arztzeugnis kann eine Gutschrift für einen späteren Kurs gewährt werden.',
      },
    },
    {
      q: {
        en: 'What if I miss a lesson?',
        de: 'Was, wenn ich eine Lektion verpasse?',
      },
      a: {
        en: 'Lessons that are not attended are not refunded and cannot be carried over to another course. In a one-to-one course we can usually move a lesson if you tell us in good time.',
        de: 'Nicht besuchte Lektionen werden nicht rückerstattet und nicht auf einen anderen Kurs angerechnet. Im Einzelunterricht können wir eine Lektion in der Regel verschieben, wenn du dich rechtzeitig meldest.',
      },
    },
    {
      q: {
        en: 'Is there a free trial or a first conversation?',
        de: 'Gibt es ein kostenloses Kennenlernen?',
      },
      a: {
        en: 'Yes — a free 15-minute call, bookable from the homepage. It is the fastest way to work out your level, what you actually need, and whether a group or one-to-one course fits.',
        de: 'Ja — ein kostenloses 15-Minuten-Gespräch, buchbar auf der Startseite. Das ist der schnellste Weg, um dein Niveau zu klären, herauszufinden, was du wirklich brauchst, und ob ein Gruppen- oder Einzelkurs passt.',
      },
    },
  ],
};

// Renders a group of Q&As. Used for the FAQ page and for the inline FAQ blocks
// on the service pages.
export function faqHtml(items, lang) {
  return items
    .map((item) => `<div class="faq-item"><h3>${item.q[lang]}</h3><p>${item.a[lang]}</p></div>`)
    .join('');
}

// Cross-link card, so the internal link graph has edges between the leaves and
// not just spokes to the homepage.
function linkCard(href, title, blurb) {
  return `<a class="content-link" href="${href}"><strong>${title}</strong><span>${blurb}</span></a>`;
}

// The section block shared by the five standard course pages. Only the
// "what a lesson looks like" copy and the cross-links differ per course; the
// online paragraph and the FAQ group are the same everywhere, and repeating
// them by hand is how they drift apart.
function courseSections({ lessonTitle, lessonBody, lessonList, online, links }) {
  return {
    '#course-lesson-title': lessonTitle || {
      en: 'What a lesson looks like',
      de: 'Wie eine Lektion abläuft',
    },
    '#course-lesson-body': lessonBody,
    '#course-lesson-list': lessonList,
    '#course-online-title': { en: 'Also available online', de: 'Auch online verfügbar' },
    '#course-online-body': online || {
      en: 'Every course on this page can be taught online by live video, at the same price and with the same teachers. Lessons run at a fixed weekly slot in Zürich time, and materials are shared digitally before and after each one. Some people take the whole course online; others switch for a week when they are travelling. See <a href="/online-lessons.html">online lessons</a> for how it works.',
      de: 'Jeder Kurs auf dieser Seite kann auch online per Live-Video stattfinden, zum selben Preis und mit denselben Lehrpersonen. Der Unterricht läuft zu einem festen wöchentlichen Termin nach Zürcher Zeit, die Materialien kommen digital vor und nach jeder Lektion. Manche belegen den ganzen Kurs online, andere wechseln nur für eine Reisewoche. Wie das abläuft, steht unter <a href="/online-lessons.html">Online-Unterricht</a>.',
    },
    '#course-faq-title': { en: 'Common questions', de: 'Häufige Fragen' },
    '#course-faq-list': { en: faqHtml(FAQ.courses, 'en'), de: faqHtml(FAQ.courses, 'de') },
    '#course-links-title': { en: 'Related', de: 'Passend dazu' },
    '#course-links': links,
  };
}

const GERMAN_SECTIONS = courseSections({
  lessonBody: {
    en: 'Sixty minutes, taught in German from the first lesson — including at A0, where it feels impossible for about two weeks and then stops feeling that way. The point is that you spend the hour using the language rather than being told about it.',
    de: 'Sechzig Minuten, ab der ersten Lektion auf Deutsch — auch auf A0, wo sich das etwa zwei Wochen lang unmöglich anfühlt und dann nicht mehr. Der Sinn dahinter: Du verbringst die Stunde damit, die Sprache zu benutzen, statt über sie belehrt zu werden.',
  },
  lessonList: {
    en: '<li>A short warm-up in the language, so the switch happens before the lesson proper starts.</li><li>One new structure at a time, introduced through examples rather than a rule to memorise.</li><li>Speaking practice in pairs or as a group — the reason the groups stay under five.</li><li>Material drawn from where you actually need the German: your work, your studies, your paperwork, your neighbours.</li><li>Homework that takes twenty minutes, not two hours, because the ones that take two hours do not get done.</li>',
    de: '<li>Ein kurzer Einstieg in der Sprache, damit der Wechsel passiert, bevor die eigentliche Lektion beginnt.</li><li>Eine neue Struktur nach der anderen, eingeführt über Beispiele statt über eine Regel zum Auswendiglernen.</li><li>Sprechübungen zu zweit oder in der Gruppe — der Grund, weshalb die Gruppen unter fünf Personen bleiben.</li><li>Material von dort, wo du das Deutsch wirklich brauchst: Beruf, Studium, Behördenpost, Nachbarschaft.</li><li>Hausaufgaben, die zwanzig Minuten dauern und nicht zwei Stunden — denn die mit zwei Stunden werden nicht gemacht.</li>',
  },
  links: {
    en:
      linkCard(
        '/swiss-german.html',
        'Swiss German',
        'The other half of actually living in Zürich.'
      ) +
      linkCard(
        '/private-lessons.html',
        'Private lessons',
        'One-to-one, at your pace and on your schedule.'
      ) +
      linkCard('/niveaus.html', 'Find your level', 'An interactive CEFR self-assessment.'),
    de:
      linkCard(
        '/swiss-german.html',
        'Schweizerdeutsch',
        'Die andere Hälfte davon, wirklich in Zürich zu leben.'
      ) +
      linkCard(
        '/private-lessons.html',
        'Einzelunterricht',
        'Eins zu eins, in deinem Tempo und nach deinem Plan.'
      ) +
      linkCard('/niveaus.html', 'Niveau herausfinden', 'Interaktive Selbsteinschätzung nach GER.'),
  },
});

const SWISS_SECTIONS = courseSections({
  lessonBody: {
    en: 'Almost entirely spoken. Swiss German has no standard written form, so there is no textbook to work through and no spelling to get right — which means the hour goes on listening and talking, with a teacher who grew up speaking Zürich German.',
    de: 'Fast durchgehend gesprochen. Schweizerdeutsch hat keine einheitliche Schriftform, es gibt also kein Lehrbuch zum Durcharbeiten und keine Rechtschreibung, die man treffen muss — die Stunde geht deshalb ins Zuhören und Sprechen, mit einer Lehrperson, die mit Zürichdeutsch aufgewachsen ist.',
  },
  lessonList: {
    en: '<li>Listening first: real speech at real speed, slowed down only where it breaks.</li><li>The sound changes that turn a German word you already know into a Swiss German one you do not.</li><li>The vocabulary that has no standard-German equivalent, and the false friends that do.</li><li>Situations you are actually in — the lunch table, the tram, the Apéro, the small talk before a meeting starts.</li><li>Dialect differences, so you can follow a colleague from Bern or Basel and not only one from Zürich.</li>',
    de: '<li>Zuerst Hören: echte Sprache in echtem Tempo, nur dort verlangsamt, wo es kippt.</li><li>Die Lautverschiebungen, die aus einem deutschen Wort, das du kennst, ein schweizerdeutsches machen, das du nicht kennst.</li><li>Der Wortschatz, für den es kein hochdeutsches Gegenstück gibt — und die falschen Freunde, für die es eines gibt.</li><li>Situationen, in denen du wirklich bist: Mittagstisch, Tram, Apéro, Small Talk vor einer Sitzung.</li><li>Dialektunterschiede, damit du auch einer Kollegin aus Bern oder Basel folgen kannst und nicht nur einer aus Zürich.</li>',
  },
  links: {
    en:
      linkCard(
        '/online-lessons.html',
        'Swiss German online',
        'A spoken language suits a video lesson particularly well.'
      ) +
      linkCard(
        '/company-courses.html',
        'Company courses',
        'Swiss German for relocating and international teams.'
      ) +
      linkCard('/about.html', 'About us', 'Why the Swiss German here is native, not learnt.'),
    de:
      linkCard(
        '/online-lessons.html',
        'Schweizerdeutsch online',
        'Eine gesprochene Sprache eignet sich besonders gut für Video.'
      ) +
      linkCard(
        '/company-courses.html',
        'Firmenkurse',
        'Schweizerdeutsch für zuziehende und internationale Teams.'
      ) +
      linkCard('/about.html', 'Über uns', 'Warum das Schweizerdeutsch hier muttersprachlich ist.'),
  },
});

const ENGLISH_SECTIONS = courseSections({
  lessonBody: {
    en: 'Sixty minutes built around what you need English for, which is rarely the same thing twice. A pupil catching up on school grammar and an adult preparing to present to a client need different hours, and get them.',
    de: 'Sechzig Minuten rund um das, wofür du Englisch brauchst — und das ist selten zweimal dasselbe. Ein Kind, das Schulstoff aufholt, und eine erwachsene Person, die eine Kundenpräsentation vorbereitet, brauchen unterschiedliche Stunden und bekommen sie auch.',
  },
  lessonList: {
    en: '<li>For school and tutoring: the current topic from class, retaught where it did not land, then practised until it holds.</li><li>For work: the meetings, emails and calls you actually have, in the vocabulary of your field.</li><li>For everyday life: speaking practice with the fluency and confidence that written exercises never build.</li><li>Correction that is specific — which mistakes matter, and which ones native speakers make too.</li>',
    de: '<li>Für Schule und Nachhilfe: das aktuelle Thema aus dem Unterricht, neu erklärt, wo es nicht angekommen ist, und geübt, bis es sitzt.</li><li>Für den Beruf: die Sitzungen, E-Mails und Telefonate, die du wirklich hast, im Fachwortschatz deines Gebiets.</li><li>Für den Alltag: Sprechübungen mit der Sicherheit, die schriftliche Übungen nie aufbauen.</li><li>Konkrete Korrektur — welche Fehler zählen und welche auch Muttersprachlerinnen und Muttersprachler machen.</li>',
  },
  links: {
    en:
      linkCard(
        '/exam-preparation.html',
        'Exam preparation',
        'Cambridge, TOEFL and IELTS with the real formats.'
      ) +
      linkCard(
        '/private-lessons.html',
        'Private lessons',
        'One-to-one tutoring, school to university.'
      ) +
      linkCard('/faq.html', 'FAQ', 'Levels, group sizes, prices, cancellation.'),
    de:
      linkCard(
        '/exam-preparation.html',
        'Prüfungsvorbereitung',
        'Cambridge, TOEFL und IELTS mit den echten Formaten.'
      ) +
      linkCard(
        '/private-lessons.html',
        'Einzelunterricht',
        'Nachhilfe eins zu eins, von der Schule bis zur Uni.'
      ) +
      linkCard('/faq.html', 'Häufige Fragen', 'Niveaus, Gruppengrössen, Preise, Stornierung.'),
  },
});

const EXAM_SECTIONS = courseSections({
  lessonBody: {
    en: 'Exam preparation is a different job from a language course: the target is not fluency in general but a specific mark on a specific paper on a specific date. The course is built backwards from that date.',
    de: 'Prüfungsvorbereitung ist etwas anderes als ein Sprachkurs: Das Ziel ist nicht Sprachkompetenz im Allgemeinen, sondern ein bestimmtes Resultat in einer bestimmten Prüfung an einem bestimmten Datum. Der Kurs wird von diesem Datum her rückwärts geplant.',
  },
  lessonList: {
    en: '<li>A diagnostic first: which of the four papers is actually costing you marks, because it is usually not the one you expect.</li><li>Work in the real exam format from early on — Cambridge, TOEFL, IELTS, TELC or Goethe, whichever you are sitting.</li><li>Timed practice, then going through what went wrong and why, which is where the marks come from.</li><li>The written and spoken tasks marked against the actual assessment criteria, not general impressions.</li><li>Exam-day technique: time budgeting, what to do when a question will not come, and how to leave marks on the table deliberately rather than by accident.</li>',
    de: '<li>Zuerst eine Standortbestimmung: Welcher der vier Prüfungsteile kostet dich wirklich Punkte — meist nicht der, den man erwartet.</li><li>Von Anfang an Arbeit im echten Prüfungsformat: Cambridge, TOEFL, IELTS, TELC oder Goethe, je nachdem, was ansteht.</li><li>Übungen unter Zeitvorgabe und danach die Besprechung, was schiefging und warum — genau da entstehen die Punkte.</li><li>Schriftliche und mündliche Aufgaben, bewertet nach den echten Kriterien statt nach allgemeinem Eindruck.</li><li>Prüfungstechnik: Zeiteinteilung, was tun, wenn eine Aufgabe nicht kommen will, und wie man Punkte bewusst liegen lässt statt versehentlich.</li>',
  },
  links: {
    en:
      linkCard(
        '/english-courses.html',
        'English courses',
        'If the language itself needs work first.'
      ) +
      linkCard(
        '/private-lessons.html',
        'Private lessons',
        'One-to-one, when the date is fixed and close.'
      ) +
      linkCard('/niveaus.html', 'Find your level', 'Check where you are before choosing an exam.'),
    de:
      linkCard(
        '/english-courses.html',
        'Englischkurse',
        'Wenn zuerst die Sprache selbst dran ist.'
      ) +
      linkCard(
        '/private-lessons.html',
        'Einzelunterricht',
        'Eins zu eins, wenn der Termin fix und nah ist.'
      ) +
      linkCard(
        '/niveaus.html',
        'Niveau herausfinden',
        'Prüfe dein Niveau, bevor du eine Prüfung wählst.'
      ),
  },
});

const LUNCH_SECTIONS = courseSections({
  lessonTitle: {
    en: 'What "build your own" actually means',
    de: 'Was «Build your own» konkret heisst',
  },
  lessonBody: {
    en: 'Every other course on this site is a fixed shape: so many lessons, so long, at such a rhythm. This one is the shape you need. Tell us the constraint — the hour you have, the weeks you are free, the two languages you want at once — and we build around it.',
    de: 'Jeder andere Kurs auf dieser Seite hat eine feste Form: so viele Lektionen, so lang, in diesem Rhythmus. Dieser hier hat die Form, die du brauchst. Sag uns die Rahmenbedingung — die eine Stunde, die du hast, die Wochen, in denen du frei bist, die zwei Sprachen, die du gleichzeitig willst — und wir bauen darum herum.',
  },
  lessonList: {
    en: '<li><strong>Lunchtime German:</strong> 60 minutes inside a lunch break, at your office or online, so the commute does not eat the lesson.</li><li><strong>Intensive blocks:</strong> several lessons a week over a short period — a summer holiday, the weeks before a move, a gap between jobs.</li><li><strong>Swiss German and German combined:</strong> the standard German you need on paper and the Swiss German you need in the room, in one programme.</li><li><strong>Business English</strong> or any other specific purpose, built from your material rather than a course book.</li><li>Lessons of 60, 90 or 120 minutes, priced from CHF 50 per 60 minutes per person in a group and CHF 120 one-to-one.</li>',
    de: '<li><strong>Lunchtime German:</strong> 60 Minuten in der Mittagspause, bei euch im Büro oder online, damit nicht der Arbeitsweg die Lektion auffrisst.</li><li><strong>Intensivblöcke:</strong> mehrere Lektionen pro Woche über einen kurzen Zeitraum — Sommerferien, die Wochen vor einem Umzug, die Lücke zwischen zwei Stellen.</li><li><strong>Schweizerdeutsch und Deutsch kombiniert:</strong> das Hochdeutsch, das du auf Papier brauchst, und das Schweizerdeutsch, das du im Raum brauchst, in einem Programm.</li><li><strong>Business-Englisch</strong> oder jeder andere konkrete Zweck, aufgebaut auf deinem Material statt auf einem Lehrbuch.</li><li>Lektionen à 60, 90 oder 120 Minuten, ab CHF 50 pro 60 Minuten pro Person in der Gruppe und CHF 120 im Einzelunterricht.</li>',
  },
  links: {
    en:
      linkCard(
        '/private-lessons.html',
        'Private lessons',
        'The most tailored version of all of this.'
      ) +
      linkCard(
        '/company-courses.html',
        'Company courses',
        'The same flexibility, for a whole team.'
      ) +
      linkCard(
        '/online-lessons.html',
        'Online lessons',
        'Fits a lunch break better than a commute does.'
      ),
    de:
      linkCard(
        '/private-lessons.html',
        'Einzelunterricht',
        'Die massgeschneidertste Variante von alldem.'
      ) +
      linkCard(
        '/company-courses.html',
        'Firmenkurse',
        'Dieselbe Flexibilität, für ein ganzes Team.'
      ) +
      linkCard(
        '/online-lessons.html',
        'Online-Unterricht',
        'Passt besser in eine Mittagspause als ein Arbeitsweg.'
      ),
  },
});

// `facts` overrides the shared fact tiles; `sections` carries the long-form
// body below them, for the pages that have one.
function coursePage(entry) {
  return {
    title: entry.title,
    description: entry.description,
    text: Object.assign(
      { h1: entry.h1, '#course-intro': entry.intro },
      courseFacts,
      entry.facts || {},
      entry.sections || {}
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
    sections: GERMAN_SECTIONS,
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
    sections: SWISS_SECTIONS,
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
    sections: {
      '#gymi-exam-title': {
        en: 'What the Gymiprüfung asks for',
        de: 'Was die Gymiprüfung verlangt',
      },
      '#gymi-exam-body': {
        en: 'The entrance exam for the Gymnasium in canton Zürich tests German and mathematics, under time pressure, in a format most children have never sat before. That last part matters more than families expect: a child can know the material and still lose marks to the shape of the paper — how the questions are phrased, how long to spend on each one, when to move on and come back. Preparation has to cover the subject knowledge and the exam itself, because on the day they are the same problem.',
        de: 'Die Aufnahmeprüfung ans Gymnasium im Kanton Zürich prüft Deutsch und Mathematik, unter Zeitdruck und in einem Format, das die meisten Kinder vorher nie geschrieben haben. Gerade dieser letzte Punkt wird oft unterschätzt: Ein Kind kann den Stoff beherrschen und trotzdem Punkte an die Form der Prüfung verlieren — wie die Fragen formuliert sind, wie lange man an einer Aufgabe bleibt, wann man weitergeht und später zurückkommt. Die Vorbereitung muss deshalb den Stoff und die Prüfung selbst abdecken, denn am Prüfungstag sind das dasselbe Problem.',
      },

      '#gymi-when-title': {
        en: 'When to start',
        de: 'Wann man beginnen sollte',
      },
      '#gymi-when-body': {
        en: 'Earlier than most families think, and calmly rather than intensively. One block of our Gymivorbereitung is 12 lessons of 90 minutes across three months. Families who start a year out typically take more than one block, using the first to close gaps in the underlying material and the later ones for exam practice proper. Starting a few weeks before the exam is still worth doing, but at that point the work is triage: we pick the two or three things that will move the mark most and leave the rest.',
        de: 'Früher, als die meisten Familien denken — und in Ruhe statt im Intensivmodus. Ein Block unserer Gymivorbereitung umfasst 12 Lektionen à 90 Minuten über drei Monate. Familien, die ein Jahr im Voraus beginnen, buchen meist mehr als einen Block: Der erste schliesst Lücken im Stoff, die späteren dienen dem eigentlichen Prüfungstraining. Auch wenige Wochen vor der Prüfung lohnt sich der Einstieg noch, dann arbeiten wir aber nach Dringlichkeit: Wir wählen die zwei, drei Dinge, die am meisten Punkte bringen, und lassen den Rest.',
      },

      '#gymi-lesson-title': {
        en: 'What a lesson looks like',
        de: 'Wie eine Lektion abläuft',
      },
      '#gymi-lesson-body': {
        en: 'Ninety minutes, with the balance between the three parts set for the individual child rather than for the group as a whole.',
        de: 'Neunzig Minuten, wobei die Gewichtung der drei Teile auf das einzelne Kind abgestimmt wird und nicht auf die Gruppe als Ganzes.',
      },
      '#gymi-lesson-list': {
        en: '<li><strong>Closing gaps.</strong> The underlying material, retaught where it did not land the first time.</li><li><strong>Exam practice.</strong> Past-paper style tasks under realistic timing, then going through what went wrong and why.</li><li><strong>Exam technique and nerves.</strong> How to budget the time, what to do when a question will not come, and how to arrive on the day without the panic that costs more marks than any gap in knowledge.</li>',
        de: '<li><strong>Lücken schliessen.</strong> Der Stoff, neu erklärt dort, wo er beim ersten Mal nicht angekommen ist.</li><li><strong>Prüfungstraining.</strong> Aufgaben im Prüfungsformat unter realistischer Zeitvorgabe, danach die Besprechung, was schiefging und warum.</li><li><strong>Prüfungstechnik und Nerven.</strong> Wie man sich die Zeit einteilt, was man tut, wenn eine Aufgabe nicht kommen will, und wie man am Prüfungstag ankommt, ohne die Panik, die mehr Punkte kostet als jede Wissenslücke.</li>',
      },

      '#gymi-format-title': {
        en: 'Group or one-to-one',
        de: 'Gruppe oder Einzelunterricht',
      },
      '#gymi-format-body': {
        en: 'Groups run from three to seven children and cost CHF 80 per person per 60 minutes. They work well when a child is broadly on track and mainly needs practice and routine — and the presence of others working on the same paper is, for a lot of children, motivating rather than stressful. One-to-one is CHF 120 per 60 minutes and is the better choice when there are specific gaps to close, when a child needs a slower pace without an audience, or when exam anxiety is the main obstacle rather than the material.',
        de: 'Gruppen umfassen drei bis sieben Kinder und kosten CHF 80 pro Person pro 60 Minuten. Sie eignen sich gut, wenn ein Kind grundsätzlich auf Kurs ist und vor allem Übung und Routine braucht — und für viele Kinder wirkt es motivierend statt belastend, wenn andere an derselben Prüfung arbeiten. Einzelunterricht kostet CHF 120 pro 60 Minuten und ist die bessere Wahl, wenn gezielt Lücken zu schliessen sind, wenn ein Kind ein langsameres Tempo ohne Publikum braucht oder wenn nicht der Stoff, sondern die Prüfungsangst das Haupthindernis ist.',
      },
      '#gymi-format-pull': {
        en: 'A child who knows the material but freezes on the day has a different problem from a child who is calm but has gaps. They should not get the same course.',
        de: 'Ein Kind, das den Stoff kann, aber am Prüfungstag blockiert, hat ein anderes Problem als ein Kind, das ruhig bleibt, aber Lücken hat. Beide sollten nicht denselben Kurs bekommen.',
      },

      '#gymi-parents-title': {
        en: 'What parents can expect from us',
        de: 'Was Eltern von uns erwarten können',
      },
      '#gymi-parents-body': {
        en: 'An honest assessment at the start, including when we think the timeline is tight or the target is the wrong one — that conversation is more useful to you than an encouraging one. Then regular, specific feedback on how your child is actually doing: not "going well", but which topics are secure, which are not, and what is being done about it. We teach in small groups or one-to-one, always in German, and we will tell you if we think a different format would serve your child better.',
        de: 'Eine ehrliche Einschätzung zu Beginn — auch dann, wenn wir den Zeitplan für knapp oder das Ziel für das falsche halten. Dieses Gespräch nützt euch mehr als ein aufmunterndes. Danach regelmässige, konkrete Rückmeldungen dazu, wie es eurem Kind wirklich geht: nicht «läuft gut», sondern welche Themen sitzen, welche nicht und was dagegen unternommen wird. Wir unterrichten in kleinen Gruppen oder einzeln, immer auf Deutsch, und sagen euch, wenn wir ein anderes Format für euer Kind für besser halten.',
      },

      '#gymi-faq-title': { en: 'Questions parents ask', de: 'Fragen von Eltern' },
      '#gymi-faq-list': { en: faqHtml(FAQ.gymi, 'en'), de: faqHtml(FAQ.gymi, 'de') },

      '#gymi-links-title': { en: 'Related', de: 'Passend dazu' },
      '#gymi-links': {
        en:
          linkCard(
            '/private-lessons.html',
            'Private lessons',
            'One-to-one, when a group is not the right fit.'
          ) +
          linkCard(
            '/german-courses.html',
            'German courses',
            'If the German itself is the gap to close.'
          ) +
          linkCard('/faq.html', 'FAQ', 'Timelines, group sizes, cancellation terms.'),
        de:
          linkCard(
            '/private-lessons.html',
            'Einzelunterricht',
            'Eins zu eins, wenn eine Gruppe nicht passt.'
          ) +
          linkCard(
            '/german-courses.html',
            'Deutschkurse',
            'Wenn das Deutsch selbst die Lücke ist.'
          ) +
          linkCard('/faq.html', 'Häufige Fragen', 'Zeitpläne, Gruppengrössen, Stornobedingungen.'),
      },
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
    sections: ENGLISH_SECTIONS,
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
    sections: EXAM_SECTIONS,
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
    sections: {
      '#company-setup-title': {
        en: 'How an in-house course is set up',
        de: 'Wie ein Inhouse-Kurs aufgesetzt wird',
      },
      '#company-setup-body': {
        en: 'Before we quote anything, we work out what your team actually needs. That conversation is free and usually takes one meeting: who is learning, at what level, for what, and what has to be true by when.',
        de: 'Bevor wir eine Offerte machen, klären wir, was euer Team wirklich braucht. Dieses Gespräch ist kostenlos und dauert in der Regel ein Meeting: wer lernt, auf welchem Niveau, wofür, und was bis wann erreicht sein muss.',
      },
      '#company-setup-list': {
        en: '<li><strong>Needs analysis.</strong> A short assessment per participant, so nobody sits in a course that is a level too easy or too hard.</li><li><strong>A proposal.</strong> Group split, lesson length, frequency, duration and what each block covers.</li><li><strong>Location.</strong> At your offices, in our classroom in Zürich, online, or a mix across the programme.</li><li><strong>The course itself,</strong> with material built for your context rather than a course book chapter.</li><li><strong>Progress reporting</strong> back to whoever is responsible for the budget, at intervals you set.</li>',
        de: '<li><strong>Bedarfsanalyse.</strong> Eine kurze Einstufung pro Teilnehmenden, damit niemand in einem Kurs sitzt, der ein Niveau zu leicht oder zu schwer ist.</li><li><strong>Ein Vorschlag.</strong> Gruppeneinteilung, Lektionsdauer, Rhythmus, Dauer und was jeder Block abdeckt.</li><li><strong>Ort.</strong> Bei euch im Büro, in unserem Kursraum in Zürich, online oder gemischt über das Programm hinweg.</li><li><strong>Der Kurs selbst,</strong> mit Material für euren Kontext statt eines Lehrbuchkapitels.</li><li><strong>Fortschrittsberichte</strong> an die budgetverantwortliche Person, in den Abständen, die ihr festlegt.</li>',
      },

      '#company-content-title': {
        en: 'Content built for your industry',
        de: 'Inhalte, die zu eurer Branche passen',
      },
      '#company-content-body': {
        en: 'A generic business-language course teaches the vocabulary of no particular business. We would rather spend the preparation time than have your team spend the lesson time on situations they will never be in. That means the emails they actually send, the meetings they actually sit in, the clients they actually talk to, and the terminology of your field.',
        de: 'Ein generischer Business-Sprachkurs vermittelt den Wortschatz keiner bestimmten Branche. Wir investieren lieber die Vorbereitungszeit, als dass euer Team die Unterrichtszeit mit Situationen verbringt, in die es nie kommt. Das heisst: die E-Mails, die sie wirklich schreiben, die Sitzungen, in denen sie wirklich sitzen, die Kundschaft, mit der sie wirklich sprechen, und die Fachsprache eures Gebiets.',
      },
      '#company-content-pull': {
        en: 'The measure of a company course is not how much grammar was covered. It is whether the next client meeting goes better than the last one.',
        de: 'Der Massstab eines Firmenkurses ist nicht, wie viel Grammatik behandelt wurde. Sondern ob das nächste Kundengespräch besser läuft als das letzte.',
      },

      '#company-swiss-title': {
        en: 'Swiss German for relocating and international teams',
        de: 'Schweizerdeutsch für zuziehende und internationale Teams',
      },
      '#company-swiss-body': {
        en: 'This is what companies ask us for most, and the one thing most language providers in Zürich cannot supply. Standard German gets a new arrival through the working day. Swiss German is what decides whether they are part of the lunch table, the corridor conversation and the team apéro, or standing slightly outside all three. It is taught by a native Swiss German speaker born and raised in Zürich — it is not a language you can learn from a textbook, because there is no standard written form to put in one. For teams that need both, we run Swiss German and standard German as a combined programme.',
        de: 'Das ist die häufigste Anfrage von Firmen — und das Einzige, was die meisten Sprachanbieter in Zürich nicht liefern können. Mit Hochdeutsch kommt eine neu zugezogene Person durch den Arbeitstag. Schweizerdeutsch entscheidet darüber, ob sie beim Mittagstisch, im Gang und beim Team-Apéro dazugehört oder bei allen dreien knapp daneben steht. Unterrichtet wird von einer in Zürich geborenen und aufgewachsenen Muttersprachlerin — es ist keine Sprache, die man aus einem Lehrbuch lernt, weil es dafür keine einheitliche Schriftform gibt. Für Teams, die beides brauchen, kombinieren wir Schweizerdeutsch und Hochdeutsch in einem Programm.',
      },

      '#company-schedule-title': {
        en: 'Scheduling around how your company actually runs',
        de: 'Planung entlang eures echten Arbeitsalltags',
      },
      '#company-schedule-body': {
        en: 'Two 60-minute lessons a week is the usual rhythm, and around 100 lessons covers a full level. But the rhythm is yours to set: lunch-break slots, early mornings before the day starts, intensive blocks around a quieter period, or a schedule that works around shift patterns and recurring meetings. If your team is split across sites, part of the group can join online while the rest are in the room.',
        de: 'Zwei Lektionen à 60 Minuten pro Woche ist der übliche Rhythmus, und rund 100 Lektionen decken ein ganzes Niveau ab. Den Rhythmus bestimmt aber ihr: Termine in der Mittagspause, früh am Morgen vor Arbeitsbeginn, Intensivblöcke in ruhigeren Phasen oder eine Planung rund um Schichtmodelle und wiederkehrende Sitzungen. Ist euer Team auf mehrere Standorte verteilt, kann ein Teil online dazukommen, während der Rest im Raum sitzt.',
      },

      '#company-admin-title': {
        en: 'Enrolment, invoicing and contracts',
        de: 'Anmeldung, Rechnung und Verträge',
      },
      '#company-admin-body': {
        en: 'We invoice the company directly — one invoice for the whole programme, or one per participant, whichever your finance team prefers. Companies can also be issued a booking code, which lets employees enrol themselves in the right course without every sign-up passing through an HR inbox. Terms, cancellation conditions and data handling are the same as for any other course and are set out in our <a href="/agb.html">terms and conditions</a>.',
        de: 'Wir stellen der Firma direkt Rechnung — eine Rechnung für das ganze Programm oder eine pro Teilnehmenden, je nachdem, was eurer Buchhaltung lieber ist. Firmen können ausserdem einen Buchungscode erhalten: Damit melden sich Mitarbeitende selbst für den richtigen Kurs an, ohne dass jede Anmeldung über ein HR-Postfach läuft. Vertragsbedingungen, Stornoregelungen und Datenbearbeitung sind dieselben wie bei jedem anderen Kurs und stehen in unseren <a href="/agb.html">AGB</a>.',
      },

      '#company-faq-title': {
        en: 'Questions companies ask',
        de: 'Fragen von Firmen',
      },
      '#company-faq-list': { en: faqHtml(FAQ.company, 'en'), de: faqHtml(FAQ.company, 'de') },

      '#company-links-title': { en: 'Related', de: 'Passend dazu' },
      '#company-links': {
        en:
          linkCard(
            '/swiss-german.html',
            'Swiss German courses',
            'The course relocating employees ask for by name.'
          ) +
          linkCard(
            '/online-lessons.html',
            'Online lessons',
            'For teams split across sites or working remotely.'
          ) +
          linkCard('/about.html', 'About us', 'Who teaches, and why the Swiss German is native.'),
        de:
          linkCard(
            '/swiss-german.html',
            'Schweizerdeutschkurse',
            'Der Kurs, nach dem zuziehende Mitarbeitende namentlich fragen.'
          ) +
          linkCard(
            '/online-lessons.html',
            'Online-Unterricht',
            'Für Teams an mehreren Standorten oder im Homeoffice.'
          ) +
          linkCard(
            '/about.html',
            'Über uns',
            'Wer unterrichtet und warum das Schweizerdeutsch muttersprachlich ist.'
          ),
      },
    },
  }),
  '/lunch-time-german.html': coursePage({
    title: {
      en: 'Build Your Own German Course in Zürich — Learning with Gioia',
      de: 'Build Your Own: Deutschkurs nach Mass in Zürich — Learning with Gioia',
    },
    description: {
      en: 'Lunchtime German, intensive blocks, Swiss German and German combined, business English — built around your schedule. From CHF 50 per 60 minutes per person.',
      de: 'Mittagskurse, Intensivblöcke, Schweizerdeutsch und Deutsch kombiniert, Business-Englisch — nach deinem Zeitplan. Ab CHF 50 pro 60 Minuten pro Person.',
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
    sections: LUNCH_SECTIONS,
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

Object.assign(pages, {
  '/about.html': {
    title: {
      en: 'About Learning with Gioia — Language Teaching in Zürich',
      de: 'Über Learning with Gioia — Sprachunterricht in Zürich',
    },
    description: {
      en: 'A Zürich language school founded by Gioia, born and raised in Zürich and a native speaker of Swiss German and German. Who teaches, and how we teach.',
      de: 'Zürcher Sprachschule, gegründet von Gioia — in Zürich aufgewachsen, Muttersprachlerin für Schweizerdeutsch und Deutsch. Wer unterrichtet und wie.',
    },
    text: {
      '#about-kicker': { en: 'about us', de: 'Über uns' },
      '#about-h1': { en: 'About Learning with Gioia', de: 'Über Learning with Gioia' },
      '#about-intro': {
        en: 'A small Zürich language school built on the opposite of a standard curriculum: lessons prepared for the people actually in the room.',
        de: 'Eine kleine Zürcher Sprachschule, aufgebaut auf dem Gegenteil eines Standardlehrplans: Unterricht, der für die Menschen vorbereitet wird, die wirklich im Raum sitzen.',
      },

      '#about-origin-title': {
        en: 'Born and raised in Zürich',
        de: 'In Zürich geboren und aufgewachsen',
      },
      '#about-origin-body': {
        en: 'Learning with Gioia was founded by Gioia, who was born and raised in Zürich and is a native speaker of both Swiss German and German. That is not a detail on a CV — it is the whole reason the Swiss German courses exist. Swiss German is not a subject most language schools can teach, because it is not written down in a textbook and it is not something you can learn from a curriculum. It is learnt from someone who grew up speaking it.',
        de: 'Learning with Gioia wurde von Gioia gegründet — in Zürich geboren und aufgewachsen, Muttersprachlerin für Schweizerdeutsch und Deutsch. Das ist kein Detail im Lebenslauf, sondern der Grund, weshalb es die Schweizerdeutschkurse überhaupt gibt. Schweizerdeutsch ist kein Fach, das die meisten Sprachschulen anbieten können: Es steht in keinem Lehrbuch und lässt sich nicht aus einem Lehrplan lernen. Man lernt es von jemandem, der damit aufgewachsen ist.',
      },
      '#about-origin-pull': {
        en: 'Standard German gets you through the working day in Zürich. Swiss German is what makes the lunch table, the corridor and the apéro stop being a wall.',
        de: 'Mit Hochdeutsch kommst du in Zürich durch den Arbeitstag. Schweizerdeutsch sorgt dafür, dass Mittagstisch, Gang und Apéro keine Mauer mehr sind.',
      },

      '#about-approach-title': {
        en: 'How we teach',
        de: 'Wie wir unterrichten',
      },
      '#about-approach-body': {
        en: 'Every course is prepared for the people taking it. That is easy to claim and slow to do, which is why the groups stay small — a maximum of five people in an open group course — and why we ask a lot of questions before the first lesson rather than after it.',
        de: 'Jeder Kurs wird für die Menschen vorbereitet, die ihn besuchen. Das ist leicht behauptet und aufwendig gemacht — deshalb bleiben die Gruppen klein, mit höchstens fünf Personen in einem offenen Gruppenkurs, und deshalb stellen wir viele Fragen vor der ersten Lektion statt danach.',
      },
      '#about-approach-list': {
        en: '<li>Small groups, so nobody spends the lesson waiting for a turn to speak.</li><li>Material built around your work, your studies or your everyday life, not a generic course book chapter.</li><li>A clear structure underneath it: the CEFR levels A1 to C2, with each level split into blocks of 32 hours of guided learning.</li><li>Lessons in our classroom, at your offices, at the teacher’s home, or online — whichever removes the most friction.</li>',
        de: '<li>Kleine Gruppen, damit niemand die Lektion damit verbringt, aufs Wort zu warten.</li><li>Material rund um deinen Beruf, dein Studium oder deinen Alltag statt eines beliebigen Lehrbuchkapitels.</li><li>Darunter eine klare Struktur: die Niveaus A1 bis C2 des GER, jedes Niveau unterteilt in Blöcke à 32 Stunden angeleitetes Lernen.</li><li>Unterricht in unserem Kursraum, bei euch im Büro, bei der Lehrperson zu Hause oder online — je nachdem, was am wenigsten im Weg steht.</li>',
      },

      '#about-teachers-title': {
        en: 'Who teaches',
        de: 'Wer unterrichtet',
      },
      '#about-teachers-body': {
        en: 'Gioia teaches German, Swiss German and English, and is the school’s native Swiss German speaker. Alongside her, a small circle of associate teachers with linguistics degrees and formal teaching qualifications covers the remaining courses and tutoring. German is taught exclusively by native speakers.',
        de: 'Gioia unterrichtet Deutsch, Schweizerdeutsch und Englisch und ist die Muttersprachlerin für Schweizerdeutsch der Schule. Daneben deckt ein kleiner Kreis von Lehrpersonen mit sprachwissenschaftlichem Studium und formaler Lehrqualifikation die übrigen Kurse und die Nachhilfe ab. Deutsch wird ausschliesslich von Muttersprachlerinnen und Muttersprachlern unterrichtet.',
      },

      '#about-who-title': {
        en: 'Who we work with',
        de: 'Mit wem wir arbeiten',
      },
      '#about-who-body': {
        en: 'Three groups, mostly: companies in and around Zürich who want language training built for their team, adults who want to learn German or Swiss German properly rather than approximately, and families preparing a child for the Gymiprüfung.',
        de: 'Hauptsächlich mit drei Gruppen: Firmen in und um Zürich, die Sprachtraining für ihr Team wollen; Erwachsene, die Deutsch oder Schweizerdeutsch richtig lernen möchten statt ungefähr; und Familien, die ein Kind auf die Gymiprüfung vorbereiten.',
      },
      '#about-who-links': {
        en:
          linkCard(
            '/company-courses.html',
            'Company courses',
            'In-house language training for teams, at your offices or ours.'
          ) +
          linkCard(
            '/online-lessons.html',
            'Online lessons',
            'German and Swiss German by video, taught by a native speaker.'
          ) +
          linkCard(
            '/private-lessons.html',
            'Private lessons',
            'One-to-one, built entirely around you.'
          ) +
          linkCard(
            '/gymivorbereitung.html',
            'Gymivorbereitung',
            'Step-by-step preparation for the Gymiprüfung.'
          ),
        de:
          linkCard(
            '/company-courses.html',
            'Firmenkurse',
            'Inhouse-Sprachtraining für Teams, bei euch im Büro oder bei uns.'
          ) +
          linkCard(
            '/online-lessons.html',
            'Online-Unterricht',
            'Deutsch und Schweizerdeutsch per Video, von einer Muttersprachlerin.'
          ) +
          linkCard(
            '/private-lessons.html',
            'Einzelunterricht',
            'Eins zu eins, ganz auf dich zugeschnitten.'
          ) +
          linkCard(
            '/gymivorbereitung.html',
            'Gymivorbereitung',
            'Schritt für Schritt auf die Gymiprüfung vorbereitet.'
          ),
      },

      '#about-cta-enquiry': { en: 'make an enquiry', de: 'Anfrage senden' },
      '#about-cta-courses': { en: 'open group courses', de: 'Offene Gruppenkurse' },
    },
  },

  '/online-lessons.html': {
    title: {
      en: 'Online German & Swiss German Lessons — Learning with Gioia',
      de: 'Deutsch & Schweizerdeutsch online lernen — Learning with Gioia',
    },
    description: {
      en: 'Online German and Swiss German with a native speaker born and raised in Zürich. Same rates as in person: CHF 1600 in a group, CHF 3840 one-to-one.',
      de: 'Deutsch und Schweizerdeutsch online bei einer Zürcher Muttersprachlerin. Gleiche Preise wie vor Ort: CHF 1600 in der Gruppe, CHF 3840 im Einzelunterricht.',
    },
    text: {
      '#online-kicker': { en: 'courses & tutoring', de: 'Kurse & Nachhilfe' },
      '#online-h1': { en: 'Online lessons', de: 'Online-Unterricht' },
      '#online-intro': {
        en: 'German and Swiss German by video, taught live by a native speaker. The same courses we teach in Zürich, without the commute.',
        de: 'Deutsch und Schweizerdeutsch per Video, live unterrichtet von einer Muttersprachlerin. Dieselben Kurse wie in Zürich, nur ohne Anfahrt.',
      },

      '#online-fact-1-label': { en: 'lessons', de: 'Lektionen' },
      '#online-fact-1-value': { en: '32 × 60 min', de: '32 × 60 Min.' },
      '#online-fact-1-unit': { en: 'over 4 months', de: 'in 4 Monaten' },
      '#online-fact-2-label': { en: 'group (3-5)', de: 'Gruppe (3-5)' },
      '#online-fact-2-value': { en: 'CHF 1600', de: 'CHF 1600' },
      '#online-fact-2-unit': { en: 'per person', de: 'pro Person' },
      '#online-fact-3-label': { en: 'one-to-one', de: 'Einzelunterricht' },
      '#online-fact-3-value': { en: 'CHF 3840', de: 'CHF 3840' },
      '#online-fact-3-unit': { en: 'total', de: 'total' },

      '#online-native-title': {
        en: 'Swiss German online, with a native speaker',
        de: 'Schweizerdeutsch online, mit einer Muttersprachlerin',
      },
      '#online-native-body': {
        en: 'Swiss German is the reason most people find this page. It is a spoken language with no standard written form, so it cannot be learnt from a textbook — which is exactly what makes it suit a live video lesson. Almost the entire hour is spent listening and speaking, with a teacher who grew up speaking Zürich German and can tell you what people actually say, not what a course book thinks they say.',
        de: 'Schweizerdeutsch ist der Grund, weshalb die meisten auf dieser Seite landen. Es ist eine gesprochene Sprache ohne einheitliche Schriftform und lässt sich deshalb nicht aus einem Lehrbuch lernen — genau das macht es für eine Live-Lektion per Video so geeignet. Fast die ganze Stunde wird zugehört und gesprochen, mit einer Lehrperson, die mit Zürichdeutsch aufgewachsen ist und dir sagen kann, was man wirklich sagt, nicht was ein Lehrbuch dafür hält.',
      },
      '#online-native-pull': {
        en: 'Online does not mean a recording, a chatbot or a worksheet. It means a live lesson, prepared for you, with a person on the other side.',
        de: 'Online heisst nicht Aufzeichnung, Chatbot oder Arbeitsblatt. Es heisst: eine Live-Lektion, für dich vorbereitet, mit einem Menschen auf der anderen Seite.',
      },

      '#online-how-title': {
        en: 'How online lessons run',
        de: 'Wie der Online-Unterricht abläuft',
      },
      '#online-how-body': {
        en: 'Structurally an online course is identical to one in our classroom: the same levels, the same lesson counts, the same teachers. What changes is only where everyone sits.',
        de: 'Strukturell ist ein Online-Kurs identisch mit einem Kurs in unserem Raum: dieselben Niveaus, dieselbe Anzahl Lektionen, dieselben Lehrpersonen. Anders ist nur, wo alle sitzen.',
      },
      '#online-how-list': {
        en: '<li>Live video lessons at a fixed weekly slot, arranged in Zürich time.</li><li>Materials shared digitally before and after each lesson, so nothing depends on a printer.</li><li>Group courses of three to five people, or one-to-one.</li><li>You need a stable connection, a camera and microphone, and somewhere you can speak out loud.</li>',
        de: '<li>Live-Lektionen per Video zu einem festen wöchentlichen Termin, nach Zürcher Zeit.</li><li>Materialien digital vor und nach jeder Lektion, damit nichts von einem Drucker abhängt.</li><li>Gruppenkurse mit drei bis fünf Personen oder Einzelunterricht.</li><li>Du brauchst eine stabile Verbindung, Kamera und Mikrofon und einen Ort, an dem du laut sprechen kannst.</li>',
      },

      '#online-who-title': { en: 'Who learns online with us', de: 'Wer bei uns online lernt' },
      '#online-who-body': {
        en: 'Online lessons are not a compromise version of the course. For a lot of people they are simply the right format.',
        de: 'Online-Unterricht ist keine abgespeckte Variante des Kurses. Für viele ist es schlicht das passende Format.',
      },
      '#online-who-list': {
        en: '<li>People who have moved to Switzerland for work and want Swiss German before the next team lunch.</li><li>Employees whose company books in-house training but who work remotely or across sites.</li><li>Anyone outside Zürich, in Switzerland or abroad, who wants a Zürich-native teacher.</li><li>People whose schedule only allows a lunch break or an evening, and who cannot spend it commuting.</li>',
        de: '<li>Menschen, die für die Arbeit in die Schweiz gezogen sind und Schweizerdeutsch können möchten, bevor das nächste Team-Mittagessen ansteht.</li><li>Mitarbeitende, deren Firma Inhouse-Schulungen bucht, die aber remote oder an anderen Standorten arbeiten.</li><li>Alle ausserhalb Zürichs, in der Schweiz oder im Ausland, die eine Lehrperson aus Zürich möchten.</li><li>Menschen, deren Zeitplan nur eine Mittagspause oder einen Abend hergibt — und die diese nicht im Zug verbringen wollen.</li>',
      },

      '#online-price-title': { en: 'What it costs', de: 'Was es kostet' },
      '#online-price-body': {
        en: 'The same as in person. A 32-lesson course over four months is CHF 1600 per person in a group of three to five, or CHF 3840 one-to-one. Shorter and more flexible formats — a lunchtime course, an intensive block, Swiss German and German combined — are priced from CHF 50 per 60 minutes per person in a group and CHF 120 one-to-one.',
        de: 'Gleich viel wie vor Ort. Ein Kurs mit 32 Lektionen über vier Monate kostet CHF 1600 pro Person in einer Gruppe von drei bis fünf Personen oder CHF 3840 im Einzelunterricht. Kürzere und flexiblere Formate — Mittagskurs, Intensivblock, Schweizerdeutsch und Deutsch kombiniert — beginnen bei CHF 50 pro 60 Minuten pro Person in der Gruppe und CHF 120 im Einzelunterricht.',
      },

      '#online-faq-title': {
        en: 'Questions about online lessons',
        de: 'Fragen zum Online-Unterricht',
      },
      '#online-faq-list': {
        en: faqHtml(FAQ.online, 'en'),
        de: faqHtml(FAQ.online, 'de'),
      },

      '#online-links-title': { en: 'Related', de: 'Passend dazu' },
      '#online-links': {
        en:
          linkCard(
            '/swiss-german.html',
            'Swiss German courses',
            'The full course, in Zürich or online.'
          ) +
          linkCard(
            '/private-lessons.html',
            'Private lessons',
            'One-to-one, entirely at your pace.'
          ) +
          linkCard('/faq.html', 'FAQ', 'Levels, group sizes, cancellation terms.'),
        de:
          linkCard(
            '/swiss-german.html',
            'Schweizerdeutschkurse',
            'Der ganze Kurs, in Zürich oder online.'
          ) +
          linkCard(
            '/private-lessons.html',
            'Einzelunterricht',
            'Eins zu eins, ganz in deinem Tempo.'
          ) +
          linkCard('/faq.html', 'Häufige Fragen', 'Niveaus, Gruppengrössen, Stornobedingungen.'),
      },

      '#online-cta-enquiry': { en: 'make an enquiry', de: 'Anfrage senden' },
      '#online-cta-courses': { en: 'open group courses', de: 'Offene Gruppenkurse' },
    },
  },

  '/private-lessons.html': {
    title: {
      en: 'Private One-to-One Language Lessons in Zürich — Learning with Gioia',
      de: 'Einzelunterricht für Sprachen in Zürich — Learning with Gioia',
    },
    description: {
      en: 'One-to-one German, Swiss German and English lessons in Zürich and online. CHF 3840 for a 32-lesson course, or CHF 120 per 60 minutes for flexible bookings.',
      de: 'Einzelunterricht in Deutsch, Schweizerdeutsch und Englisch in Zürich und online. CHF 3840 für einen Kurs mit 32 Lektionen oder CHF 120 pro 60 Minuten bei flexibler Buchung.',
    },
    text: {
      '#private-kicker': { en: 'courses & tutoring', de: 'Kurse & Nachhilfe' },
      '#private-h1': { en: 'Private lessons', de: 'Einzelunterricht' },
      '#private-intro': {
        en: 'One teacher, one learner, and a course built from nothing but what you need. In Zürich or online.',
        de: 'Eine Lehrperson, eine lernende Person und ein Kurs, der aus nichts anderem besteht als dem, was du brauchst. In Zürich oder online.',
      },

      '#private-fact-1-label': { en: 'course', de: 'Kurs' },
      '#private-fact-1-value': { en: 'CHF 3840', de: 'CHF 3840' },
      '#private-fact-1-unit': { en: '32 × 60 min', de: '32 × 60 Min.' },
      '#private-fact-2-label': { en: 'flexible booking', de: 'flexible Buchung' },
      '#private-fact-2-value': { en: 'CHF 120', de: 'CHF 120' },
      '#private-fact-2-unit': { en: 'per 60 min', de: 'pro 60 Min.' },
      '#private-fact-3-label': { en: 'where', de: 'Ort' },
      '#private-fact-3-value': { en: 'Zürich or online', de: 'Zürich oder online' },
      '#private-fact-3-unit': { en: '', de: '' },

      '#private-why-title': {
        en: 'When one-to-one is the right choice',
        de: 'Wann Einzelunterricht die richtige Wahl ist',
      },
      '#private-why-body': {
        en: 'A group course is the better deal and, for most people learning a language from scratch, the better experience — you need other people to talk to. One-to-one earns its price in the cases where a group cannot go where you need to go: a specific exam on a specific date, a professional vocabulary nobody else in the room shares, a schedule that will not survive a fixed weekly slot, or a level so far along that a matching group would take months to form.',
        de: 'Ein Gruppenkurs ist günstiger und für die meisten, die eine Sprache von Grund auf lernen, auch die bessere Erfahrung — man braucht Menschen zum Sprechen. Einzelunterricht rechtfertigt seinen Preis dort, wo eine Gruppe nicht hinkommt, wo du hinmusst: eine bestimmte Prüfung an einem bestimmten Datum, ein Fachwortschatz, den sonst niemand im Raum teilt, ein Terminplan, der keinen festen Wochentermin überlebt, oder ein Niveau so weit oben, dass sich eine passende Gruppe erst in Monaten findet.',
      },
      '#private-why-pull': {
        en: 'In a group, the course sets the pace and you meet it. One-to-one, you set the pace and the course follows.',
        de: 'In der Gruppe gibt der Kurs das Tempo vor und du gehst mit. Im Einzelunterricht gibst du das Tempo vor und der Kurs folgt.',
      },

      '#private-how-title': { en: 'How it works', de: 'Wie es abläuft' },
      '#private-how-body': {
        en: 'We start with what you actually need, not with chapter one. That first conversation is free and takes fifteen minutes.',
        de: 'Wir beginnen bei dem, was du wirklich brauchst, nicht bei Kapitel eins. Dieses erste Gespräch ist kostenlos und dauert fünfzehn Minuten.',
      },
      '#private-how-list': {
        en: '<li>A free 15-minute call to establish your level, your goal and your deadline if you have one.</li><li>A proposal: how many lessons, how long, how often, and what each block will cover.</li><li>Lessons at times that fit your week, including lunch breaks and evenings.</li><li>Material prepared for you between lessons — your work, your studies, your exam format.</li><li>Direction adjusted as you go, rather than at the end of a fixed syllabus.</li>',
        de: '<li>Ein kostenloses 15-Minuten-Gespräch, um Niveau, Ziel und — falls vorhanden — Termin zu klären.</li><li>Ein Vorschlag: wie viele Lektionen, wie lang, wie oft und was jeder Block abdeckt.</li><li>Unterricht zu Zeiten, die in deine Woche passen, auch in der Mittagspause oder am Abend.</li><li>Material, das zwischen den Lektionen für dich vorbereitet wird — dein Beruf, dein Studium, dein Prüfungsformat.</li><li>Die Richtung wird unterwegs angepasst, nicht erst am Ende eines fixen Lehrplans.</li>',
      },

      '#private-where-title': {
        en: 'Where lessons take place',
        de: 'Wo der Unterricht stattfindet',
      },
      '#private-where-body': {
        en: 'In our classroom in Zürich, at the teacher’s home, at your offices, or online by video — and you can mix them across a course. Online lessons are the same price and the same lesson, which makes them a practical fallback for a week when you are travelling rather than a separate product.',
        de: 'In unserem Kursraum in Zürich, bei der Lehrperson zu Hause, bei euch im Büro oder online per Video — und du kannst die Varianten innerhalb eines Kurses mischen. Online-Lektionen kosten gleich viel und sind dieselbe Lektion, was sie zu einer praktischen Lösung für eine Reisewoche macht statt zu einem eigenen Produkt.',
      },

      '#private-price-title': { en: 'What it costs', de: 'Was es kostet' },
      '#private-price-body': {
        en: 'A full one-to-one course of 32 lessons of 60 minutes over four months is CHF 3840. Exam preparation runs longer, at 40 lessons over five months for CHF 4800. If you would rather book flexibly than commit to a full course, one-to-one lessons are CHF 120 per 60 minutes. Gymivorbereitung is priced separately, at CHF 120 per 60 minutes one-to-one.',
        de: 'Ein vollständiger Einzelkurs mit 32 Lektionen à 60 Minuten über vier Monate kostet CHF 3840. Die Prüfungsvorbereitung ist länger: 40 Lektionen über fünf Monate für CHF 4800. Wenn du lieber flexibel buchst, statt dich auf einen ganzen Kurs festzulegen, kostet die Einzellektion CHF 120 pro 60 Minuten. Die Gymivorbereitung wird separat berechnet, im Einzelunterricht ebenfalls zu CHF 120 pro 60 Minuten.',
      },

      '#private-faq-title': {
        en: 'Questions about private lessons',
        de: 'Fragen zum Einzelunterricht',
      },
      '#private-faq-list': {
        en: faqHtml(FAQ.booking, 'en'),
        de: faqHtml(FAQ.booking, 'de'),
      },

      '#private-links-title': { en: 'Related', de: 'Passend dazu' },
      '#private-links': {
        en:
          linkCard(
            '/online-lessons.html',
            'Online lessons',
            'The same one-to-one lesson, by video.'
          ) +
          linkCard(
            '/exam-preparation.html',
            'Exam preparation',
            'Cambridge, TOEFL, IELTS, TELC and Goethe.'
          ) +
          linkCard(
            '/group-courses.html',
            'Open group courses',
            'What is currently bookable, and at which level.'
          ),
        de:
          linkCard(
            '/online-lessons.html',
            'Online-Unterricht',
            'Dieselbe Einzellektion, per Video.'
          ) +
          linkCard(
            '/exam-preparation.html',
            'Prüfungsvorbereitung',
            'Cambridge, TOEFL, IELTS, TELC und Goethe.'
          ) +
          linkCard(
            '/group-courses.html',
            'Offene Gruppenkurse',
            'Was gerade buchbar ist und auf welchem Niveau.'
          ),
      },

      '#private-cta-enquiry': { en: 'make an enquiry', de: 'Anfrage senden' },
      '#private-cta-call': {
        en: 'book a free 15-minute call',
        de: 'Kostenloses 15-Minuten-Gespräch buchen',
      },
    },
  },

  '/faq.html': {
    title: {
      en: 'Frequently Asked Questions — Learning with Gioia',
      de: 'Häufige Fragen — Learning with Gioia',
    },
    description: {
      en: 'Answers on levels, group sizes, prices, online lessons, Gymivorbereitung, company courses, booking and cancellation terms at Learning with Gioia in Zürich.',
      de: 'Antworten zu Niveaus, Gruppengrössen, Preisen, Online-Unterricht, Gymivorbereitung, Firmenkursen, Buchung und Stornobedingungen bei Learning with Gioia in Zürich.',
    },
    text: {
      '#faq-kicker': { en: 'good to know', de: 'Gut zu wissen' },
      '#faq-h1': { en: 'Frequently asked questions', de: 'Häufige Fragen' },
      '#faq-intro': {
        en: 'The questions we are asked most, answered plainly. If yours is not here, ask us — we answer email within a working day.',
        de: 'Die Fragen, die uns am häufigsten gestellt werden, klar beantwortet. Fehlt deine, frag uns einfach — wir antworten innerhalb eines Arbeitstags.',
      },

      '#faq-courses-title': { en: 'Courses and levels', de: 'Kurse und Niveaus' },
      '#faq-courses-list': { en: faqHtml(FAQ.courses, 'en'), de: faqHtml(FAQ.courses, 'de') },
      '#faq-online-title': { en: 'Online lessons', de: 'Online-Unterricht' },
      '#faq-online-list': { en: faqHtml(FAQ.online, 'en'), de: faqHtml(FAQ.online, 'de') },
      '#faq-gymi-title': { en: 'Gymivorbereitung', de: 'Gymivorbereitung' },
      '#faq-gymi-list': { en: faqHtml(FAQ.gymi, 'en'), de: faqHtml(FAQ.gymi, 'de') },
      '#faq-company-title': { en: 'Company courses', de: 'Firmenkurse' },
      '#faq-company-list': { en: faqHtml(FAQ.company, 'en'), de: faqHtml(FAQ.company, 'de') },
      '#faq-booking-title': {
        en: 'Booking, payment and cancellation',
        de: 'Buchung, Zahlung und Stornierung',
      },
      '#faq-booking-list': { en: faqHtml(FAQ.booking, 'en'), de: faqHtml(FAQ.booking, 'de') },

      '#faq-links-title': { en: 'Related', de: 'Passend dazu' },
      '#faq-links': {
        en:
          linkCard('/about.html', 'About us', 'Who teaches, and how the courses are built.') +
          linkCard('/niveaus.html', 'Find your level', 'An interactive CEFR self-assessment.') +
          linkCard(
            '/agb.html',
            'Terms & Conditions',
            'The full contractual terms, including cancellation.'
          ),
        de:
          linkCard(
            '/about.html',
            'Über uns',
            'Wer unterrichtet und wie die Kurse aufgebaut sind.'
          ) +
          linkCard(
            '/niveaus.html',
            'Niveau herausfinden',
            'Interaktive Selbsteinschätzung nach GER.'
          ) +
          linkCard(
            '/agb.html',
            'AGB',
            'Die vollständigen Vertragsbedingungen, inklusive Stornierung.'
          ),
      },

      '#faq-cta-enquiry': { en: 'make an enquiry', de: 'Anfrage senden' },
      '#faq-cta-courses': { en: 'open group courses', de: 'Offene Gruppenkurse' },
    },
  },
});
