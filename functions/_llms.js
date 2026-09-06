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

// Courses, about and FAQ are sections of the homepage rather than pages, so
// those entries carry an anchor and their own title and description. A plain
// string is a page key looked up in the copy dictionary.
const SECTIONS = [
  {
    heading: 'Courses and services',
    items: [
      '/index.html',
      {
        anchor: 'language-courses',
        title: { en: 'Language courses', de: 'Sprachkurse' },
        description: {
          en: 'German, Swiss German and English from A0 to C2, plus exam preparation (Goethe, TELC, FIDE, Cambridge, TOEFL, IELTS). Other languages on request, taught by a teacher sourced from the school’s network. Group, one-to-one, company or fully tailored; in Zürich, at your offices, at your home or online. Group CHF 50 per person per 60 min, one-to-one CHF 120.',
          de: 'Deutsch, Schweizerdeutsch und Englisch von A0 bis C2, plus Prüfungsvorbereitung (Goethe, TELC, FIDE, Cambridge, TOEFL, IELTS). Andere Sprachen auf Anfrage, unterrichtet von einer Lehrperson aus dem Netzwerk der Schule. Gruppe, Einzelunterricht, Firmenkurs oder massgeschneidert; in Zürich, im Büro, zu Hause oder online. Gruppe CHF 50 pro Person pro 60 Min., Einzelunterricht CHF 120.',
        },
      },
      {
        anchor: 'tutoring',
        title: { en: 'Tutoring', de: 'Nachhilfe' },
        description: {
          en: 'Tutoring in every subject taught in Swiss schools: primary school, secondary school, Gymnasium and BMS, in Zürich or online. Group (3–7) CHF 80 per person per 60 min, one-to-one CHF 120 per 60 min.',
          de: 'Nachhilfe in allen Fächern, die an Schweizer Schulen unterrichtet werden: Primarschule, Sekundarschule, Gymnasium und BMS, in Zürich oder online. Gruppe (3–7) CHF 80 pro Person pro 60 Min., Einzelunterricht CHF 120 pro 60 Min.',
        },
      },
      {
        anchor: 'gymivorbereitung',
        title: { en: 'Gymivorbereitung', de: 'Gymivorbereitung' },
        description: {
          en: 'Preparation for the Gymiprüfung, the Gymnasium entrance exam in canton Zürich, in Mathematics and German. 12 or 20 teaching days of three hours each (36 and 60 lessons respectively), once or twice a week. Taught in Zürich Seefeld or online. Group (3–7 children) CHF 80 per person per 60 min, one-to-one CHF 150 per 60 min.',
          de: 'Vorbereitung auf die Gymiprüfung, die Aufnahmeprüfung ans Gymnasium im Kanton Zürich, in Mathematik und Deutsch. 12 oder 20 Unterrichtstage à drei Stunden (36 bzw. 60 Lektionen), ein- oder zweimal pro Woche. Unterricht in Zürich Seefeld oder online. Gruppe (3–7 Kinder) CHF 80 pro Person pro 60 Min., Einzelunterricht CHF 150 pro 60 Min.',
        },
      },
    ],
  },
  {
    heading: 'Booking and information',
    items: [
      '/group-courses.html',
      '/enquiry.html',
      {
        anchor: 'enquiry',
        title: { en: 'Book a free 15-minute call', de: 'Kostenloses 15-Minuten-Gespräch buchen' },
        description: {
          en: 'Pick a slot for a short introductory call, Zürich time.',
          de: 'Wählen Sie einen Termin für ein kurzes Kennenlerngespräch, Zürcher Zeit.',
        },
      },
      {
        anchor: 'about',
        title: { en: 'About Learning with Gioia', de: 'Über Learning with Gioia' },
        description: {
          en: 'Who teaches, in the founder’s own words: what she studied, why she started teaching, how her earlier work in finance feeds into it, and her degrees. The FAQ below is part of the same section.',
          de: 'Wer unterrichtet, in den Worten der Gründerin: was sie studiert hat, warum sie zu unterrichten begann, wie ihre frühere Arbeit im Finanzsektor dabei hilft, und ihre Abschlüsse. Die häufigen Fragen sind Teil desselben Abschnitts.',
        },
      },
      {
        anchor: 'faq',
        title: { en: 'Frequently asked questions', de: 'Häufige Fragen' },
        description: {
          en: 'Answers on courses offered, how long a level takes, finding your level, private versus group, group sizes, minimum participants, exams, learning German in Switzerland alongside Swiss German, online lessons, Gymivorbereitung and company courses.',
          de: 'Antworten zum Kursangebot, zur Dauer eines Niveaus, zur Niveaubestimmung, zu Einzel- gegenüber Gruppenunterricht, Gruppengrössen, Mindestteilnehmenden, Prüfungen, Deutschlernen in der Schweiz neben Schweizerdeutsch, Online-Unterricht, Gymivorbereitung und Firmenkursen.',
        },
      },
      {
        anchor: 'levels',
        title: { en: 'Which level fits you?', de: 'Welches Niveau passt zu Ihnen?' },
        description: {
          en: 'The six CEFR levels, A1 to C2, and a link to the interactive self-assessment.',
          de: 'Die sechs GER-Niveaus, A1 bis C2, und der Link zur interaktiven Selbsteinschätzung.',
        },
      },
      '/niveaus.html',
    ],
  },
  {
    heading: 'Free learning materials',
    items: ['/modalpartikeln.html', '/subjunktionen.html', '/konjunktionen.html'],
  },
  {
    heading: 'Legal',
    items: ['/impressum.html', '/datenschutzerklaerung.html', '/agb.html'],
  },
];

function line(item, lang) {
  if (typeof item === 'string') {
    const entry = pages[item];
    if (!entry || !ROUTES[item]) return null;
    const title = entry.title[lang].replace(/\s*[—-]\s*Learning with Gioia\s*$/, '');
    return `- [${title}](${SITE_ORIGIN}${pagePath(item, lang)}): ${entry.description[lang]}`;
  }
  const url = `${SITE_ORIGIN}${pagePath('/index.html', lang)}#${item.anchor}`;
  return `- [${item.title[lang]}](${url}): ${item.description[lang]}`;
}

export function buildLlmsTxt(lang = 'en') {
  const out = [
    `# ${BUSINESS.name}`,
    '',
    '> A language school in Zürich, Switzerland, teaching German, Swiss German and English,',
    '> plus Gymivorbereitung (preparation for the Gymnasium entrance exam in canton Zürich),',
    '> exam preparation and tutoring in all subjects taught in Swiss schools. Courses run in',
    '> small groups, one-to-one, in-house at companies, and online.',
    '',
    '## Key facts',
    '',
    `- Founded and run by ${BUSINESS.founderName}, who was born and raised in Zürich and is a native speaker of both Swiss German and German. This is the distinguishing fact about the school: Swiss German has no standard written form and cannot be learnt from a textbook, so it has to be taught by someone who grew up speaking it.`,
    `- ${BUSINESS.founderName} holds an MA in Russian Studies from University College London and a BA in Russian Language and Literature from the University of Zürich, and is completing a teaching diploma (Lehrdiplom) at the University of Zürich.`,
    '- Associate teachers hold linguistics degrees and formal teaching qualifications. German is taught exclusively by native speakers.',
    `- Location: ${BUSINESS.street}, ${BUSINESS.postalCode} ${BUSINESS.city}, Switzerland. Lessons also take place at client offices and online, worldwide.`,
    `- Contact: ${BUSINESS.email}`,
    ...(BUSINESS.telephone ? [`- Telephone: ${BUSINESS.telephone}`] : []),
    `- Legal entity: ${BUSINESS.legalName}, VAT ${BUSINESS.vatID}`,
    '- Languages taught: German (A0–C2), Swiss German, English (A1–C2). Other languages are arranged on request through the school’s teacher network.',
    '- Exams prepared for: Goethe, TELC, FIDE, Cambridge, TOEFL, IELTS.',
    '- Tutoring: all subjects taught in Swiss schools — primary school, secondary school, Gymnasium and BMS — plus Gymivorbereitung.',
    '- Lessons take place in the school’s classrooms in Zürich, at client offices, at the learner’s home, or online.',
    '- Site languages: English at /en/, German at /de/. The German copy uses the formal Sie throughout. The courses, and the about section with the FAQ inside it, are sections of the homepage, linked below by anchor.',
    '',
    '## Prices',
    '',
    '- Standard language courses (German, Swiss German, English, exam preparation): CHF 50 per person per 60 minutes in a group of 3–5, CHF 120 per 60 minutes one-to-one.',
    '- A regular group block is 32 lessons of 60 minutes over 4 months (CHF 1600 per person); an exam preparation block is 40 lessons over 5 months.',
    '- Tutoring in school subjects: CHF 80 per person per 60 minutes in a group of 3–7, CHF 120 per 60 minutes one-to-one.',
    '- Gymivorbereitung: CHF 80 per person per 60 minutes in a group of 3–7 children, CHF 150 per 60 minutes one-to-one. Taught in Mathematics and German over 12 or 20 teaching days of 3 hours (36 or 60 lessons), once or twice a week, in Zürich Seefeld or online.',
    '- Company courses and fully tailored programmes: on request. Around 100 lessons per level, commonly 2 × 60 minutes per week.',
    '- Online lessons cost the same as in-person lessons.',
    '- A group course runs from 3 participants. A free 15-minute introductory call is available.',
  ];

  for (const section of SECTIONS) {
    const lines = section.items.map((item) => line(item, lang)).filter(Boolean);
    if (!lines.length) continue;
    out.push('', `## ${section.heading}`, '', ...lines);
  }

  out.push(
    '',
    '## Notes',
    '',
    '- Every page is served as complete server-rendered HTML in the language of its URL prefix; no JavaScript is required to read the content.',
    `- Structured data (JSON-LD) is embedded inline on every page; the homepage graph carries one Course node per course. The sitemap is at ${SITE_ORIGIN}/sitemap.xml.`,
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
