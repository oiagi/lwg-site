// Each entry: { name, function, functionEn, meaning, meaningEn, examples[{de,en}], tip, tipEn, category }
(function () {
  'use strict';

  const C = {
    addition: 'addition',
    contrast: 'contrast',
    correction: 'correction',
    alternative: 'alternative',
    reason: 'reason',
  };

  const connectors = [
    {
      name: 'aber',
      function: 'Gegensatz oder Einschränkung',
      functionEn: 'contrast or limitation',
      meaning:
        'Verbindet zwei gleichrangige Aussagen, wenn die zweite etwas einschränkt oder dagegensteht.',
      meaningEn:
        'Connects two equal statements when the second limits or contrasts with the first.',
      examples: [
        {
          de: 'Ich habe wenig Zeit, {aber} ich komme kurz vorbei.',
          en: 'I have little time, but I will stop by briefly.',
        },
      ],
      tip: '"Aber" verbindet Hauptsätze ohne Verb-Endstellung: "..., aber ich komme", nicht "..., aber ich kurz vorbeikomme".',
      tipEn:
        '"Aber" connects main clauses without verb-final order: "..., aber ich komme", not "..., aber ich kurz vorbeikomme".',
      category: C.contrast,
    },
    {
      name: 'denn',
      function: 'Grund',
      functionEn: 'reason',
      meaning: 'Gibt einen Grund an und verbindet zwei Hauptsätze.',
      meaningEn: 'Gives a reason and connects two main clauses.',
      examples: [
        {
          de: 'Ich gehe früh schlafen, {denn} ich muss morgen arbeiten.',
          en: 'I am going to bed early because I have to work tomorrow.',
        },
      ],
      tip: '"Denn" ist eine Konjunktion mit normaler Hauptsatzstellung. Anders als "weil" schickt es das Verb nicht ans Ende.',
      tipEn:
        '"Denn" is a conjunction with normal main-clause word order. Unlike "weil", it does not send the verb to the end.',
      category: C.reason,
    },
    {
      name: 'und',
      function: 'Addition oder Verbindung',
      functionEn: 'addition or connection',
      meaning: 'Verbindet Wörter, Satzteile oder Hauptsätze additiv.',
      meaningEn: 'Connects words, sentence parts, or main clauses additively.',
      examples: [
        {
          de: 'Ich lerne Deutsch {und} sie lernt Englisch.',
          en: 'I am learning German and she is learning English.',
        },
      ],
      tip: '"Und" ist koordinierend: Beide Teile bleiben gleichrangig, und das finite Verb bleibt in normaler Position.',
      tipEn:
        '"Und" is coordinating: both parts remain equal, and the finite verb stays in its normal position.',
      category: C.addition,
    },
    {
      name: 'sondern',
      function: 'Korrektur nach Verneinung',
      functionEn: 'correction after negation',
      meaning: 'Korrigiert eine verneinte Aussage und sagt, was stattdessen stimmt.',
      meaningEn: 'Corrects a negated statement and says what is true instead.',
      examples: [
        {
          de: 'Ich trinke keinen Kaffee, {sondern} Tee.',
          en: 'I do not drink coffee, but rather tea.',
        },
      ],
      tip: '"Sondern" braucht fast immer eine Verneinung vorher: nicht/kein ... sondern ...',
      tipEn: '"Sondern" almost always needs a negation before it: nicht/kein ... sondern ...',
      category: C.correction,
    },
    {
      name: 'oder',
      function: 'Alternative',
      functionEn: 'alternative',
      meaning: 'Verbindet Möglichkeiten, Fragen oder gleichrangige Satzteile.',
      meaningEn: 'Connects options, questions, or equal sentence parts.',
      examples: [{ de: 'Möchtest du Kaffee {oder} Tee?', en: 'Would you like coffee or tea?' }],
      tip: 'Bei zwei Hauptsätzen bleibt die Satzstellung normal: "Du kommst mit, oder du wartest hier."',
      tipEn:
        'With two main clauses, word order stays normal: "Du kommst mit, oder du wartest hier."',
      category: C.alternative,
    },
  ];

  const categories = {
    addition: { label: 'Addition' },
    contrast: { label: 'Gegensatz' },
    correction: { label: 'Korrektur' },
    alternative: { label: 'Alternative' },
    reason: { label: 'Grund' },
  };

  const categoriesEn = {
    addition: 'Addition',
    contrast: 'Contrast',
    correction: 'Correction',
    alternative: 'Alternative',
    reason: 'Reason',
  };

  const uiCopy = {
    expandHint: { en: '▸ Show note', de: '▸ Hinweis anzeigen' },
    noVerbFinal: { en: 'no verb-final shift', de: 'keine Verb-Endstellung' },
    question: { en: 'Question', de: 'Frage' },
    of: { en: 'of', de: 'von' },
    chooseConnectors: {
      en: 'Choose conjunctions to practise',
      de: 'Konjunktionen zum Üben auswählen',
    },
    allConnectors: { en: 'All', de: 'Alle' },
    clearConnectors: { en: 'Clear', de: 'Auswahl leeren' },
    selectedCount: { en: 'selected', de: 'ausgewählt' },
    noQuestions: {
      en: 'Select at least one conjunction to start the quiz.',
      de: 'Wähle mindestens eine Konjunktion aus, um das Quiz zu starten.',
    },
    noMatchingQuestions: {
      en: 'No quiz questions match this selection yet.',
      de: 'Zu dieser Auswahl gibt es noch keine Quizfragen.',
    },
    acceptedAnswers: { en: 'Accepted answers', de: 'Mögliche Lösungen' },
    answers: { en: 'Answer options', de: 'Antwortoptionen' },
    next: { en: 'Next ->', de: 'Weiter ->' },
    results: {
      en: ['Excellent!', 'Good work!', 'Keep practising!'],
      de: ['Ausgezeichnet!', 'Gut gemacht!', 'Weiter üben!'],
    },
    messages: {
      en: [
        'You can already distinguish these coordinating links very well.',
        'The core patterns are there - review the subtle contrasts again.',
        'No problem - the overview will make the differences clearer.',
      ],
      de: [
        'Du kannst diese koordinierenden Verbindungen schon sehr gut unterscheiden.',
        'Die Grundmuster sitzen - schau dir die feinen Gegensätze nochmal an.',
        'Kein Problem - mit der Übersicht werden die Unterschiede klarer.',
      ],
    },
    restart: { en: 'Play again', de: 'Nochmal spielen' },
  };

  const quizQuestions = [
    {
      sentence: 'Ich habe wenig Zeit, ___ ich komme kurz vorbei.',
      translation: 'I have little time, but I will stop by briefly.',
      answers: [
        {
          value: 'aber',
          explanation: '"Aber" marks a simple contrast.',
          explanationDe: '"Aber" markiert einen einfachen Gegensatz.',
        },
      ],
      options: ['aber', 'denn', 'oder', 'und'],
      context: 'The second main clause contrasts with the first.',
      contextDe: 'Der zweite Hauptsatz steht im Gegensatz zum ersten.',
    },
    {
      sentence: 'Ich gehe früh schlafen, ___ ich muss morgen arbeiten.',
      translation: 'I am going to bed early because I have to work tomorrow.',
      answers: [
        {
          value: 'denn',
          explanation: '"Denn" gives a reason with main-clause word order.',
          explanationDe: '"Denn" gibt einen Grund mit Hauptsatzstellung an.',
        },
      ],
      options: ['denn', 'aber', 'sondern', 'oder'],
      context: 'A reason without verb-final word order.',
      contextDe: 'Ein Grund ohne Verb-Endstellung.',
    },
    {
      sentence: 'Ich lerne Deutsch ___ sie lernt Englisch.',
      translation: 'I am learning German and she is learning English.',
      answers: [
        {
          value: 'und',
          explanation: '"Und" connects equal words, phrases, or clauses.',
          explanationDe: '"Und" verbindet gleichrangige Wörter, Satzteile oder Sätze.',
        },
      ],
      options: ['und', 'sondern', 'oder', 'aber'],
      context: 'Two equal main clauses are added together.',
      contextDe: 'Zwei gleichrangige Hauptsätze werden additiv verbunden.',
    },
    {
      sentence: 'Ich trinke keinen Kaffee, ___ Tee.',
      translation: 'I do not drink coffee, but rather tea.',
      answers: [
        {
          value: 'sondern',
          explanation: '"Sondern" corrects a negated statement.',
          explanationDe: '"Sondern" korrigiert eine verneinte Aussage.',
        },
      ],
      options: ['sondern', 'aber', 'denn', 'oder'],
      context: 'Negation first, correction second.',
      contextDe: 'Zuerst die Verneinung, dann die Korrektur.',
    },
    {
      sentence: 'Möchtest du Kaffee ___ Tee?',
      translation: 'Would you like coffee or tea?',
      answers: [
        {
          value: 'oder',
          explanation: '"Oder" connects alternatives.',
          explanationDe: '"Oder" verbindet Alternativen.',
        },
      ],
      options: ['oder', 'und', 'denn', 'aber'],
      context: 'Two possible choices.',
      contextDe: 'Zwei mögliche Optionen.',
    },
  ];

  window.LWG_KONJUNKTIONEN_DATA = {
    connectors,
    categories,
    categoriesEn,
    uiCopy,
    quizQuestions,
  };
})();
