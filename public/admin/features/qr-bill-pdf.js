/* ── Swiss QR-bill page (jsPDF, mm units) ───────────────────────── */
// Draws the payment part and receipt per the SIX "Style Guide QR-bill":
// a 210 × 105 mm strip at the bottom of an A4 page, receipt 62 mm wide on
// the left, payment part 148 mm on the right, 5 mm margins, Helvetica,
// 46 × 46 mm QR code with the 7 × 7 mm Swiss cross, dashed separators with
// scissors because the page is delivered as a PDF rather than perforated.
import {
  prepareQrBill,
  formatIban,
  formatQrReference,
  formatAmount,
  qrBillLabels,
  partyDisplayLines,
} from '../core/swiss-qr-bill.js';
import { encodeQrBill } from '../core/swiss-qr-code.js';

const PAGE_W = 210;
const PAGE_H = 297;
const STRIP_H = 105;
const RECEIPT_W = 62;
const MARGIN = 5;
const QR_SIZE = 46;
const CROSS_SIZE = 7;

// Typography from the style guide (points) and the line heights used for it.
const RECEIPT = { title: 11, heading: 6, value: 8, headingLine: 2.6, valueLine: 3.2, gap: 2.5 };
const PAYMENT = { title: 11, heading: 8, value: 10, headingLine: 3.2, valueLine: 3.9, gap: 3.2 };

const PT_TO_MM = 25.4 / 72;

function setFont(doc, size, style = 'normal') {
  doc.setFont('helvetica', style);
  doc.setFontSize(size);
}

// Draws a heading followed by its value lines; returns the next baseline.
function drawBlock(doc, type, x, y, heading, lines, maxWidth) {
  setFont(doc, type.heading, 'bold');
  doc.text(heading, x, y);
  y += type.headingLine;
  setFont(doc, type.value);
  for (const line of lines) {
    const wrapped = doc.splitTextToSize(String(line), maxWidth);
    doc.text(wrapped, x, y);
    y += wrapped.length * type.valueLine;
  }
  return y + type.gap;
}

// Blank box with 3 mm corner marks, used when the amount or debtor is left
// for the payer to fill in.
function drawCornerBox(doc, x, y, w, h) {
  const mark = 3;
  doc.setLineWidth(0.75 * PT_TO_MM);
  doc.setLineDashPattern([], 0);
  const corners = [
    [x, y, 1, 1],
    [x + w, y, -1, 1],
    [x, y + h, 1, -1],
    [x + w, y + h, -1, -1],
  ];
  for (const [cx, cy, dx, dy] of corners) {
    doc.line(cx, cy, cx + dx * mark, cy);
    doc.line(cx, cy, cx, cy + dy * mark);
  }
}

function drawQrCode(doc, payload, x, y) {
  const qr = encodeQrBill(payload);
  const module = QR_SIZE / qr.size;
  doc.setFillColor(0, 0, 0);
  // Runs of dark modules per row become one rectangle each: fewer objects
  // and no hairline seams between neighbouring modules.
  for (let row = 0; row < qr.size; row += 1) {
    let col = 0;
    while (col < qr.size) {
      if (!qr.isDark(col, row)) {
        col += 1;
        continue;
      }
      let end = col;
      while (end < qr.size && qr.isDark(end, row)) end += 1;
      doc.rect(x + col * module, y + row * module, (end - col) * module, module, 'F');
      col = end;
    }
  }
  drawSwissCross(doc, x + QR_SIZE / 2, y + QR_SIZE / 2);
}

// Swiss cross in the official 6:20:32 proportions, 7 × 7 mm black square with
// a thin white frame so the logo stays crisp against the modules.
function drawSwissCross(doc, cx, cy) {
  const frame = 0.5;
  const half = CROSS_SIZE / 2;
  doc.setFillColor(255, 255, 255);
  doc.rect(
    cx - half - frame,
    cy - half - frame,
    CROSS_SIZE + 2 * frame,
    CROSS_SIZE + 2 * frame,
    'F'
  );
  doc.setFillColor(0, 0, 0);
  doc.rect(cx - half, cy - half, CROSS_SIZE, CROSS_SIZE, 'F');
  const armWidth = (CROSS_SIZE * 6) / 32;
  const armLength = (CROSS_SIZE * 20) / 32;
  doc.setFillColor(255, 255, 255);
  doc.rect(cx - armWidth / 2, cy - armLength / 2, armWidth, armLength, 'F');
  doc.rect(cx - armLength / 2, cy - armWidth / 2, armLength, armWidth, 'F');
}

// Small scissors symbol centred on (x, y), blades pointing along `angle`
// (0 = right, 90 = down). Drawn from primitives so no glyph font is needed.
function drawScissors(doc, x, y, angle = 0) {
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const at = (dx, dy) => [x + dx * cos - dy * sin, y + dx * sin + dy * cos];
  doc.setLineWidth(0.35);
  doc.setLineDashPattern([], 0);
  doc.setDrawColor(0, 0, 0);
  const tip = at(2.6, 0);
  const pivot = at(0.2, 0);
  for (const side of [-1, 1]) {
    const handle = at(-2.4, side * 1.1);
    const bladeStart = at(-0.6, side * 1.1);
    doc.circle(handle[0], handle[1], 0.75, 'S');
    doc.line(bladeStart[0], bladeStart[1], pivot[0], pivot[1]);
    doc.line(pivot[0], pivot[1], tip[0], tip[1]);
    const bladeTip = at(2.6, side * 0.6);
    doc.line(pivot[0], pivot[1], bladeTip[0], bladeTip[1]);
  }
}

function drawSeparators(doc, y0, labels) {
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(0, y0, PAGE_W, y0);
  doc.line(RECEIPT_W, y0, RECEIPT_W, PAGE_H);
  doc.setLineDashPattern([], 0);
  drawScissors(doc, 14, y0, 0);
  drawScissors(doc, RECEIPT_W, y0 + 12, 90);
  setFont(doc, 7);
  doc.text(labels.separate, PAGE_W / 2, y0 - 1.6, { align: 'center' });
}

function drawReceipt(doc, bill, y0, labels) {
  const x = MARGIN;
  const width = RECEIPT_W - 2 * MARGIN;
  setFont(doc, RECEIPT.title, 'bold');
  doc.text(labels.receipt, x, y0 + 8);

  let y = y0 + 14;
  y = drawBlock(
    doc,
    RECEIPT,
    x,
    y,
    labels.account,
    [formatIban(bill.iban), ...partyDisplayLines(bill.creditor)],
    width
  );
  if (bill.reference) {
    y = drawBlock(doc, RECEIPT, x, y, labels.reference, [formatQrReference(bill.reference)], width);
  }
  if (bill.debtor) {
    drawBlock(doc, RECEIPT, x, y, labels.payableBy, partyDisplayLines(bill.debtor), width);
  } else {
    setFont(doc, RECEIPT.heading, 'bold');
    doc.text(labels.payableByBlank, x, y);
    drawCornerBox(doc, x, y + 1.5, 52, 20);
  }

  const amountTop = y0 + 68;
  setFont(doc, RECEIPT.heading, 'bold');
  doc.text(labels.currency, x, amountTop + 2);
  doc.text(labels.amount, x + 13, amountTop + 2);
  setFont(doc, RECEIPT.value);
  doc.text(bill.currency, x, amountTop + 5.6);
  if (bill.amount === null) {
    drawCornerBox(doc, x + 22, amountTop + 3, 30, 10);
  } else {
    doc.text(formatAmount(bill.amount), x + 13, amountTop + 5.6);
  }

  setFont(doc, RECEIPT.heading, 'bold');
  doc.text(labels.acceptancePoint, RECEIPT_W - MARGIN, y0 + 83.5, { align: 'right' });
}

function drawPaymentPart(doc, bill, y0, labels) {
  const x = RECEIPT_W + MARGIN;
  const infoX = x + QR_SIZE + 5;
  const infoWidth = PAGE_W - MARGIN - infoX;

  setFont(doc, PAYMENT.title, 'bold');
  doc.text(labels.paymentPart, x, y0 + 8);

  drawQrCode(doc, bill.payload, x, y0 + 17);

  const amountTop = y0 + 68;
  setFont(doc, PAYMENT.heading, 'bold');
  doc.text(labels.currency, x, amountTop + 2.5);
  doc.text(labels.amount, x + 22, amountTop + 2.5);
  setFont(doc, PAYMENT.value);
  doc.text(bill.currency, x, amountTop + 7);
  if (bill.amount === null) {
    drawCornerBox(doc, x + 22, amountTop + 4, 40, 15);
  } else {
    doc.text(formatAmount(bill.amount), x + 22, amountTop + 7);
  }

  let y = y0 + 14;
  y = drawBlock(
    doc,
    PAYMENT,
    infoX,
    y,
    labels.account,
    [formatIban(bill.iban), ...partyDisplayLines(bill.creditor)],
    infoWidth
  );
  if (bill.reference) {
    y = drawBlock(
      doc,
      PAYMENT,
      infoX,
      y,
      labels.reference,
      [formatQrReference(bill.reference)],
      infoWidth
    );
  }
  if (bill.message) {
    y = drawBlock(doc, PAYMENT, infoX, y, labels.additionalInfo, [bill.message], infoWidth);
  }
  if (bill.debtor) {
    drawBlock(doc, PAYMENT, infoX, y, labels.payableBy, partyDisplayLines(bill.debtor), infoWidth);
  } else {
    setFont(doc, PAYMENT.heading, 'bold');
    doc.text(labels.payableByBlank, infoX, y);
    drawCornerBox(doc, infoX, y + 2, 65, 25);
  }
}

// Adds a new A4 page carrying the QR-bill strip at the bottom. `input` is the
// raw bill data (see prepareQrBill); it is validated here, so an invalid bill
// throws before anything is drawn. `header` is an optional line printed at the
// top of the page so a detached sheet stays attributable to its invoice.
export function drawQrBillPage(doc, input, lang = 'de', header = '') {
  const bill = prepareQrBill(input);
  const labels = qrBillLabels(lang);
  const y0 = PAGE_H - STRIP_H;

  doc.addPage('a4', 'portrait');
  doc.setTextColor(0, 0, 0);
  doc.setDrawColor(0, 0, 0);
  if (header) {
    setFont(doc, 9);
    doc.text(String(header), 22, 20);
  }
  drawSeparators(doc, y0, labels);
  drawReceipt(doc, bill, y0, labels);
  drawPaymentPart(doc, bill, y0, labels);
  doc.setLineDashPattern([], 0);
  return bill;
}
