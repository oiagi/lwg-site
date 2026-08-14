// Runtime translation layer for JavaScript-rendered UI.
//
// Page copy, titles, descriptions, canonicals, hreflang, navigation and JSON-LD
// are rendered server-side by functions/_render.js — the language is already
// correct in the HTML before this file loads. What remains here is the strings
// for content that only exists after a fetch (course cards, call slots, form
// states) and the helpers those scripts share.
(function () {
  'use strict';

  const SUPPORTED = ['en', 'de'];

  // Mirror of ROUTES in functions/_i18n-content.js, per language. Needed here
  // only so that links inside dynamically inserted markup can be pointed at the
  // right language prefix.
  //
  // tests/i18n-routing.test.mjs parses both files and fails if they disagree —
  // do not edit one without the other.
  const ROUTES = {
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
  const PAGE_BY_ROUTE = SUPPORTED.reduce((byLang, lang) => {
    byLang[lang] = Object.entries(ROUTES).reduce((acc, [page, slugs]) => {
      acc[slugs[lang]] = page;
      return acc;
    }, {});
    return byLang;
  }, {});

  function hasRoute(page) {
    return Object.prototype.hasOwnProperty.call(ROUTES, page);
  }

  function splitPath(pathname) {
    const parts = pathname.split('/').filter(Boolean);
    const lang = SUPPORTED.includes(parts[0]) ? parts[0] : null;
    return { lang, route: parts.slice(lang ? 1 : 0).join('/') };
  }

  function normalisePageKey(pathname) {
    const cleanRoute = splitPath(pathname).route.replace(/\/$/, '');
    if (!cleanRoute) return '/index.html';
    // Check every language's slug set, so a link written with either
    // language's slug still resolves to its page.
    for (const lang of SUPPORTED) {
      if (PAGE_BY_ROUTE[lang][cleanRoute]) return PAGE_BY_ROUTE[lang][cleanRoute];
    }
    if (cleanRoute.endsWith('.html')) return '/' + cleanRoute;
    return '/' + cleanRoute + '.html';
  }

  function pageKey() {
    return normalisePageKey(window.location.pathname);
  }

  function pagePath(page, lang) {
    const safeLang = SUPPORTED.includes(lang) ? lang : currentLang;
    const slug = hasRoute(page)
      ? ROUTES[page][safeLang]
      : page.replace(/^\//, '').replace(/\.html$/, '');
    return '/' + safeLang + (slug ? '/' + slug : '/');
  }

  // Every rendered URL carries its language as the first path segment, so the
  // URL is authoritative; <html lang> is the fallback for anything served
  // outside the language routes (admin, flow pages).
  function getInitialLang() {
    const fromUrl = splitPath(window.location.pathname).lang;
    if (fromUrl) return fromUrl;
    const fromDocument = document.documentElement.lang;
    return SUPPORTED.includes(fromDocument) ? fromDocument : 'en';
  }

  const currentLang = getInitialLang();

  // Labels for interactions this file still owns (the nav toggle).
  const ui = {
    menu: { en: 'menu', de: 'Menü' },
    close: { en: 'close', de: 'Schliessen' },
  };

  const runtime = {
    feedbackRatingRequired: {
      en: 'Please choose a rating.',
      de: 'Bitte wähle eine Bewertung.',
    },
    feedbackChoiceRequired: {
      en: 'Please choose an answer.',
      de: 'Bitte wähle eine Antwort.',
    },
    feedbackOtherPlaceholder: { en: 'please tell us', de: 'Sag uns gerne, was' },
    feedbackSubmitting: { en: 'sending...', de: 'Wird gesendet...' },
    feedbackOptional: { en: 'optional', de: 'optional' },
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
    callLoading: {
      en: 'loading available times…',
      de: 'Verfügbare Zeiten werden geladen…',
    },
    callLoadError: {
      en: 'Available times could not be loaded right now.',
      de: 'Verfügbare Zeiten konnten gerade nicht geladen werden.',
    },
    callNoSlots: {
      en: 'No free slots in the next three weeks.',
      de: 'In den nächsten drei Wochen sind keine Termine frei.',
    },
    callEnquiryLink: { en: 'make an enquiry ->', de: 'Anfrage senden ->' },
    callSelected: {
      en: (date, time) => `Selected: ${date} at ${time} (Zürich time)`,
      de: (date, time) => `Gewählt: ${date} um ${time} (Zürcher Zeit)`,
    },
    callChooseSlot: {
      en: 'Please choose a time first.',
      de: 'Bitte wähle zuerst eine Zeit.',
    },
    callSubmitting: { en: 'booking…', de: 'Wird gebucht…' },
    callSubmit: { en: 'book the call', de: 'Gespräch buchen' },
    callTaken: {
      en: 'That time was just taken. Please choose another one.',
      de: 'Dieser Termin wurde gerade vergeben. Bitte wähle einen anderen.',
    },
    callServerError: {
      en: 'Something went wrong. Please try again later.',
      de: 'Etwas ist schiefgelaufen. Bitte versuche es später erneut.',
    },
    callSuccessMeet: {
      en: (when) =>
        `We've emailed you a calendar invitation with the video link. See you on ${when}.`,
      de: (when) =>
        `Wir haben dir eine Kalendereinladung mit dem Videolink geschickt. Bis ${when}.`,
    },
    callSuccessEmail: {
      en: (when) => `We've emailed you the details for ${when}. See you then!`,
      de: (when) => `Wir haben dir die Details für ${when} per E-Mail geschickt. Bis dann!`,
    },
    enquiryPhone: { en: 'phone', de: 'Telefon' },
    enquiryPhoneOptional: { en: 'phone (optional)', de: 'Telefon (optional)' },
    enquirySubmitting: { en: 'sending…', de: 'Wird gesendet…' },
    makeEnquiry: { en: 'make an enquiry ->', de: 'Anfrage senden ->' },
    reviewSubmitting: { en: 'sending…', de: 'Wird gesendet…' },
    reviewReadMore: { en: 'read more', de: 'mehr lesen' },
    reviewReadLess: { en: 'show less', de: 'weniger anzeigen' },
  };

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

  function t(key, lang) {
    const value = (ui[key] || runtime[key] || {})[lang || currentLang];
    return typeof value === 'function' ? value : value || key;
  }

  // Ten page scripts render their dynamic content in response to this event,
  // and several — agb.js among them — have no other entry point. Switching
  // language is a navigation now, not a DOM update, so it fires exactly once,
  // after the page scripts at the end of <body> have registered their listeners.
  function announce() {
    document.dispatchEvent(
      new CustomEvent('lwg:language-applied', { detail: { lang: currentLang } })
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', announce);
  } else {
    announce();
  }

  window.LWG_I18N = {
    getLang: () => currentLang,
    getPageKey: pageKey,
    href: pagePath,
    localizeInternalLinks,
    normalisePageKey,
    runtime,
    t,
    translateRuntime(key, ...args) {
      const value = runtime[key] && runtime[key][currentLang];
      return typeof value === 'function' ? value(...args) : value || key;
    },
  };
})();
