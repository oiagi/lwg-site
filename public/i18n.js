// Translation map: nav/common are shared; pages is keyed by page path, each entry has title/description/text.
// text keys are CSS selectors; values are { en, de } strings (may contain HTML).
(function () {
  'use strict';

  const SUPPORTED = ['en', 'de'];
  const ROUTES = {
    '/index.html': '',
    '/german-courses.html': 'german-courses',
    '/swiss-german.html': 'swiss-german',
    '/gymivorbereitung.html': 'gymivorbereitung',
    '/english-courses.html': 'english-courses',
    '/exam-preparation.html': 'exam-preparation',
    '/company-courses.html': 'company-courses',
    '/group-courses.html': 'group-courses',
    '/enquiry.html': 'enquiry',
    '/thankyou.html': 'thankyou',
    '/impressum.html': 'impressum',
    '/datenschutzerklaerung.html': 'datenschutzerklaerung',
    '/agb.html': 'agb',
    '/modalpartikeln.html': 'modalpartikeln',
    '/subjunktionen.html': 'subjunktionen',
    '/konjunktionen.html': 'konjunktionen',
    '/niveaus.html': 'niveaus',
    '/intake.html': 'intake',
  };
  const PAGE_BY_ROUTE = Object.entries(ROUTES).reduce((acc, [page, slug]) => {
    acc[slug] = page;
    return acc;
  }, {});
  function hasRoute(page) {
    return Object.prototype.hasOwnProperty.call(ROUTES, page);
  }
  const DEFAULT_BY_PAGE = {
    '/impressum.html': 'de',
    '/datenschutzerklaerung.html': 'de',
    '/agb.html': 'de',
    '/modalpartikeln.html': 'de',
    '/subjunktionen.html': 'de',
    '/konjunktionen.html': 'de',
    '/niveaus.html': 'de',
  };

  function splitPath(pathname) {
    const parts = pathname.split('/').filter(Boolean);
    const lang = SUPPORTED.includes(parts[0]) ? parts[0] : null;
    const routeParts = lang ? parts.slice(1) : parts;
    return { lang, route: routeParts.join('/') };
  }

  function normalisePageKey(pathname) {
    const { route } = splitPath(pathname);
    const cleanRoute = route.replace(/\/$/, '');
    if (!cleanRoute) return '/index.html';
    if (PAGE_BY_ROUTE[cleanRoute]) return PAGE_BY_ROUTE[cleanRoute];
    if (cleanRoute.endsWith('.html')) return '/' + cleanRoute;
    return '/' + cleanRoute + '.html';
  }

  function pageKey() {
    return normalisePageKey(window.location.pathname);
  }

  function pagePath(page, lang) {
    const safeLang = SUPPORTED.includes(lang) ? lang : currentLang;
    const slug = hasRoute(page) ? ROUTES[page] : page.replace(/^\//, '').replace(/\.html$/, '');
    return '/' + safeLang + (slug ? '/' + slug : '/');
  }

  function getUrlLang() {
    const pathLang = splitPath(window.location.pathname).lang;
    if (pathLang) return pathLang;
    const queryLang = new URLSearchParams(window.location.search).get('lang');
    return SUPPORTED.includes(queryLang) ? queryLang : null;
  }

  function getInitialLang() {
    const fromUrl = getUrlLang();
    if (fromUrl) return fromUrl;
    const stored = localStorage.getItem('lwg-lang');
    if (SUPPORTED.includes(stored)) return stored;
    return DEFAULT_BY_PAGE[pageKey()] || document.documentElement.lang || 'en';
  }

  let currentLang = SUPPORTED.includes(getInitialLang()) ? getInitialLang() : 'en';

  const nav = {
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
    courseStructure: { en: 'course structure', de: 'Kursstruktur' },
    levels: { en: 'your level', de: 'Dein Niveau' },
    reviews: { en: 'reviews', de: 'Stimmen' },
    about: { en: 'about', de: 'Über mich' },
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

  const common = {
    updated: { en: 'Updated: 3 May 2026', de: 'Stand: 3. Mai 2026' },
    email: { en: 'Email', de: 'E-Mail' },
  };

  const pages = {
    '/index.html': {
      title: {
        en: 'Learning with Gioia - Language Courses & Tutoring in Zürich',
        de: 'Learning with Gioia - Sprachkurse & Nachhilfe in Zürich',
      },
      description: {
        en: 'German and Swiss German courses, Gymivorbereitung, exam preparation and tutoring in Zürich. Native-speaking teachers with linguistics degrees and formal teaching qualifications.',
        de: 'Deutsch- und Schweizerdeutschkurse, Gymivorbereitung, Prüfungsvorbereitung und Nachhilfe in Zürich. Muttersprachliche Lehrpersonen mit sprachwissenschaftlichem Studium und formaler Lehrqualifikation.',
      },
      text: {
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
        '#offer .offer-card__cta': { en: 'learn more →', de: 'mehr erfahren →' },
        '#offer-details .kicker': { en: 'good to know', de: 'Gut zu wissen' },
        '#offer-details .section-title': {
          en: 'Course structure',
          de: 'Kursstruktur',
        },
        '#structure-hours': {
          en: 'Progressing through a full level (e.g. from A0 to A1) typically takes around 100-150 hours** of guided learning, alongside a similar amount of independent study.',
          de: 'Um ein vollständiges Sprachniveau abzudecken (z. B. von A0 zu A1), benötigt man in der Regel etwa 100-150 Stunden** angeleitetes Lernen plus eine ähnliche Menge an selbstständigem Lernen.',
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
          en: '~100-150 h guided learning',
          de: '~100-150 Std. angeleitetes Lernen',
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
          en: 'Not sure where to start? The six CEFR levels, A1 to C2, describe what you can do in a language. Our interactive self-assessment helps you find your current level — the perfect starting point for choosing the right course.',
          de: 'Du weisst nicht, wo du starten sollst? Die sechs Niveaus des GER, A1 bis C2, beschreiben, was du in einer Sprache kannst. Unser interaktives Selbsteinschätzungsraster hilft dir, dein aktuelles Niveau zu finden — der perfekte Ausgangspunkt für den passenden Kurs.',
        },
        '#levels-cta': { en: 'find your level', de: 'Niveau herausfinden' },
        '#materials .kicker': { en: 'materials', de: 'Materialien' },
        '#materials .section-title': {
          en: 'Free learning materials',
          de: 'Kostenlose Lernmaterialien',
        },
        '#materials-intro': {
          en: 'Small interactive guides we built for our students — free for everyone. Reference, quiz and cheat sheet included.',
          de: 'Kleine interaktive Guides, die wir für unsere Lernenden gebaut haben — kostenlos für alle. Mit Übersicht, Quiz und Spickzettel.',
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
          en: 'Something went wrong — please try again later.',
          de: 'Etwas ist schiefgelaufen — bitte versuche es später erneut.',
        },
        '#review-success': {
          en: 'Thank you! Your review will appear here once it has been checked.',
          de: 'Danke! Deine Bewertung erscheint hier, sobald sie geprüft wurde.',
        },
        '#about .kicker': { en: 'about', de: 'Über mich' },
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
      },
    },
    '/enquiry.html': {
      title: {
        en: 'Make an Enquiry - Learning with Gioia',
        de: 'Anfrage senden - Learning with Gioia',
      },
      description: {
        en: 'Make a quick enquiry with Learning with Gioia - language courses, exam prep and tutoring in Zürich.',
        de: 'Sende eine kurze Anfrage an Learning with Gioia - für Sprachkurse, Prüfungsvorbereitung und Nachhilfe in Zürich.',
      },
      text: {
        h1: { en: 'make an enquiry', de: 'Anfrage senden' },
        'label[for="lesson-type"]': { en: 'what are you looking for?', de: 'Wonach suchst du?' },
        '#lesson-type': {
          en: 'e.g. German A2 course, IELTS exam prep, Maths tutoring - Gymnasium year 9, Gymivorbereitung grade 6...',
          de: 'z. B. Deutschkurs A2, IELTS-Vorbereitung, Mathe-Nachhilfe - Gymnasium 2. Klasse, Gymivorbereitung 6. Klasse...',
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
          en: 'Something went wrong - please try again or email us at <a href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
          de: 'Etwas ist schiefgelaufen - bitte versuche es erneut oder schreibe uns an <a href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
        },
      },
    },
    '/group-courses.html': {
      title: {
        en: 'Open Group Courses - Learning with Gioia',
        de: 'Offene Gruppenkurse - Learning with Gioia',
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
      title: { en: 'Thank You - Learning with Gioia', de: 'Danke - Learning with Gioia' },
      description: {
        en: 'Your enquiry has been received. We will be in touch shortly.',
        de: 'Deine Anfrage ist bei uns eingetroffen. Wir melden uns bald.',
      },
      text: {
        '#success-state h1': { en: 'thank you.', de: 'Danke.' },
        '#success-state p:nth-of-type(1)': {
          en: "We've received your message and will contact you shortly to discuss your enquiry.",
          de: 'Wir haben deine Nachricht erhalten und melden uns bald, um deine Anfrage zu besprechen.',
        },
        '#success-state p:nth-of-type(2)': {
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
        en: 'Imprint - Learning with Gioia',
        de: 'Impressum - Learning with Gioia',
      },
      description: {
        en: 'Legal information for Learning with Gioia / Birukoff World, sole proprietorship in Zürich.',
        de: 'Impressum von Learning with Gioia / Birukoff World, Einzelfirma in Zürich.',
      },
      text: {
        h1: { en: 'Imprint', de: 'Impressum' },
        '.legal-meta': common.updated,
        '.legal-section:nth-of-type(1) h2': { en: 'Provider', de: 'Anbieterin' },
        '.legal-section:nth-of-type(1) address': {
          en: '<strong>Birukoff World</strong><br>Sole proprietorship<br>Wildbachstrasse 65<br>8008 Zürich<br>Switzerland',
          de: '<strong>Birukoff World</strong><br>Einzelfirma<br>Wildbachstrasse 65<br>8008 Zürich<br>Schweiz',
        },
        '.legal-section:nth-of-type(2) h2': { en: 'Contact', de: 'Kontakt' },
        '.legal-section:nth-of-type(3) h2': { en: 'Register', de: 'Register' },
        '.legal-section:nth-of-type(3) p': {
          en: 'UID: CHE-396.783.072<br>Commercial register entry: CH-020.1.105.662-3',
          de: 'UID: CHE-396.783.072<br>Handelsregistereintrag: CH-020.1.105.662-3',
        },
        '.legal-section:nth-of-type(4) h2': { en: 'Responsibility', de: 'Verantwortung' },
        '.legal-section:nth-of-type(4) p': {
          en: 'Birukoff World is responsible for the content of this website. Despite careful checks, we accept no liability for the content of external links. The operators of linked pages are solely responsible for their content.',
          de: 'Birukoff World ist für die Inhalte dieser Website verantwortlich. Trotz sorgfältiger Kontrolle übernehmen wir keine Haftung für Inhalte externer Links. Für den Inhalt verlinkter Seiten sind ausschliesslich deren Betreiberinnen und Betreiber verantwortlich.',
        },
      },
    },
    '/datenschutzerklaerung.html': {
      title: {
        en: 'Privacy Policy - Learning with Gioia',
        de: 'Datenschutzerklärung - Learning with Gioia',
      },
      description: {
        en: 'Privacy policy for Learning with Gioia / Birukoff World.',
        de: 'Datenschutzerklärung von Learning with Gioia / Birukoff World.',
      },
      text: {
        h1: { en: 'Privacy Policy', de: 'Datenschutzerklärung' },
        '.legal-meta': common.updated,
        '.legal-section:nth-of-type(1) h2': { en: 'Controller', de: 'Verantwortliche Stelle' },
        '.legal-section:nth-of-type(1) address': {
          en: '<strong>Birukoff World</strong><br>Sole proprietorship<br>Wildbachstrasse 65<br>8008 Zürich<br>Switzerland<br><a href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>',
          de: '<strong>Birukoff World</strong><br>Einzelfirma<br>Wildbachstrasse 65<br>8008 Zürich<br>Schweiz<br><a href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>',
        },
        '.legal-section:nth-of-type(2) h2': { en: 'Principle', de: 'Grundsatz' },
        '.legal-section:nth-of-type(2) p': {
          en: 'We process personal data only insofar as this is necessary to operate this website, answer enquiries, organise courses and provide our services. We comply with the Swiss Data Protection Act (DSG) and, where applicable, further data protection regulations.',
          de: 'Wir bearbeiten Personendaten nur soweit dies für den Betrieb dieser Website, die Beantwortung von Anfragen, die Organisation von Kursen und die Erbringung unserer Dienstleistungen erforderlich ist. Dabei beachten wir das Schweizer Datenschutzgesetz (DSG) und, soweit anwendbar, weitere Datenschutzvorschriften.',
        },
        '.legal-section:nth-of-type(3) h2': { en: 'Data processed', de: 'Bearbeitete Daten' },
        '.legal-section:nth-of-type(3) div': {
          en: '<p>Depending on how you use the website and our services, we may process in particular the following data:</p><ul class="legal-list"><li>Contact details such as name, email address, telephone number and address.</li><li>Information about desired courses, language level, learning goals, bookings, appointments and participation.</li><li>Administrative course and billing data where required for providing our services.</li><li>Technical data such as IP address, browser, device, date, time and pages accessed.</li></ul>',
          de: '<p>Je nach Nutzung der Website und unserer Dienstleistungen können insbesondere folgende Daten bearbeitet werden:</p><ul class="legal-list"><li>Kontaktangaben wie Name, E-Mail-Adresse, Telefonnummer und Adresse.</li><li>Angaben zu gewünschten Kursen, Sprachniveau, Lernzielen, Buchungen, Terminen und Teilnahme.</li><li>Administrative Kurs- und Rechnungsdaten, soweit sie für die Durchführung unserer Dienstleistungen erforderlich sind.</li><li>Technische Daten wie IP-Adresse, Browser, Gerät, Datum, Uhrzeit und aufgerufene Seiten.</li></ul>',
        },
        '.legal-section:nth-of-type(4) h2': { en: 'Purposes', de: 'Zwecke' },
        '.legal-section:nth-of-type(4) div': {
          en: '<p>We use personal data in particular for the following purposes:</p><ul class="legal-list"><li>Processing and answering enquiries.</li><li>Planning, providing and managing lessons, courses and appointments.</li><li>Communication with prospective clients, clients, customers and teachers.</li><li>Sending confirmations, course information, schedules and certificates.</li><li>Operating, securing, troubleshooting and improving the website.</li><li>Fulfilling legal, accounting and contractual obligations.</li></ul>',
          de: '<p>Wir verwenden Personendaten insbesondere für folgende Zwecke:</p><ul class="legal-list"><li>Bearbeitung und Beantwortung von Anfragen.</li><li>Planung, Durchführung und Verwaltung von Unterricht, Kursen und Terminen.</li><li>Kommunikation mit Interessentinnen, Interessenten, Kundinnen, Kunden und Lehrpersonen.</li><li>Versand von Bestätigungen, Kursinformationen, Terminplänen und Zertifikaten.</li><li>Betrieb, Sicherheit, Fehleranalyse und Verbesserung der Website.</li><li>Erfüllung gesetzlicher, buchhalterischer und vertraglicher Pflichten.</li></ul>',
        },
        '.legal-section:nth-of-type(5) h2': { en: 'Forms', de: 'Formulare' },
        '.legal-section:nth-of-type(5) p': {
          en: 'When you submit an enquiry, intake or other form, we store and process the data you enter. This data is used to answer your enquiry, organise suitable courses or appointments and manage our business relationship.',
          de: 'Wenn Sie ein Anfrage-, Intake- oder anderes Formular absenden, speichern und bearbeiten wir die von Ihnen eingegebenen Daten. Diese Daten werden verwendet, um Ihre Anfrage zu beantworten, passende Kurse oder Termine zu organisieren und unsere Geschäftsbeziehung zu verwalten.',
        },
        '.legal-section:nth-of-type(6) h2': { en: 'Service providers', de: 'Dienstleister' },
        '.legal-section:nth-of-type(6) div': {
          en: '<p>We may use carefully selected service providers for the operation of our website and services, in particular:</p><ul class="legal-list"><li>Cloudflare for hosting, delivery, security and server functions.</li><li>Supabase for database and authentication functions.</li><li>Resend for sending transactional emails.</li><li>Google Calendar for appointment and course planning.</li><li>Google Fonts for displaying the fonts used.</li></ul><p>Personal data may also be disclosed to countries outside Switzerland and the European Economic Area. In such cases, we pay attention to appropriate safeguards or legally provided grounds for transfer.</p>',
          de: '<p>Für den Betrieb unserer Website und Dienstleistungen können wir sorgfältig ausgewählte Dienstleister einsetzen, insbesondere:</p><ul class="legal-list"><li>Cloudflare für Hosting, Auslieferung, Sicherheit und Serverfunktionen.</li><li>Supabase für Datenbank- und Authentifizierungsfunktionen.</li><li>Resend für den Versand transaktionaler E-Mails.</li><li>Google Calendar für Termin- und Kursplanung.</li><li>Google Fonts für die Darstellung der verwendeten Schriftarten.</li></ul><p>Dabei können Personendaten auch in Länder ausserhalb der Schweiz und des Europäischen Wirtschaftsraums bekanntgegeben werden. In solchen Fällen achten wir auf angemessene Garantien oder gesetzlich vorgesehene Grundlagen für die Übermittlung.</p>',
        },
        '.legal-section:nth-of-type(7) h2': { en: 'Cookies and logs', de: 'Cookies und Logs' },
        '.legal-section:nth-of-type(7) p': {
          en: 'This website may use technically necessary cookies, local browser data and server log data to provide functions, prevent misuse, analyse errors and ensure the security of the service. We do not use our own tracking or analytics cookies for advertising purposes.',
          de: 'Diese Website kann technisch notwendige Cookies, lokale Browserdaten und Server-Logdaten verwenden, um Funktionen bereitzustellen, Missbrauch zu verhindern, Fehler zu analysieren und die Sicherheit des Angebots zu gewährleisten. Wir verwenden keine eigenen Tracking- oder Analyse-Cookies zu Werbezwecken.',
        },
        '.legal-section:nth-of-type(8) h2': { en: 'Retention', de: 'Aufbewahrung' },
        '.legal-section:nth-of-type(8) p': {
          en: 'We retain personal data only for as long as required for the stated purposes, as long as statutory retention obligations exist, or as long as legitimate interests such as documentation, evidence preservation and contract processing require it.',
          de: 'Wir bewahren Personendaten nur so lange auf, wie es für die genannten Zwecke erforderlich ist, gesetzliche Aufbewahrungspflichten bestehen oder berechtigte Interessen wie Dokumentation, Beweissicherung und Vertragsabwicklung dies erfordern.',
        },
        '.legal-section:nth-of-type(9) h2': { en: 'Your rights', de: 'Ihre Rechte' },
        '.legal-section:nth-of-type(9) p': {
          en: 'Within the scope of applicable data protection law, you may request information about your personal data, have inaccurate data corrected, request deletion or restriction of processing and object to processing. Please contact us at <a href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
          de: 'Sie können im Rahmen des anwendbaren Datenschutzrechts Auskunft über Ihre Personendaten verlangen, unrichtige Daten berichtigen lassen, die Löschung oder Einschränkung der Bearbeitung verlangen und einer Bearbeitung widersprechen. Bitte kontaktieren Sie uns dafür unter <a href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
        },
        '.legal-section:nth-of-type(10) h2': { en: 'Changes', de: 'Änderungen' },
        '.legal-section:nth-of-type(10) p': {
          en: 'We may amend this privacy policy at any time, in particular if our data processing, the services used or legal requirements change. The version published on this website applies.',
          de: 'Wir können diese Datenschutzerklärung jederzeit anpassen, insbesondere wenn sich unsere Datenbearbeitungen, die eingesetzten Dienste oder rechtliche Anforderungen ändern. Es gilt die jeweils auf dieser Website veröffentlichte Fassung.',
        },
      },
    },
  };

  pages['/agb.html'] = {
    title: { en: 'Terms & Conditions - Learning with Gioia', de: 'AGB - Learning with Gioia' },
    description: {
      en: 'Terms and conditions of Learning with Gioia / Birukoff World.',
      de: 'Allgemeine Geschäftsbedingungen von Learning with Gioia / Birukoff World.',
    },
  };

  // ── Course detail pages ─────────────────────────────────────────
  // They share the tailored-programme note and CTAs; heading, intro and
  // meta always differ. Courses with a non-standard structure (exam
  // preparation) pass `facts` to override individual fact rows.
  const courseFacts = {
    '.kicker': { en: 'courses & tutoring', de: 'Kurse & Nachhilfe' },
    '#fact-duration-label': { en: 'course duration', de: 'Kursdauer' },
    '#fact-duration-value': { en: '4 months', de: '4 Monate' },
    '#fact-lessons-label': { en: 'lessons of 60 min', de: 'Lektionen à 60 Min.' },
    '#fact-group-label': { en: 'group (3-5)', de: 'Gruppe (3-5)' },
    '#fact-group-unit': { en: 'per person', de: 'pro Person' },
    '#fact-solo-label': { en: 'private', de: 'Einzelunterricht' },
    '#fact-solo-unit': { en: 'total', de: 'gesamt' },
    '#course-tailored': {
      en: 'You prefer a different schedule or programme? We offer fully tailored programmes. Contact us today to find the best schedule for you.',
      de: 'Du wünschst dir einen anderen Zeitplan oder ein anderes Programm? Wir bieten vollständig massgeschneiderte Programme. Kontaktiere uns noch heute, damit wir den passenden Plan für dich finden.',
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
        en: 'German Courses in Zürich - Learning with Gioia',
        de: 'Deutschkurse in Zürich - Learning with Gioia',
      },
      description: {
        en: 'German courses in Zürich from A0 to C2, taught by native speakers. 32 lessons of 60 minutes over 4 months - CHF 1600 in a group, CHF 3840 one-to-one.',
        de: 'Deutschkurse in Zürich von A0 bis C2, unterrichtet von Muttersprachlerinnen und Muttersprachlern. 32 Lektionen à 60 Minuten in 4 Monaten - CHF 1600 in der Gruppe, CHF 3840 im Einzelunterricht.',
      },
      h1: { en: 'German courses', de: 'Deutschkurse' },
      intro: {
        en: 'German for everyday life, work and study, from complete beginner (A0) to advanced (C2). Taught exclusively by native speakers with linguistics degrees and formal teaching qualifications.',
        de: 'Deutsch für Alltag, Beruf und Studium, von A0 bis C2. Unterrichtet ausschliesslich von Muttersprachlerinnen und Muttersprachlern mit sprachwissenschaftlichem Studium und formaler Lehrqualifikation.',
      },
    }),
    '/swiss-german.html': coursePage({
      title: {
        en: 'Swiss German Courses in Zürich - Learning with Gioia',
        de: 'Schweizerdeutschkurse in Zürich - Learning with Gioia',
      },
      description: {
        en: 'Swiss German courses in Zürich taught by native speakers. 32 lessons of 60 minutes over 4 months - CHF 1600 in a group, CHF 3840 one-to-one.',
        de: 'Schweizerdeutschkurse in Zürich, unterrichtet von Muttersprachlerinnen und Muttersprachlern. 32 Lektionen à 60 Minuten in 4 Monaten - CHF 1600 in der Gruppe, CHF 3840 im Einzelunterricht.',
      },
      h1: { en: 'Swiss German', de: 'Schweizerdeutsch' },
      intro: {
        en: 'Our Swiss German courses taught by native speakers will help you follow conversations, join in… and finally feel at home in Swiss everyday life!',
        de: 'Unsere Schweizerdeutschkurse, unterrichtet von Muttersprachlerinnen und Muttersprachlern, helfen dir, Gesprächen zu folgen, mitzureden … und dich im Schweizer Alltag endlich zuhause zu fühlen!',
      },
    }),
    '/gymivorbereitung.html': coursePage({
      title: {
        en: 'Gymivorbereitung in Zürich - Learning with Gioia',
        de: 'Gymivorbereitung in Zürich - Learning with Gioia',
      },
      description: {
        en: 'Gymivorbereitung in Zürich, in small groups or one-to-one. 32 lessons of 60 minutes over 4 months - CHF 1600 in a group, CHF 3840 one-to-one.',
        de: 'Gymivorbereitung in Zürich, in kleinen Gruppen oder im Einzelunterricht. 32 Lektionen à 60 Minuten in 4 Monaten - CHF 1600 in der Gruppe, CHF 3840 im Einzelunterricht.',
      },
      h1: { en: 'Gymivorbereitung', de: 'Gymivorbereitung' },
      intro: {
        en: 'The road to Gymnasium starts long before exam day. We prepare pupils step by step: closing gaps, practising with the exam format, and building the calm confidence it takes to perform on the day. In small groups or one-to-one, always tailored to your child.',
        de: 'Der Weg ans Gymnasium beginnt lange vor dem Prüfungstag. Wir bereiten Schülerinnen und Schüler Schritt für Schritt vor: Lücken schliessen, mit dem Prüfungsformat üben und die nötige Ruhe und Sicherheit aufbauen. In kleinen Gruppen oder im Einzelunterricht, immer abgestimmt auf dein Kind.',
      },
    }),
    '/english-courses.html': coursePage({
      title: {
        en: 'English Courses in Zürich - Learning with Gioia',
        de: 'Englischkurse in Zürich - Learning with Gioia',
      },
      description: {
        en: 'English courses and tutoring in Zürich, from beginner (A1) to advanced (C2). 32 lessons of 60 minutes over 4 months - CHF 1600 in a group, CHF 3840 one-to-one.',
        de: 'Englischkurse und Nachhilfe in Zürich, von A1 bis C2. 32 Lektionen à 60 Minuten in 4 Monaten - CHF 1600 in der Gruppe, CHF 3840 im Einzelunterricht.',
      },
      h1: { en: 'English courses', de: 'Englischkurse' },
      intro: {
        en: 'English for school, work and everyday life, from beginner (A1) to advanced (C2). Tutoring from primary school to university, always tailored to what you need next.',
        de: 'Englisch für Schule, Beruf und Alltag, von A1 bis C2. Nachhilfe von der Primarschule bis zur Universität, immer abgestimmt auf das, was als Nächstes ansteht.',
      },
    }),
    '/exam-preparation.html': coursePage({
      title: {
        en: 'Exam Preparation in Zürich - Learning with Gioia',
        de: 'Prüfungsvorbereitung in Zürich - Learning with Gioia',
      },
      description: {
        en: 'Preparation for Cambridge, TOEFL, IELTS, TELC and Goethe exams in Zürich. 40 lessons of 60 minutes over 5 months - CHF 2000 in a group, CHF 4800 one-to-one.',
        de: 'Vorbereitung auf Cambridge, TOEFL, IELTS, TELC und Goethe in Zürich. 40 Lektionen à 60 Minuten in 5 Monaten - CHF 2000 in der Gruppe, CHF 4800 im Einzelunterricht.',
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
        en: 'Company Language Courses in Zürich - Learning with Gioia',
        de: 'Firmenkurse in Zürich - Learning with Gioia',
      },
      description: {
        en: 'Language courses for companies and teams in Zürich, at your offices or ours. 32 lessons of 60 minutes over 4 months - CHF 1600 in a group, CHF 3840 one-to-one.',
        de: 'Sprachkurse für Firmen und Teams in Zürich, bei euch im Büro oder bei uns. 32 Lektionen à 60 Minuten in 4 Monaten - CHF 1600 in der Gruppe, CHF 3840 im Einzelunterricht.',
      },
      h1: { en: 'Company courses', de: 'Firmenkurse' },
      intro: {
        en: 'Language training for teams, at your offices or ours. We build the programme around your industry, your everyday work and the situations your people actually face - from client meetings to small talk in the corridor.',
        de: 'Sprachtraining für Teams, bei euch im Büro oder bei uns. Wir bauen das Programm rund um eure Branche, euren Arbeitsalltag und die Situationen auf, die bei euch wirklich vorkommen - vom Kundengespräch bis zum Small Talk auf dem Gang.',
      },
    }),
  });

  Object.assign(pages, {
    '/intake.html': {
      title: {
        en: 'Student Intake - Learning with Gioia',
        de: 'Schülerangaben - Learning with Gioia',
      },
      text: {
        '#intake-loading': { en: 'loading...', de: 'Wird geladen...' },
        '#intake-content h1': { en: 'your details', de: 'Deine Angaben' },
        '.intake-intro': {
          en: 'Please fill in or confirm the information below so we can keep your records up to date. Fields marked * are required.',
          de: 'Bitte fülle die folgenden Angaben aus oder bestätige sie, damit wir deine Daten aktuell halten können. Felder mit * sind erforderlich.',
        },
        '#intake-content > .section-label:nth-of-type(2)': {
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
        '#intake-content > .section-label:nth-of-type(3)': {
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
        '#intake-content > .section-label:nth-of-type(4)': {
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
          en: 'Something went wrong - please try again or email us at <a href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
          de: 'Etwas ist schiefgelaufen - bitte versuche es erneut oder schreibe uns an <a href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
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
    '/modalpartikeln.html': {
      title: { en: 'Modal particles', de: 'Modalpartikeln' },
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
          en: 'Modal particles always stand in the <strong>middle field</strong> of the sentence - usually before <em>auch</em> or <em>nicht</em>, before modal and local details, and before words or information that belong directly to the verb.',
          de: 'Modalpartikeln stehen immer im <strong>Mittelfeld</strong> des Satzes - meist vor <em>auch</em> oder <em>nicht</em>, bzw. vor Modal- und Lokalangaben und vor den <em>Verbgefährten</em> (Wörter und Informationen, die direkt zum Verb gehören oder direkt mit ihm verbunden sind).',
        },
      },
    },
    '/subjunktionen.html': {
      title: { en: 'Subjunctions', de: 'Subjunktionen' },
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
      title: { en: 'Conjunctions', de: 'Konjunktionen' },
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

  const runtime = {
    groupCoursesLoading: { en: 'loading courses...', de: 'Kurse werden geladen...' },
    groupCoursesLoadError: {
      en: 'Could not load group courses right now.',
      de: 'Gruppenkurse konnten gerade nicht geladen werden.',
    },
    groupCoursesNoSpots: {
      en: 'currently there are no spots available in planned or ongoing group courses :(',
      de: 'Aktuell sind leider keine Plätze in geplanten oder laufenden Gruppenkursen verfügbar :(',
    },
    groupCoursesEnquiry: { en: 'make an enquiry ->', de: 'Anfrage senden ->' },
    groupCoursesStarts: { en: 'starts', de: 'Start' },
    groupCoursesNextLesson: { en: 'next', de: 'Nächste' },
    groupCoursesTimeSlot: { en: 'time', de: 'Zeit' },
    groupCoursesWeeklySlot: { en: 'weekly slot', de: 'wöchentlicher Termin' },
    groupCoursesFormingCourse: {
      en: 'group course interest',
      de: 'Interesse an Gruppenkurs',
    },
    groupCoursesChooseLevel: { en: 'choose your level', de: 'Niveau wählen' },
    groupCoursesChooseLocation: { en: 'choose location', de: 'Ort wählen' },
    groupCoursesStartsWhenReady: {
      en: 'tell us your preferred level and location',
      de: 'Teile uns dein gewünschtes Niveau und deinen gewünschten Ort mit',
    },
    groupCoursesInterest: { en: 'interest', de: 'Interesse' },
    groupCoursesNeeded: { en: 'needed', de: 'benötigt' },
    groupCoursesLessons: { en: 'lessons', de: 'Lektionen' },
    groupCoursesNumberOfLessons: { en: 'number of lessons', de: 'Anzahl Lektionen' },
    groupCoursesCompleted: { en: 'completed', de: 'abgeschlossen' },
    groupCoursesRemaining: { en: 'remaining', de: 'verbleibend' },
    groupCoursesOpenEnded: { en: 'open-ended', de: 'offen' },
    groupCoursesPlace: { en: 'place', de: 'Ort' },
    groupCoursesSpots: { en: 'spots', de: 'Plätze' },
    groupCoursesSpot: { en: 'spot', de: 'Platz' },
    groupCoursesAvailable: { en: 'available', de: 'frei' },
    groupCoursesMaxPeople: { en: 'max. 5 people', de: 'max. 5 Personen' },
    groupCoursesPerPerson: { en: 'per person / 60min', de: 'pro Person / 60 Min.' },
    groupCoursesBook: { en: 'request spot ->', de: 'Platz anfragen ->' },
    groupCoursesRegisterInterest: { en: 'register interest ->', de: 'Interesse anmelden ->' },
    groupCoursesSelected: { en: 'selected course', de: 'Ausgewählter Kurs' },
    groupCoursesSelectedSlot: { en: 'selected time slot', de: 'Ausgewählter Termin' },
    groupCoursesCodeTitle: { en: 'company booking code', de: 'Buchungscode der Firma' },
    groupCoursesCodeCopy: {
      en: 'Have a code from your company? Enter it here to see your group booking options.',
      de: 'Hast du einen Code von deiner Firma? Gib ihn hier ein, um deine Buchungsoptionen zu sehen.',
    },
    groupCoursesCodePlaceholder: { en: 'booking code', de: 'Buchungscode' },
    groupCoursesUnlock: { en: 'unlock', de: 'freischalten' },
    groupCoursesUnlocking: { en: 'unlocking...', de: 'Wird freigeschaltet...' },
    groupCoursesCodeRequired: {
      en: 'Please enter your booking code.',
      de: 'Bitte gib deinen Buchungscode ein.',
    },
    groupCoursesCodeInvalid: {
      en: 'No group booking options were found for this code.',
      de: 'Für diesen Code wurden keine Gruppenkursoptionen gefunden.',
    },
    groupCoursesCodeUnlocked: {
      en: (count) => `${count} company booking option${count === 1 ? '' : 's'} unlocked.`,
      de: (count) => `${count} Firmen-Buchungsoption${count === 1 ? '' : 'en'} freigeschaltet.`,
    },
    groupCoursesCodeUnlockedLabel: {
      en: (label, count) =>
        `${count} booking option${count === 1 ? '' : 's'} unlocked for ${label}.`,
      de: (label, count) =>
        `${count} Buchungsoption${count === 1 ? '' : 'en'} für ${label} freigeschaltet.`,
    },
    groupCoursesCompanyOption: { en: 'company option', de: 'Firmenoption' },
    groupCoursesReducedLessonsHint: {
      en: 'Should fewer than three people sign up, the number of lessons will be reduced to match the monetary value of a course for a group of three. The adjusted lesson count is rounded down.',
      de: 'Falls sich weniger als drei Personen anmelden, wird die Anzahl Lektionen so reduziert, dass sie dem monetären Wert eines Kurses für drei Personen entspricht. Die angepasste Lektionenzahl wird abgerundet.',
    },
    groupCoursesReducedLessonsHintDetail: {
      en: (full, two, one) =>
        `This slot is planned as ${full} lessons with at least three people. If only two people join, it will be reduced to ${two} lessons; if only one person joins, to ${one} lessons. The adjusted count is rounded down.`,
      de: (full, two, one) =>
        `Dieser Termin ist mit ${full} Lektionen ab drei Personen geplant. Bei nur zwei Personen wird auf ${two} Lektionen reduziert, bei nur einer Person auf ${one} Lektionen. Die angepasste Anzahl wird abgerundet.`,
    },
    groupCoursesSubmitting: { en: 'sending...', de: 'Wird gesendet...' },
    groupCoursesServerError: {
      en: 'Something went wrong. Please try again or email info@learningwithgioia.ch.',
      de: 'Etwas ist schiefgelaufen. Bitte versuche es erneut oder schreibe an info@learningwithgioia.ch.',
    },
    groupCoursesUnavailable: {
      en: 'This course is no longer available for direct booking.',
      de: 'Dieser Kurs ist nicht mehr direkt buchbar.',
    },
    groupCoursesSuccessTitle: { en: 'thank you.', de: 'Danke.' },
    groupCoursesSuccessBody: {
      en: 'Your booking request has been received. We will confirm your request shortly.',
      de: 'Deine Buchungsanfrage ist eingegangen. Wir bestätigen deine Anfrage so schnell wie möglich.',
    },
    enquiryPhone: { en: 'phone', de: 'Telefon' },
    enquiryPhoneOptional: { en: 'phone (optional)', de: 'Telefon (optional)' },
    enquirySubmitting: { en: 'sending…', de: 'Wird gesendet…' },
    makeEnquiry: { en: 'make an enquiry ->', de: 'Anfrage senden ->' },
    reviewSubmitting: { en: 'sending…', de: 'Wird gesendet…' },
    reviewReadMore: { en: 'read more', de: 'mehr lesen' },
    reviewReadLess: { en: 'show less', de: 'weniger anzeigen' },
  };

  function setMeta(name, value) {
    const meta = document.querySelector(`meta[name="${name}"]`);
    if (meta) meta.setAttribute('content', value);
  }

  function setProperty(property, value) {
    const meta = document.querySelector(`meta[property="${property}"]`);
    if (meta) meta.setAttribute('content', value);
  }

  function currentCleanSearch() {
    const params = new URLSearchParams(window.location.search);
    params.delete('lang');
    const value = params.toString();
    return value ? '?' + value : '';
  }

  function localizedUrl(page, lang) {
    return pagePath(page, lang) + currentCleanSearch() + window.location.hash;
  }

  function syncBrowserUrl(mode) {
    const page = pageKey();
    if (!hasRoute(page) || !window.history || !window.history[mode]) return;
    const nextUrl = localizedUrl(page, currentLang);
    const currentUrl = window.location.pathname + window.location.search + window.location.hash;
    if (nextUrl !== currentUrl) {
      window.history[mode](null, '', nextUrl);
    }
  }

  function setLink(rel, href, hreflang) {
    const selector = hreflang ? `link[rel="${rel}"][hreflang="${hreflang}"]` : `link[rel="${rel}"]`;
    let link = document.querySelector(selector);
    if (!link) {
      link = document.createElement('link');
      link.rel = rel;
      if (hreflang) link.hreflang = hreflang;
      document.head.appendChild(link);
    }
    link.href = href;
  }

  function absolutePageUrl(page, lang) {
    return window.location.origin + pagePath(page, lang);
  }

  function syncSeoLinks() {
    const page = pageKey();
    if (!hasRoute(page)) return;
    const canonical = absolutePageUrl(page, currentLang);
    setLink('canonical', canonical);
    setLink('alternate', absolutePageUrl(page, 'en'), 'en');
    setLink('alternate', absolutePageUrl(page, 'de'), 'de');
    setLink('alternate', absolutePageUrl(page, 'en'), 'x-default');
    setProperty('og:url', canonical);
  }

  function localizeInternalLinks(root) {
    const scope = root || document;
    scope.querySelectorAll('a[href]').forEach((link) => {
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:'))
        return;
      const url = new URL(href, window.location.origin);
      if (url.origin !== window.location.origin) return;
      const page = normalisePageKey(url.pathname);
      if (!hasRoute(page)) return;
      link.href = pagePath(page, currentLang) + url.search + url.hash;
    });
  }

  function applyEntry(entry) {
    if (!entry) return;
    if (entry.title) {
      const title = entry.title[currentLang];
      document.title = title;
      setProperty('og:title', title);
      setMeta('twitter:title', title);
    }
    if (entry.description) {
      const description = entry.description[currentLang];
      setMeta('description', description);
      setProperty('og:description', description);
      setMeta('twitter:description', description);
    }
    Object.entries(entry.text || {}).forEach(([selector, copy]) => {
      document.querySelectorAll(selector).forEach((el) => {
        const value = copy[currentLang];
        if (copy.attr) {
          el.setAttribute(copy.attr, value);
        } else {
          el.innerHTML = value;
        }
      });
    });
  }

  function apply() {
    document.documentElement.lang = currentLang;
    applyEntry(pages[pageKey()]);
    syncSeoLinks();
    localizeInternalLinks(document);
    document.dispatchEvent(
      new CustomEvent('lwg:language-applied', { detail: { lang: currentLang } })
    );
  }

  function setLang(lang) {
    if (!SUPPORTED.includes(lang)) return;
    currentLang = lang;
    localStorage.setItem('lwg-lang', lang);
    syncBrowserUrl('pushState');
    apply();
  }

  function t(key, lang) {
    const value = (nav[key] || runtime[key] || {})[lang || currentLang];
    return typeof value === 'function' ? value : value || key;
  }

  window.LWG_I18N = {
    apply,
    getLang: () => currentLang,
    getPageKey: pageKey,
    href: pagePath,
    localizeInternalLinks,
    normalisePageKey,
    setLang,
    nav,
    runtime,
    t,
    translateRuntime(key, ...args) {
      const value = runtime[key] && runtime[key][currentLang];
      return typeof value === 'function' ? value(...args) : value || key;
    },
  };

  function boot() {
    localStorage.setItem('lwg-lang', currentLang);
    syncBrowserUrl('replaceState');
    apply();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.addEventListener('popstate', () => {
    const lang = getUrlLang();
    if (lang && lang !== currentLang) {
      currentLang = lang;
      localStorage.setItem('lwg-lang', lang);
      apply();
    }
  });
})();
