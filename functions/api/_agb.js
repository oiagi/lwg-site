// functions/api/_agb.js
// Shared content for course confirmation emails.
//
// The CANCELLATION_POLICY clause is rendered prominently in the confirmation
// and is also referenced in the AGB (§3). Edit AGB_HTML to update the terms
// that go out with every confirmation email.

export const CANCELLATION_POLICY =
  'Bitte beachten Sie, dass das Absagen oder Verschieben einer Lektion mindestens 24 Stunden vor Lektionsbeginn kommuniziert werden muss. Wird eine Lektion weniger als 24 Stunden vor Beginn abgesagt, gilt die Lektion als abgehalten und kann nicht mehr verschoben werden.';

export const AGB_HTML = `
<h3 style="margin:0 0 12px;font-size:14px;font-weight:normal;letter-spacing:0.12em;text-transform:uppercase;color:#1a1a1a;">Allgemeine Geschäftsbedingungen</h3>

<p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#1a1a1a;">§1 Vertragsgegenstand</p>
<p style="margin:0 0 14px;font-size:12px;line-height:1.6;color:#333;">
Learning with Gioia bietet Sprachkurse, Prüfungsvorbereitung und Nachhilfe in Einzel-, Duo- und Gruppenformaten. Der Vertrag kommt mit der schriftlichen Bestätigung des Kurses durch Learning with Gioia zustande.
</p>

<p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#1a1a1a;">§2 Zahlungsbedingungen</p>
<p style="margin:0 0 14px;font-size:12px;line-height:1.6;color:#333;">
Die Kursgebühren werden nach Rechnungsstellung fällig. Die Zahlung erfolgt innerhalb der in der Rechnung angegebenen Frist. Bei Zahlungsverzug behält sich Learning with Gioia das Recht vor, weitere Lektionen bis zum Zahlungseingang auszusetzen.
</p>

<p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#1a1a1a;">§3 Absage und Verschiebung von Lektionen</p>
<p style="margin:0 0 14px;font-size:12px;line-height:1.6;color:#333;">
${CANCELLATION_POLICY} Eine rechtzeitig abgesagte Lektion wird in Absprache zu einem Ersatztermin nachgeholt.
</p>

<p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#1a1a1a;">§4 Absage durch Learning with Gioia</p>
<p style="margin:0 0 14px;font-size:12px;line-height:1.6;color:#333;">
Muss eine Lektion seitens Learning with Gioia abgesagt werden, wird diese kostenlos zu einem neuen Termin nachgeholt. Bereits bezahlte, nicht abgehaltene Lektionen werden im Falle einer endgültigen Absage vollständig zurückerstattet.
</p>

<p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#1a1a1a;">§5 Kursdurchführung</p>
<p style="margin:0 0 14px;font-size:12px;line-height:1.6;color:#333;">
Die Lektionen finden zu den vereinbarten Zeiten am vereinbarten Ort statt. Online-Lektionen werden über einen von Learning with Gioia bereitgestellten Video-Link durchgeführt. Die teilnehmende Person ist für eine stabile Internetverbindung selbst verantwortlich.
</p>

<p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#1a1a1a;">§6 Haftung</p>
<p style="margin:0 0 14px;font-size:12px;line-height:1.6;color:#333;">
Learning with Gioia haftet nur für Schäden, die auf vorsätzlichem oder grob fahrlässigem Verhalten beruhen. Eine Haftung für den Lernerfolg wird ausdrücklich ausgeschlossen.
</p>

<p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#1a1a1a;">§7 Datenschutz</p>
<p style="margin:0 0 14px;font-size:12px;line-height:1.6;color:#333;">
Die im Rahmen der Kursanmeldung erhobenen personenbezogenen Daten werden ausschliesslich zur Vertragsabwicklung verwendet und nicht an Dritte weitergegeben. Es gilt die Datenschutzerklärung unter oiagi.org.
</p>

<p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#1a1a1a;">§8 Schlussbestimmungen</p>
<p style="margin:0;font-size:12px;line-height:1.6;color:#333;">
Änderungen und Ergänzungen dieser AGB bedürfen der Schriftform. Es gilt schweizerisches Recht. Gerichtsstand ist Zürich.
</p>
`;
