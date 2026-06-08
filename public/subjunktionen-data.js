// Each entry: { name, function, functionEn, meaning, meaningEn, examples[{de,en}], tip, tipEn, category }
(function () {
  'use strict';

  const C = {
    temporal: 'temporal',
    causal: 'causal',
    conditional: 'conditional',
    concessive: 'concessive',
    comparative: 'comparative',
    consecutive: 'consecutive',
    modal: 'modal',
    restrictive: 'restrictive',
    content: 'content',
    adversative: 'adversative',
  };

  const connectors = [
    {
      name: 'als',
      function: 'einmaliger Zeitpunkt in der Vergangenheit',
      functionEn: 'single point in the past',
      meaning: 'Benutze "als" für etwas, das einmal in der Vergangenheit passiert ist.',
      meaningEn: 'Use "als" for something that happened once in the past.',
      examples: [
        {
          de: '{Als} ich in Berlin war, habe ich viel Deutsch gesprochen.',
          en: 'When I was in Berlin, I spoke a lot of German.',
        },
      ],
      tip: 'Nicht mit "wenn" verwechseln: "als" = einmal in der Vergangenheit, "wenn" = wiederholt oder zukünftig.',
      tipEn:
        'Do not confuse it with "wenn": "als" = once in the past, "wenn" = repeated or future.',
      category: C.temporal,
    },
    {
      name: 'als dass',
      function: 'Folge, die nicht möglich oder angemessen ist',
      functionEn: 'result that is not possible or appropriate',
      meaning: 'Steht nach "zu" oder "genug" und zeigt: Für diese Folge reicht es nicht.',
      meaningEn: 'Follows "too" or "enough" ideas and shows that a result is not possible.',
      examples: [
        {
          de: 'Er ist zu müde, {als dass} er noch lernen könnte.',
          en: 'He is too tired to keep studying.',
        },
      ],
      tip: 'Oft mit Konjunktiv II: "zu teuer, als dass wir es kaufen könnten".',
      tipEn: 'Often used with subjunctive II: "too expensive for us to be able to buy it".',
      category: C.consecutive,
    },
    {
      name: 'als ob',
      function: 'irrealer Vergleich',
      functionEn: 'unreal comparison',
      meaning: 'Vergleicht mit einer Situation, die nur so wirkt, aber nicht sicher wahr ist.',
      meaningEn: 'Compares something to a situation that only seems true.',
      examples: [
        {
          de: 'Sie tut so, {als ob} sie nichts gehört hätte.',
          en: 'She acts as if she had heard nothing.',
        },
      ],
      tip: 'Sehr häufig mit Konjunktiv II, besonders bei irrealen Vergleichen.',
      tipEn: 'Very often used with subjunctive II, especially for unreal comparisons.',
      category: C.comparative,
    },
    {
      name: 'als wenn',
      function: 'irrealer Vergleich',
      functionEn: 'unreal comparison',
      meaning: 'Bedeutet fast dasselbe wie "als ob"; in vielen Kontexten austauschbar.',
      meaningEn: 'Means almost the same as "als ob"; often interchangeable.',
      examples: [
        {
          de: 'Es sieht aus, {als wenn} es gleich regnen würde.',
          en: 'It looks as if it might rain any moment.',
        },
      ],
      tip: '"Als ob" klingt oft etwas neutraler; "als wenn" ist ebenfalls standardsprachlich.',
      tipEn: '"Als ob" often sounds a little more neutral; "als wenn" is also standard German.',
      category: C.comparative,
    },
    {
      name: 'anstatt dass',
      function: 'nicht gewählte Alternative',
      functionEn: 'alternative that did not happen',
      meaning: 'Zeigt, was nicht passiert, obwohl es erwartet oder sinnvoll wäre.',
      meaningEn: 'Shows what does not happen although it would be expected or sensible.',
      examples: [
        {
          de: '{Anstatt dass} er fragt, probiert er es allein.',
          en: 'Instead of asking, he tries it alone.',
        },
      ],
      tip: 'Auch möglich: "statt dass". Mit gleichem Subjekt oft kürzer: "anstatt zu fragen".',
      tipEn:
        'Also possible: "statt dass". With the same subject, "anstatt zu fragen" is often shorter.',
      category: C.adversative,
    },
    {
      name: 'auch wenn',
      function: 'Einräumung',
      functionEn: 'concession',
      meaning: 'Sagt: Diese Sache stimmt, aber sie ändert das Ergebnis nicht.',
      meaningEn: 'Says: this is true, but it does not change the result.',
      examples: [
        {
          de: '{Auch wenn} es spät ist, mache ich die Aufgabe fertig.',
          en: 'Even though it is late, I will finish the task.',
        },
      ],
      tip: 'Etwas alltagssprachlicher und direkter als "obwohl".',
      tipEn: 'A little more everyday and direct than "obwohl".',
      category: C.concessive,
    },
    {
      name: 'außer dass',
      function: 'Ausnahme zu einer Aussage',
      functionEn: 'exception to a statement',
      meaning: 'Nennt den einzigen Punkt, der von einer Aussage ausgenommen ist.',
      meaningEn: 'Names the only point that is excluded from a statement.',
      examples: [
        {
          de: 'Alles war gut, {außer dass} der Zug Verspätung hatte.',
          en: 'Everything was good except that the train was delayed.',
        },
      ],
      tip: 'Nach "außer dass" folgt ein ganzer Nebensatz.',
      tipEn: 'After "außer dass", a full subordinate clause follows.',
      category: C.restrictive,
    },
    {
      name: 'außer wenn',
      function: 'Ausnahmebedingung',
      functionEn: 'exception condition',
      meaning: 'Bedeutet: nur in diesem Fall gilt die Aussage nicht.',
      meaningEn: 'Means: only in this case the statement does not apply.',
      examples: [
        {
          de: 'Wir gehen spazieren, {außer wenn} es stark regnet.',
          en: 'We will go for a walk unless it rains heavily.',
        },
      ],
      tip: 'Entspricht oft "unless" auf Englisch.',
      tipEn: 'Often corresponds to English "unless".',
      category: C.conditional,
    },
    {
      name: 'bevor',
      function: 'Zeitpunkt davor',
      functionEn: 'before',
      meaning: 'Der Nebensatz nennt das Ereignis, vor dem etwas anderes passiert.',
      meaningEn: 'The subordinate clause names the event before which something else happens.',
      examples: [
        { de: 'Ich rufe dich an, {bevor} ich losfahre.', en: 'I will call you before I leave.' },
      ],
      tip: 'Das Verb steht auch hier am Ende: "bevor ich losfahre".',
      tipEn: 'The finite verb still goes to the end: "bevor ich losfahre".',
      category: C.temporal,
    },
    {
      name: 'bis',
      function: 'Endpunkt',
      functionEn: 'until',
      meaning: 'Markiert den Zeitpunkt, an dem eine Handlung endet oder sich ändert.',
      meaningEn: 'Marks the point at which an action ends or changes.',
      examples: [
        { de: 'Ich warte, {bis} du fertig bist.', en: 'I will wait until you are finished.' },
      ],
      tip: '"Bis" kann Präposition sein ("bis Montag") oder Subjunktion ("bis du kommst").',
      tipEn: '"Bis" can be a preposition ("until Monday") or a conjunction ("until you come").',
      category: C.temporal,
    },
    {
      name: 'da',
      function: 'Grund, oft bekannt oder vorausgesetzt',
      functionEn: 'reason, often known or assumed',
      meaning: 'Gibt einen Grund an, der eher erklärend als neu wirkt.',
      meaningEn: 'Gives a reason that sounds explanatory rather than new.',
      examples: [
        {
          de: '{Da} ich morgen früh aufstehe, gehe ich heute früher schlafen.',
          en: 'Since I have to get up early tomorrow, I am going to bed earlier today.',
        },
      ],
      tip: '"Da" steht sehr oft am Satzanfang; "weil" ist neutraler und im Alltag häufiger.',
      tipEn:
        '"Da" often stands at the beginning; "weil" is more neutral and common in everyday speech.',
      category: C.causal,
    },
    {
      name: 'damit',
      function: 'Ziel oder Zweck',
      functionEn: 'purpose',
      meaning: 'Sagt, wozu etwas gemacht wird.',
      meaningEn: 'Says what something is done for.',
      examples: [
        {
          de: 'Ich schreibe es auf, {damit} ich es nicht vergesse.',
          en: 'I write it down so that I do not forget it.',
        },
      ],
      tip: 'Bei gleichem Subjekt ist oft auch "um ... zu" möglich: "Ich schreibe es auf, um es nicht zu vergessen."',
      tipEn: 'With the same subject, "um ... zu" is often possible too.',
      category: C.consecutive,
    },
    {
      name: 'dass',
      function: 'Inhalt eines Gedankens, Sagens oder Gefühls',
      functionEn: 'content of a thought, statement, or feeling',
      meaning: 'Leitet einen Inhaltssatz ein: Was wird gesagt, gedacht, gehofft oder gewusst?',
      meaningEn: 'Introduces a content clause: what is said, thought, hoped, or known?',
      examples: [{ de: 'Ich glaube, {dass} du recht hast.', en: 'I think that you are right.' }],
      tip: '"Dass" ist keine Frage; für indirekte Ja-Nein-Fragen benutzt man "ob".',
      tipEn: '"Dass" is not a question; for indirect yes/no questions, use "ob".',
      category: C.content,
    },
    {
      name: 'ehe',
      function: 'bevor; gehoben oder schriftlich',
      functionEn: 'before; elevated or written',
      meaning: 'Bedeutet "bevor", klingt aber formeller oder literarischer.',
      meaningEn: 'Means "before", but sounds more formal or literary.',
      examples: [
        { de: 'Überleg gut, {ehe} du unterschreibst.', en: 'Think carefully before you sign.' },
      ],
      tip: 'Im Alltag ist "bevor" meist natürlicher.',
      tipEn: 'In everyday language, "bevor" is usually more natural.',
      category: C.temporal,
    },
    {
      name: 'falls',
      function: 'mögliche Bedingung',
      functionEn: 'possible condition',
      meaning:
        'Bedeutet "wenn es passiert, dass ..." und klingt oft etwas vorsichtiger als "wenn".',
      meaningEn:
        'Means "if it happens that ..." and often sounds a little more cautious than "wenn".',
      examples: [
        { de: '{Falls} du Fragen hast, schreib mir.', en: 'If you have questions, write to me.' },
      ],
      tip: '"Falls" passt gut, wenn die Bedingung wirklich unsicher ist.',
      tipEn: '"Falls" works well when the condition is genuinely uncertain.',
      category: C.conditional,
    },
    {
      name: 'indem',
      function: 'Mittel oder Methode',
      functionEn: 'means or method',
      meaning: 'Erklärt, wie etwas gemacht oder erreicht wird.',
      meaningEn: 'Explains how something is done or achieved.',
      examples: [
        {
          de: 'Du lernst neue Wörter, {indem} du sie aktiv benutzt.',
          en: 'You learn new words by actively using them.',
        },
      ],
      tip: 'Nicht für Gleichzeitigkeit verwenden; dafür passt oft "während".',
      tipEn: 'Do not use it for simultaneity; "während" often fits there.',
      category: C.modal,
    },
    {
      name: 'insofern',
      function: 'Einschränkung oder genauer Bereich',
      functionEn: 'restriction or precise scope',
      meaning: 'Begrenzt eine Aussage: Sie gilt nur in dieser Hinsicht.',
      meaningEn: 'Limits a statement: it applies only in this respect.',
      examples: [
        {
          de: 'Das ist sinnvoll, {insofern} es Zeit spart.',
          en: 'That makes sense insofar as it saves time.',
        },
      ],
      tip: 'Kann wie ein Adverb im Hauptsatz stehen; als Subjunktion leitet es einen Nebensatz ein.',
      tipEn:
        'It can stand as an adverb in the main clause; as a conjunction it introduces a subordinate clause.',
      category: C.restrictive,
    },
    {
      name: 'insofern als',
      function: 'präzisierende Einschränkung',
      functionEn: 'precise restriction',
      meaning: 'Bedeutet "in dem Maße / in der Hinsicht, dass ...".',
      meaningEn: 'Means "to the extent / in the respect that ...".',
      examples: [
        {
          de: 'Der Plan hilft, {insofern als} er klare Schritte vorgibt.',
          en: 'The plan helps insofar as it gives clear steps.',
        },
      ],
      tip: 'Klingt formeller als einfaches "weil" oder "da".',
      tipEn: 'Sounds more formal than simple "weil" or "da".',
      category: C.restrictive,
    },
    {
      name: 'insoweit',
      function: 'in diesem Ausmaß',
      functionEn: 'to this extent',
      meaning: 'Schränkt eine Aussage auf ein bestimmtes Maß oder einen bestimmten Bereich ein.',
      meaningEn: 'Restricts a statement to a certain degree or area.',
      examples: [
        {
          de: 'Ich stimme zu, {insoweit} die Regeln fair bleiben.',
          en: 'I agree insofar as the rules remain fair.',
        },
      ],
      tip: 'Besonders in formeller Sprache und Argumentationen.',
      tipEn: 'Especially common in formal language and argumentation.',
      category: C.restrictive,
    },
    {
      name: 'insoweit als',
      function: 'präzisierende Bereichsangabe',
      functionEn: 'precise scope marker',
      meaning: 'Gibt genau an, in welchem Umfang eine Aussage gilt.',
      meaningEn: 'States exactly to what extent a statement applies.',
      examples: [
        {
          de: 'Das Angebot passt, {insoweit als} es unser Budget nicht übersteigt.',
          en: 'The offer works insofar as it does not exceed our budget.',
        },
      ],
      tip: 'Sehr nah bei "insofern als"; beide klingen eher schriftlich.',
      tipEn: 'Very close to "insofern als"; both sound fairly written.',
      category: C.restrictive,
    },
    {
      name: 'je nachdem',
      function: 'abhängige Alternative',
      functionEn: 'dependent alternative',
      meaning: 'Zeigt, dass etwas von einer Bedingung oder Situation abhängt.',
      meaningEn: 'Shows that something depends on a condition or situation.',
      examples: [
        {
          de: 'Wir entscheiden spontan, {je nachdem} wie das Wetter ist.',
          en: 'We will decide spontaneously depending on what the weather is like.',
        },
      ],
      tip: 'Oft mit W-Wort: "je nachdem, was/wie/wann ...".',
      tipEn: 'Often used with a question word: "depending on what/how/when ...".',
      category: C.conditional,
    },
    {
      name: 'kaum dass',
      function: 'unmittelbar nachdem',
      functionEn: 'hardly/scarcely after',
      meaning: 'Sagt, dass zwei Ereignisse fast direkt nacheinander passieren.',
      meaningEn: 'Says that two events happen almost immediately after each other.',
      examples: [
        {
          de: '{Kaum dass} ich zu Hause war, klingelte das Telefon.',
          en: 'Hardly had I arrived home when the phone rang.',
        },
      ],
      tip: 'Klingt gehoben oder literarisch; Alltag: "kaum war ich zu Hause, ...".',
      tipEn:
        'Sounds elevated or literary; everyday German often says "kaum war ich zu Hause, ...".',
      category: C.temporal,
    },
    {
      name: 'nachdem',
      function: 'Zeitpunkt danach',
      functionEn: 'after',
      meaning: 'Der Nebensatz nennt das Ereignis, das zuerst passiert.',
      meaningEn: 'The subordinate clause names the event that happens first.',
      examples: [
        {
          de: '{Nachdem} ich gegessen hatte, ging ich spazieren.',
          en: 'After I had eaten, I went for a walk.',
        },
      ],
      tip: 'Oft stehen verschiedene Zeiten: "Nachdem ich gegessen hatte, ging ich ...".',
      tipEn: 'Often uses different tenses: "After I had eaten, I went ...".',
      category: C.temporal,
    },
    {
      name: 'nur dass',
      function: 'einschränkender Gegensatz',
      functionEn: 'limiting contrast',
      meaning: 'Fügt eine Einschränkung hinzu: Alles wäre so, aber dieser eine Punkt ist anders.',
      meaningEn: 'Adds a limitation: everything would be so, except for this one point.',
      examples: [
        {
          de: 'Es ist wie früher, {nur dass} wir jetzt mehr Erfahrung haben.',
          en: 'It is like before, except that we now have more experience.',
        },
      ],
      tip: 'Sehr nützlich, um einen Vergleich nachträglich einzuschränken.',
      tipEn: 'Very useful for limiting a comparison afterwards.',
      category: C.restrictive,
    },
    {
      name: 'ob',
      function: 'indirekte Ja-Nein-Frage',
      functionEn: 'indirect yes/no question',
      meaning: 'Leitet eine indirekte Frage ein, bei der die Antwort ja oder nein sein könnte.',
      meaningEn: 'Introduces an indirect question where the answer could be yes or no.',
      examples: [
        {
          de: 'Ich weiß nicht, {ob} sie heute kommt.',
          en: 'I do not know whether she is coming today.',
        },
      ],
      tip: 'Nicht mit "wenn" verwechseln: "ob" fragt nach ja/nein; "wenn" nennt eine Bedingung.',
      tipEn: 'Do not confuse it with "wenn": "ob" asks whether; "wenn" gives a condition.',
      category: C.content,
    },
    {
      name: 'obgleich',
      function: 'Einräumung; gehoben',
      functionEn: 'concession; elevated',
      meaning: 'Bedeutet "obwohl", klingt aber formeller.',
      meaningEn: 'Means "although", but sounds more formal.',
      examples: [
        {
          de: '{Obgleich} er müde war, blieb er konzentriert.',
          en: 'Although he was tired, he stayed focused.',
        },
      ],
      tip: 'In Alltagssprache ist "obwohl" viel häufiger.',
      tipEn: 'In everyday language, "obwohl" is much more common.',
      category: C.concessive,
    },
    {
      name: 'obschon',
      function: 'Einräumung; schweizerisch/gehoben',
      functionEn: 'concession; Swiss/elevated',
      meaning: 'Bedeutet "obwohl"; in der Schweiz und in gehobener Sprache geläufiger.',
      meaningEn: 'Means "although"; more common in Switzerland and elevated style.',
      examples: [
        {
          de: '{Obschon} es teuer ist, lohnt sich der Kurs.',
          en: 'Although it is expensive, the course is worth it.',
        },
      ],
      tip: 'Für Zürich-Kontext nicht fremd, aber "obwohl" bleibt neutraler.',
      tipEn: 'Not unusual in a Zurich context, but "obwohl" remains more neutral.',
      category: C.concessive,
    },
    {
      name: 'obwohl',
      function: 'Einräumung',
      functionEn: 'concession',
      meaning: 'Sagt: Etwas stimmt, aber trotzdem passiert etwas anderes.',
      meaningEn: 'Says: something is true, but something else happens anyway.',
      examples: [
        {
          de: '{Obwohl} sie wenig Zeit hat, hilft sie mir.',
          en: 'Although she has little time, she helps me.',
        },
      ],
      tip: 'Der Standard für "although" im Alltag.',
      tipEn: 'The standard everyday word for "although".',
      category: C.concessive,
    },
    {
      name: 'obzwar',
      function: 'Einräumung; veraltet oder literarisch',
      functionEn: 'concession; old-fashioned or literary',
      meaning: 'Bedeutet "obwohl", klingt heute aber deutlich gehoben oder altmodisch.',
      meaningEn: 'Means "although", but today sounds clearly elevated or old-fashioned.',
      examples: [
        {
          de: '{Obzwar} er jung war, sprach er sehr ruhig.',
          en: 'Although he was young, he spoke very calmly.',
        },
      ],
      tip: 'Zum Erkennen wichtig; aktiv brauchst du meistens "obwohl".',
      tipEn: 'Useful to recognize; actively, you usually need "obwohl".',
      category: C.concessive,
    },
    {
      name: 'ohne dass',
      function: 'fehlende Begleitumstände',
      functionEn: 'missing accompanying circumstance',
      meaning: 'Sagt, dass etwas nicht passiert, während etwas anderes passiert.',
      meaningEn: 'Says that something does not happen while something else happens.',
      examples: [
        { de: 'Er ging, {ohne dass} jemand es bemerkte.', en: 'He left without anyone noticing.' },
      ],
      tip: 'Bei gleichem Subjekt oft kürzer: "ohne etwas zu sagen".',
      tipEn: 'With the same subject, often shorter: "without saying anything".',
      category: C.modal,
    },
    {
      name: 'seit',
      function: 'Beginn in der Vergangenheit bis jetzt',
      functionEn: 'since',
      meaning: 'Beschreibt, seit wann etwas gilt oder passiert.',
      meaningEn: 'Describes since when something has been true or happening.',
      examples: [
        {
          de: '{Seit} ich hier wohne, fahre ich viel Tram.',
          en: 'Since I have lived here, I take the tram a lot.',
        },
      ],
      tip: '"Seit" und "seitdem" sind als Subjunktionen sehr nah beieinander.',
      tipEn: '"Seit" and "seitdem" are very close as conjunctions.',
      category: C.temporal,
    },
    {
      name: 'seitdem',
      function: 'seit diesem Zeitpunkt',
      functionEn: 'since that point',
      meaning: 'Betont den Zeitpunkt, ab dem sich etwas geändert hat.',
      meaningEn: 'Emphasizes the point from which something changed.',
      examples: [
        {
          de: '{Seitdem} sie Deutsch lernt, versteht sie die Stadt besser.',
          en: 'Since she has been learning German, she understands the city better.',
        },
      ],
      tip: 'Kann auch als Adverb stehen: "Seitdem lernt sie jeden Tag."',
      tipEn: 'Can also stand as an adverb: "Since then, she studies every day."',
      category: C.temporal,
    },
    {
      name: 'selbst wenn',
      function: 'starke Einräumung',
      functionEn: 'strong concession',
      meaning: 'Sagt: Auch dieser extreme Fall würde das Ergebnis nicht ändern.',
      meaningEn: 'Says: even this extreme case would not change the result.',
      examples: [
        { de: '{Selbst wenn} es regnet, kommen wir.', en: 'Even if it rains, we will come.' },
      ],
      tip: 'Stärker als "auch wenn".',
      tipEn: 'Stronger than "auch wenn".',
      category: C.concessive,
    },
    {
      name: 'sobald',
      function: 'unmittelbar wenn',
      functionEn: 'as soon as',
      meaning: 'Markiert den Zeitpunkt, an dem sofort etwas anderes passiert.',
      meaningEn: 'Marks the moment when something else happens immediately.',
      examples: [
        {
          de: 'Ich melde mich, {sobald} ich mehr weiß.',
          en: 'I will contact you as soon as I know more.',
        },
      ],
      tip: 'Für Zukunftspläne steht im Deutschen oft Präsens: "sobald ich mehr weiß".',
      tipEn: 'For future plans, German often uses present tense: "as soon as I know more".',
      category: C.temporal,
    },
    {
      name: 'sodass',
      function: 'Folge',
      functionEn: 'result',
      meaning: 'Zeigt die Folge einer vorherigen Aussage.',
      meaningEn: 'Shows the result of a previous statement.',
      examples: [
        {
          de: 'Der Kurs war voll, {sodass} wir eine Warteliste eröffneten.',
          en: 'The course was full, so we opened a waiting list.',
        },
      ],
      tip: 'Auch getrennt möglich, wenn "so" betont wird: "so ..., dass ...".',
      tipEn: 'Can also be split when "so" is emphasized: "so ..., dass ...".',
      category: C.consecutive,
    },
    {
      name: 'sofern',
      function: 'Bedingung; formeller',
      functionEn: 'condition; formal',
      meaning: 'Bedeutet "wenn", klingt aber schriftlicher und einschränkender.',
      meaningEn: 'Means "if", but sounds more written and restrictive.',
      examples: [
        {
          de: 'Du kannst teilnehmen, {sofern} noch Plätze frei sind.',
          en: 'You can participate provided that places are still available.',
        },
      ],
      tip: 'Gut für Regeln, Bedingungen und formelle Informationen.',
      tipEn: 'Good for rules, conditions, and formal information.',
      category: C.conditional,
    },
    {
      name: 'sogar wenn',
      function: 'verstärkte Einräumung',
      functionEn: 'strengthened concession',
      meaning: 'Ähnlich wie "selbst wenn": Auch ein überraschender Fall ändert nichts.',
      meaningEn: 'Similar to "selbst wenn": even a surprising case changes nothing.',
      examples: [
        {
          de: '{Sogar wenn} ich wenig Zeit habe, übe ich zehn Minuten.',
          en: 'Even if I have little time, I practise for ten minutes.',
        },
      ],
      tip: '"Selbst wenn" ist idiomatischer; "sogar wenn" betont das Unerwartete.',
      tipEn: '"Selbst wenn" is more idiomatic; "sogar wenn" emphasizes the unexpected.',
      category: C.concessive,
    },
    {
      name: 'solange',
      function: 'Dauer oder Bedingung',
      functionEn: 'duration or condition',
      meaning: 'Bedeutet "während der ganzen Zeit, in der" oder "unter der Bedingung, dass".',
      meaningEn: 'Means "for the whole time that" or "provided that".',
      examples: [
        {
          de: '{Solange} du übst, machst du Fortschritte.',
          en: 'As long as you practise, you make progress.',
        },
      ],
      tip: 'Kann zeitlich oder konditional sein; der Kontext entscheidet.',
      tipEn: 'Can be temporal or conditional; context decides.',
      category: C.conditional,
    },
    {
      name: 'sooft',
      function: 'jedes Mal wenn',
      functionEn: 'whenever',
      meaning: 'Beschreibt eine wiederholte Situation.',
      meaningEn: 'Describes a repeated situation.',
      examples: [
        {
          de: '{Sooft} sie das Lied hört, denkt sie an Zürich.',
          en: 'Whenever she hears the song, she thinks of Zurich.',
        },
      ],
      tip: 'Auch getrennt möglich: "so oft, wie ..."; als Subjunktion meist zusammengeschrieben.',
      tipEn:
        'Can also be split in comparisons; as a conjunction it is usually written as one word.',
      category: C.temporal,
    },
    {
      name: 'soviel',
      function: 'nach dem Maß des Wissens',
      functionEn: 'as far as one knows',
      meaning: 'Schränkt eine Aussage auf bekanntes Wissen ein.',
      meaningEn: 'Restricts a statement to known information.',
      examples: [
        {
          de: '{Soviel} ich weiß, beginnt der Kurs um neun.',
          en: 'As far as I know, the course starts at nine.',
        },
      ],
      tip: 'Sehr häufig in der festen Wendung "soviel ich weiß".',
      tipEn: 'Very common in the fixed phrase "soviel ich weiß".',
      category: C.restrictive,
    },
    {
      name: 'soweit',
      function: 'Grenze oder Wissensstand',
      functionEn: 'limit or state of knowledge',
      meaning: 'Bedeutet "in dem Maße, wie" oder "nach dem, was bekannt ist".',
      meaningEn: 'Means "to the extent that" or "as far as is known".',
      examples: [
        {
          de: '{Soweit} ich es verstanden habe, gibt es zwei Optionen.',
          en: 'As far as I understood it, there are two options.',
        },
      ],
      tip: '"Soweit" bezieht sich oft auf Verständnis, Wissen, Möglichkeit oder Reichweite.',
      tipEn: '"Soweit" often relates to understanding, knowledge, possibility, or scope.',
      category: C.restrictive,
    },
    {
      name: 'sowie',
      function: 'sobald; gehoben',
      functionEn: 'as soon as; elevated',
      meaning: 'Als Subjunktion bedeutet es "sobald"; als Konjunktion auch "und".',
      meaningEn: 'As a subjunction it means "as soon as"; as a conjunction it can also mean "and".',
      examples: [
        {
          de: '{Sowie} die Zahlung eingegangen ist, bestätigen wir die Anmeldung.',
          en: 'As soon as the payment has arrived, we will confirm the registration.',
        },
      ],
      tip: 'Achte auf die Bedeutung: "A sowie B" = und; "sowie der Kurs beginnt" = sobald.',
      tipEn: 'Watch the meaning: "A sowie B" = and; "sowie der Kurs beginnt" = as soon as.',
      category: C.temporal,
    },
    {
      name: 'statt dass',
      function: 'nicht gewählte Alternative',
      functionEn: 'alternative that did not happen',
      meaning: 'Zeigt, dass etwas anderes passiert als erwartet oder gewünscht.',
      meaningEn: 'Shows that something else happens than expected or wanted.',
      examples: [
        {
          de: '{Statt dass} sie pausiert, arbeitet sie weiter.',
          en: 'Instead of taking a break, she keeps working.',
        },
      ],
      tip: 'Gleichbedeutend mit "anstatt dass"; bei gleichem Subjekt oft "statt zu ...".',
      tipEn: 'Same meaning as "anstatt dass"; with the same subject often "statt zu ...".',
      category: C.adversative,
    },
    {
      name: 'um so mehr als',
      function: 'verstärkender Grund',
      functionEn: 'strengthening reason',
      meaning: 'Bedeutet: Das gilt besonders, weil ein zusätzlicher Grund dazukommt.',
      meaningEn: 'Means: this is especially true because an additional reason applies.',
      examples: [
        {
          de: 'Das freut mich, {um so mehr als} ich lange darauf gewartet habe.',
          en: 'That makes me even happier, especially since I waited a long time for it.',
        },
      ],
      tip: 'Heute meist "umso mehr, als" geschrieben; gehobene, argumentierende Sprache.',
      tipEn: 'Today usually written "umso mehr, als"; elevated argumentative style.',
      category: C.causal,
    },
    {
      name: 'um so weniger als',
      function: 'verstärkende Einschränkung',
      functionEn: 'strengthening restriction',
      meaning: 'Bedeutet: Das gilt noch weniger, weil ein zusätzlicher Grund dagegen spricht.',
      meaningEn: 'Means: this applies even less because an additional reason speaks against it.',
      examples: [
        {
          de: 'Das überzeugt mich nicht, {um so weniger als} Belege fehlen.',
          en: 'That does not convince me, even less so because evidence is missing.',
        },
      ],
      tip: 'Selten und formell; wichtig vor allem zum Verstehen anspruchsvoller Texte.',
      tipEn: 'Rare and formal; mainly useful for understanding advanced texts.',
      category: C.causal,
    },
    {
      name: 'während',
      function: 'Gleichzeitigkeit oder Gegensatz',
      functionEn: 'simultaneity or contrast',
      meaning: 'Kann zeitlich "while" bedeuten oder einen Gegensatz markieren.',
      meaningEn: 'Can mean temporal "while" or mark a contrast.',
      examples: [
        { de: '{Während} ich koche, hört sie Musik.', en: 'While I cook, she listens to music.' },
      ],
      tip: 'Zeitlich: zwei Dinge passieren gleichzeitig. Gegensatz: "Während ich Kaffee mag, trinkt er Tee."',
      tipEn:
        'Temporal: two things happen at the same time. Contrast: "Whereas I like coffee, he drinks tea."',
      category: C.temporal,
    },
    {
      name: 'weil',
      function: 'Grund',
      functionEn: 'reason',
      meaning: 'Gibt den Grund für eine Aussage oder Handlung an.',
      meaningEn: 'Gives the reason for a statement or action.',
      examples: [
        {
          de: 'Ich lerne Deutsch, {weil} ich in Zürich lebe.',
          en: 'I am learning German because I live in Zurich.',
        },
      ],
      tip: 'In Standardsprache steht das finite Verb am Ende: "weil ich in Zürich lebe".',
      tipEn: 'In standard German, the finite verb goes to the end: "weil ich in Zürich lebe".',
      category: C.causal,
    },
    {
      name: 'wenn',
      function: 'Bedingung oder wiederholte Zeit',
      functionEn: 'condition or repeated time',
      meaning: 'Bedeutet "if" oder "whenever/when" bei wiederholten Situationen.',
      meaningEn: 'Means "if" or "whenever/when" for repeated situations.',
      examples: [
        { de: '{Wenn} ich Zeit habe, komme ich vorbei.', en: 'If I have time, I will come by.' },
      ],
      tip: 'Für einmalige Vergangenheit nimmt man "als", nicht "wenn".',
      tipEn: 'For a single event in the past, use "als", not "wenn".',
      category: C.conditional,
    },
    {
      name: 'wenngleich',
      function: 'Einräumung; formell',
      functionEn: 'concession; formal',
      meaning: 'Bedeutet "obwohl", klingt aber schriftlich und gehoben.',
      meaningEn: 'Means "although", but sounds written and elevated.',
      examples: [
        {
          de: '{Wenngleich} der Text schwierig ist, ist er nützlich.',
          en: 'Although the text is difficult, it is useful.',
        },
      ],
      tip: 'Aktiv brauchst du im Alltag fast immer "obwohl".',
      tipEn: 'In everyday speech, you almost always need "obwohl".',
      category: C.concessive,
    },
    {
      name: 'wie',
      function: 'Art und Weise oder Vergleich',
      functionEn: 'manner or comparison',
      meaning: 'Leitet einen Nebensatz ein, der zeigt, auf welche Weise etwas passiert.',
      meaningEn: 'Introduces a clause showing how something happens.',
      examples: [
        { de: 'Ich zeige dir, {wie} das funktioniert.', en: 'I will show you how it works.' },
      ],
      tip: '"Wie" kann Fragewort, Vergleichswort oder Subjunktion sein.',
      tipEn: '"Wie" can be a question word, comparison word, or subjunction.',
      category: C.modal,
    },
    {
      name: 'wie wenn',
      function: 'Vergleich mit hypothetischer Situation',
      functionEn: 'comparison with a hypothetical situation',
      meaning: 'Bedeutet ähnlich wie "als ob", regional oder umgangssprachlich häufiger.',
      meaningEn: 'Means something like "as if"; more common regionally or colloquially.',
      examples: [
        {
          de: 'Es klingt, {wie wenn} jemand oben laufen würde.',
          en: 'It sounds as if someone were walking upstairs.',
        },
      ],
      tip: 'In formeller Standardsprache ist "als ob" meist die sicherere Wahl.',
      tipEn: 'In formal standard German, "als ob" is usually the safer choice.',
      category: C.comparative,
    },
    {
      name: 'wiewohl',
      function: 'Einräumung; veraltet/gehoben',
      functionEn: 'concession; old-fashioned/elevated',
      meaning: 'Bedeutet "obwohl", wirkt heute aber literarisch.',
      meaningEn: 'Means "although", but today sounds literary.',
      examples: [
        {
          de: '{Wiewohl} sie erschöpft war, lächelte sie.',
          en: 'Although she was exhausted, she smiled.',
        },
      ],
      tip: 'Vor allem passiv erkennen; aktiv ist "obwohl" natürlicher.',
      tipEn: 'Mostly useful to recognize passively; actively, "obwohl" is more natural.',
      category: C.concessive,
    },
    {
      name: 'wohingegen',
      function: 'Gegensatz',
      functionEn: 'contrast',
      meaning: 'Stellt zwei Aussagen einander gegenüber.',
      meaningEn: 'Contrasts two statements with each other.',
      examples: [
        {
          de: 'Sie spricht sehr schnell, {wohingegen} er langsam erklärt.',
          en: 'She speaks very quickly, whereas he explains slowly.',
        },
      ],
      tip: 'Stärker schriftlich als "während" im kontrastiven Sinn.',
      tipEn: 'More written than contrastive "während".',
      category: C.adversative,
    },
    {
      name: 'zumal',
      function: 'zusätzlicher wichtiger Grund',
      functionEn: 'additional important reason',
      meaning: 'Fügt einen besonders wichtigen Grund hinzu.',
      meaningEn: 'Adds an especially important reason.',
      examples: [
        {
          de: 'Wir bleiben zu Hause, {zumal} morgen ein langer Tag wird.',
          en: 'We are staying home, especially since tomorrow will be a long day.',
        },
      ],
      tip: 'Heißt nicht einfach "weil", sondern eher "besonders weil / zumal ja".',
      tipEn: 'Not just "because", but closer to "especially since".',
      category: C.causal,
    },
  ];

  const categories = {
    temporal: { label: 'Zeit' },
    causal: { label: 'Grund' },
    conditional: { label: 'Bedingung' },
    concessive: { label: 'Einräumung' },
    comparative: { label: 'Vergleich' },
    consecutive: { label: 'Folge / Zweck' },
    modal: { label: 'Art und Weise' },
    restrictive: { label: 'Einschränkung' },
    content: { label: 'Inhalt / Frage' },
    adversative: { label: 'Gegensatz / Alternative' },
  };

  const categoriesEn = {
    temporal: 'Time',
    causal: 'Reason',
    conditional: 'Condition',
    concessive: 'Concession',
    comparative: 'Comparison',
    consecutive: 'Result / purpose',
    modal: 'Manner',
    restrictive: 'Restriction',
    content: 'Content / question',
    adversative: 'Contrast / alternative',
  };

  const uiCopy = {
    expandHint: { en: '▸ Show note', de: '▸ Hinweis anzeigen' },
    verbFinal: { en: 'verb final', de: 'Verb am Ende' },
    question: { en: 'Question', de: 'Frage' },
    of: { en: 'of', de: 'von' },
    chooseConnectors: {
      en: 'Choose subjunctions to practise',
      de: 'Subjunktionen zum Üben auswählen',
    },
    allConnectors: { en: 'All', de: 'Alle' },
    clearConnectors: { en: 'Clear', de: 'Auswahl leeren' },
    selectedCount: { en: 'selected', de: 'ausgewählt' },
    noQuestions: {
      en: 'Select at least one subjunction to start the quiz.',
      de: 'Wähle mindestens eine Subjunktion aus, um das Quiz zu starten.',
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
        'You can already sort these sentence connectors very well.',
        'The core patterns are there - review the tricky pairs again.',
        'No problem - the overview will make the patterns clearer.',
      ],
      de: [
        'Du kannst diese Satzverbindungen schon sehr gut einordnen.',
        'Die Grundmuster sitzen - schau dir die schwierigen Paare nochmal an.',
        'Kein Problem - mit der Übersicht werden die Muster klarer.',
      ],
    },
    restart: { en: 'Play again', de: 'Nochmal spielen' },
  };

  const quizQuestions = [
    {
      sentence: 'Ich bleibe zu Hause, ___ ich krank bin.',
      translation: 'I am staying home because I am sick.',
      answers: [
        {
          value: 'weil',
          explanation: '"Weil" gives the reason.',
          explanationDe: '"Weil" gibt den Grund an.',
        },
      ],
      options: ['weil', 'ob', 'bevor', 'sodass'],
      context: 'A simple reason.',
      contextDe: 'Ein einfacher Grund.',
    },
    {
      sentence: 'Ich weiß nicht, ___ sie heute kommt.',
      translation: 'I do not know whether she is coming today.',
      answers: [
        {
          value: 'ob',
          explanation: '"Ob" introduces an indirect yes/no question.',
          explanationDe: '"Ob" leitet eine indirekte Ja-Nein-Frage ein.',
        },
      ],
      options: ['ob', 'dass', 'wenn', 'weil'],
      context: 'Indirect question, not a condition.',
      contextDe: 'Indirekte Frage, keine Bedingung.',
    },
    {
      sentence: '___ ich in Bern wohnte, fuhr ich oft nach Zürich.',
      translation: 'When I lived in Bern, I often went to Zurich.',
      answers: [
        {
          value: 'als',
          explanation: '"Als" is used for a single past period or event.',
          explanationDe:
            '"Als" benutzt man für eine einmalige Vergangenheit oder einen vergangenen Zeitraum.',
        },
      ],
      options: ['als', 'wenn', 'falls', 'sobald'],
      context: 'One past life phase.',
      contextDe: 'Eine vergangene Lebensphase.',
    },
    {
      sentence: '___ du Hilfe brauchst, schreib mir.',
      translation: 'If you need help, write to me.',
      answers: [
        {
          value: 'wenn',
          explanation: '"Wenn" gives a condition.',
          explanationDe: '"Wenn" nennt eine Bedingung.',
        },
        {
          value: 'falls',
          explanation: '"Falls" also works and sounds a little more cautious.',
          explanationDe: '"Falls" passt auch und klingt etwas vorsichtiger.',
        },
      ],
      options: ['wenn', 'falls', 'obwohl', 'nachdem'],
      context: 'A possible future condition.',
      contextDe: 'Eine mögliche zukünftige Bedingung.',
    },
    {
      sentence: 'Ich rufe dich an, ___ ich losfahre.',
      translation: 'I will call you before I leave.',
      answers: [
        {
          value: 'bevor',
          explanation: '"Bevor" marks the event before which something else happens.',
          explanationDe: '"Bevor" markiert das Ereignis, vor dem etwas anderes passiert.',
        },
      ],
      options: ['bevor', 'nachdem', 'bis', 'seitdem'],
      context: 'Ordering two events in time.',
      contextDe: 'Zwei Ereignisse zeitlich ordnen.',
    },
    {
      sentence: '___ ich gegessen hatte, ging ich spazieren.',
      translation: 'After I had eaten, I went for a walk.',
      answers: [
        {
          value: 'nachdem',
          explanation: '"Nachdem" names the earlier event.',
          explanationDe: '"Nachdem" nennt das frühere Ereignis.',
        },
      ],
      options: ['nachdem', 'bevor', 'sobald', 'ehe'],
      context: 'The eating happened first.',
      contextDe: 'Das Essen passierte zuerst.',
    },
    {
      sentence: 'Sie hilft mir, ___ sie wenig Zeit hat.',
      translation: 'She helps me although she has little time.',
      answers: [
        {
          value: 'obwohl',
          explanation: '"Obwohl" is the neutral everyday concession.',
          explanationDe: '"Obwohl" ist die neutrale alltägliche Einräumung.',
        },
        {
          value: 'auch wenn',
          explanation: '"Auch wenn" is also possible and sounds direct.',
          explanationDe: '"Auch wenn" ist ebenfalls möglich und klingt direkt.',
        },
      ],
      options: ['obwohl', 'auch wenn', 'damit', 'sodass'],
      context: 'A fact does not prevent the result.',
      contextDe: 'Eine Tatsache verhindert das Ergebnis nicht.',
    },
    {
      sentence: 'Ich schreibe es auf, ___ ich es nicht vergesse.',
      translation: 'I write it down so that I do not forget it.',
      answers: [
        {
          value: 'damit',
          explanation: '"Damit" gives the purpose.',
          explanationDe: '"Damit" nennt den Zweck.',
        },
      ],
      options: ['damit', 'indem', 'während', 'zumal'],
      context: 'The goal of the action.',
      contextDe: 'Das Ziel der Handlung.',
    },
    {
      sentence: 'Du lernst Wörter, ___ du sie aktiv benutzt.',
      translation: 'You learn words by actively using them.',
      answers: [
        {
          value: 'indem',
          explanation: '"Indem" explains the method.',
          explanationDe: '"Indem" erklärt die Methode.',
        },
      ],
      options: ['indem', 'damit', 'ob', 'außer wenn'],
      context: 'How something is achieved.',
      contextDe: 'Wie etwas erreicht wird.',
    },
    {
      sentence: 'Der Kurs war voll, ___ wir eine Warteliste eröffneten.',
      translation: 'The course was full, so we opened a waiting list.',
      answers: [
        {
          value: 'sodass',
          explanation: '"Sodass" introduces a result.',
          explanationDe: '"Sodass" leitet eine Folge ein.',
        },
      ],
      options: ['sodass', 'weil', 'obgleich', 'sofern'],
      context: 'A result of the first clause.',
      contextDe: 'Eine Folge des ersten Satzteils.',
    },
    {
      sentence: 'Wir gehen spazieren, ___ es stark regnet.',
      translation: 'We will go for a walk unless it rains heavily.',
      answers: [
        {
          value: 'außer wenn',
          explanation: '"Außer wenn" names the exception condition.',
          explanationDe: '"Außer wenn" nennt die Ausnahmebedingung.',
        },
      ],
      options: ['außer wenn', 'sobald', 'seit', 'wie wenn'],
      context: 'Only one condition cancels the plan.',
      contextDe: 'Nur eine Bedingung hebt den Plan auf.',
    },
    {
      sentence: 'Es klingt, ___ jemand oben laufen würde.',
      translation: 'It sounds as if someone were walking upstairs.',
      answers: [
        {
          value: 'als ob',
          explanation: '"Als ob" introduces an unreal comparison.',
          explanationDe: '"Als ob" leitet einen irrealen Vergleich ein.',
        },
        {
          value: 'als wenn',
          explanation: '"Als wenn" can also introduce an unreal comparison.',
          explanationDe: '"Als wenn" kann ebenfalls einen irrealen Vergleich einleiten.',
        },
      ],
      options: ['als ob', 'als wenn', 'zumal', 'insofern'],
      context: 'Something only seems to be true.',
      contextDe: 'Etwas wirkt nur so.',
    },
  ];

  window.LWG_SUBJUNKTIONEN_DATA = {
    connectors,
    categories,
    categoriesEn,
    uiCopy,
    quizQuestions,
  };
})();
