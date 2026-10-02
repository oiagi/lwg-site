/* ── Swiss QR Code encoding ──────────────────────────────────────── */
// Wraps the vendored Nayuki encoder with the parameters the SIX guidelines
// require: byte mode UTF-8, error correction level M (never boosted) and the
// smallest version that fits, capped at version 25.
import qrcodegen from '../vendor/qrcodegen.js';

export const QR_MAX_VERSION = 25;

export function encodeQrBill(payload) {
  const { QrCode, QrSegment } = qrcodegen;
  const bytes = new TextEncoder().encode(String(payload ?? ''));
  const segments = [QrSegment.makeBytes(bytes)];
  const qr = QrCode.encodeSegments(segments, QrCode.Ecc.MEDIUM, 1, QR_MAX_VERSION, -1, false);
  return {
    size: qr.size,
    version: qr.version,
    errorCorrectionLevel: qr.errorCorrectionLevel === QrCode.Ecc.MEDIUM ? 'M' : 'other',
    isDark: (x, y) => qr.getModule(x, y),
  };
}
