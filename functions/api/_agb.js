// functions/api/_agb.js
// Shared content for course confirmation emails.
//
// CANCELLATION_POLICY is rendered in a highlighted callout box above the AGB.
// AGB_HTML contains the full terms sent with every course confirmation.

export const CANCELLATION_POLICY =
  'Bitte beachten Sie, dass das Absagen oder Verschieben einer Lektion mindestens 24 Stunden vor Lektionsbeginn kommuniziert werden muss. Wird eine Lektion weniger als 24 Stunden vor Beginn abgesagt, gilt die Lektion als abgehalten und kann nicht mehr verschoben werden.';

const S = {
  heading:
    'margin:0 0 20px;font-size:14px;font-weight:normal;letter-spacing:0.12em;text-transform:uppercase;color:#1a1a1a;border-bottom:1px solid #eee;padding-bottom:10px;',
  section: 'margin:0 0 6px;font-size:12px;font-weight:700;color:#1a1a1a;',
  sub: 'margin:8px 0 4px;font-size:12px;font-weight:600;color:#444;',
  p: 'margin:0 0 12px;font-size:12px;line-height:1.65;color:#333;',
  pLast: 'margin:0;font-size:12px;line-height:1.65;color:#333;',
  li: 'font-size:12px;line-height:1.65;color:#333;margin-bottom:2px;',
  ul: 'margin:4px 0 12px;padding-left:18px;',
};

export const AGB_HTML = `
<h3 style="${S.heading}">Allgemeine Geschäftsbedingungen</h3>

<p style="${S.section}">Geltungsbereich</p>
<p style="${S.p}">Diese Allgemeinen Geschäftsbedingungen (AGB) regeln das Vertragsverhältnis zwischen Learning with Gioia (nachfolgend „Schule") und den Teilnehmenden (nachfolgend „KundInnen" oder „Teilnehmende") für alle Sprachkurse, Beratungen und weiteren Dienstleistungen der Schule.</p>
<p style="${S.p}">Mit der Anmeldung oder Buchung eines Angebots anerkennen die Teilnehmenden diese Bedingungen als verbindlich.</p>

<p style="${S.section}">Anmeldung und Vertragsabschluss</p>
<ul style="${S.ul}">
  <li style="${S.li}">Die Anmeldung kann online, telefonisch, schriftlich oder persönlich erfolgen.</li>
  <li style="${S.li}">Die Anmeldungen werden in der Reihenfolge ihres Eingangs berücksichtigt.</li>
  <li style="${S.li}">Mit der Bestätigung durch die Schule (E-Mail oder schriftlich) entsteht ein verbindlicher Vertrag.</li>
  <li style="${S.li}">Eine Anmeldung ist auch ohne Unterschrift gültig, sofern sie elektronisch oder mündlich bestätigt wurde.</li>
</ul>

<p style="${S.section}">Kursgebühren und Zahlungsbedingungen</p>
<ul style="${S.ul}">
  <li style="${S.li}">Die Kursgebühren sind in Schweizer Franken (CHF) angegeben und verstehen sich – sofern nicht anders vermerkt – exklusive Mehrwertsteuer und Lehrmittel.</li>
  <li style="${S.li}">Die Zahlung ist vor Kursbeginn fällig.</li>
  <li style="${S.li}">Bei Ratenzahlung gelten die individuell vereinbarten Fristen.</li>
  <li style="${S.li}">Nicht bezahlte Kursgebühren können zum Ausschluss vom Unterricht führen.</li>
  <li style="${S.li}">Mahngebühren und Inkassokosten gehen zulasten der Teilnehmenden. Eine erste Mahnung ist gratis, eine zweite Mahnung wird mit CHF 20.– verrechnet, eine Dritte Mahnung wird mit CHF 50.– verrechnet.</li>
</ul>

<p style="${S.section}">Rücktritt, Abmeldung und Stornierung</p>
<p style="${S.sub}">Vor Kursbeginn (Gruppenkurse und Privatunterricht)</p>
<p style="${S.p}">Abmeldungen müssen schriftlich erfolgen. Es gelten folgende Stornobedingungen:</p>
<ul style="${S.ul}">
  <li style="${S.li}">bis 30 Tage vor Kursbeginn: kostenlos</li>
  <li style="${S.li}">29–15 Tage vor Kursbeginn: 50 % der Kursgebühr</li>
  <li style="${S.li}">14–7 Tage vor Kursbeginn: 75 % der Kursgebühr</li>
  <li style="${S.li}">ab 6 Tage vor Kursbeginn oder Nichterscheinen: 100 % der Kursgebühr</li>
</ul>
<p style="${S.sub}">Nach Kursbeginn</p>
<ul style="${S.ul}">
  <li style="${S.li}">Ein Rücktritt nach Kursbeginn ist nicht mehr möglich.</li>
  <li style="${S.li}">Nicht besuchte Lektionen oder Prüfungen werden nicht rückerstattet und werden auch nicht für einen anderen Kurs angerechnet. Eine Umwandlung von Gruppenkurs in Privatkurs ist nicht generell möglich.</li>
</ul>
<p style="${S.sub}">Rücktritt wegen Krankheit oder Unfall</p>
<p style="${S.p}">Bei Krankheit oder Unfall kann gegen Vorlage eines Arztzeugnisses eine Gutschrift für einen späteren Kurs gewährt werden (keine Barauszahlung).</p>

<p style="${S.section}">Kursorganisation und Änderungen</p>
<p style="${S.p}">Die Schule behält sich das Recht vor,</p>
<ul style="${S.ul}">
  <li style="${S.li}">Kurse bei zu geringer Teilnehmerzahl abzusagen oder zusammenzulegen. Grundsätzlich findet ein Gruppenkurs ab 3 Teilnehmenden statt.</li>
  <li style="${S.li}">Unterrichtszeiten, Kursräume oder Lehrpersonen zu ändern.</li>
</ul>
<ul style="${S.ul}">
  <li style="${S.li}">Bei Absage durch die Schule wird der volle Kursbetrag rückerstattet.</li>
  <li style="${S.li}">Änderungen des Kursplans berechtigen nicht zu einer Rückerstattung.</li>
</ul>

<p style="${S.section}">Besonderheit Privatunterricht</p>
<ul style="${S.ul}">
  <li style="${S.li}">Ferien und andere Abwesenheiten besprechen Sie direkt mit der Lehrperson.</li>
  <li style="${S.li}">Es gilt die 24-Stunden-Regel: Bis 24 Stunden vor dem vereinbarten Termin kann eine Lektion ohne Kostenfolge verschoben werden.</li>
  <li style="${S.li}">Ausgefallene Lektionen werden bei einem Abbruch vor Abo-Ende nicht zurückerstattet.</li>
  <li style="${S.li}">Bei einem Kursunterbruch oder -abbruch wird das Kursgeld nicht zurückerstattet (auch nicht teilweise) und wird auch nicht für einen anderen Kurs angerechnet.</li>
</ul>

<p style="${S.section}">Besonderheit Prüfungsvorbereitung</p>
<p style="${S.p}">Die Schule haftet nicht für Entscheidungen externer Prüfungsinstitutionen bezüglich Zulassung oder Resultaten.</p>

<p style="${S.section}">Haftung</p>
<ul style="${S.ul}">
  <li style="${S.li}">Die Teilnahme an Kursen und Prüfungen erfolgt auf eigene Verantwortung.</li>
  <li style="${S.li}">Die Schule übernimmt keine Haftung für Unfall, Krankheit, Verlust oder Diebstahl persönlicher Gegenstände.</li>
  <li style="${S.li}">Eine Unfall- und Haftpflichtversicherung ist Sache der Teilnehmenden.</li>
</ul>

<p style="${S.section}">Datenschutz</p>
<ul style="${S.ul}">
  <li style="${S.li}">Die Schule verpflichtet sich zur Einhaltung des Schweizer Datenschutzgesetzes (revDSG).</li>
  <li style="${S.li}">Personenbezogene Daten werden ausschliesslich für Kursverwaltung, Rechnungsstellung und interne Kommunikation verwendet.</li>
  <li style="${S.li}">Eine Weitergabe an Dritte erfolgt nur mit Einwilligung oder gesetzlicher Grundlage.</li>
  <li style="${S.li}">Mit der Anmeldung stimmen die Teilnehmenden der Bearbeitung ihrer Daten gemäss dem Datenschutzreglement der Schule zu.</li>
</ul>

<p style="${S.section}">Urheberrecht</p>
<ul style="${S.ul}">
  <li style="${S.li}">Kursunterlagen, Lernplattformen und Unterrichtsmaterialien sind urheberrechtlich geschützt.</li>
  <li style="${S.li}">Vervielfältigung, Fotografieren, Verbreitung oder Weitergabe ohne Zustimmung der Schule ist nicht gestattet.</li>
</ul>

<p style="${S.section}">Verhalten und Ordnung</p>
<ul style="${S.ul}">
  <li style="${S.li}">Teilnehmende verpflichten sich zu respektvollem Verhalten gegenüber Lehrpersonen, Mitarbeitenden und Mitlernenden.</li>
  <li style="${S.li}">Die Schule behält sich vor, Teilnehmende bei grobem Fehlverhalten oder wiederholter Störung vom Unterricht auszuschliessen – ohne Rückerstattung der Kursgebühren.</li>
</ul>

<p style="${S.section}">Ferien, Feiertage und Unterrichtsausfall</p>
<ul style="${S.ul}">
  <li style="${S.li}">Es gelten die Feiertage der Stadt Zürich.</li>
  <li style="${S.li}">Vom 24. Dezember bis einschliesslich 31. Dezember sowie vom 1. Januar bis einschliesslich 7. Januar finden keine Kurse oder Lektionen statt.</li>
  <li style="${S.li}">Sofern zutreffend, werden Ferienzeiten der Lehrpersonen im Voraus in die jeweiligen Kurszyklen eingeplant und den Teilnehmerinnen und Teilnehmern rechtzeitig kommuniziert.</li>
  <li style="${S.li}">Bei Unterrichtsausfall durch die Schule werden Ersatzlektionen angeboten oder anteilige Rückerstattungen gewährt.</li>
  <li style="${S.li}">Unterrichtsausfall durch Teilnehmende (z. B. Ferien, Krankheit) wird nicht vergütet.</li>
</ul>

<p style="${S.section}">Vertragsänderungen</p>
<ul style="${S.ul}">
  <li style="${S.li}">Änderungen der AGB treten mit Veröffentlichung auf der Website oder Mitteilung an die Teilnehmenden in Kraft.</li>
  <li style="${S.li}">Es gelten die zum Zeitpunkt der Anmeldung gültigen Bedingungen.</li>
</ul>

<p style="${S.section}">Gerichtsstand und anwendbares Recht</p>
<ul style="${S.ul}">
  <li style="${S.li}">Es gilt Schweizer Recht.</li>
  <li style="${S.li}">Gerichtsstand ist Zürich, Schweiz.</li>
</ul>

<p style="${S.section}">Schlussbestimmung</p>
<p style="${S.pLast}">Mit der Anmeldung zu einem Kurs, einer Prüfung oder einem Angebot der Schule gelten diese AGB als anerkannt.</p>
`;
