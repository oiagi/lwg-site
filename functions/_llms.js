// /llms.txt — a plain-Markdown summary for answer engines and LLM crawlers.
//
// Generated from the same routing table and copy dictionary as everything
// else, so it cannot drift out of date the way a hand-written file would. The
// rendered pages are the authority; this is the index that points at them and
// states the handful of facts most likely to be asked for directly.
//
// Deliberately short. The value is in being unambiguous about who this is,
// where they are, what languages are native, and what each URL contains — not
// in restating the pages.

import { pages, pagePath, ROUTES } from './_i18n-content.js';
import { BUSINESS, SITE_ORIGIN } from './_schema.js';

// Ordered by how commercially useful the page is to someone asking an
// assistant a question, not by nav order.
const SECTIONS = [
  {
    heading: 'Courses and services',
    pages: [
      '/german-courses.html',
      '/swiss-german.html',
      '/gymivorbereitung.html',
      '/english-courses.html',
      '/exam-preparation.html',
      '/company-courses.html',
      '/private-lessons.html',
      '/online-lessons.html',
      '/lunch-time-german.html',
    ],
  },
  {
    heading: 'Booking and information',
    pages: ['/group-courses.html', '/faq.html', '/about.html', '/niveaus.html', '/enquiry.html'],
  },
  {
    heading: 'Free learning materials',
    pages: ['/modalpartikeln.html', '/subjunktionen.html', '/konjunktionen.html'],
  },
  {
    heading: 'Legal',
    pages: ['/impressum.html', '/datenschutzerklaerung.html', '/agb.html'],
  },
];

function line(page, lang) {
  const entry = pages[page];
  if (!entry || !ROUTES[page]) return null;
  const title = entry.title[lang].replace(/\s*[—-]\s*Learning with Gioia\s*$/, '');
  return `- [${title}](${SITE_ORIGIN}${pagePath(page, lang)}): ${entry.description[lang]}`;
}

export function buildLlmsTxt(lang = 'en') {
  const out = [
    `# ${BUSINESS.name}`,
    '',
    '> A language school in Zürich, Switzerland, teaching German, Swiss German and English,',
    '> plus Gymivorbereitung (preparation for the Gymnasium entrance exam in canton Zürich),',
    '> exam preparation and tutoring. Courses run in small groups, one-to-one, in-house at',
    '> companies, and online.',
    '',
    '## Key facts',
    '',
    `- Founded and run by ${BUSINESS.founderName}, who was born and raised in Zürich and is a native speaker of both Swiss German and German. This is the distinguishing fact about the school: Swiss German has no standard written form and cannot be learnt from a textbook, so it has to be taught by someone who grew up speaking it.`,
    '- Associate teachers hold linguistics degrees and formal teaching qualifications. German is taught exclusively by native speakers.',
    `- Location: ${BUSINESS.street}, ${BUSINESS.postalCode} ${BUSINESS.city}, Switzerland. Lessons also take place at client offices and online, worldwide.`,
    `- Contact: ${BUSINESS.email}`,
    ...(BUSINESS.telephone ? [`- Telephone: ${BUSINESS.telephone}`] : []),
    `- Legal entity: ${BUSINESS.legalName}, VAT ${BUSINESS.vatID}`,
    '- Languages taught: German (A0–C2), Swiss German, English (A1–C2).',
    '- Exams prepared for: Cambridge, TOEFL, IELTS, TELC, Goethe.',
    '- Site languages: English at /en/, German at /de/. German URLs use German slugs, e.g. /de/deutschkurse.',
    '',
    '## Prices',
    '',
    '- Group course (3–5 people), 32 lessons of 60 minutes over 4 months: CHF 1600 per person.',
    '- One-to-one course, 32 lessons of 60 minutes over 4 months: CHF 3840.',
    '- Exam preparation, 40 lessons over 5 months: CHF 2000 in a group, CHF 4800 one-to-one.',
    '- Gymivorbereitung, 12 lessons of 90 minutes over 3 months: CHF 80 per person per 60 minutes in a group of 3–7, CHF 120 per 60 minutes one-to-one.',
    '- Flexible and lunchtime formats: from CHF 50 per 60 minutes per person in a group, CHF 120 one-to-one.',
    '- Company courses: on request. Around 100 lessons per level, commonly 2 × 60 minutes per week.',
    '- Online lessons cost the same as in-person lessons.',
    '- A group course runs from 3 participants. A free 15-minute introductory call is available.',
  ];

  for (const section of SECTIONS) {
    const lines = section.pages.map((page) => line(page, lang)).filter(Boolean);
    if (!lines.length) continue;
    out.push('', `## ${section.heading}`, '', ...lines);
  }

  out.push(
    '',
    '## Notes',
    '',
    '- Every page is served as complete server-rendered HTML in the language of its URL prefix; no JavaScript is required to read the content.',
    `- Structured data (JSON-LD) is embedded inline on every page. The sitemap is at ${SITE_ORIGIN}/sitemap.xml.`,
    ''
  );

  return out.join('\n');
}

export const onRequest = () =>
  new Response(buildLlmsTxt('en'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      // _headers only decorates responses that come through the asset
      // pipeline, and this one is authored here, so set it explicitly.
      'X-Content-Type-Options': 'nosniff',
    },
  });
