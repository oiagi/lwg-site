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
  priceRange: 'CHF 50–4800',
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
  // e.g. { en: 'MA in Linguistics', de: 'MA in Sprachwissenschaft' }
  degree: null, // TODO(gioia): what you studied
  // e.g. { '@type': 'CollegeOrUniversity', name: 'Universität Zürich' }
  alumniOf: null, // TODO(gioia): where you studied
  // e.g. 'SVEB 1' or a teaching diploma.
  teachingQualification: null, // TODO(gioia): teaching qualification
  // Year teaching started, as a number, e.g. 2016. Rendered as a duration so
  // the copy never goes stale.
  teachingSince: null, // TODO(gioia): year you started teaching
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
  // Online only: no onsite CourseInstance, so the page cannot be read as
  // offering a Zürich classroom slot it does not have.
  '/online-lessons.html': {
    name: 'Online German and Swiss German lessons',
    language: 'de',
    onlineOnly: true,
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

  const credentials = [];
  if (CREDENTIALS.degree) {
    credentials.push({
      '@type': 'EducationalOccupationalCredential',
      credentialCategory: 'degree',
      name: CREDENTIALS.degree[lang],
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

  const instances = [];
  if (!data.onlineOnly) {
    if (data.priceOnRequest) {
      instances.push(instance('onsite'));
    } else {
      instances.push(
        instance('onsite', data.priceGroup, data.categoryGroup),
        instance('onsite', data.priceSolo, data.categorySolo)
      );
    }
  }
  if (data.online || data.onlineOnly) {
    if (data.priceOnRequest) {
      instances.push(instance('online'));
    } else {
      instances.push(
        instance('online', data.priceGroup, data.categoryGroup),
        instance('online', data.priceSolo, data.categorySolo)
      );
    }
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
// Only questions that are actually rendered on the page may be marked up —
// Google treats hidden FAQ markup as a violation, and an assistant that quotes
// an answer the visitor cannot find is worse than one that quotes nothing. The
// two come from one source (FAQ in _i18n-content.js) so they cannot diverge.
const FAQ_GROUPS_BY_PAGE = {
  '/faq.html': ['courses', 'online', 'gymi', 'company', 'booking'],
  '/online-lessons.html': ['online'],
  '/private-lessons.html': ['booking'],
  '/company-courses.html': ['company'],
  '/gymivorbereitung.html': ['gymi'],
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
      name: item.q[lang],
      acceptedAnswer: { '@type': 'Answer', text: item.a[lang] },
    })),
  };
}

function aboutNode(lang) {
  return {
    '@type': 'AboutPage',
    '@id': `${SITE_ORIGIN}${pagePath('/about.html', lang)}#about`,
    inLanguage: lang,
    name: pages['/about.html'].title[lang],
    description: pages['/about.html'].description[lang],
    // The point of the page: it is the document that describes the Person.
    mainEntity: { '@id': PERSON_ID },
    about: [{ '@id': PERSON_ID }, { '@id': BUSINESS_ID }],
    isPartOf: { '@id': WEBSITE_ID },
  };
}

// The one-to-one offering, which until now existed only as a price tile.
function privateLessonsNode(lang) {
  return {
    '@type': 'Service',
    '@id': `${SITE_ORIGIN}${pagePath('/private-lessons.html', lang)}#service`,
    serviceType:
      lang === 'de' ? 'Einzelunterricht für Sprachen' : 'Private one-to-one language lessons',
    name: pages['/private-lessons.html'].title[lang],
    description: pages['/private-lessons.html'].description[lang],
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

  if (COURSES[page]) graph.push(courseNode(page, lang));
  if (LEARNING_RESOURCES.includes(page)) graph.push(learningResourceNode(page, lang));
  if (page === '/about.html') graph.push(aboutNode(lang));
  if (page === '/private-lessons.html') graph.push(privateLessonsNode(lang));

  const faq = faqNode(page, lang);
  if (faq) graph.push(faq);

  const breadcrumb = breadcrumbNode(page, lang);
  if (breadcrumb) graph.push(breadcrumb);

  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, (key, value) =>
    value === undefined ? undefined : value
  );
}
