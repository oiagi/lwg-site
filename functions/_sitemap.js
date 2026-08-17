// Sitemap generated from the routing table rather than maintained by hand.
//
// The hand-written public/sitemap.xml had drifted: /en/impressum and its two
// siblings were declared as hreflang alternates without ever appearing as their
// own <loc>, x-default disagreed with _redirects on five pages, and new pages
// had to be remembered. Deriving it from ROUTES makes those states impossible.
//
// changefreq and priority are omitted deliberately — Google ignores both. So is
// lastmod: an accurate one would need per-page publication dates, and a faked
// "today" is worse than none.

import { ROUTES, SUPPORTED, pagePath, defaultLangFor } from './_i18n-content.js';
import { SITE_ORIGIN } from './_schema.js';

// Flow pages: noindex, and Disallowed in robots.txt.
const EXCLUDED = new Set(['/intake.html', '/feedback.html', '/thankyou.html']);

export function buildSitemap() {
  const entries = [];

  for (const page of Object.keys(ROUTES)) {
    if (EXCLUDED.has(page)) continue;

    const alternates = SUPPORTED.map(
      (lang) =>
        `    <xhtml:link rel="alternate" hreflang="${lang}" href="${SITE_ORIGIN}${pagePath(page, lang)}" />`
    );
    alternates.push(
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE_ORIGIN}${pagePath(page, defaultLangFor(page))}" />`
    );

    // Every alternate is also a <loc> of its own, so the set is reciprocal.
    for (const lang of SUPPORTED) {
      entries.push(
        [
          '  <url>',
          `    <loc>${SITE_ORIGIN}${pagePath(page, lang)}</loc>`,
          ...alternates,
          '  </url>',
        ].join('\n')
      );
    }
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset',
    '  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '  xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    '',
    entries.join('\n\n'),
    '',
    '</urlset>',
    '',
  ].join('\n');
}

export const onRequest = () =>
  new Response(buildSitemap(), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      // _headers only decorates responses that come through the asset
      // pipeline, and this one is authored here, so set it explicitly.
      'X-Content-Type-Options': 'nosniff',
    },
  });
