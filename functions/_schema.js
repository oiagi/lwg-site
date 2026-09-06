// JSON-LD graph, injected inline server-side by _render.js.
//
// Replaces public/index-structured-data.js and public/course-structured-data.js,
// which built their blocks in the browser and were therefore invisible to every
// crawler that does not execute JavaScript.
//
// One @graph per document with stable @ids, so the nodes reference each other
// instead of repeating themselves.

import { pages, pagePath, ROUTES, nav, FAQ } from './_i18n-content.js';

export const SITE_ORIGIN = 'https://learningwithgioia.ch';

const BUSINESS_ID = `${SITE_ORIGIN}/#business`;
const PERSON_ID = `${SITE_ORIGIN}/#gioia`;
const WEBSITE_ID = `${SITE_ORIGIN}/#website`;

// Verified facts only. Anything still null is awaiting confirmation and is
// omitted from the output rather than guessed — a wrong fact in structured data
// is worse than a missing one, because assistants repeat it verbatim.
export const BUSINESS = {
  name: 'Learning with Gioia',
  legalName: 'Birukoff World', // impressum.html
  email: 'info@learningwithgioia.ch',
  street: 'Wildbachstrasse 65', // impressum.html
  postalCode: '8008',
  city: 'Zürich',
  country: 'CH',
  vatID: 'CHE-396.783.072', // impressum.html
  priceRange: 'CHF 50–150',
  // First name only, deliberately: Gioia chose not to publish a full legal
  // name. Do not "complete" this from the Impressum.
  founderName: 'Gioia',
  // Approved for publication; awaiting the number itself. E.164, e.g. '+41…'.
  telephone: null, // TODO(gioia): phone number
  // No social profiles published by choice, so sameAs is omitted entirely —
  // an empty sameAs is not a weaker claim, it is a malformed one.
  geo: null, // Optional: lat/lng for the Zürich address.
};

// Approved for publication; awaiting the facts themselves. Each is omitted
// from the Person node while null.
export const CREDENTIALS = {
  // One entry per degree awarded, highest first.
  degrees: [
    {
      en: 'MA in Russian Studies, University College London',
      de: 'Master of Arts in Russian Studies, University College London',
    },
    {
      en: 'BA in Russian Language and Literature, University of Zürich',
      de: 'Bachelor of Arts in Russischer Sprach- und Literaturwissenschaft, Universität Zürich',
    },
  ],
  alumniOf: [
    { '@type': 'CollegeOrUniversity', name: 'University College London' },
    { '@type': 'CollegeOrUniversity', name: 'Universität Zürich' },
  ],
  // The Lehrdiplom (UZH, Russian and Mathematics) is still in progress. A
  // credential that has not been awarded is not a credential, so it stays out
  // of the graph until it is — the about page says "in progress" instead.
  teachingQualification: null, // TODO(gioia): set once the Lehrdiplom is awarded
  // Year teaching started, as a number, e.g. 2016. Rendered as a duration so
  // the copy never goes stale.
  teachingSince: null, // TODO(gioia): year you started teaching
};

const DESCRIPTION = {
  en: 'German and Swiss German courses, Gymivorbereitung, exam preparation and tutoring in Zürich and online. Taught by a native Swiss German and German speaker born and raised in Zürich, with associate teachers holding linguistics degrees and formal teaching qualifications.',
  de: 'Deutsch- und Schweizerdeutschkurse, Gymivorbereitung, Prüfungsvorbereitung und Nachhilfe in Zürich und online. Unterrichtet von einer in Zürich geborenen und aufgewachsenen Muttersprachlerin für Schweizerdeutsch und Deutsch, mit Lehrpersonen mit sprachwissenschaftlichem Studium und formaler Lehrqualifikation.',
};

const PERSON_DESCRIPTION = {
  en: 'Founder of Learning with Gioia. Born and raised in Zürich, native speaker of both Swiss German and German, teaching German, Swiss German and English in Zürich and online. Studied Russian language and literature with a focus on linguistics, and worked in the financial sector in London before returning to teaching.',
  de: 'Gründerin von Learning with Gioia. In Zürich geboren und aufgewachsen, Muttersprachlerin für Schweizerdeutsch und Deutsch, unterrichtet Deutsch, Schweizerdeutsch und Englisch in Zürich und online. Studium der Russischen Sprach- und Literaturwissenschaft mit Schwerpunkt Linguistik, davor Tätigkeit im Finanzsektor in London.',
};

const SERVICE_TYPES = [
  'German courses',
  'Swiss German courses',
  'Gymivorbereitung',
  'English courses',
  'Exam preparation',
  'Company language courses',
  'In-house language training',
  'Private one-to-one lessons',
  'Online language lessons',
  'Tutoring in Swiss school subjects',
  // Not a Course node: for languages beyond the three taught in house a teacher
  // is sourced from the network, so there is no fixed level ladder or price.
  'Other languages on request',
];

// The courses are sections of the homepage, not pages of their own, so each
// is keyed by an id and points at the anchor where it is described. Prices
// are the per-60-minute rates the page shows: a regular 32-lesson group
// block therefore works out at CHF 1600, but the rate is what is quoted.
const COURSE_DEFAULTS = {
  workload: 'PT1H',
  priceGroup: '50',
  priceSolo: '120',
  categoryGroup: 'group course (3–5), per 60 min, per person',
  categorySolo: 'one-to-one, per 60 min',
};

export const COURSES = {
  'german-courses': {
    anchor: 'language-courses',
    name: { en: 'German courses', de: 'Deutschkurse' },
    description: {
      en: 'German courses in Zürich from A0 to C2, taught by native speakers, in small groups or one-to-one, in person or online.',
      de: 'Deutschkurse in Zürich von A0 bis C2, unterrichtet von Muttersprachlerinnen und Muttersprachlern, in kleinen Gruppen oder im Einzelunterricht, vor Ort oder online.',
    },
    language: 'de',
  },
  'swiss-german': {
    anchor: 'language-courses',
    name: { en: 'Swiss German courses', de: 'Schweizerdeutschkurse' },
    description: {
      en: 'Swiss German courses in Zürich taught by a native speaker born and raised in Zürich, in small groups or one-to-one, in person or online.',
      de: 'Schweizerdeutschkurse in Zürich, unterrichtet von einer in Zürich aufgewachsenen Muttersprachlerin, in kleinen Gruppen oder im Einzelunterricht, vor Ort oder online.',
    },
    language: 'gsw',
  },
  'english-courses': {
    anchor: 'language-courses',
    name: { en: 'English courses', de: 'Englischkurse' },
    description: {
      en: 'English courses and tutoring in Zürich from A1 to C2, for school, work and everyday life, in small groups or one-to-one.',
      de: 'Englischkurse und Nachhilfe in Zürich von A1 bis C2, für Schule, Beruf und Alltag, in kleinen Gruppen oder im Einzelunterricht.',
    },
    language: 'en',
  },
  'exam-preparation': {
    anchor: 'language-courses',
    name: { en: 'Exam preparation', de: 'Prüfungsvorbereitung' },
    description: {
      en: 'Preparation for Goethe, TELC, FIDE, Cambridge, TOEFL and IELTS exams in Zürich, practised with the real exam formats.',
      de: 'Vorbereitung auf Goethe, TELC, FIDE, Cambridge, TOEFL und IELTS in Zürich, geübt mit den echten Prüfungsformaten.',
    },
    language: 'en',
  },
  'company-courses': {
    anchor: 'language-courses',
    name: { en: 'Company language courses', de: 'Firmenkurse' },
    description: {
      en: 'Language courses for companies and teams in Zürich, at your offices, in our classroom or online. Around 100 lessons per level, pricing on request.',
      de: 'Sprachkurse für Firmen und Teams in Zürich, bei euch im Büro, in unserem Kursraum oder online. Rund 100 Lektionen pro Niveau, Preis auf Anfrage.',
    },
    language: 'en',
    priceOnRequest: true,
  },
  gymivorbereitung: {
    anchor: 'gymivorbereitung',
    name: { en: 'Gymivorbereitung', de: 'Gymivorbereitung' },
    description: {
      en: 'Gymivorbereitung in Zürich Seefeld, in Mathematics and German, in small groups of three to seven or one-to-one. 12 or 20 teaching days of three hours, once or twice a week.',
      de: 'Gymivorbereitung in Zürich Seefeld, in Mathematik und Deutsch, in kleinen Gruppen von drei bis sieben oder im Einzelunterricht. 12 oder 20 Unterrichtstage à drei Stunden, ein- oder zweimal pro Woche.',
    },
    language: 'de',
    priceGroup: '80',
    priceSolo: '150',
    categoryGroup: 'group course (3–7), per 60 min, per person',
  },
  tutoring: {
    anchor: 'tutoring',
    name: { en: 'School tutoring', de: 'Nachhilfe' },
    description: {
      en: 'Tutoring in all subjects taught in Swiss schools, from primary school to Matura, in small groups or one-to-one.',
      de: 'Nachhilfe in allen Fächern der Schweizer Schulen, von der Primarschule bis zur Matura, in kleinen Gruppen oder im Einzelunterricht.',
    },
    language: 'de',
    priceGroup: '80',
    categoryGroup: 'group course (3–7), per 60 min, per person',
  },
};

function homeUrl(lang) {
  return SITE_ORIGIN + pagePath('/index.html', lang);
}

function place() {
  return {
    '@type': 'Place',
    address: {
      '@type': 'PostalAddress',
      streetAddress: BUSINESS.street,
      postalCode: BUSINESS.postalCode,
      addressLocality: BUSINESS.city,
      addressCountry: BUSINESS.country,
    },
  };
}

function personNode(lang) {
  const node = {
    '@type': 'Person',
    '@id': PERSON_ID,
    name: BUSINESS.founderName,
    description: PERSON_DESCRIPTION[lang],
    jobTitle: lang === 'de' ? 'Sprachlehrerin und Gründerin' : 'Language teacher and founder',
    birthPlace: { '@type': 'Place', name: 'Zürich, Switzerland' },
    homeLocation: { '@type': 'Place', name: 'Zürich, Switzerland' },
    // Swiss German and German are native; English is a teaching language.
    knowsLanguage: [
      { '@type': 'Language', name: 'Swiss German', alternateName: 'gsw' },
      { '@type': 'Language', name: 'German', alternateName: 'de' },
      { '@type': 'Language', name: 'English', alternateName: 'en' },
    ],
    knowsAbout: [
      'German as a foreign language',
      'Swiss German',
      'Gymivorbereitung',
      'Linguistics',
      'Russian language and literature',
      'Exam preparation',
    ],
    worksFor: { '@id': BUSINESS_ID },
  };

  const credentials = [];
  for (const degree of CREDENTIALS.degrees || []) {
    credentials.push({
      '@type': 'EducationalOccupationalCredential',
      credentialCategory: 'degree',
      name: degree[lang],
    });
  }
  if (CREDENTIALS.teachingQualification) {
    credentials.push({
      '@type': 'EducationalOccupationalCredential',
      credentialCategory: 'certification',
      name: CREDENTIALS.teachingQualification,
    });
  }
  if (credentials.length) node.hasCredential = credentials;
  if (CREDENTIALS.alumniOf) node.alumniOf = CREDENTIALS.alumniOf;

  return node;
}

function businessNode(lang) {
  const node = {
    '@type': ['LocalBusiness', 'EducationalOrganization'],
    '@id': BUSINESS_ID,
    name: BUSINESS.name,
    legalName: BUSINESS.legalName,
    vatID: BUSINESS.vatID,
    url: SITE_ORIGIN + pagePath('/index.html', lang),
    logo: { '@type': 'ImageObject', url: `${SITE_ORIGIN}/lwg_logo.svg` },
    image: `${SITE_ORIGIN}/gioia_logo.png`,
    description: DESCRIPTION[lang],
    email: BUSINESS.email,
    address: place().address,
    priceRange: BUSINESS.priceRange,
    areaServed: [
      { '@type': 'City', name: 'Zürich' },
      { '@type': 'Country', name: 'Switzerland' },
      // Online lessons are not bounded by the canton.
      { '@type': 'Place', name: 'Online, worldwide' },
    ],
    knowsLanguage: ['de', 'gsw', 'en'],
    availableLanguage: ['de', 'gsw', 'en'],
    founder: { '@id': PERSON_ID },
    employee: { '@id': PERSON_ID },
    serviceType: SERVICE_TYPES,
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: lang === 'de' ? 'Kurse & Nachhilfe' : 'Courses & tutoring',
      // Inline rather than @id references: the full Course nodes are only on
      // the homepage, and every other page's graph must still resolve.
      itemListElement: Object.values(COURSES).map((course) => ({
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Course',
          name: course.name[lang],
          url: `${homeUrl(lang)}#${course.anchor}`,
        },
      })),
    },
  };
  if (BUSINESS.telephone) node.telephone = BUSINESS.telephone;
  if (BUSINESS.geo) node.geo = BUSINESS.geo;
  return node;
}

function websiteNode(lang) {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: SITE_ORIGIN + '/',
    name: BUSINESS.name,
    description: DESCRIPTION[lang],
    inLanguage: ['de', 'en'],
    publisher: { '@id': BUSINESS_ID },
  };
}

function courseNode(id, lang) {
  const data = { ...COURSE_DEFAULTS, ...COURSES[id] };
  const url = `${homeUrl(lang)}#${data.anchor}`;

  const instance = (mode, price, category) => {
    const node = {
      '@type': 'CourseInstance',
      courseMode: mode,
      courseWorkload: data.workload,
      instructor: { '@id': PERSON_ID },
    };
    if (mode === 'onsite') node.location = place();
    if (!data.priceOnRequest) {
      node.offers = {
        '@type': 'Offer',
        price,
        priceCurrency: 'CHF',
        category,
        availability: 'https://schema.org/InStock',
      };
    }
    return node;
  };

  // Every course is taught both in person and online, at the same rate.
  const instances = [];
  for (const mode of ['onsite', 'online']) {
    if (data.priceOnRequest) {
      instances.push(instance(mode));
    } else {
      instances.push(
        instance(mode, data.priceGroup, data.categoryGroup),
        instance(mode, data.priceSolo, data.categorySolo)
      );
    }
  }

  return {
    '@type': 'Course',
    // Several courses share an anchor, so the id carries the course key.
    '@id': `${homeUrl(lang)}#course-${id}`,
    name: data.name[lang],
    description: data.description?.[lang] || DESCRIPTION[lang],
    url,
    inLanguage: data.language,
    teaches: data.name.en,
    provider: { '@id': BUSINESS_ID },
    offers: data.priceOnRequest
      ? undefined
      : {
          '@type': 'Offer',
          price: data.priceGroup,
          priceCurrency: 'CHF',
          category: data.categoryGroup,
        },
    hasCourseInstance: instances,
  };
}

function breadcrumbNode(page, lang) {
  if (page === '/index.html') return null;
  const navKey = Object.entries(ROUTES).find(([p]) => p === page);
  const label = pages[page]?.text?.h1?.[lang] || pages[page]?.title?.[lang] || navKey?.[1] || '';
  return {
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: nav.home[lang],
        item: SITE_ORIGIN + pagePath('/index.html', lang),
      },
      { '@type': 'ListItem', position: 2, name: stripTags(label) },
    ],
  };
}

function learningResourceNode(page, lang) {
  const entry = pages[page] || {};
  const url = SITE_ORIGIN + pagePath(page, lang);
  return {
    '@type': 'LearningResource',
    '@id': url + '#resource',
    name: stripTags(entry.text?.['.page-header h1']?.[lang] || entry.title?.[lang] || ''),
    description: entry.description?.[lang] || '',
    url,
    inLanguage: 'de',
    isAccessibleForFree: true,
    learningResourceType: 'Interactive exercise',
    educationalLevel: 'CEFR A1–C2',
    teaches: stripTags(entry.text?.['.page-header h1']?.[lang] || ''),
    provider: { '@id': BUSINESS_ID },
    author: { '@id': PERSON_ID },
  };
}

const LEARNING_RESOURCES = [
  '/modalpartikeln.html',
  '/subjunktionen.html',
  '/konjunktionen.html',
  '/niveaus.html',
];

function stripTags(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .trim();
}

// Builds the full @graph for a page. Returns a JSON string ready to inline.
// Only questions that are actually rendered on the page may be marked up —
// Google treats hidden FAQ markup as a violation, and an assistant that quotes
// an answer the visitor cannot find is worse than one that quotes nothing. The
// two come from one source (FAQ in _i18n-content.js) so they cannot diverge.
// The questions are rendered in the homepage #faq section (as a collapsed
// accordion, which Google accepts: the answers are in the HTML and a reader
// can expand them), so the homepage is the only document that may carry the
// markup.
// About and the FAQ are one section now, and the personal answers are rendered
// in the same accordion as the rest, so they are marked up alongside them.
const FAQ_GROUPS_BY_PAGE = {
  '/index.html': ['personal', 'courses', 'swiss', 'online', 'gymi', 'company'],
};

function faqNode(page, lang) {
  const groups = FAQ_GROUPS_BY_PAGE[page];
  if (!groups) return null;
  const items = groups.flatMap((group) => FAQ[group] || []);
  if (!items.length) return null;

  return {
    '@type': 'FAQPage',
    '@id': `${SITE_ORIGIN}${pagePath(page, lang)}#faq`,
    inLanguage: lang,
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: stripTags(item.q[lang]),
      // Answers may carry a link; the markup wants the prose an assistant can
      // quote, not the anchor. An answer's `extra` (the course-structure
      // figure, its sources) is deliberately left out for the same reason.
      acceptedAnswer: { '@type': 'Answer', text: stripTags(item.a[lang]) },
    })),
  };
}

// The one-to-one offering: a format rather than a course, described in the
// homepage's language-courses section.
const PRIVATE_LESSONS = {
  name: { en: 'Private one-to-one language lessons', de: 'Einzelunterricht für Sprachen' },
  description: {
    en: 'One-to-one German, Swiss German and English lessons in Zürich and online, CHF 120 per 60 minutes.',
    de: 'Einzelunterricht in Deutsch, Schweizerdeutsch und Englisch in Zürich und online, CHF 120 pro 60 Minuten.',
  },
};

function privateLessonsNode(lang) {
  return {
    '@type': 'Service',
    '@id': `${homeUrl(lang)}#service-private-lessons`,
    url: `${homeUrl(lang)}#language-courses`,
    serviceType: PRIVATE_LESSONS.name[lang],
    name: PRIVATE_LESSONS.name[lang],
    description: PRIVATE_LESSONS.description[lang],
    provider: { '@id': BUSINESS_ID },
    areaServed: [
      { '@type': 'City', name: 'Zürich' },
      { '@type': 'Place', name: 'Online, worldwide' },
    ],
    availableLanguage: ['de', 'gsw', 'en'],
    offers: {
      '@type': 'Offer',
      price: '120',
      priceCurrency: 'CHF',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: '120',
        priceCurrency: 'CHF',
        unitText: lang === 'de' ? 'pro 60 Minuten' : 'per 60 minutes',
      },
      availability: 'https://schema.org/InStock',
    },
  };
}

export function schemaFor(page, lang) {
  const graph = [businessNode(lang), personNode(lang), websiteNode(lang)];

  // The homepage describes every course, so it carries every Course node.
  if (page === '/index.html') {
    for (const id of Object.keys(COURSES)) graph.push(courseNode(id, lang));
    graph.push(privateLessonsNode(lang));
  }
  if (LEARNING_RESOURCES.includes(page)) graph.push(learningResourceNode(page, lang));

  const faq = faqNode(page, lang);
  if (faq) graph.push(faq);

  const breadcrumb = breadcrumbNode(page, lang);
  if (breadcrumb) graph.push(breadcrumb);

  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, (key, value) =>
    value === undefined ? undefined : value
  );
}
