// JSON-LD graph, injected inline server-side by _render.js.
//
// Replaces public/index-structured-data.js and public/course-structured-data.js,
// which built their blocks in the browser and were therefore invisible to every
// crawler that does not execute JavaScript.
//
// One @graph per document with stable @ids, so the nodes reference each other
// instead of repeating themselves.

import { pages, pagePath, ROUTES, nav } from './_i18n-content.js';

export const SITE_ORIGIN = 'https://learningwithgioia.ch';

const BUSINESS_ID = `${SITE_ORIGIN}/#business`;
const PERSON_ID = `${SITE_ORIGIN}/#gioia`;
const WEBSITE_ID = `${SITE_ORIGIN}/#website`;

// Verified facts only. Everything marked TODO needs confirmation from Gioia
// before it is published — do not guess these.
export const BUSINESS = {
  name: 'Learning with Gioia',
  legalName: 'Birukoff World', // impressum.html
  email: 'info@learningwithgioia.ch',
  street: 'Wildbachstrasse 65', // impressum.html
  postalCode: '8008',
  city: 'Zürich',
  country: 'CH',
  vatID: 'CHE-396.783.072', // impressum.html
  priceRange: 'CHF 50–4800',
  founderName: 'Gioia', // TODO: full name for the Person node?
  telephone: null, // TODO: publish a phone number? Strong local-SEO signal.
  sameAs: [], // TODO: Instagram / LinkedIn / Google Business Profile URLs.
  geo: null, // TODO: lat/lng, once the address is confirmed as publishable.
};

const DESCRIPTION = {
  en: 'German and Swiss German courses, Gymivorbereitung, exam preparation and tutoring in Zürich and online. Taught by a native Swiss German and German speaker born and raised in Zürich, with associate teachers holding linguistics degrees and formal teaching qualifications.',
  de: 'Deutsch- und Schweizerdeutschkurse, Gymivorbereitung, Prüfungsvorbereitung und Nachhilfe in Zürich und online. Unterrichtet von einer in Zürich geborenen und aufgewachsenen Muttersprachlerin für Schweizerdeutsch und Deutsch, mit Lehrpersonen mit sprachwissenschaftlichem Studium und formaler Lehrqualifikation.',
};

const PERSON_DESCRIPTION = {
  en: 'Founder of Learning with Gioia. Born and raised in Zürich, native speaker of both Swiss German and German, teaching German, Swiss German and English in Zürich and online.',
  de: 'Gründerin von Learning with Gioia. In Zürich geboren und aufgewachsen, Muttersprachlerin für Schweizerdeutsch und Deutsch, unterrichtet Deutsch, Schweizerdeutsch und Englisch in Zürich und online.',
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
  'Tutoring',
];

// Course facts, previously carried as data-course-* attributes on <body>. Held
// here so the graph can be built while writing <head>, before <body> is parsed.
const COURSE_DEFAULTS = {
  workload: 'PT32H',
  priceGroup: '1600',
  priceSolo: '3840',
  categoryGroup: 'group course, per person',
  categorySolo: 'one-to-one',
  online: true,
};

export const COURSES = {
  '/german-courses.html': { name: 'German courses', language: 'de' },
  '/swiss-german.html': { name: 'Swiss German courses', language: 'gsw' },
  '/english-courses.html': { name: 'English courses', language: 'en' },
  '/gymivorbereitung.html': {
    name: 'Gymivorbereitung',
    language: 'de',
    workload: 'PT1H',
    priceGroup: '80',
    priceSolo: '120',
    categoryGroup: 'group course, per 60 min, per person',
    categorySolo: 'one-to-one, per 60 min',
  },
  '/exam-preparation.html': {
    name: 'Exam preparation',
    language: 'en',
    workload: 'PT40H',
    priceGroup: '2000',
    priceSolo: '4800',
  },
  '/company-courses.html': {
    name: 'Company language courses',
    language: 'en',
    workload: 'PT100H',
    priceOnRequest: true,
  },
  '/lunch-time-german.html': {
    name: 'Build your own German course (lunchtime, intensive)',
    language: 'de',
    workload: 'PT1H',
    priceGroup: '50',
    priceSolo: '120',
  },
};

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
      'Exam preparation',
    ],
    worksFor: { '@id': BUSINESS_ID },
  };
  if (BUSINESS.sameAs.length) node.sameAs = BUSINESS.sameAs;
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
      itemListElement: Object.keys(COURSES).map((page) => ({
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Course',
          name: pages[page]?.title?.[lang] || COURSES[page].name,
          url: SITE_ORIGIN + pagePath(page, lang),
        },
      })),
    },
  };
  if (BUSINESS.telephone) node.telephone = BUSINESS.telephone;
  if (BUSINESS.sameAs.length) node.sameAs = BUSINESS.sameAs;
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

function courseNode(page, lang) {
  const data = { ...COURSE_DEFAULTS, ...COURSES[page] };
  const entry = pages[page] || {};
  const url = SITE_ORIGIN + pagePath(page, lang);

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

  const instances = data.priceOnRequest
    ? [instance('onsite')]
    : [
        instance('onsite', data.priceGroup, data.categoryGroup),
        instance('onsite', data.priceSolo, data.categorySolo),
      ];
  if (data.online) {
    instances.push(
      data.priceOnRequest
        ? instance('online')
        : instance('online', data.priceSolo, data.categorySolo)
    );
  }

  return {
    '@type': 'Course',
    '@id': url + '#course',
    name: data.name,
    description: entry.description?.[lang] || DESCRIPTION[lang],
    url,
    inLanguage: data.language,
    teaches: data.name,
    provider: { '@id': BUSINESS_ID },
    offers: data.priceOnRequest
      ? undefined
      : { '@type': 'Offer', price: data.priceGroup, priceCurrency: 'CHF' },
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
export function schemaFor(page, lang) {
  const graph = [businessNode(lang), personNode(lang), websiteNode(lang)];

  if (COURSES[page]) graph.push(courseNode(page, lang));
  if (LEARNING_RESOURCES.includes(page)) graph.push(learningResourceNode(page, lang));

  const breadcrumb = breadcrumbNode(page, lang);
  if (breadcrumb) graph.push(breadcrumb);

  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, (key, value) =>
    value === undefined ? undefined : value
  );
}
