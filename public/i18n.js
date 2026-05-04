(function () {
  'use strict';

  const SUPPORTED = ['en', 'de'];
  const ROUTES = {
    '/index.html': '',
    '/info.html': 'info',
    '/group-courses.html': 'group-courses',
    '/enquiry.html': 'enquiry',
    '/thankyou.html': 'thankyou',
    '/impressum.html': 'impressum',
    '/datenschutzerklaerung.html': 'datenschutzerklaerung',
    '/agb.html': 'agb',
    '/modalpartikeln.html': 'modalpartikeln',
    '/sessions.html': 'sessions',
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
    menu: { en: 'menu', de: 'menu' },
    close: { en: 'close', de: 'schliessen' },
    home: { en: 'Home', de: 'Start' },
    info: { en: 'info', de: 'info' },
    groupCourses: { en: 'group courses', de: 'gruppenkurse' },
    enquiry: { en: 'enquiry', de: 'anfrage' },
    materials: { en: 'materials', de: 'materialien' },
    modalpartikeln: { en: 'modal particles', de: 'modalpartikeln' },
    legalLabel: { en: 'Legal pages', de: 'Rechtliche Seiten' },
    impressum: { en: 'Legal Information', de: 'Impressum' },
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
        en: 'Learning with Gioia - Language Courses & Tutoring in Zurich',
        de: 'Learning with Gioia - Sprachkurse & Nachhilfe in Zürich',
      },
      description: {
        en: 'Language courses, exam preparation and tutoring in Zurich. Native-speaking teachers with linguistics degrees and formal teaching qualifications.',
        de: 'Sprachkurse, Prüfungsvorbereitung und Nachhilfe in Zürich. Muttersprachliche Lehrpersonen mit sprachwissenschaftlichem Studium und formaler Lehrqualifikation.',
      },
      text: {
        '.hero-tagline': {
          en: '<em>Language courses, exam preparation &amp; tutoring</em><span class="sep" aria-hidden="true">·</span><em>Zurich</em>',
          de: '<em>Sprachkurse, Prüfungsvorbereitung &amp; Nachhilfe</em><span class="sep" aria-hidden="true">·</span><em>Zürich</em>',
        },
        '.lede p:nth-of-type(1)': {
          en: 'Small groups. Carefully prepared, individually tailored lessons.',
          de: 'Kleine Gruppen. Sorgfältige Vorbereitung, individuell abgestimmter Unterricht.',
        },
        '.lede p:nth-of-type(2)': {
          en: 'We give you the tools to use your knowledge beyond the classroom - and the motivation to actually want to.',
          de: 'Wir trainieren deine Motivation, dein Wissen auch ausserhalb des Unterrichts anzuwenden.',
        },
        '.home-cta': { en: 'Find out more ->', de: 'Mehr erfahren ->' },
      },
    },
    '/info.html': {
      title: {
        en: 'Courses & Pricing - Learning with Gioia',
        de: 'Kurse & Preise - Learning with Gioia',
      },
      description: {
        en: 'German, Swiss German and English language courses, exam preparation and tutoring in Zurich. All levels welcome. Pricing upon request.',
        de: 'Deutsch-, Schweizerdeutsch- und Englischkurse, Prüfungsvorbereitung und Nachhilfe in Zürich. Alle Niveaus willkommen.',
      },
      text: {
        h1: { en: 'what we offer', de: 'was wir anbieten' },
        '.section:nth-of-type(1) h2': { en: 'Language courses', de: 'Sprachkurse' },
        '.section:nth-of-type(1) p': {
          en: 'We offer courses in <strong>German</strong>, <strong>Swiss German</strong>, and <strong>English</strong>, taught exclusively by <strong>native speakers</strong>. All levels are welcome, from complete beginners to advanced learners looking to refine their skills. If you are interested in a language not listed here, please get in touch. We may be able to help.',
          de: 'Wir bieten Kurse in <strong>Deutsch</strong>, <strong>Schweizerdeutsch</strong> und <strong>Englisch</strong> an, ausschliesslich unterrichtet von <strong>Muttersprachlerinnen und Muttersprachlern</strong>. Alle Niveaus sind willkommen, von kompletten Anfängerinnen und Anfängern bis zu Fortgeschrittenen, die ihre Kenntnisse verfeinern möchten. Wenn dich eine Sprache interessiert, die hier nicht aufgeführt ist, melde dich gerne. Vielleicht können wir helfen.',
        },
        '.section:nth-of-type(2) h2': { en: 'Exam preparation', de: 'Prüfungsvorbereitung' },
        '.section:nth-of-type(2) p': {
          en: 'We offer targeted preparation for internationally recognised language exams, including <strong>Cambridge</strong>, <strong>TOEFL</strong>, <strong>IELTS</strong>, <strong>TELC</strong>, and <strong>Goethe</strong>. Courses are tailored to the format and requirements of your chosen exam and are taught in the exam language. If you prefer to be taught in another language, please let us know and we will do our best to accommodate you.',
          de: 'Ob <strong>Cambridge</strong>, <strong>TOEFL</strong>, <strong>IELTS</strong>, <strong>TELC</strong> und <strong>Goethe</strong> - wir bieten gezielte Vorbereitung auf international anerkannte Sprachprüfungen an. Die Kurse werden auf Format und Anforderungen deiner Prüfung abgestimmt und in der Prüfungssprache unterrichtet. Wenn du lieber in einer anderen Sprache unterrichtet werden möchtest, sag uns Bescheid; wir geben unser Bestes, zu helfen.',
        },
        '.section:nth-of-type(3) h2': { en: 'Tutoring', de: 'Nachhilfe' },
        '.section:nth-of-type(3) p': {
          en: 'We provide tutoring support across all educational levels, from primary school through to university. Need ongoing help, targeted exam prep, or <strong>Gymivorbereitung</strong>? No problem! We will work with you to find the right approach.',
          de: 'Wir bieten Nachhilfe auf allen Bildungsstufen an, von Primarschule bis zu Universität. Regelmässige Unterstützung, gezielte Prüfungsvorbereitung oder <strong>Gymivorbereitung</strong>? Kein Problem! Gemeinsam finden wir das passende Angebot.',
        },
        '.section:nth-of-type(4) h2': { en: 'Our teachers', de: 'Unsere Lehrpersonen' },
        '.section:nth-of-type(4) p': {
          en: 'All of our teachers hold or are working towards a university degree and a formal teaching qualification (<strong>Lehrdiplom</strong>). Our language teachers specialise in linguistics, bringing an understanding of how language works (not just how to speak it) to every lesson.',
          de: 'Alle unsere Lehrpersonen haben einen Hochschulabschluss und verfügen über eine formale Lehrqualifikation (<strong>Lehrdiplom</strong>) oder befinden sich in der Ausbildung dahin. Unsere Sprachlehrpersonen spezialisieren sich auf Linguistik und bringen das Verständnis dafür mit, wie Sprache funktioniert - nicht nur, wie man sie spricht.',
        },
        '.section:nth-of-type(5) h2': { en: 'Location', de: 'Ort' },
        '.section:nth-of-type(5) p': {
          en: 'Group classes are held in central Zurich, within easy reach of Zurich HB. The exact venue is confirmed when a course is scheduled. Private, company, and online sessions can of course take place wherever suits you best.*',
          de: 'Gruppenkurse finden zentral in Zürich statt, gut erreichbar vom Zürich HB. Der genaue Ort wird bestätigt, sobald ein Kurs geplant ist. Privat-, Firmen- und Onlinelektionen können natürlich dort stattfinden, wo es für dich am besten passt.*',
        },
        '.section:nth-of-type(5) li': { en: 'Travel fees apply.', de: 'Reisekosten fallen an.' },
        '.section:nth-of-type(6) h2': { en: 'Course structure', de: 'Kursstruktur' },
        '.section:nth-of-type(6) p:nth-of-type(1)': {
          en: 'As a general guide, progressing through a full level, for example from A0 to A1, typically takes around 100-150 hours* of guided learning alongside a similar amount of independent study. Note that at higher levels, regular exposure and contact with native speakers becomes increasingly important alongside formal instruction.',
          de: 'Um ein vollständiges Sprachniveau abzudecken, zum Beispiel von A0 zu A1, benötigt man durchscnittlich etwa 100-150 Stunden* angeleitetes Lernen plus eine ähnliche Menge an selbstständigem Lernen. Auf höheren Niveaus ist regelmässiger Kontakt mit der Sprache und Austausch mit Muttersprachlerinnen und Muttersprachlern neben formalem Unterricht unabdingbar.',
        },
        '.section:nth-of-type(6) p:nth-of-type(2)': {
          en: 'The amount of lessons with Learning with Gioia depends on your goals and schedule. We will discuss this as part of your enquiry.',
          de: 'Wie viele Lektionen mit Learning with Gioia sinnvoll sind, hängt von deinen Zielen und deinem Zeitplan ab. Wir besprechen das im Rahmen deiner Anfrage.',
        },
        '.section:nth-of-type(7) h2': { en: 'Pricing', de: 'Preise' },
        '.pricing-card:nth-child(1) .pricing-card__label': {
          en: 'Individual',
          de: 'Einzelunterricht',
        },
        '.pricing-card:nth-child(1) .pricing-card__unit': { en: 'per 60 min', de: 'pro 60 Min.' },
        '.pricing-card:nth-child(2) .pricing-card__label': { en: '2 people', de: '2 Personen' },
        '.pricing-card:nth-child(2) .pricing-card__unit': {
          en: 'per person / 60 min',
          de: 'pro Person / 60 Min.',
        },
        '.pricing-card:nth-child(3) .pricing-card__label': { en: '3-5 people', de: '3-5 Personen' },
        '.pricing-card:nth-child(3) .pricing-card__unit': {
          en: 'per person / 60 min',
          de: 'pro Person / 60 Min.',
        },
        '.book-cta': { en: 'make an enquiry ->', de: 'anfrage senden ->' },
      },
    },
    '/enquiry.html': {
      title: {
        en: 'Make an Enquiry - Learning with Gioia',
        de: 'Anfrage senden - Learning with Gioia',
      },
      description: {
        en: 'Make a quick enquiry with Learning with Gioia - language courses, exam prep and tutoring in Zurich.',
        de: 'Sende eine kurze Anfrage an Learning with Gioia - für Sprachkurse, Prüfungsvorbereitung und Nachhilfe in Zürich.',
      },
      text: {
        h1: { en: 'make an enquiry', de: 'anfrage senden' },
        'label[for="lesson-type"]': { en: 'what are you looking for?', de: 'wonach suchst du?' },
        '#lesson-type': {
          en: 'e.g. German A2 course, IELTS exam prep, Maths tutoring - Gymnasium year 9, Gymivorbereitung grade 6...',
          de: 'z. B. Deutschkurs A2, IELTS-Vorbereitung, Mathe-Nachhilfe - Gymnasium 2. Klasse, Gymivorbereitung 6. Klasse...',
          attr: 'placeholder',
        },
        '#err-lesson-type': {
          en: 'Please describe what you are looking for.',
          de: 'Bitte beschreibe, wonach du suchst.',
        },
        '.section-label': { en: 'your details', de: 'deine angaben' },
        'label[for="lead-first"]': { en: 'first name', de: 'vorname' },
        'label[for="lead-last"]': { en: 'last name', de: 'nachname' },
        'label[for="lead-email"]': { en: 'email', de: 'e-mail' },
        '#label-lead-phone': { en: 'phone', de: 'telefon' },
        'label[for="preferred-contact"]': {
          en: 'preferred contact method',
          de: 'bevorzugte kontaktart',
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
        '#submit-btn': { en: 'send enquiry ->', de: 'anfrage senden ->' },
        '#submit-error': {
          en: 'Something went wrong - please try again or email us at <a href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
          de: 'Etwas ist schiefgelaufen - bitte versuche es erneut oder schreibe uns an <a href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
        },
      },
    },
    '/group-courses.html': {
      title: {
        en: 'Group Courses Starting Soon - Learning with Gioia',
        de: 'Bald startende Gruppenkurse - Learning with Gioia',
      },
      description: {
        en: 'Book open spots in small group language courses starting soon in Zurich.',
        de: 'Freie Plaetze in bald startenden Kleingruppen-Sprachkursen in Zuerich direkt anfragen.',
      },
      text: {
        h1: { en: 'group courses starting soon', de: 'gruppenkurse mit baldigem start' },
        '.courses-intro': {
          en: 'Small group courses with a maximum of 5 people. Booking requests are handled first come, first served. Your booking will be confirmed within two hours.',
          de: 'Kleine Gruppenkurse mit maximal 5 Personen. Buchungsanfragen werden nach Eingang bearbeitet und vor der Zahlung persoenlich im Backend bestaetigt.',
        },
        '#courses-status': { en: 'loading courses...', de: 'kurse werden geladen...' },
        '#empty-state p': {
          en: 'currently there are no spots available in group courses starting soon :(',
          de: 'aktuell sind leider keine plaetze in bald startenden gruppenkursen frei :(',
        },
        '#empty-state .enquiry-link': { en: 'make an enquiry ->', de: 'anfrage senden ->' },
        '#booking-title': { en: 'your details', de: 'deine angaben' },
        '#booking-cancel': { en: 'cancel', de: 'abbrechen' },
        '#label-booking-request': { en: 'booking request', de: 'buchungsanfrage' },
        '#label-personal': { en: 'personal information', de: 'persoenliche angaben' },
        '#label-emergency': { en: 'emergency contact', de: 'notfallkontakt' },
        '#label-billing': { en: 'billing', de: 'rechnung' },
        '#booking-note': {
          en: 'Your spot is only final after backend confirmation. Payment happens after confirmation.',
          de: 'Dein Platz ist erst nach der Bestaetigung im Backend definitiv. Die Zahlung erfolgt nach der Bestaetigung.',
        },
        'label[for="bf-first-name"]': { en: 'first name *', de: 'vorname *' },
        'label[for="bf-last-name"]': { en: 'last name *', de: 'nachname *' },
        'label[for="bf-email"]': { en: 'email *', de: 'e-mail *' },
        'label[for="bf-phone"]': { en: 'phone', de: 'telefon' },
        'label[for="bf-street"]': { en: 'street', de: 'strasse' },
        'label[for="bf-street-number"]': { en: 'number', de: 'nummer' },
        'label[for="bf-postcode"]': { en: 'postcode', de: 'postleitzahl' },
        'label[for="bf-city"]': { en: 'city', de: 'ort' },
        'label[for="bf-ec-name"]': { en: 'name', de: 'name' },
        'label[for="bf-ec-relationship"]': { en: 'relationship', de: 'beziehung' },
        '#bf-ec-relationship': {
          en: 'e.g. partner, parent',
          de: 'z. B. Partner/in, Elternteil',
          attr: 'placeholder',
        },
        'label[for="bf-ec-phone"]': { en: 'phone', de: 'telefon' },
        'label[for="bf-ec-email"]': { en: 'email', de: 'e-mail' },
        'label[for="bf-billing-name"]': { en: 'billing name', de: 'rechnungsname' },
        'label[for="bf-billing-email"]': { en: 'billing email', de: 'rechnungs-e-mail' },
        'label[for="bf-billing-phone"]': { en: 'billing phone', de: 'rechnungstelefon' },
        'label[for="bf-billing-street"]': { en: 'street', de: 'strasse' },
        'label[for="bf-billing-street-number"]': { en: 'number', de: 'nummer' },
        'label[for="bf-billing-postcode"]': { en: 'postcode', de: 'postleitzahl' },
        'label[for="bf-billing-city"]': { en: 'city', de: 'ort' },
        '.booking-checkbox span': {
          en: 'billing address differs from personal address',
          de: 'rechnungsadresse weicht von persoenlicher adresse ab',
        },
        '.consent-row span': {
          en: 'I agree to the processing of my data for this booking request and accept the <a href="/agb">terms and conditions</a>. *',
          de: 'Ich bin mit der Verarbeitung meiner Daten fuer diese Buchungsanfrage einverstanden und akzeptiere die <a href="/agb">AGB</a>. *',
        },
        '#err-first-name': {
          en: 'Please enter a first name.',
          de: 'Bitte gib einen Vornamen ein.',
        },
        '#err-last-name': {
          en: 'Please enter a last name.',
          de: 'Bitte gib einen Nachnamen ein.',
        },
        '#err-email': {
          en: 'Please enter a valid email address.',
          de: 'Bitte gib eine gueltige E-Mail-Adresse ein.',
        },
        '#err-consent': {
          en: 'Please accept the terms to continue.',
          de: 'Bitte akzeptiere die AGB, um fortzufahren.',
        },
        '#booking-submit': { en: 'request spot ->', de: 'platz anfragen ->' },
        '#success-state h2': { en: 'thank you.', de: 'danke.' },
        '#success-state p': {
          en: 'Your booking request has been received. We will confirm your spot personally before payment is due.',
          de: 'Deine Buchungsanfrage ist eingegangen. Wir bestaetigen deinen Platz persoenlich, bevor eine Zahlung faellig wird.',
        },
      },
    },
    '/thankyou.html': {
      title: { en: 'Thank You - Learning with Gioia', de: 'Danke - Learning with Gioia' },
      description: {
        en: 'Your enquiry has been received. We will be in touch within 48 hours.',
        de: 'Deine Anfrage ist bei uns eingetroffen. Wir melden uns innerhalb von 48 Stunden.',
      },
      text: {
        '#success-state h1': { en: 'thank you.', de: 'danke.' },
        '#success-state p:nth-of-type(1)': {
          en: "We've received your enquiry and will be in touch within 48 hours.",
          de: 'Wir haben deine Anfrage erhalten und melden uns innerhalb von 48 Stunden.',
        },
        '#success-state p:nth-of-type(2)': {
          en: 'We personally review every enquiry to make sure we match you with the right teacher.',
          de: 'Wir prüfen jede Anfrage persönlich, damit wir für dich die passende Lehrperson finden können.',
        },
        '#success-state p:nth-of-type(3)': {
          en: 'If you have any questions in the meantime, write to us at <a href="mailto:info@learningwithgioia.ch" style="color:#1a1614;">info@learningwithgioia.ch</a>.',
          de: 'Wenn du in der Zwischenzeit Fragen hast, schreib uns an <a href="mailto:info@learningwithgioia.ch" style="color:#1a1614;">info@learningwithgioia.ch</a>.',
        },
        '#success-state .home-link': { en: 'back to home', de: 'zurück zur startseite' },
        '#error-state h1': { en: 'something went wrong.', de: 'etwas ist schiefgelaufen.' },
        '#error-state p': {
          en: 'Your enquiry may not have been received. Please try again or email us directly at <a href="mailto:info@learningwithgioia.ch" style="color:#b8492e;">info@learningwithgioia.ch</a>.',
          de: 'Deine Anfrage wurde möglicherweise nicht gesendet. Bitte versuche es erneut oder schreibe uns direkt an <a href="mailto:info@learningwithgioia.ch" style="color:#b8492e;">info@learningwithgioia.ch</a>.',
        },
        '#error-state .home-link': { en: 'try again', de: 'erneut versuchen' },
      },
    },
    '/impressum.html': {
      title: {
        en: 'Legal Information - Learning with Gioia',
        de: 'Impressum - Learning with Gioia',
      },
      description: {
        en: 'Legal information for Learning with Gioia / Birukoff World, sole proprietorship in Zurich.',
        de: 'Impressum von Learning with Gioia / Birukoff World, Einzelfirma in Zürich.',
      },
      text: {
        h1: { en: 'Legal Information', de: 'Impressum' },
        '.legal-meta': common.updated,
        '.legal-section:nth-of-type(1) h2': { en: 'Provider', de: 'Anbieterin' },
        '.legal-section:nth-of-type(1) address': {
          en: '<strong>Birukoff World</strong><br>Sole proprietorship<br>Wildbachstrasse 65<br>8008 Zurich<br>Switzerland',
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
          en: '<strong>Birukoff World</strong><br>Sole proprietorship<br>Wildbachstrasse 65<br>8008 Zurich<br>Switzerland<br><a href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>',
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
    text: {
      h1: { en: 'Terms & Conditions', de: 'Allgemeine Geschäftsbedingungen' },
      '.legal-meta': common.updated,
      '.legal-section:nth-of-type(1) h2': { en: 'Scope', de: 'Geltungsbereich' },
      '.legal-section:nth-of-type(1) div': {
        en: '<p>These Terms and Conditions govern the contractual relationship between Birukoff World, also called Learning with Gioia (hereinafter "school"), and participants (hereinafter "clients" or "participants") for all language courses, consultations and other services of the school.</p><p>By registering for or booking an offer, participants accept these terms as binding.</p>',
        de: '<p>Diese Allgemeinen Geschäftsbedingungen (AGB) regeln das Vertragsverhältnis zwischen Birukoff World, auch Learning with Gioia genannt (nachfolgend "Schule") und den Teilnehmenden (nachfolgend "KundInnen" oder "Teilnehmende") für alle Sprachkurse, Beratungen und weiteren Dienstleistungen der Schule.</p><p>Mit der Anmeldung oder Buchung eines Angebots anerkennen die Teilnehmenden diese Bedingungen als verbindlich.</p>',
      },
      '.legal-section:nth-of-type(2) h2': {
        en: 'Registration and conclusion of contract',
        de: 'Anmeldung und Vertragsabschluss',
      },
      '.legal-section:nth-of-type(2) ul': {
        en: '<li>Registration may take place online, by telephone, in writing or in person.</li><li>Registrations are considered in the order in which they are received.</li><li>A binding contract is formed upon confirmation by the school (by email or in writing).</li><li>A registration is valid without a signature if it has been confirmed electronically or verbally.</li>',
        de: '<li>Die Anmeldung kann online, telefonisch, schriftlich oder persönlich erfolgen.</li><li>Die Anmeldungen werden in der Reihenfolge ihres Eingangs berücksichtigt.</li><li>Mit der Bestätigung durch die Schule (E-Mail oder schriftlich) entsteht ein verbindlicher Vertrag.</li><li>Eine Anmeldung ist auch ohne Unterschrift gültig, sofern sie elektronisch oder mündlich bestätigt wurde.</li>',
      },
      '.legal-section:nth-of-type(3) h2': {
        en: 'Course fees and payment',
        de: 'Kursgebühren und Zahlung',
      },
      '.legal-section:nth-of-type(3) ul': {
        en: '<li>Course fees are stated in Swiss francs (CHF) and, unless otherwise noted, exclude VAT and teaching materials.</li><li>Payment is due before the course begins.</li><li>For instalment payments, the individually agreed deadlines apply.</li><li>Unpaid course fees may lead to exclusion from lessons.</li><li>Reminder fees and collection costs are borne by participants. The first reminder is free, the second reminder is charged at CHF 20.- and the third reminder at CHF 50.-.</li>',
        de: '<li>Die Kursgebühren sind in Schweizer Franken (CHF) angegeben und verstehen sich - sofern nicht anders vermerkt - exklusive Mehrwertsteuer und Lehrmittel.</li><li>Die Zahlung ist vor Kursbeginn fällig.</li><li>Bei Ratenzahlung gelten die individuell vereinbarten Fristen.</li><li>Nicht bezahlte Kursgebühren können zum Ausschluss vom Unterricht führen.</li><li>Mahngebühren und Inkassokosten gehen zulasten der Teilnehmenden. Eine erste Mahnung ist gratis, eine zweite Mahnung wird mit CHF 20.- verrechnet, eine dritte Mahnung wird mit CHF 50.- verrechnet.</li>',
      },
      '.legal-section:nth-of-type(4) h2': {
        en: 'Withdrawal and cancellation',
        de: 'Rücktritt und Stornierung',
      },
      '.legal-section:nth-of-type(4) div': {
        en: '<p class="legal-subheading">Before the course begins (group courses and private lessons)</p><p>Cancellations must be made in writing. The following cancellation conditions apply:</p><ul class="legal-list"><li>up to 30 days before course start: free of charge</li><li>29-15 days before course start: 50% of the course fee</li><li>14-7 days before course start: 75% of the course fee</li><li>from 6 days before course start or no-show: 100% of the course fee</li></ul><p class="legal-subheading">After the course begins</p><ul class="legal-list"><li>Withdrawal after the course begins is no longer possible.</li><li>Missed lessons or exams are not refunded and are not credited toward another course. Conversion from a group course to a private course is not generally possible.</li></ul><p class="legal-subheading">Withdrawal due to illness or accident</p><p>In case of illness or accident, credit for a later course may be granted upon presentation of a medical certificate (no cash payout).</p>',
        de: '<p class="legal-subheading">Vor Kursbeginn (Gruppenkurse und Privatunterricht)</p><p>Abmeldungen müssen schriftlich erfolgen. Es gelten folgende Stornobedingungen:</p><ul class="legal-list"><li>bis 30 Tage vor Kursbeginn: kostenlos</li><li>29-15 Tage vor Kursbeginn: 50 % der Kursgebühr</li><li>14-7 Tage vor Kursbeginn: 75 % der Kursgebühr</li><li>ab 6 Tage vor Kursbeginn oder Nichterscheinen: 100 % der Kursgebühr</li></ul><p class="legal-subheading">Nach Kursbeginn</p><ul class="legal-list"><li>Ein Rücktritt nach Kursbeginn ist nicht mehr möglich.</li><li>Nicht besuchte Lektionen oder Prüfungen werden nicht rückerstattet und werden auch nicht für einen anderen Kurs angerechnet. Eine Umwandlung von Gruppenkurs in Privatkurs ist nicht generell möglich.</li></ul><p class="legal-subheading">Rücktritt wegen Krankheit oder Unfall</p><p>Bei Krankheit oder Unfall kann gegen Vorlage eines Arztzeugnisses eine Gutschrift für einen späteren Kurs gewährt werden (keine Barauszahlung).</p>',
      },
      '.legal-section:nth-of-type(5) h2': { en: 'Course organisation', de: 'Kursorganisation' },
      '.legal-section:nth-of-type(5) div': {
        en: '<p>The school reserves the right to cancel or merge courses if there are too few participants. In principle, a group course takes place from 3 participants.</p><p>The school may change lesson times, classrooms or teachers. If the school cancels a course, the full course amount will be refunded. Changes to the course schedule do not entitle participants to a refund.</p>',
        de: '<p>Die Schule behält sich das Recht vor, Kurse bei zu geringer Teilnehmerzahl abzusagen oder zusammenzulegen. Grundsätzlich findet ein Gruppenkurs ab 3 Teilnehmenden statt.</p><p>Die Schule kann Unterrichtszeiten, Kursräume oder Lehrpersonen ändern. Bei Absage durch die Schule wird der volle Kursbetrag rückerstattet. Änderungen des Kursplans berechtigen nicht zu einer Rückerstattung.</p>',
      },
      '.legal-section:nth-of-type(6) h2': { en: 'Private lessons', de: 'Privatunterricht' },
      '.legal-section:nth-of-type(6) ul': {
        en: '<li>Holidays and other absences are arranged directly with the teacher.</li><li>The 24-hour rule applies: up to 24 hours before the agreed appointment, a lesson can be postponed without cost.</li><li>Missed lessons are not refunded if a subscription is terminated before its end.</li><li>If a course is interrupted or terminated, the course fee is not refunded (including partially) and is not credited toward another course.</li>',
        de: '<li>Ferien und andere Abwesenheiten besprechen Sie direkt mit der Lehrperson.</li><li>Es gilt die 24 Stunden Regel: Bis 24 Stunden vor dem vereinbarten Termin kann eine Lektion ohne Kostenfolge verschoben werden.</li><li>Ausgefallene Lektionen werden bei einem Abbruch vor Abo-Ende nicht rückerstattet.</li><li>Bei einem Kursunterbruch oder -abbruch wird das Kursgeld nicht rückerstattet (auch nicht teilweise) und wird auch nicht für einen anderen Kurs angerechnet.</li>',
      },
      '.legal-section:nth-of-type(7) h2': { en: 'Exam preparation', de: 'Prüfungsvorbereitung' },
      '.legal-section:nth-of-type(7) p': {
        en: 'The school is not liable for decisions by external examination institutions regarding admission or results.',
        de: 'Die Schule haftet nicht für Entscheidungen externer Prüfungsinstitutionen bezüglich Zulassung oder Resultaten.',
      },
      '.legal-section:nth-of-type(8) h2': { en: 'Liability', de: 'Haftung' },
      '.legal-section:nth-of-type(8) ul': {
        en: '<li>Participation in courses and exams is at participants own responsibility.</li><li>The school accepts no liability for accident, illness, loss or theft of personal belongings.</li><li>Accident and liability insurance is the responsibility of participants.</li>',
        de: '<li>Die Teilnahme an Kursen und Prüfungen erfolgt auf eigene Verantwortung.</li><li>Die Schule übernimmt keine Haftung für Unfall, Krankheit, Verlust oder Diebstahl persönlicher Gegenstände.</li><li>Eine Unfall- und Haftpflichtversicherung ist Sache der Teilnehmenden.</li>',
      },
      '.legal-section:nth-of-type(9) h2': { en: 'Data protection', de: 'Datenschutz' },
      '.legal-section:nth-of-type(9) ul': {
        en: '<li>The school undertakes to comply with the Swiss Data Protection Act (revDSG).</li><li>Personal data is used exclusively for course administration, invoicing and internal communication.</li><li>Disclosure to third parties takes place only with consent or on a legal basis.</li><li>By registering, participants agree to the processing of their data in accordance with the school privacy policy.</li>',
        de: '<li>Die Schule verpflichtet sich zur Einhaltung des Schweizer Datenschutzgesetzes (revDSG).</li><li>Personenbezogene Daten werden ausschliesslich für Kursverwaltung, Rechnungsstellung und interne Kommunikation verwendet.</li><li>Eine Weitergabe an Dritte erfolgt nur mit Einwilligung oder gesetzlicher Grundlage.</li><li>Mit der Anmeldung stimmen die Teilnehmenden der Bearbeitung ihrer Daten gemäss dem Datenschutzreglement der Schule zu.</li>',
      },
      '.legal-section:nth-of-type(10) h2': { en: 'Copyright', de: 'Urheberrecht' },
      '.legal-section:nth-of-type(10) ul': {
        en: '<li>Course documents, learning platforms and teaching materials are protected by copyright.</li><li>Copying, photographing, distributing or passing them on without the schools consent is not permitted.</li>',
        de: '<li>Kursunterlagen, Lernplattformen und Unterrichtsmaterialien sind urheberrechtlich geschützt.</li><li>Vervielfältigung, Fotografieren, Verbreitung oder Weitergabe ohne Zustimmung der Schule ist nicht gestattet.</li>',
      },
      '.legal-section:nth-of-type(11) h2': { en: 'Conduct and rules', de: 'Verhalten und Ordnung' },
      '.legal-section:nth-of-type(11) ul': {
        en: '<li>Participants undertake to behave respectfully toward teachers, staff and fellow learners.</li><li>The school reserves the right to exclude participants from lessons in cases of serious misconduct or repeated disruption, without refunding course fees.</li>',
        de: '<li>Teilnehmende verpflichten sich zu respektvollem Verhalten gegenüber Lehrpersonen, Mitarbeitenden und Mitlernenden.</li><li>Die Schule behält sich vor, Teilnehmende bei grobem Fehlverhalten oder wiederholter Störung vom Unterricht auszuschliessen - ohne Rückerstattung der Kursgebühren.</li>',
      },
      '.legal-section:nth-of-type(12) h2': {
        en: 'Holidays and public holidays',
        de: 'Ferien und Feiertage',
      },
      '.legal-section:nth-of-type(12) ul': {
        en: '<li>The public holidays of the City of Zurich apply.</li><li>No courses or lessons take place from 24 December through 31 December or from 1 January through 7 January.</li><li>Where applicable, teacher holiday periods are planned into the respective course cycles in advance and communicated to participants in good time.</li><li>If lessons are cancelled by the school, replacement lessons are offered or partial refunds are granted.</li><li>Lesson absences caused by participants (e.g. holidays, illness) are not compensated.</li>',
        de: '<li>Es gelten die Feiertage der Stadt Zürich.</li><li>Vom 24. Dezember bis einschliesslich 31. Dezember sowie vom 1. Januar bis einschliesslich 7. Januar finden keine Kurse oder Lektionen statt.</li><li>Sofern zutreffend, werden Ferienzeiten der Lehrpersonen im Voraus in die jeweiligen Kurszyklen eingeplant und den Teilnehmerinnen und Teilnehmern rechtzeitig kommuniziert.</li><li>Bei Unterrichtsausfall durch die Schule werden Ersatzlektionen angeboten oder anteilige Rückerstattungen gewährt.</li><li>Unterrichtsausfall durch Teilnehmende (z. B. Ferien, Krankheit) wird nicht vergütet.</li>',
      },
      '.legal-section:nth-of-type(13) h2': { en: 'Contract changes', de: 'Vertragsänderungen' },
      '.legal-section:nth-of-type(13) ul': {
        en: '<li>Changes to the Terms and Conditions take effect when published on the website or communicated to participants.</li><li>The terms valid at the time of registration apply.</li>',
        de: '<li>Änderungen der AGB treten mit Veröffentlichung auf der Website oder Mitteilung an die Teilnehmenden in Kraft.</li><li>Es gelten die zum Zeitpunkt der Anmeldung gültigen Bedingungen.</li>',
      },
      '.legal-section:nth-of-type(14) h2': {
        en: 'Place of jurisdiction and law',
        de: 'Gerichtsstand und Recht',
      },
      '.legal-section:nth-of-type(14) ul': {
        en: '<li>Swiss law applies.</li><li>The place of jurisdiction is Zurich, Switzerland.</li>',
        de: '<li>Es gilt Schweizer Recht.</li><li>Gerichtsstand ist Zürich, Schweiz.</li>',
      },
      '.legal-section:nth-of-type(15) h2': { en: 'Final provision', de: 'Schlussbestimmung' },
      '.legal-section:nth-of-type(15) p': {
        en: 'By registering for a course, exam or offer of the school, these Terms and Conditions are deemed accepted.',
        de: 'Mit der Anmeldung zu einem Kurs, einer Prüfung oder einem Angebot der Schule gelten diese AGB als anerkannt.',
      },
    },
  };

  Object.assign(pages, {
    '/intake.html': {
      title: {
        en: 'Student Intake - Learning with Gioia',
        de: 'Schülerangaben - Learning with Gioia',
      },
      text: {
        '#intake-loading': { en: 'loading...', de: 'wird geladen...' },
        '#intake-content h1': { en: 'your details', de: 'deine angaben' },
        '.intake-intro': {
          en: 'Please fill in or confirm the information below so we can keep your records up to date. Fields marked * are required.',
          de: 'Bitte fülle die folgenden Angaben aus oder bestätige sie, damit wir deine Daten aktuell halten können. Felder mit * sind erforderlich.',
        },
        '#intake-content > .section-label:nth-of-type(2)': {
          en: 'personal information',
          de: 'persönliche angaben',
        },
        'label[for="if-first-name"]': { en: 'first name *', de: 'vorname *' },
        'label[for="if-last-name"]': { en: 'last name *', de: 'nachname *' },
        'label[for="if-email"]': { en: 'email', de: 'e-mail' },
        'label[for="if-phone"]': { en: 'phone', de: 'telefon' },
        'label[for="if-street"]': { en: 'street', de: 'strasse' },
        'label[for="if-street-number"]': { en: 'number', de: 'nummer' },
        'label[for="if-postcode"]': { en: 'postcode', de: 'postleitzahl' },
        'label[for="if-city"]': { en: 'city', de: 'ort' },
        '#intake-content > .section-label:nth-of-type(3)': {
          en: 'emergency contact',
          de: 'notfallkontakt',
        },
        'label[for="if-ec-name"]': { en: 'name', de: 'name' },
        'label[for="if-ec-relationship"]': { en: 'relationship', de: 'beziehung' },
        '#if-ec-relationship': {
          en: 'e.g. partner, parent',
          de: 'z. B. Partner/in, Elternteil',
          attr: 'placeholder',
        },
        'label[for="if-ec-phone"]': { en: 'phone', de: 'telefon' },
        'label[for="if-ec-email"]': { en: 'email', de: 'e-mail' },
        '#intake-content > .section-label:nth-of-type(4)': { en: 'billing', de: 'rechnung' },
        '.intake-checkbox span': {
          en: 'billing address differs from personal address',
          de: 'rechnungsadresse weicht von persönlicher adresse ab',
        },
        'label[for="if-billing-name"]': { en: 'billing name', de: 'rechnungsname' },
        'label[for="if-billing-email"]': { en: 'billing email', de: 'rechnungs-e-mail' },
        'label[for="if-billing-phone"]': { en: 'billing phone', de: 'rechnungstelefon' },
        'label[for="if-billing-street"]': { en: 'street', de: 'strasse' },
        'label[for="if-billing-street-number"]': { en: 'number', de: 'nummer' },
        'label[for="if-billing-postcode"]': { en: 'postcode', de: 'postleitzahl' },
        'label[for="if-billing-city"]': { en: 'city', de: 'ort' },
        '#err-first-name': {
          en: 'Please enter a first name.',
          de: 'Bitte gib einen Vornamen ein.',
        },
        '#err-last-name': { en: 'Please enter a last name.', de: 'Bitte gib einen Nachnamen ein.' },
        '#intake-submit-btn': { en: 'save details ->', de: 'angaben speichern ->' },
        '#submit-error': {
          en: 'Something went wrong - please try again or email us at <a href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
          de: 'Etwas ist schiefgelaufen - bitte versuche es erneut oder schreibe uns an <a href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
        },
        '#intake-thanks h1': { en: 'thank you.', de: 'danke.' },
        '#intake-thanks p': {
          en: "Your details have been saved. We'll be in touch shortly.",
          de: 'Deine Angaben wurden gespeichert. Wir melden uns bald.',
        },
        '#intake-error h1': {
          en: 'link expired or invalid.',
          de: 'link abgelaufen oder ungültig.',
        },
        '#intake-error p': {
          en: 'Please contact your teacher for a new link, or email <a href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
          de: 'Bitte kontaktiere deine Lehrperson für einen neuen Link oder schreibe an <a href="mailto:info@learningwithgioia.ch">info@learningwithgioia.ch</a>.',
        },
      },
    },
    '/sessions.html': {
      title: {
        en: 'My Sessions - learning with gioia',
        de: 'Meine Lektionen - learning with gioia',
      },
      text: { '.error-state': { en: 'loading...', de: 'wird geladen...' } },
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
  });

  const runtime = {
    sessionsHeading: { en: 'your sessions', de: 'deine lektionen' },
    noSessionLink: {
      en: 'No session link provided.<br>Please use the link sent to you by your teacher.',
      de: 'Kein Lektionslink angegeben.<br>Bitte verwende den Link, den dir deine Lehrperson gesendet hat.',
    },
    noSessions: { en: 'No sessions scheduled yet.', de: 'Noch keine Lektionen geplant.' },
    makeEnquiry: { en: 'make an enquiry ->', de: 'anfrage senden ->' },
    completedOf: { en: 'sessions completed', de: 'Lektionen abgeschlossen' },
    remaining: { en: 'remaining', de: 'verbleibend' },
    rebookSome: {
      en: (n) =>
        `You have ${n} session${n === 1 ? '' : 's'} remaining. Ready to continue? <a href="/enquiry.html">Make a new enquiry -></a>`,
      de: (n) =>
        `Du hast noch ${n} Lektion${n === 1 ? '' : 'en'} übrig. Bereit weiterzumachen? <a href="/enquiry.html">Neue Anfrage senden -></a>`,
    },
    rebookDone: {
      en: 'Your current block is complete. <a href="/enquiry.html">Book your next block -></a>',
      de: 'Dein aktueller Block ist abgeschlossen. <a href="/enquiry.html">Nächsten Block buchen -></a>',
    },
    couldNotLoad: {
      en: 'Could not load your sessions.<br>Please check your link or contact your teacher.',
      de: 'Deine Lektionen konnten nicht geladen werden.<br>Bitte prüfe den Link oder kontaktiere deine Lehrperson.',
    },
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
