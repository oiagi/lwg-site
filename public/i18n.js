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
    menu: { en: 'menu', de: 'Menü' },
    close: { en: 'close', de: 'Schliessen' },
    home: { en: 'Home', de: 'Start' },
    info: { en: 'info', de: 'Info' },
    groupCourses: { en: 'group courses', de: 'Gruppenkurse' },
    enquiry: { en: 'enquiry', de: 'Anfrage' },
    materials: { en: 'materials', de: 'Materialien' },
    modalpartikeln: { en: 'modal particles', de: 'Modalpartikeln' },
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
        en: 'Language courses, exam preparation and tutoring in Zürich. Native-speaking teachers with linguistics degrees and formal teaching qualifications.',
        de: 'Sprachkurse, Prüfungsvorbereitung und Nachhilfe in Zürich. Muttersprachliche Lehrpersonen mit sprachwissenschaftlichem Studium und formaler Lehrqualifikation.',
      },
      text: {
        '.hero-tagline': {
          en: '<em>Language courses, exam preparation &amp; tutoring</em><span class="sep" aria-hidden="true">·</span><em>Zürich</em>',
          de: '<em>Sprachkurse, Prüfungsvorbereitung &amp; Nachhilfe</em><span class="sep" aria-hidden="true">·</span><em>Zürich</em>',
        },
        '.lede p:nth-of-type(1)': {
          en: 'Small groups. Carefully prepared, individually tailored lessons.',
          de: 'Kleine Gruppen. Sorgfältige Vorbereitung, individuell abgestimmter Unterricht.',
        },
        '.lede p:nth-of-type(2)': {
          en: 'We want to give you confidence and motivation to use your knowledge beyond the classroom.',
          de: 'Wir wollen dich dabei unterstützen, dein Wissen auch ausserhalb des Unterrichts anzuwenden.',
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
        en: 'German, Swiss German and English language courses, exam preparation and tutoring in Zürich. All levels welcome. Pricing upon request.',
        de: 'Deutsch-, Schweizerdeutsch- und Englischkurse, Prüfungsvorbereitung und Nachhilfe in Zürich. Alle Niveaus willkommen.',
      },
      text: {
        h1: { en: 'what we offer', de: 'Was wir anbieten' },
        '.section:nth-of-type(1) h2': { en: 'Language courses', de: 'Sprachkurse' },
        '.section:nth-of-type(1) p': {
          en: 'We offer courses in <strong>German</strong>, <strong>Swiss German</strong>, and <strong>English</strong>, taught exclusively by <strong>native speakers</strong>. All levels are welcome, from complete beginners to advanced learners looking to refine their skills. If you are interested in a language not listed here, please get in touch. We may be able to help.',
          de: 'Wir bieten Kurse in <strong>Deutsch</strong>, <strong>Schweizerdeutsch</strong> und <strong>Englisch</strong> an, ausschliesslich unterrichtet von <strong>Muttersprachlerinnen und Muttersprachlern</strong>. Alle Niveaus sind willkommen, von kompletten Anfängerinnen und Anfängern bis zu Fortgeschrittenen, die ihre Kenntnisse verfeinern möchten. Wenn dich eine Sprache interessiert, die hier nicht aufgeführt ist, melde dich gerne. Vielleicht können wir helfen.',
        },
        '.section:nth-of-type(2) h2': { en: 'Exam preparation', de: 'Prüfungsvorbereitung' },
        '.section:nth-of-type(2) p': {
          en: 'We offer targeted preparation for internationally recognised language exams, including <strong>Cambridge</strong>, <strong>TOEFL</strong>, <strong>IELTS</strong>, <strong>TELC</strong>, and <strong>Goethe</strong>. Courses are tailored to the format and requirements of your chosen exam and are taught in the exam language. If you prefer to be taught in another language, please let us know and we will do our best to accommodate you.',
          de: 'Ob <strong>Cambridge</strong>, <strong>TOEFL</strong>, <strong>IELTS</strong>, <strong>TELC</strong> und <strong>Goethe</strong> - wir bieten gezielte Vorbereitung auf international anerkannte Sprachprüfungen an. Die Kurse werden auf Format und Anforderungen deiner Prüfung abgestimmt und in der Prüfungssprache unterrichtet. Wenn du lieber in einer anderen Sprache unterrichtet werden möchtest, sag uns Bescheid. Wir geben unser Bestes, dich mit einer Lehrperson zu verbinden, die deine Sprache spricht.',
        },
        '.section:nth-of-type(3) h2': { en: 'Tutoring', de: 'Nachhilfe' },
        '.section:nth-of-type(3) p': {
          en: 'We provide tutoring support across all educational levels, from primary school through to university. Need ongoing help, targeted exam prep, or <strong>Gymivorbereitung</strong>? No problem! We will work with you to find the right approach.',
          de: 'Wir bieten Nachhilfe auf allen Bildungsstufen an, von Primarschule bis zu Universität. Regelmässige Unterstützung, gezielte Prüfungsvorbereitung oder <strong>Gymivorbereitung</strong>? Kein Problem! Gemeinsam finden wir das passende Angebot.',
        },
        '.section:nth-of-type(4) h2': { en: 'Our teachers', de: 'Unsere Lehrpersonen' },
        '.section:nth-of-type(4) p': {
          en: 'All of our teachers hold or are working towards a university degree and a formal teaching qualification (<strong>Lehrdiplom</strong>). Our language teachers specialise in linguistics, bringing an understanding of how language works (not just how to speak it) to every lesson.',
          de: 'Alle unsere Lehrpersonen haben einen Hochschulabschluss und verfügen über eine formale Lehrqualifikation (<strong>Lehrdiplom</strong>) oder befinden sich in der Ausbildung dahin. Unsere Sprachlehrpersonen spezialisieren sich auf Linguistik und verstehen, wie Sprache funktioniert (nicht nur, wie man sie spricht).',
        },
        '.section:nth-of-type(5) h2': { en: 'Location', de: 'Ort' },
        '.section:nth-of-type(5) p': {
          en: 'Group classes are held in central Zürich, within easy reach of Zürich HB. The exact venue is confirmed when a course is scheduled. Private, company, and online sessions can of course take place wherever suits you best.*',
          de: 'Gruppenkurse finden zentral in Zürich statt, gut erreichbar vom Zürich HB. Der genaue Ort wird bestätigt, sobald ein Kurs geplant ist. Privat-, Firmen- und Onlinelektionen können natürlich dort stattfinden, wo es für dich am besten passt.*',
        },
        '.section:nth-of-type(5) li': { en: 'Travel fees apply.', de: 'Reisekosten fallen an.' },
        '.section:nth-of-type(6) h2': { en: 'Course structure', de: 'Kursstruktur' },
        '.section:nth-of-type(6) p:nth-of-type(1)': {
          en: 'As a general guide, progressing through a full level, for example from A0 to A1, typically takes around 100-150 hours* of guided learning alongside a similar amount of independent study. Note that at higher levels, regular exposure and contact with native speakers becomes increasingly important alongside formal instruction.',
          de: 'Um ein vollständiges Sprachniveau abzudecken, zum Beispiel von A0 zu A1, benötigt man durchschnittlich etwa 100-150 Stunden* angeleitetes Lernen plus eine ähnliche Menge an selbstständigem Lernen. Auf höheren Niveaus ist regelmässiger Kontakt mit der Sprache und Austausch mit Muttersprachlerinnen und Muttersprachlern neben formalem Unterricht unabdingbar.',
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
        '.cta-row .book-cta:first-child': {
          en: 'open group courses ->',
          de: 'offene Gruppenkurse ->',
        },
        '.cta-row .book-cta:last-child': { en: 'make an enquiry ->', de: 'Anfrage senden ->' },
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
        '#label-personal': { en: 'personal information', de: 'Persönliche Angaben' },
        '#label-emergency': { en: 'emergency contact', de: 'Notfallkontakt' },
        '#label-billing': { en: 'billing', de: 'Rechnung' },
        '#booking-payment-note': {
          en: "What happens after your booking? We will review your request and confirm your spot. Then we will send you the invoice for your booking. Once we receive your payment you're all booked in.",
          de: 'Was passiert nach deiner Buchungsanfrage? Wir prüfen deine Anfrage und bestätigen deinen Platz. Dann schicken wir dir die Rechnung für deine Buchung. Sobald deine Zahlung eingegangen ist, bist du fix dabei.',
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
        'label[for="bf-ec-name"]': { en: 'name *', de: 'Name *' },
        'label[for="bf-ec-relationship"]': { en: 'relationship *', de: 'Beziehung *' },
        '#bf-ec-relationship': {
          en: 'e.g. partner, parent',
          de: 'z. B. Partner/in, Elternteil',
          attr: 'placeholder',
        },
        'label[for="bf-ec-phone"]': { en: 'phone *', de: 'Telefon *' },
        'label[for="bf-ec-email"]': { en: 'email *', de: 'E-Mail *' },
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
          en: 'personal information',
          de: 'Persönliche Angaben',
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
        'label[for="if-ec-name"]': { en: 'name *', de: 'Name *' },
        'label[for="if-ec-relationship"]': { en: 'relationship *', de: 'Beziehung *' },
        '#if-ec-relationship': {
          en: 'e.g. partner, parent',
          de: 'z. B. Partner/in, Elternteil',
          attr: 'placeholder',
        },
        'label[for="if-ec-phone"]': { en: 'phone *', de: 'Telefon *' },
        'label[for="if-ec-email"]': { en: 'email *', de: 'E-Mail *' },
        '#intake-content > .section-label:nth-of-type(4)': { en: 'billing', de: 'Rechnung' },
        '.intake-checkbox span': {
          en: 'billing address differs from personal address',
          de: 'Rechnungsadresse weicht von persönlicher Adresse ab',
        },
        'label[for="if-billing-name"]': { en: 'billing name *', de: 'Rechnungsname *' },
        'label[for="if-billing-email"]': {
          en: 'billing email *',
          de: 'Rechnungs-E-Mail *',
        },
        'label[for="if-billing-phone"]': { en: 'billing phone *', de: 'Rechnungstelefon *' },
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
    '/sessions.html': {
      title: {
        en: 'My Sessions - learning with gioia',
        de: 'Meine Lektionen - Learning with Gioia',
      },
      text: { '.error-state': { en: 'loading...', de: 'Wird geladen...' } },
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
    groupCoursesLessons: { en: 'lessons', de: 'Lektionen' },
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
    groupCoursesSelected: { en: 'selected course', de: 'Ausgewählter Kurs' },
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
    sessionsHeading: { en: 'your sessions', de: 'Deine Lektionen' },
    noSessionLink: {
      en: 'No session link provided.<br>Please use the link sent to you by your teacher.',
      de: 'Kein Lektionslink angegeben.<br>Bitte verwende den Link, den dir deine Lehrperson gesendet hat.',
    },
    noSessions: { en: 'No sessions scheduled yet.', de: 'Noch keine Lektionen geplant.' },
    makeEnquiry: { en: 'make an enquiry ->', de: 'Anfrage senden ->' },
    completedOf: { en: 'sessions completed', de: 'Lektionen abgeschlossen' },
    remaining: { en: 'remaining', de: 'Verbleibend' },
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
