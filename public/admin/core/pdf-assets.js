/* ── Shared PDF assets (logo + signature) ─────────────────────────────
   Shared by certificates.js and contracts.js. Caches the rasterised
   logo and the admin signature image so both PDF flows download each
   asset once per session. */
import { apiFetch } from './api.js';

const LOGO_URL = '/lwg_logo.svg';
export const SIGNATURE_URL = '/api/get-signature';
export const SIGNATURE_NAME = 'Gioia Birukoff';
export const SIGNATURE_TITLE_DE = 'Schulleitung · learning with gioia';
export const SIGNATURE_TITLE_EN = 'Founder · learning with gioia';
export const ISSUE_LOCATION = 'Zürich';

let logoDataUrl = null;
let signatureDataUrl = null;
let signatureLoadError = null;

export async function loadPdfAssets() {
  if (!logoDataUrl) {
    try {
      logoDataUrl = await loadImageAsDataUrl(LOGO_URL);
    } catch (err) {
      console.error('Could not load logo:', err);
      logoDataUrl = null;
    }
  }
  if (!signatureDataUrl) {
    try {
      signatureDataUrl = await loadImageAsDataUrl(SIGNATURE_URL, { authed: true });
      signatureLoadError = null;
    } catch (err) {
      signatureLoadError = err?.message || String(err);
      console.warn(
        `Signature image could not be loaded from ${SIGNATURE_URL}: ${signatureLoadError}. ` +
          'PDFs will be generated without a signature image until the file is reachable.'
      );
      signatureDataUrl = null;
    }
  }
  return { logoDataUrl, signatureDataUrl, signatureLoadError };
}

async function loadImageAsDataUrl(url, { authed = false } = {}) {
  // Use fetch + FileReader: gives real HTTP error messages, avoids
  // CORS quirks of <img crossorigin>, and bypasses image-cache lag.
  // authed: route the request through apiFetch so admin-only endpoints
  // receive the Bearer token.
  const res = authed ? await apiFetch(url) : await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
  const blob = await res.blob();

  // SVG: rasterise via canvas so jsPDF can embed it as PNG.
  if (blob.type === 'image/svg+xml' || /\.svg(\?|$)/i.test(url)) {
    const objectUrl = URL.createObjectURL(blob);
    try {
      return await rasteriseToPngDataUrl(objectUrl);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  return await blobToDataUrl(blob);
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}

function rasteriseToPngDataUrl(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 800;
        canvas.height = img.naturalHeight || 600;
        canvas.getContext('2d').drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('Image decode failed: ' + src));
    img.src = src;
  });
}

export function imageAspectRatio(doc, dataUrl) {
  try {
    const props = doc.getImageProperties(dataUrl);
    if (props?.width && props?.height) return props.width / props.height;
  } catch (err) {
    console.warn('Could not read image dimensions:', err);
  }
  return null;
}
