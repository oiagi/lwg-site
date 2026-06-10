// CEFR level data — global scale descriptions and skill-by-skill Can-Do descriptors
// Source: Council of Europe Common European Framework of Reference (CEFR)
// © Council of Europe / Conseil de l'Europe

(function () {
  'use strict';

  const LEVELS = [
    {
      id: 'A1',
      group: 'basic',
      groupLabel: { en: 'Basic User', de: 'Elementare Sprachverwendung' },
      globalScale: {
        en: 'Can understand and use familiar everyday expressions and very basic phrases aimed at the satisfaction of needs of a concrete type. Can introduce him/herself and others and can ask and answer questions about personal details such as where he/she lives, people he/she knows and things he/she has. Can interact in a simple way provided the other person talks slowly and clearly and is prepared to help.',
        de: 'Kann vertraute, alltägliche Ausdrücke und ganz einfache Sätze verstehen und verwenden, die auf die Befriedigung konkreter Bedürfnisse zielen. Kann sich und andere vorstellen und anderen Leuten Fragen zu ihrer Person stellen – z. B. wo sie wohnen, was für Leute sie kennen oder was für Dinge sie haben – und kann auf Fragen dieser Art Antwort geben. Kann sich auf einfache Art verständigen, wenn die Gesprächspartnerinnen oder Gesprächspartner langsam und deutlich sprechen und bereit sind zu helfen.',
      },
    },
    {
      id: 'A2',
      group: 'basic',
      groupLabel: { en: 'Basic User', de: 'Elementare Sprachverwendung' },
      globalScale: {
        en: 'Can understand sentences and frequently used expressions related to areas of most immediate relevance (e.g. very basic personal and family information, shopping, local geography, employment). Can communicate in simple and routine tasks requiring a simple and direct exchange of information on familiar and routine matters. Can describe in simple terms aspects of his/her background, immediate environment and matters in areas of immediate need.',
        de: 'Kann Sätze und häufig gebrauchte Ausdrücke verstehen, die mit Bereichen von ganz unmittelbarer Bedeutung zusammenhängen (z. B. Informationen zur Person und zur Familie, Einkaufen, Arbeit, nähere Umgebung). Kann sich in einfachen, routinemäßigen Situationen verständigen, in denen es um einen einfachen und direkten Austausch von Informationen über vertraute und geläufige Dinge geht. Kann mit einfachen Mitteln die eigene Herkunft und Ausbildung, die direkte Umgebung und Dinge im Zusammenhang mit unmittelbaren Bedürfnissen beschreiben.',
      },
    },
    {
      id: 'B1',
      group: 'independent',
      groupLabel: { en: 'Independent User', de: 'Selbstständige Sprachverwendung' },
      globalScale: {
        en: 'Can understand the main points of clear standard input on familiar matters regularly encountered in work, school, leisure, etc. Can deal with most situations likely to arise whilst travelling in an area where the language is spoken. Can produce simple connected text on topics which are familiar or of personal interest. Can describe experiences and events, dreams, hopes & ambitions and briefly give reasons and explanations for opinions and plans.',
        de: 'Kann die Hauptpunkte verstehen, wenn klare Standardsprache verwendet wird und wenn es um vertraute Dinge aus Arbeit, Schule, Freizeit usw. geht. Kann die meisten Situationen bewältigen, denen man auf Reisen im Sprachgebiet begegnet. Kann sich einfach und zusammenhängend über vertraute Themen und persönliche Interessengebiete äußern. Kann über Erfahrungen und Ereignisse berichten, Träume, Hoffnungen und Ziele beschreiben und zu Plänen und Ansichten kurze Begründungen oder Erklärungen geben.',
      },
    },
    {
      id: 'B2',
      group: 'independent',
      groupLabel: { en: 'Independent User', de: 'Selbstständige Sprachverwendung' },
      globalScale: {
        en: 'Can understand the main ideas of complex text on both concrete and abstract topics, including technical discussions in his/her field of specialisation. Can interact with a degree of fluency and spontaneity that makes regular interaction with native speakers quite possible without strain for either party. Can produce clear, detailed text on a wide range of subjects and explain a viewpoint on a topical issue giving the advantages and disadvantages of various options.',
        de: 'Kann die Hauptinhalte komplexer Texte zu konkreten und abstrakten Themen verstehen; versteht im eigenen Spezialgebiet auch Fachdiskussionen. Kann sich so spontan und fließend verständigen, dass ein normales Gespräch mit Muttersprachlern ohne größere Anstrengung auf beiden Seiten gut möglich ist. Kann sich zu einem breiten Themenspektrum klar und detailliert ausdrücken, einen Standpunkt zu einer aktuellen Frage erläutern und die Vor- und Nachteile verschiedener Möglichkeiten angeben.',
      },
    },
    {
      id: 'C1',
      group: 'proficient',
      groupLabel: { en: 'Proficient User', de: 'Kompetente Sprachverwendung' },
      globalScale: {
        en: 'Can understand a wide range of demanding, longer texts, and recognise implicit meaning. Can express him/herself fluently and spontaneously without much obvious searching for expressions. Can use language flexibly and effectively for social, academic and professional purposes. Can produce clear, well-structured, detailed text on complex subjects, showing controlled use of organisational patterns, connectors and cohesive devices.',
        de: 'Kann ein breites Spektrum anspruchsvoller, längerer Texte verstehen und auch implizite Bedeutungen erfassen. Kann sich spontan und fließend ausdrücken, ohne öfter deutlich erkennbar nach Worten suchen zu müssen. Kann die Sprache im gesellschaftlichen und beruflichen Leben oder in Ausbildung und Studium wirksam und flexibel gebrauchen. Kann sich klar, strukturiert und ausführlich zu komplexen Sachverhalten äußern und dabei verschiedene Mittel zur Textverknüpfung angemessen verwenden.',
      },
    },
    {
      id: 'C2',
      group: 'proficient',
      groupLabel: { en: 'Proficient User', de: 'Kompetente Sprachverwendung' },
      globalScale: {
        en: 'Can understand with ease virtually everything heard or read. Can summarise information from different spoken and written sources, reconstructing arguments and accounts in a coherent presentation. Can express him/herself spontaneously, very fluently and precisely, differentiating finer shades of meaning even in more complex situations.',
        de: 'Kann praktisch alles, was er/sie liest oder hört, mühelos verstehen. Kann Informationen aus verschiedenen schriftlichen und mündlichen Quellen zusammenfassen und dabei Begründungen und Erklärungen in einer zusammenhängenden Darstellung wiedergeben. Kann sich spontan, sehr flüssig und genau ausdrücken und auch bei komplexeren Sachverhalten feinere Bedeutungsnuancen deutlich machen.',
      },
    },
  ];

  const SKILLS = [
    {
      id: 'listening',
      label: { en: 'Listening', de: 'Hören' },
      descriptors: {
        A1: {
          en: 'I can recognise familiar words and very basic phrases concerning myself, my family and immediate concrete surroundings when people speak slowly and clearly.',
          de: 'Ich kann vertraute Wörter und ganz einfache Sätze verstehen, die sich auf mich selbst, meine Familie oder auf konkrete Dinge um mich herum beziehen, vorausgesetzt es wird langsam und deutlich gesprochen.',
        },
        A2: {
          en: 'I can understand phrases and the highest frequency vocabulary related to areas of most immediate personal relevance (e.g. very basic personal and family information, shopping, local area, employment). I can catch the main point in short, clear, simple messages and announcements.',
          de: 'Ich kann einzelne Sätze und die gebräuchlichsten Wörter verstehen, wenn es um für mich wichtige Dinge geht (z. B. sehr einfache Informationen zur Person und zur Familie, Einkaufen, Arbeit, nähere Umgebung). Ich verstehe das Wesentliche von kurzen, klaren und einfachen Mitteilungen und Durchsagen.',
        },
        B1: {
          en: 'I can understand the main points of clear standard speech on familiar matters regularly encountered in work, school, leisure, etc. I can understand the main point of many radio or TV programmes on current affairs or topics of personal or professional interest when the delivery is relatively slow and clear.',
          de: 'Ich kann die Hauptpunkte verstehen, wenn klare Standardsprache verwendet wird und wenn es um vertraute Dinge aus Arbeit, Schule, Freizeit usw. geht. Ich kann vielen Radio- oder Fernsehsendungen über aktuelle Ereignisse und über Themen aus meinem Berufs- oder Interessengebiet die Hauptinformation entnehmen, wenn relativ langsam und deutlich gesprochen wird.',
        },
        B2: {
          en: 'I can understand extended speech and lectures and follow even complex lines of argument provided the topic is reasonably familiar. I can understand most TV news and current affairs programmes. I can understand the majority of films in standard dialect.',
          de: 'Ich kann längere Redebeiträge und Vorträge verstehen und auch komplexer Argumentation folgen, wenn mir das Thema einigermassen vertraut ist. Ich kann im Fernsehen die meisten Nachrichtensendungen und aktuellen Reportagen verstehen. Ich kann die meisten Spielfilme verstehen, sofern Standardsprache gesprochen wird.',
        },
        C1: {
          en: 'I can understand extended speech even when it is not clearly structured and when relationships are only implied and not signalled explicitly. I can understand television programmes and films without too much effort.',
          de: 'Ich kann längeren Redebeiträgen folgen, auch wenn diese nicht klar strukturiert sind und wenn Zusammenhänge nicht explizit ausgedrückt sind. Ich kann ohne allzu grosse Mühe Fernsehsendungen und Spielfilme verstehen.',
        },
        C2: {
          en: 'I have no difficulty in understanding any kind of spoken language, whether live or broadcast, even when delivered at fast native speed, provided I have some time to get familiar with the accent.',
          de: 'Ich habe keinerlei Schwierigkeit, gesprochene Sprache zu verstehen, gleichgültig ob „live" oder in den Medien, und zwar auch, wenn schnell gesprochen wird. Ich brauche nur etwas Zeit, mich an einen besonderen Akzent zu gewöhnen.',
        },
      },
    },
    {
      id: 'reading',
      label: { en: 'Reading', de: 'Lesen' },
      descriptors: {
        A1: {
          en: 'I can understand familiar names, words and very simple sentences, for example on notices and posters or in catalogues.',
          de: 'Ich kann einzelne vertraute Namen, Wörter und ganz einfache Sätze verstehen, z. B. auf Schildern, Plakaten oder in Katalogen.',
        },
        A2: {
          en: 'I can read very short, simple texts. I can find specific, predictable information in simple everyday material such as advertisements, prospectuses, menus and timetables and I can understand short simple personal letters.',
          de: 'Ich kann ganz kurze, einfache Texte lesen. Ich kann in einfachen Alltagstexten (z. B. Anzeigen, Prospekten, Speisekarten oder Fahrplänen) konkrete, vorhersehbare Informationen auffinden und ich kann kurze, einfache persönliche Briefe verstehen.',
        },
        B1: {
          en: 'I can understand texts that consist mainly of high frequency everyday or job-related language. I can understand the description of events, feelings and wishes in personal letters.',
          de: 'Ich kann Texte verstehen, in denen vor allem sehr gebräuchliche Alltags- oder Berufssprache vorkommt. Ich kann private Briefe verstehen, in denen von Ereignissen, Gefühlen und Wünschen berichtet wird.',
        },
        B2: {
          en: 'I can read articles and reports concerned with contemporary problems in which the writers adopt particular attitudes or viewpoints. I can understand contemporary literary prose.',
          de: 'Ich kann Artikel und Berichte über Probleme der Gegenwart lesen und verstehen, in denen die Schreibenden eine bestimmte Haltung oder einen bestimmten Standpunkt vertreten. Ich kann zeitgenössische literarische Prosatexte verstehen.',
        },
        C1: {
          en: 'I can understand long and complex factual and literary texts, appreciating distinctions of style. I can understand specialised articles and longer technical instructions, even when they do not relate to my field.',
          de: 'Ich kann lange, komplexe Sachtexte und literarische Texte verstehen und Stilunterschiede wahrnehmen. Ich kann Fachartikel und längere technische Anleitungen verstehen, auch wenn sie nicht in meinem Fachgebiet liegen.',
        },
        C2: {
          en: 'I can read with ease virtually all forms of the written language, including abstract, structurally or linguistically complex texts such as manuals, specialised articles and literary works.',
          de: 'Ich kann praktisch jede Art von geschriebenen Texten mühelos lesen, auch wenn sie abstrakt oder inhaltlich und sprachlich komplex sind, z. B. Handbücher, Fachartikel und literarische Werke.',
        },
      },
    },
    {
      id: 'spokenInteraction',
      label: { en: 'Spoken Interaction', de: 'An Gesprächen teilnehmen' },
      descriptors: {
        A1: {
          en: "I can interact in a simple way provided the other person is prepared to repeat or rephrase things at a slower rate of speech and help me formulate what I'm trying to say. I can ask and answer simple questions in areas of immediate need or on very familiar topics.",
          de: 'Ich kann mich auf einfache Art verständigen, wenn mein Gesprächspartner bereit ist, etwas langsamer zu wiederholen oder anders zu sagen, und mir dabei hilft zu formulieren, was ich zu sagen versuche. Ich kann einfache Fragen stellen und beantworten, sofern es sich um unmittelbar notwendige Dinge und um sehr vertraute Themen handelt.',
        },
        A2: {
          en: "I can communicate in simple and routine tasks requiring a simple and direct exchange of information on familiar topics and activities. I can handle very short social exchanges, even though I can't usually understand enough to keep the conversation going myself.",
          de: 'Ich kann mich in einfachen, routinemässigen Situationen verständigen, in denen es um einen einfachen, direkten Austausch von Informationen und um vertraute Themen und Tätigkeiten geht. Ich kann ein sehr kurzes Kontaktgespräch führen, verstehe aber normalerweise nicht genug, um selbst das Gespräch in Gang zu halten.',
        },
        B1: {
          en: 'I can deal with most situations likely to arise whilst travelling in an area where the language is spoken. I can enter unprepared into conversation on topics that are familiar, of personal interest or pertinent to everyday life (e.g. family, hobbies, work, travel and current events).',
          de: 'Ich kann die meisten Situationen bewältigen, denen man auf Reisen im Sprachgebiet begegnet. Ich kann ohne Vorbereitung an Gesprächen über Themen teilnehmen, die mir vertraut sind, die mich persönlich interessieren oder die sich auf Themen des Alltags wie Familie, Hobbys, Arbeit, Reisen, aktuelle Ereignisse beziehen.',
        },
        B2: {
          en: 'I can interact with a degree of fluency and spontaneity that makes regular interaction with native speakers quite possible. I can take an active part in discussion in familiar contexts, accounting for and sustaining my views.',
          de: 'Ich kann mich so spontan und fliessend verständigen, dass ein normales Gespräch mit einem Muttersprachler recht gut möglich ist. Ich kann mich in vertrauten Situationen aktiv an einer Diskussion beteiligen und meine Ansichten begründen und verteidigen.',
        },
        C1: {
          en: 'I can express myself fluently and spontaneously without much obvious searching for expressions. I can use language flexibly and effectively for social and professional purposes. I can formulate ideas and opinions with precision and relate my contribution skilfully to those of other speakers.',
          de: 'Ich kann mich spontan und fliessend ausdrücken, ohne öfter deutlich erkennbar nach Worten suchen zu müssen. Ich kann die Sprache im gesellschaftlichen und beruflichen Leben wirksam und flexibel gebrauchen. Ich kann meine Gedanken und Meinungen präzise ausdrücken und meine eigenen Beiträge geschickt mit denen anderer verknüpfen.',
        },
        C2: {
          en: 'I can take part effortlessly in any conversation or discussion and have a good familiarity with idiomatic expressions and colloquialisms. I can express myself fluently and convey finer shades of meaning precisely. If I do have a problem I can backtrack and restructure around the difficulty so smoothly that other people are hardly aware of it.',
          de: 'Ich kann mich mühelos an allen Gesprächen und Diskussionen beteiligen und bin auch mit Redewendungen und umgangssprachlichen Wendungen gut vertraut. Ich kann fliessend sprechen und auch feinere Bedeutungsnuancen genau ausdrücken. Bei Ausdrucksschwierigkeiten kann ich so reibungslos wieder ansetzen und umformulieren, dass man es kaum merkt.',
        },
      },
    },
    {
      id: 'spokenProduction',
      label: { en: 'Spoken Production', de: 'Zusammenhängendes Sprechen' },
      descriptors: {
        A1: {
          en: 'I can use simple phrases and sentences to describe where I live and people I know.',
          de: 'Ich kann einfache Wendungen und Sätze gebrauchen, um Leute, die ich kenne, zu beschreiben und um zu beschreiben, wo ich wohne.',
        },
        A2: {
          en: 'I can use a series of phrases and sentences to describe in simple terms my family and other people, living conditions, my educational background and my present or most recent job.',
          de: 'Ich kann mit einer Reihe von Sätzen und mit einfachen Mitteln z. B. meine Familie, andere Leute, meine Wohnsituation, meine Ausbildung und meine gegenwärtige oder letzte berufliche Tätigkeit beschreiben.',
        },
        B1: {
          en: 'I can connect phrases in a simple way in order to describe experiences and events, my dreams, hopes and ambitions. I can briefly give reasons and explanations for opinions and plans. I can narrate a story or relate the plot of a book or film and describe my reactions.',
          de: 'Ich kann in einfachen zusammenhängenden Sätzen sprechen, um Erfahrungen und Ereignisse oder meine Träume, Hoffnungen und Ziele zu beschreiben. Ich kann kurz meine Meinungen und Pläne erklären und begründen. Ich kann eine Geschichte erzählen oder die Handlung eines Buches oder Films wiedergeben und meine Reaktionen beschreiben.',
        },
        B2: {
          en: 'I can present clear, detailed descriptions on a wide range of subjects related to my field of interest. I can explain a viewpoint on a topical issue giving the advantages and disadvantages of various options.',
          de: 'Ich kann zu vielen Themen aus meinen Interessengebieten eine klare und detaillierte Darstellung geben. Ich kann einen Standpunkt zu einer aktuellen Frage erläutern und Vor- und Nachteile verschiedener Möglichkeiten angeben.',
        },
        C1: {
          en: 'I can present clear, detailed descriptions of complex subjects integrating sub-themes, developing particular points and rounding off with an appropriate conclusion.',
          de: 'Ich kann komplexe Sachverhalte ausführlich darstellen und dabei Themenpunkte miteinander verbinden, bestimmte Aspekte besonders ausführen und meinen Beitrag angemessen abschliessen.',
        },
        C2: {
          en: 'I can present a clear, smoothly-flowing description or argument in a style appropriate to the context and with an effective logical structure which helps the recipient to notice and remember significant points.',
          de: 'Ich kann Sachverhalte klar, flüssig und im Stil der jeweiligen Situation angemessen darstellen und erörtern; ich kann meine Darstellung logisch aufbauen und es so den Zuhörern erleichtern, wichtige Punkte zu erkennen und sich diese zu merken.',
        },
      },
    },
    {
      id: 'writing',
      label: { en: 'Writing', de: 'Schreiben' },
      descriptors: {
        A1: {
          en: 'I can write a short, simple postcard, for example sending holiday greetings. I can fill in forms with personal details, for example entering my name, nationality and address on a hotel registration form.',
          de: 'Ich kann eine kurze einfache Postkarte schreiben, z. B. Feriengrüsse. Ich kann auf Formularen, z. B. in Hotels, Namen, Adresse, Nationalität usw. eintragen.',
        },
        A2: {
          en: 'I can write short, simple notes and messages relating to matters in areas of immediate needs. I can write a very simple personal letter, for example thanking someone for something.',
          de: 'Ich kann kurze, einfache Notizen und Mitteilungen schreiben. Ich kann einen ganz einfachen persönlichen Brief schreiben, z. B. um mich für etwas zu bedanken.',
        },
        B1: {
          en: 'I can write simple connected text on topics which are familiar or of personal interest. I can write personal letters describing experiences and impressions.',
          de: 'Ich kann über Themen, die mir vertraut sind oder mich persönlich interessieren, einfache zusammenhängende Texte schreiben. Ich kann persönliche Briefe schreiben und darin von Erfahrungen und Eindrücken berichten.',
        },
        B2: {
          en: 'I can write clear, detailed text on a wide range of subjects related to my interests. I can write an essay or report, passing on information or giving reasons in support of or against a particular point of view. I can write letters highlighting the personal significance of events and experiences.',
          de: 'Ich kann über eine Vielzahl von Themen, die mich interessieren, klare und detaillierte Texte schreiben. Ich kann in einem Aufsatz oder Bericht Informationen wiedergeben oder Argumente und Gegenargumente für oder gegen einen bestimmten Standpunkt darlegen. Ich kann Briefe schreiben und darin die persönliche Bedeutung von Ereignissen und Erfahrungen deutlich machen.',
        },
        C1: {
          en: 'I can express myself in clear, well-structured text, expressing points of view at some length. I can write about complex subjects in a letter, an essay or a report, underlining what I consider to be the salient issues. I can select style appropriate to the reader in mind.',
          de: 'Ich kann mich schriftlich klar und gut strukturiert ausdrücken und meine Ansicht ausführlich darstellen. Ich kann in Briefen, Aufsätzen oder Berichten über komplexe Sachverhalte schreiben und die für mich wesentlichen Aspekte hervorheben. Ich kann in meinen schriftlichen Texten den Stil wählen, der für die jeweiligen Leser angemessen ist.',
        },
        C2: {
          en: 'I can write clear, smoothly-flowing text in an appropriate style. I can write complex letters, reports or articles which present a case with an effective logical structure which helps the recipient to notice and remember significant points. I can write summaries and reviews of professional or literary works.',
          de: 'Ich kann klar, flüssig und stilistisch dem jeweiligen Zweck angemessen schreiben. Ich kann anspruchsvolle Briefe und komplexe Berichte oder Artikel verfassen, die einen Sachverhalt gut strukturiert darstellen und so dem Leser helfen, wichtige Punkte zu erkennen und sich diese zu merken. Ich kann Fachtexte und literarische Werke schriftlich zusammenfassen und besprechen.',
        },
      },
    },
  ];

  window.LWG_NIVEAUS_DATA = { LEVELS, SKILLS };
})();
