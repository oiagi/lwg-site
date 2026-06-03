// Each entry: { name, function, functionEn, contexts, contextsEn, meaning, meaningDe, examples[{type, de, en}], tip, tipDe, category }
(function () {
  'use strict';

  const particles = [
    {
      name: 'mal',
      function: 'Abschwächung / Höflichkeit',
      functionEn: 'Softening / Politeness',
      contexts: 'Aufforderungen · Aussagesätze',
      contextsEn: 'Requests · Statements',
      meaning:
        'Makes requests softer and friendlier. Turns a command into a casual suggestion; in statements signals a brief, tentative action.',
      meaningDe:
        'Macht Bitten weicher und freundlicher. Aus einem Befehl wird eine lockere Aufforderung; in Aussagen markiert es oft eine kurze, beiläufige Handlung.',
      examples: [
        {
          type: 'Aufforderung',
          de: 'Kannst du {mal} kurz helfen?',
          en: 'Can you help me for a sec?',
        },
        { type: 'Aufforderung', de: 'Schau {mal}!', en: 'Look! / Have a look!' },
        {
          type: 'Aussagesatz',
          de: 'Ich muss {mal} kurz nachdenken.',
          en: 'I need to think for a moment.',
        },
        {
          type: 'Aussagesatz',
          de: 'Das ist {mal} ein guter Kaffee!',
          en: 'Now THAT is a good coffee!',
        },
      ],
      tip: "Use 'mal' to soften any imperative. Compare: 'Komm her!' vs. 'Komm mal her!' (Come here, would you?). In statements it can mean 'for a moment' or — with stress — 'now THAT is a…'.",
      tipDe:
        "Mit 'mal' klingen Aufforderungen weniger hart: 'Komm her!' wirkt direkter als 'Komm mal her!'. In Aussagesätzen kann es 'kurz' bedeuten oder, betont gesprochen, Überraschung ausdrücken: 'Das ist mal ein...'.",
      category: 'softening',
    },
    {
      name: 'doch',
      function: 'Widerspruch / Nachdruck',
      functionEn: 'Contradiction / Emphasis',
      contexts: 'Aussagesätze · Aufforderungen (doch mal) · Ausrufesätze · Wunschsätze',
      contextsEn: 'Statements · Requests (doch mal) · Exclamations · Wishes',
      meaning:
        'Expresses contradiction, urges action, intensifies exclamations, or conveys longing in wishes. Very versatile!',
      meaningDe:
        'Drückt Widerspruch aus, fordert zu etwas auf, verstärkt Ausrufe oder zeigt Sehnsucht in Wunschsätzen. Sehr vielseitig!',
      examples: [
        {
          type: 'Aussagesatz',
          de: 'Du weißt {doch}, dass ich recht habe.',
          en: "You know (perfectly well) that I'm right.",
        },
        { type: 'Aufforderung', de: 'Komm {doch mal} mit!', en: "Come along! (why wouldn't you?)" },
        { type: 'Ausrufesatz', de: 'Das ist {doch} Unsinn!', en: "That's nonsense! (come on!)" },
        { type: 'Wunschsatz', de: 'Wenn er {doch} nur hier wäre!', en: 'If only he were here!' },
      ],
      tip: "'Doch' is one of the most versatile particles. Statements: 'after all / as you know'. Imperatives (often 'doch mal'): urgency or encouragement. Exclamations: indignation or surprise. Wishes: longing, especially combined with 'nur'/'bloß'.",
      tipDe:
        "'Doch' ist eine der vielseitigsten Partikeln. In Aussagen erinnert es an etwas Bekanntes, in Aufforderungen (oft 'doch mal') klingt es drängend oder ermutigend. In Ausrufen zeigt es Empörung oder Überraschung, in Wünschen Sehnsucht, besonders mit 'nur' oder 'bloß'.",
      category: 'emphasis',
    },
    {
      name: 'denn',
      function: 'Interesse / Neugier',
      functionEn: 'Interest / Curiosity',
      contexts: 'Fragen (W-Fragen und Ja-Nein-Fragen)',
      contextsEn: 'Questions (W-questions and yes/no questions)',
      meaning:
        'Shows genuine curiosity or interest in questions. Makes questions warmer and less interrogative.',
      meaningDe:
        'Zeigt echtes Interesse oder Neugier in Fragen. Dadurch klingen Fragen wärmer und weniger wie ein Verhör.',
      examples: [
        {
          type: 'W-Frage',
          de: 'Was machst du {denn} hier?',
          en: "What are you doing here? (I'm curious!)",
        },
        { type: 'W-Frage', de: 'Wie heißt du {denn}?', en: "So what's your name?" },
        {
          type: 'Ja-Nein-Frage',
          de: 'Hast du {denn} keine Zeit?',
          en: "Don't you have time? (I'm surprised)",
        },
      ],
      tip: "Without 'denn', questions can sound like a police interrogation. With 'denn', they become friendly and conversational. Use it in almost every casual question!",
      tipDe:
        "Ohne 'denn' können Fragen schnell sehr direkt klingen. Mit 'denn' werden sie freundlicher und gesprächiger. In lockeren Alltagsfragen passt es sehr oft.",
      category: 'questions',
    },
    {
      name: 'eigentlich',
      function: 'Themenwechsel / echtes Interesse',
      functionEn: 'Topic shift / Genuine interest',
      contexts: 'Fragen (W-Fragen und Ja-Nein-Fragen)',
      contextsEn: 'Questions (W-questions and yes/no questions)',
      meaning:
        "Signals a change of topic or deeper curiosity: 'by the way...' / 'when you think about it...'",
      meaningDe:
        "Markiert einen Themenwechsel oder echtes Nachfragen: 'übrigens...', 'wo wir gerade dabei sind...' oder 'wenn man genauer darüber nachdenkt...'.",
      examples: [
        {
          type: 'W-Frage',
          de: 'Was willst du {eigentlich} werden?',
          en: 'What do you actually want to become?',
        },
        { type: 'W-Frage', de: 'Wer ist das {eigentlich}?', en: 'Who is that, anyway?' },
        {
          type: 'Ja-Nein-Frage',
          de: 'Bist du {eigentlich} müde?',
          en: 'Are you actually tired (by the way)?',
        },
      ],
      tip: "'Eigentlich' in questions signals 'I've been wondering...' or 'by the way...'. Great for steering conversations toward new topics.",
      tipDe:
        "'Eigentlich' in Fragen signalisiert: 'Das wollte ich schon länger fragen...' oder 'übrigens...'. Es eignet sich gut, um ein Gespräch sanft auf ein neues Thema zu lenken.",
      category: 'questions',
    },
    {
      name: 'ja',
      function: 'Bestätigung / gemeinsames Wissen',
      functionEn: 'Confirmation / Shared knowledge',
      contexts: 'Aussagesätze · Aufforderungssätze · Ausrufesätze',
      contextsEn: 'Statements · Requests · Exclamations',
      meaning:
        'Signals shared knowledge in statements, urgent warnings in imperatives, and strong surprise in exclamations.',
      meaningDe:
        'Signalisiert in Aussagen gemeinsames Wissen, in Aufforderungen eine dringende Warnung und in Ausrufen starke Überraschung.',
      examples: [
        {
          type: 'Aussagesatz',
          de: 'Du weißt {ja}, wie er ist.',
          en: 'You know how he is. (as we both know)',
        },
        {
          type: 'Aufforderungssatz',
          de: 'Sei {ja} vorsichtig!',
          en: 'Be careful — I really mean it!',
        },
        { type: 'Aufforderungssatz', de: 'Mach das {ja} nicht!', en: "Don't you dare do that!" },
        { type: 'Ausrufesatz', de: 'Das ist {ja} toll!', en: "Wow, that's great!" },
        {
          type: 'Ausrufesatz',
          de: 'Du bist {ja} völlig durchgefroren!',
          en: "You're completely frozen through!",
        },
      ],
      tip: "'Ja' as a particle ≠ 'ja' as 'yes'. Statements: shared knowledge ('as you know'). Imperatives: urgent warning ('make sure you…!'). Exclamations: surprise ('wow!').",
      tipDe:
        "'Ja' als Modalpartikel ist nicht dasselbe wie 'ja' als Antwort. In Aussagen verweist es auf gemeinsames Wissen, in Aufforderungen warnt es dringend, in Ausrufen zeigt es Überraschung.",
      category: 'emphasis',
    },
    {
      name: 'aber',
      function: 'Überraschung / Verstärkung',
      functionEn: 'Surprise / Intensification',
      contexts: 'Ausrufesätze',
      contextsEn: 'Exclamations',
      meaning: "Expresses surprise or intensifies an exclamation. Similar to 'really' or 'wow'.",
      meaningDe:
        "Drückt Überraschung aus oder verstärkt einen Ausruf. Es klingt ähnlich wie 'wirklich' oder 'wow'.",
      examples: [
        {
          type: 'Ausrufesatz',
          de: 'Das ist {aber} nett!',
          en: "That's really nice! (more than expected)",
        },
        {
          type: 'Ausrufesatz',
          de: 'Du bist {aber} groß geworden!',
          en: "Wow, you've really grown!",
        },
        { type: 'Ausrufesatz', de: 'Das war {aber} teuer!', en: 'That was really expensive!' },
      ],
      tip: "'Aber' as a particle is NOT 'but'. It exclaims surprise at intensity: something is more [adjective] than expected. Think of it as 'wow, really!'",
      tipDe:
        "'Aber' als Modalpartikel bedeutet nicht 'but'. Es drückt aus, dass etwas stärker, grösser, netter oder extremer ist als erwartet: 'wow, wirklich!'.",
      category: 'emphasis',
    },
    {
      name: 'auch',
      function: 'Vergewisserung / Bedenken',
      functionEn: 'Reassurance / Concern',
      contexts: 'Ja-Nein-Fragen · W-Fragen',
      contextsEn: 'Yes/no questions · W-questions',
      meaning:
        'In questions: expresses doubt, concern, or the need for reassurance. In W-questions it can also signal frustration.',
      meaningDe:
        'In Fragen drückt es Zweifel, Sorge oder den Wunsch nach Vergewisserung aus. In W-Fragen kann es auch Frust oder Vorwurf signalisieren.',
      examples: [
        {
          type: 'Ja-Nein-Frage',
          de: 'Hast du {auch} abgeschlossen?',
          en: 'Did you really lock up? (I want to be sure)',
        },
        { type: 'Ja-Nein-Frage', de: 'Bist du dir {auch} sicher?', en: 'Are you really sure?' },
        {
          type: 'W-Frage',
          de: 'Warum ist er {auch} so stur?',
          en: 'Why does he have to be so stubborn?!',
        },
        {
          type: 'W-Frage',
          de: 'Wer geht {auch} bei dem Wetter raus?',
          en: 'Who on earth goes outside in this weather?',
        },
      ],
      tip: "'Auch' as a particle ≠ 'also / too'. In Ja-Nein-Fragen it seeks reassurance ('really?'). In W-Fragen it often expresses frustration or reproach: 'why does it have to be…?!'",
      tipDe:
        "'Auch' als Modalpartikel bedeutet nicht 'also' oder 'too'. In Ja-Nein-Fragen sucht es Bestätigung: 'wirklich?'. In W-Fragen klingt es oft frustriert oder vorwurfsvoll: 'Warum muss es ausgerechnet so sein?!'.",
      category: 'questions',
    },
    {
      name: 'ruhig',
      function: 'Ermutigung / Erlaubnis',
      functionEn: 'Encouragement / Permission',
      contexts: 'Aussagesätze · Aufforderungen',
      contextsEn: 'Statements · Requests',
      meaning: "Encourages someone to do something freely, without worry. 'Go ahead, feel free!'",
      meaningDe:
        "Ermutigt jemanden, etwas ohne Sorge zu tun. Der Ton ist: 'Nur zu, kein Problem!'.",
      examples: [
        { type: 'Aussagesatz', de: 'Du kannst {ruhig} bleiben.', en: 'You can stay, no problem.' },
        { type: 'Aufforderung', de: 'Frag {ruhig}!', en: "Go ahead and ask! (don't be shy)" },
        {
          type: 'Aufforderung',
          de: 'Nimm dir {ruhig} noch ein Stück.',
          en: 'Help yourself to another piece.',
        },
      ],
      tip: "'Ruhig' as a particle ≠ 'quiet/calm'. It gives permission or encouragement. Signals: 'I'm okay with it, don't hold back!'",
      tipDe:
        "'Ruhig' als Modalpartikel bedeutet nicht 'still' oder 'calm'. Es gibt Erlaubnis oder Ermutigung: 'Für mich ist das okay, halte dich nicht zurück!'.",
      category: 'softening',
    },
    {
      name: 'bloß',
      function: 'Warnung / Verzweiflung',
      functionEn: 'Warning / Desperation',
      contexts: 'Aufforderungen · W-Fragen',
      contextsEn: 'Requests · W-questions',
      meaning:
        'Adds urgency to warnings and intensifies W-questions with desperation or bewilderment.',
      meaningDe: 'Verstärkt Warnungen und macht W-Fragen verzweifelter oder ratloser.',
      examples: [
        { type: 'Aufforderung', de: 'Mach das {bloß} nicht!', en: "Don't you dare do that!" },
        {
          type: 'Aufforderung',
          de: 'Fahr {bloß} vorsichtig!',
          en: 'Drive carefully! (I mean it!)',
        },
        { type: 'W-Frage', de: 'Was habe ich {bloß} getan?', en: 'What on earth have I done?' },
        {
          type: 'W-Frage',
          de: 'Warum hast du {bloß} nichts gesagt?',
          en: "Why on earth didn't you say anything?",
        },
      ],
      tip: "'Bloß' in imperatives = strong warning. In W-questions = desperation or bewilderment. Synonym: 'nur' works the same way as a particle.",
      tipDe:
        "'Bloß' in Aufforderungen ist eine starke Warnung. In W-Fragen klingt es verzweifelt oder ratlos. 'Nur' funktioniert als Modalpartikel sehr ähnlich.",
      category: 'urgency',
    },
    {
      name: 'halt',
      function: 'Resignation / Unabänderlichkeit',
      functionEn: 'Resignation / Inevitability',
      contexts: 'Aussagesätze',
      contextsEn: 'Statements',
      meaning:
        "Signals acceptance: 'that's just how it is.' Similar to 'eben' but more colloquial (southern German).",
      meaningDe:
        "Signalisiert Akzeptanz oder Resignation: 'So ist es nun einmal.' Ähnlich wie 'eben', aber umgangssprachlicher und besonders im Süden sehr häufig.",
      examples: [
        { type: 'Aussagesatz', de: 'Das ist {halt} so.', en: "That's just the way it is." },
        {
          type: 'Aussagesatz',
          de: 'Dann musst du {halt} früher aufstehen.',
          en: 'Then you just have to get up earlier.',
        },
        {
          type: 'Aussagesatz',
          de: 'Man kann {halt} nicht alles haben.',
          en: "You just can't have everything.",
        },
      ],
      tip: "'Halt' is very common in spoken German, especially in the south. Expresses resignation — there's no alternative. 'Eben' and 'nun (ein)mal' are near-equivalents.",
      tipDe:
        "'Halt' ist in der gesprochenen Sprache sehr häufig, besonders im Süden. Es drückt Resignation aus: Es gibt keine echte Alternative. 'Eben' und 'nun (ein)mal' sind sehr nah daran.",
      category: 'emphasis',
    },
    {
      name: 'eben',
      function: 'Bestätigung / Unvermeidlichkeit',
      functionEn: 'Confirmation / Inevitability',
      contexts: 'Aussagesätze',
      contextsEn: 'Statements',
      meaning: "Confirms something as inevitable or obvious. 'That's precisely it / exactly.'",
      meaningDe:
        "Bestätigt etwas als unvermeidlich, naheliegend oder genau zutreffend: 'Genau das ist es.'",
      examples: [
        {
          type: 'Aussagesatz',
          de: 'Das ist {eben} der Unterschied.',
          en: "That's precisely the difference.",
        },
        {
          type: 'Aussagesatz',
          de: 'Er ist {eben} so.',
          en: "He's just like that. (nothing to do about it)",
        },
        {
          type: 'Aussagesatz',
          de: 'Dann bleiben wir {eben} hier.',
          en: "Then we'll just stay here.",
        },
      ],
      tip: "'Eben', 'halt' and 'nun (ein)mal' are near-synonyms. 'Eben' is more common in northern Germany, 'halt' in the south. All signal 'no alternative, deal with it.'",
      tipDe:
        "'Eben', 'halt' und 'nun (ein)mal' sind fast synonym. 'Eben' hört man eher im Norden, 'halt' eher im Süden. Alle signalisieren: Es ist so, daran lässt sich nichts ändern.",
      category: 'emphasis',
    },
    {
      name: 'nun einmal',
      function: 'Unabänderlichkeit / Akzeptanz',
      functionEn: 'Inevitability / Acceptance',
      contexts: 'Aussagesätze',
      contextsEn: 'Statements',
      meaning:
        "Expresses 'that's just how it is' — a resigned acceptance. Synonym of 'eben' and 'halt'. Very often shortened to 'nun mal'.",
      meaningDe:
        "Drückt aus: 'So ist es nun einmal' - eine resignierte Akzeptanz. Synonym zu 'eben' und 'halt'. Im Alltag oft zu 'nun mal' verkürzt.",
      examples: [
        { type: 'Aussagesatz', de: 'Das ist {nun einmal} so.', en: "That's just the way it is." },
        {
          type: 'Aussagesatz',
          de: 'Er ist {nun mal} der Chef.',
          en: "He's the boss, and that's that.",
        },
        {
          type: 'Aussagesatz',
          de: 'So ist das Leben {nun mal}.',
          en: "That's life, simple as that.",
        },
      ],
      tip: "Fully interchangeable with 'eben' and 'halt'. 'Nun mal' is the everyday spoken form; 'nun einmal' feels slightly more formal. Both particles travel together as a unit.",
      tipDe:
        "Meist austauschbar mit 'eben' und 'halt'. 'Nun mal' ist die gesprochene Alltagsform, 'nun einmal' klingt etwas formeller. Die Wörter gehören hier als Einheit zusammen.",
      category: 'emphasis',
    },
    {
      name: 'wohl',
      function: 'Vermutung / Unsicherheit',
      functionEn: 'Assumption / Uncertainty',
      contexts: 'Aussagesätze',
      contextsEn: 'Statements',
      meaning: "Expresses assumption or probability. 'Probably / I suppose / presumably.'",
      meaningDe:
        "Drückt eine Vermutung oder Wahrscheinlichkeit aus: 'wahrscheinlich', 'vermutlich', 'ich nehme an'.",
      examples: [
        { type: 'Aussagesatz', de: 'Er ist {wohl} krank.', en: "He's probably sick." },
        { type: 'Aussagesatz', de: 'Das wird {wohl} stimmen.', en: "That's presumably true." },
        { type: 'Aussagesatz', de: 'Du hast {wohl} recht.', en: "I suppose you're right." },
      ],
      tip: "'Wohl' signals you're not 100% sure but it's your best guess. Softer than 'wahrscheinlich' — more like 'I'd think so.'",
      tipDe:
        "'Wohl' zeigt: Du bist dir nicht ganz sicher, aber es ist deine beste Vermutung. Es klingt weicher als 'wahrscheinlich', eher wie 'ich denke schon'.",
      category: 'hedging',
    },
    {
      name: 'schon',
      function: 'Zuversicht / Einschränkung',
      functionEn: 'Confidence / Concession',
      contexts: 'Aussagesätze · W-Fragen (rhetorisch)',
      contextsEn: 'Statements · W-questions (rhetorical)',
      meaning:
        "In statements: reassuring confidence ('don't worry, it'll be fine') or concession. In rhetorical W-questions: implies 'nobody'.",
      meaningDe:
        "In Aussagen zeigt es beruhigende Zuversicht oder eine Einschränkung. In rhetorischen W-Fragen ist die implizite Antwort oft 'niemand' oder 'nichts'.",
      examples: [
        {
          type: 'Aussagesatz',
          de: 'Das wird {schon} klappen.',
          en: "It'll work out. (don't worry)",
        },
        { type: 'Aussagesatz', de: 'Das stimmt {schon}, aber...', en: "That's true, sure, but..." },
        {
          type: 'W-Frage',
          de: 'Wer will das {schon}?',
          en: "Who'd want that? (nobody, rhetorical)",
        },
        {
          type: 'W-Frage',
          de: 'Was soll {schon} passieren?',
          en: 'What could possibly go wrong? (nothing)',
        },
      ],
      tip: "'Schon' as a particle ≠ 'already'. Statements: reassurance or concession. Rhetorical W-questions: the implied answer is 'nobody / nothing'.",
      tipDe:
        "'Schon' als Modalpartikel bedeutet nicht einfach 'already'. In Aussagen beruhigt es oder räumt etwas ein. In rhetorischen W-Fragen ist die erwartete Antwort oft 'niemand' oder 'nichts'.",
      category: 'hedging',
    },
    {
      name: 'nur',
      function: 'Warnung / Verzweiflung / Wunsch',
      functionEn: 'Warning / Desperation / Wish',
      contexts: 'Aufforderungen · Fragen · Wunschsätze',
      contextsEn: 'Requests · Questions · Wishes',
      meaning:
        "Adds urgency to warnings (like 'bloß'). In W-questions expresses helplessness. In 'wenn'-wishes means 'if only'.",
      meaningDe:
        "Verstärkt Warnungen, ähnlich wie 'bloß'. In W-Fragen klingt es hilflos; in Wünschen mit 'wenn' bedeutet es 'wenn doch nur'.",
      examples: [
        { type: 'Aufforderung', de: 'Lass das {nur}!', en: "Stop that! (I'm warning you)" },
        {
          type: 'W-Frage',
          de: 'Was soll ich {nur} machen?',
          en: 'What am I supposed to do? (helpless)',
        },
        { type: 'Wunschsatz', de: 'Wenn er {nur} hier wäre!', en: 'If only he were here!' },
      ],
      tip: "'Nur' as a particle = 'bloß'. In wishes with 'wenn...nur' it means 'if only'. Don't confuse with 'nur' meaning 'only'.",
      tipDe:
        "'Nur' als Modalpartikel funktioniert oft wie 'bloß'. In Wünschen mit 'wenn ... nur' bedeutet es 'if only'. Nicht verwechseln mit 'nur' im Sinn von 'only'.",
      category: 'urgency',
    },
    {
      name: 'etwa',
      function: 'Unglaube / rhetorische Frage',
      functionEn: 'Disbelief / Rhetorical question',
      contexts: 'Ja-Nein-Fragen',
      contextsEn: 'Yes/no questions',
      meaning: "Signals disbelief in yes/no questions. The speaker hopes the answer is 'no'.",
      meaningDe:
        "Signalisiert Unglauben in Ja-Nein-Fragen. Die sprechende Person hofft meistens auf die Antwort 'nein'.",
      examples: [
        { type: 'Ja-Nein-Frage', de: 'Bist du {etwa} krank?', en: "Don't tell me you're sick?!" },
        {
          type: 'Ja-Nein-Frage',
          de: 'Willst du {etwa} aufgeben?',
          en: "You're not going to give up, are you?!",
        },
        {
          type: 'Ja-Nein-Frage',
          de: 'Hast du {etwa} gelogen?',
          en: 'Did you actually lie?! (please say no)',
        },
      ],
      tip: "'Etwa' in questions means 'surely not?!' or 'don't tell me...'. The speaker expects and hopes for 'nein'. Shows shock or disbelief.",
      tipDe:
        "'Etwa' in Fragen bedeutet ungefähr 'doch nicht etwa?!' oder 'willst du mir sagen, dass...?'. Es zeigt Schock oder Unglauben; die erwartete Antwort ist meist 'nein'.",
      category: 'questions',
    },
    {
      name: 'vielleicht',
      function: 'Überraschung / Ausruf',
      functionEn: 'Surprise / Exclamation',
      contexts: 'Ausrufesätze',
      contextsEn: 'Exclamations',
      meaning: "In exclamations: expresses strong surprise or disbelief. Not 'maybe'!",
      meaningDe:
        "In Ausrufen drückt es starke Überraschung oder Unglauben aus. Es bedeutet hier nicht 'maybe'!",
      examples: [
        {
          type: 'Ausrufesatz',
          de: 'Das ist {vielleicht} ein Chaos!',
          en: 'What a mess this is! (wow)',
        },
        {
          type: 'Ausrufesatz',
          de: 'Du bist {vielleicht} ein Held!',
          en: 'Some hero you are! (ironic)',
        },
        { type: 'Ausrufesatz', de: 'Das war {vielleicht} ein Tag!', en: 'What a day that was!' },
      ],
      tip: "As a particle, 'vielleicht' does NOT mean 'maybe'. Expresses amazement at how extreme something is. Always in exclamations, never in questions.",
      tipDe:
        "Als Modalpartikel bedeutet 'vielleicht' nicht 'maybe'. Es zeigt Staunen darüber, wie extrem etwas ist. Diese Verwendung steht in Ausrufen, nicht in Fragen.",
      category: 'emphasis',
    },
  ];

  const categories = {
    softening: { label: 'Abschwächung' },
    emphasis: { label: 'Verstärkung' },
    questions: { label: 'Fragen' },
    urgency: { label: 'Dringlichkeit' },
    hedging: { label: 'Absicherung' },
  };
  const categoriesEn = {
    softening: 'Softening',
    emphasis: 'Emphasis',
    questions: 'Questions',
    urgency: 'Urgency',
    hedging: 'Hedging',
  };
  const uiCopy = {
    expandHint: { en: '▸ Show tip', de: '▸ Tipp anzeigen' },
    question: { en: 'Question', de: 'Frage' },
    of: { en: 'of', de: 'von' },
    chooseParticles: {
      en: 'Choose modal particles to practise',
      de: 'Modalpartikeln zum Üben auswählen',
    },
    allParticles: { en: 'All', de: 'Alle' },
    clearParticles: { en: 'Clear', de: 'Auswahl leeren' },
    selectedCount: { en: 'selected', de: 'ausgewählt' },
    noQuestions: {
      en: 'Select at least one particle to start the quiz.',
      de: 'Wähle mindestens eine Partikel aus, um das Quiz zu starten.',
    },
    noMatchingQuestions: {
      en: 'No quiz questions match this selection yet.',
      de: 'Zu dieser Auswahl gibt es noch keine Quizfragen.',
    },
    acceptedAnswers: { en: 'Accepted answers', de: 'Mögliche Lösungen' },
    answers: { en: 'Answer options', de: 'Antwortoptionen' },
    next: { en: 'Next ->', de: 'Weiter ->' },
    results: {
      en: ['Fantastic!', 'Well done!', 'Keep practising!'],
      de: ['Fantastisch!', 'Gut gemacht!', 'Weiter üben!'],
    },
    messages: {
      en: [
        'You really understand these particles well!',
        'Solid foundations - have another look at the reference.',
        'No problem - read the reference and try again!',
      ],
      de: [
        'Du beherrschst die Partikeln wirklich gut!',
        'Solide Grundlagen - schau dir die Übersicht nochmal an.',
        'Kein Problem - lies die Übersicht und versuche es nochmal!',
      ],
    },
    restart: { en: 'Play again', de: 'Nochmal spielen' },
  };

  // ========== QUIZ DATA ==========
  const quizQuestions = [
    {
      sentence: 'Kannst du mir ___ helfen?',
      translation: 'Can you help me for a sec?',
      answers: [
        {
          value: 'mal',
          explanation:
            "'Mal' softens the request, making it more casual and friendly, like adding 'just' or 'for a sec'.",
          explanationDe:
            "'Mal' macht die Bitte weicher, lockerer und freundlicher - ähnlich wie 'kurz' oder 'mal eben'.",
        },
      ],
      options: ['mal', 'doch', 'ja', 'eben'],
      context: 'Polite, casual request to a friend.',
      contextDe: 'Eine höfliche, lockere Bitte an eine Freundin oder einen Freund.',
    },
    {
      sentence: 'Das ist ___ Unsinn!',
      translation: "That's nonsense! (come on!)",
      answers: [
        {
          value: 'doch',
          explanation:
            "'Doch' expresses contradiction. The speaker is pushing back: no, that really is nonsense, and you should know that.",
          explanationDe:
            "'Doch' drückt Widerspruch aus. Die sprechende Person widerspricht deutlich: Nein, das ist wirklich Unsinn, und das solltest du eigentlich wissen.",
        },
      ],
      options: ['aber', 'doch', 'halt', 'wohl'],
      context: 'Contradicting someone who made a wrong claim.',
      contextDe: 'Widerspruch gegen eine falsche Behauptung.',
    },
    {
      sentence: 'Was machst du ___ hier?',
      translation: "What are you doing here? (I'm curious)",
      answers: [
        {
          value: 'denn',
          explanation:
            "'Denn' adds friendly curiosity to a question. Without it, the question can sound more direct or accusatory.",
          explanationDe:
            "'Denn' gibt der Frage freundliche Neugier. Ohne 'denn' kann sie direkter oder sogar vorwurfsvoll klingen.",
        },
      ],
      options: ['denn', 'eigentlich', 'bloß', 'etwa'],
      context: 'You meet a friend somewhere unexpected.',
      contextDe: 'Du triffst unerwartet eine bekannte Person.',
    },
    {
      sentence: 'Du weißt ___, wie er ist.',
      translation: 'You know how he is. (as we both know)',
      answers: [
        {
          value: 'ja',
          explanation: "'Ja' signals shared knowledge: you know this already, and we both know it.",
          explanationDe:
            "'Ja' signalisiert gemeinsames Wissen: Du weisst das bereits, und wir beide wissen es.",
        },
        {
          value: 'doch',
          explanation:
            "'Doch' can also work when the reminder pushes a little harder: you do know how he is, after all.",
          explanationDe:
            "'Doch' passt ebenfalls, wenn die Erinnerung etwas nachdrücklicher klingt: Du weisst doch, wie er ist.",
        },
      ],
      options: ['ja', 'doch', 'schon', 'halt'],
      context: 'Reminding someone of common knowledge.',
      contextDe: 'Jemand wird an etwas erinnert, das eigentlich bekannt ist.',
    },
    {
      sentence: 'Das ist ___ nett von dir!',
      translation: "That's really nice of you! (more than expected)",
      answers: [
        {
          value: 'aber',
          explanation: "'Aber' expresses surprised intensity: wow, that is really nice.",
          explanationDe: "'Aber' drückt überraschte Verstärkung aus: Wow, das ist wirklich nett.",
        },
        {
          value: 'ja',
          explanation:
            "'Ja' can also express surprise in exclamations, as if the speaker has just noticed how nice it is.",
          explanationDe:
            "'Ja' kann in Ausrufen ebenfalls Überraschung ausdrücken, als würde die sprechende Person gerade merken, wie nett das ist.",
        },
      ],
      options: ['mal', 'aber', 'ja', 'doch'],
      context: 'Someone does something unexpectedly kind.',
      contextDe: 'Jemand tut unerwartet etwas Nettes.',
    },
    {
      sentence: 'Mach das ___ nicht!',
      translation: "Don't you dare do that!",
      answers: [
        {
          value: 'bloß',
          explanation: "'Bloß' in commands is an urgent warning: whatever you do, do not do that.",
          explanationDe:
            "'Bloß' ist in Aufforderungen eine dringende Warnung: Mach das auf keinen Fall.",
        },
        {
          value: 'ja',
          explanation:
            "'Ja' in a negative command also gives a strong warning: make absolutely sure you do not do that.",
          explanationDe:
            "'Ja' verstärkt eine negative Aufforderung ebenfalls stark: Pass unbedingt auf, dass du das nicht machst.",
        },
      ],
      options: ['ruhig', 'bloß', 'mal', 'ja'],
      context: 'Strong warning to someone about to do something dangerous.',
      contextDe: 'Eine starke Warnung an jemanden, der etwas Gefährliches tun könnte.',
    },
    {
      sentence: 'Du kannst ___ fragen.',
      translation: "Go ahead and ask. (don't be shy)",
      answers: [
        {
          value: 'ruhig',
          explanation:
            "'Ruhig' gives permission and encouragement: feel free, I do not mind, go for it.",
          explanationDe:
            "'Ruhig' gibt Erlaubnis und Ermutigung: Nur zu, frag ruhig, das ist völlig okay.",
        },
      ],
      options: ['ruhig', 'mal', 'schon', 'doch'],
      context: 'Encouraging someone who is hesitant.',
      contextDe: 'Ermutigung für jemanden, der noch zögert.',
    },
    {
      sentence: 'Das ist ___ so.',
      translation: "That's just the way it is.",
      answers: [
        {
          value: 'halt',
          explanation:
            "'Halt' signals resigned acceptance, especially colloquially: there is no alternative.",
          explanationDe:
            "'Halt' signalisiert resignierte Akzeptanz, besonders umgangssprachlich: Es gibt keine echte Alternative.",
        },
        {
          value: 'eben',
          explanation: "'Eben' also signals inevitability or acceptance: that is simply how it is.",
          explanationDe:
            "'Eben' zeigt ebenfalls Unvermeidlichkeit oder Akzeptanz: So ist es einfach.",
        },
        {
          value: 'nun mal',
          explanation:
            "'Nun mal' is another natural version of the same idea: that is just the way things are.",
          explanationDe:
            "'Nun mal' ist eine weitere natürliche Variante derselben Idee: So ist es nun einmal.",
        },
      ],
      options: ['eben', 'halt', 'nun mal', 'wohl'],
      context: 'Accepting an unchangeable situation.',
      contextDe: 'Akzeptanz einer Situation, die sich nicht ändern lässt.',
    },
    {
      sentence: 'Er ist ___ krank.',
      translation: "He's probably sick.",
      answers: [
        {
          value: 'wohl',
          explanation: "'Wohl' expresses probability: I think so, but I am not completely certain.",
          explanationDe:
            "'Wohl' drückt eine Vermutung aus: Ich denke schon, bin mir aber nicht ganz sicher.",
        },
      ],
      options: ['wohl', 'ja', 'eigentlich', 'schon'],
      context: 'Guessing why someone did not come to work.',
      contextDe: 'Eine Vermutung darüber, warum jemand nicht zur Arbeit gekommen ist.',
    },
    {
      sentence: 'Das wird ___ klappen.',
      translation: "It'll work out. (don't worry)",
      answers: [
        {
          value: 'schon',
          explanation: "'Schon' is reassuring here: trust me, it will be fine.",
          explanationDe: "'Schon' wirkt hier beruhigend: Vertrau darauf, es wird gutgehen.",
        },
      ],
      options: ['schon', 'wohl', 'mal', 'doch'],
      context: 'Reassuring a worried friend.',
      contextDe: 'Beruhigung für eine besorgte Freundin oder einen besorgten Freund.',
    },
    {
      sentence: 'Wer ist das ___?',
      translation: 'Who is that, anyway?',
      answers: [
        {
          value: 'eigentlich',
          explanation:
            "'Eigentlich' signals 'I have been meaning to ask' or 'by the way'. It shifts the topic gently.",
          explanationDe:
            "'Eigentlich' signalisiert: Das wollte ich schon länger fragen, oder: übrigens. Es lenkt das Gespräch sanft auf ein neues Thema.",
        },
        {
          value: 'denn',
          explanation:
            "'Denn' also works in a friendly question, adding curiosity and conversational warmth.",
          explanationDe:
            "'Denn' funktioniert ebenfalls in einer freundlichen Frage und macht sie neugieriger und wärmer.",
        },
      ],
      options: ['denn', 'eigentlich', 'etwa', 'bloß'],
      context: 'Changing topic; you have been wondering.',
      contextDe: 'Ein Themenwechsel; du hast dich das schon gefragt.',
    },
    {
      sentence: 'Bist du ___ krank?',
      translation: "Don't tell me you're sick?!",
      answers: [
        {
          value: 'etwa',
          explanation:
            "'Etwa' expresses disbelief in yes/no questions. The speaker hopes the answer is no.",
          explanationDe:
            "'Etwa' drückt Unglauben in Ja-Nein-Fragen aus. Die sprechende Person hofft, dass die Antwort nein ist.",
        },
      ],
      options: ['etwa', 'denn', 'vielleicht', 'wohl'],
      context: 'Shocked reaction, hoping the answer is no.',
      contextDe: 'Eine erschrockene Reaktion, bei der man auf ein Nein hofft.',
    },
    {
      sentence: 'Das ist ___ ein Chaos!',
      translation: 'What a mess! (wow)',
      answers: [
        {
          value: 'vielleicht',
          explanation:
            "'Vielleicht' as a particle does not mean 'maybe'. In exclamations it expresses amazement at how extreme something is.",
          explanationDe:
            "'Vielleicht' bedeutet als Modalpartikel nicht 'maybe'. In Ausrufen zeigt es Staunen darüber, wie extrem etwas ist.",
        },
        {
          value: 'aber',
          explanation: "'Aber' can also intensify an exclamation: that is really quite a mess.",
          explanationDe:
            "'Aber' kann einen Ausruf ebenfalls verstärken: Das ist wirklich ein ziemliches Chaos.",
        },
      ],
      options: ['aber', 'vielleicht', 'ja', 'doch'],
      context: 'Exclaiming about how extreme a situation is.',
      contextDe: 'Ein Ausruf darüber, wie extrem eine Situation ist.',
    },
    {
      sentence: 'Wenn er ___ hier wäre!',
      translation: 'If only he were here!',
      answers: [
        {
          value: 'nur',
          explanation: "'Nur' in wishes with 'wenn' means 'if only'.",
          explanationDe: "'Nur' bedeutet in Wünschen mit 'wenn': wenn doch nur.",
        },
        {
          value: 'bloß',
          explanation: "'Bloß' works like 'nur' in this wish and makes the longing sound stronger.",
          explanationDe:
            "'Bloß' funktioniert hier wie 'nur' und lässt den Wunsch noch intensiver klingen.",
        },
        {
          value: 'doch',
          explanation:
            "'Doch' also expresses longing in wishes, especially when the speaker is emotionally invested.",
          explanationDe:
            "'Doch' drückt in Wünschen ebenfalls Sehnsucht aus, besonders wenn die sprechende Person emotional beteiligt ist.",
        },
      ],
      options: ['nur', 'bloß', 'mal', 'doch'],
      context: "Expressing a wish, longing for someone's presence.",
      contextDe: 'Ein Wunsch voller Sehnsucht nach der Anwesenheit einer Person.',
    },
    {
      sentence: 'Dann bleiben wir ___ hier.',
      translation: "Then we'll just stay here.",
      answers: [
        {
          value: 'eben',
          explanation:
            "'Eben' signals resigned acceptance: there is no alternative, so this is what we will do.",
          explanationDe:
            "'Eben' signalisiert resignierte Akzeptanz: Es gibt keine Alternative, also machen wir es so.",
        },
        {
          value: 'halt',
          explanation: "'Halt' gives the same acceptance in a more colloquial tone.",
          explanationDe: "'Halt' drückt dieselbe Akzeptanz aus, klingt aber umgangssprachlicher.",
        },
      ],
      options: ['eben', 'halt', 'schon', 'ruhig'],
      context: 'Accepting a situation, for example because the restaurant is full.',
      contextDe: 'Akzeptanz einer Situation, zum Beispiel weil das Restaurant voll ist.',
    },
    {
      sentence: 'Hast du ___ abgeschlossen?',
      translation: 'Did you really lock up? (I want to be sure)',
      answers: [
        {
          value: 'auch',
          explanation: "'Auch' in yes/no questions seeks reassurance: are you really sure?",
          explanationDe: "'Auch' sucht in Ja-Nein-Fragen Bestätigung: Bist du wirklich sicher?",
        },
      ],
      options: ['auch', 'denn', 'etwa', 'eigentlich'],
      context: 'Leaving the house and double-checking with your partner.',
      contextDe: 'Beim Verlassen des Hauses wird noch einmal nachgefragt.',
    },
    {
      sentence: 'Warum ist er ___ so stur?',
      translation: 'Why does he have to be so stubborn?!',
      answers: [
        {
          value: 'auch',
          explanation:
            "'Auch' in W-questions can express frustration or reproach: why does it have to be like this?",
          explanationDe:
            "'Auch' kann in W-Fragen Frust oder Vorwurf ausdrücken: Warum muss es ausgerechnet so sein?",
        },
        {
          value: 'bloß',
          explanation:
            "'Bloß' also works here, but sounds more helpless or bewildered: why on earth is he so stubborn?",
          explanationDe:
            "'Bloß' passt hier ebenfalls, klingt aber hilfloser oder ratloser: Warum um alles in der Welt ist er so stur?",
        },
      ],
      options: ['auch', 'bloß', 'denn', 'schon'],
      context: 'Frustrated about a stubborn friend.',
      contextDe: 'Frust über eine sture Person.',
    },
    {
      sentence: 'Er ist ___ der Chef.',
      translation: "He's the boss, and that's that.",
      answers: [
        {
          value: 'nun mal',
          explanation: "'Nun mal' signals resigned acceptance: that is simply how things are.",
          explanationDe: "'Nun mal' signalisiert resignierte Akzeptanz: So sind die Dinge einfach.",
        },
        {
          value: 'eben',
          explanation:
            "'Eben' can express the same inevitability: he is the boss, so that settles it.",
          explanationDe:
            "'Eben' kann dieselbe Unvermeidlichkeit ausdrücken: Er ist der Chef, damit ist die Sache entschieden.",
        },
        {
          value: 'halt',
          explanation: "'Halt' is another colloquial alternative with the same accepting tone.",
          explanationDe:
            "'Halt' ist eine weitere, umgangssprachlichere Alternative mit demselben akzeptierenden Ton.",
        },
      ],
      options: ['nun mal', 'eben', 'halt', 'wohl'],
      context: 'Resigned acceptance of a hierarchy.',
      contextDe: 'Resignierte Akzeptanz einer Hierarchie.',
    },
    {
      sentence: 'Sei ___ vorsichtig!',
      translation: 'Be careful. I really mean it!',
      answers: [
        {
          value: 'ja',
          explanation: "'Ja' in commands is an urgent warning: make sure you are careful.",
          explanationDe: "'Ja' ist in Aufforderungen eine dringende Warnung: Pass unbedingt auf.",
        },
        {
          value: 'bloß',
          explanation:
            "'Bloß' can also make the warning strong and protective: be careful, whatever you do.",
          explanationDe:
            "'Bloß' kann die Warnung ebenfalls stark und beschützend machen: Sei auf jeden Fall vorsichtig.",
        },
      ],
      options: ['ja', 'mal', 'ruhig', 'bloß'],
      context: 'Urgent warning to someone heading into a risky situation.',
      contextDe: 'Eine dringende Warnung an jemanden, der in eine riskante Situation geht.',
    },
    {
      sentence: 'Wenn er ___ hier wäre!',
      translation: 'If only he were here!',
      answers: [
        {
          value: 'doch',
          explanation: "'Doch' in wishes expresses longing, often with emotional emphasis.",
          explanationDe: "'Doch' drückt in Wünschen Sehnsucht aus, oft mit emotionalem Nachdruck.",
        },
        {
          value: 'nur',
          explanation: "'Nur' is the classic 'if only' particle in a wish like this.",
          explanationDe:
            "'Nur' ist die klassische Partikel für 'wenn doch nur' in solchen Wünschen.",
        },
        {
          value: 'bloß',
          explanation:
            "'Bloß' works like 'nur' here and can make the wish sound especially intense.",
          explanationDe:
            "'Bloß' funktioniert hier wie 'nur' und kann den Wunsch besonders intensiv klingen lassen.",
        },
      ],
      options: ['doch', 'nur', 'bloß', 'schon'],
      context: "Wishing for someone's presence at an important moment.",
      contextDe: 'Der Wunsch, dass jemand in einem wichtigen Moment da wäre.',
    },
  ];

  window.LWG_MODALPARTIKELN_DATA = {
    particles,
    categories,
    categoriesEn,
    uiCopy,
    quizQuestions,
  };
})();
