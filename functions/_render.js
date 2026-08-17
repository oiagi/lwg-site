// Server-side language rendering for /en/* and /de/*.
//
// Fetches the underlying static HTML from the asset store and pipes it through
// HTMLRewriter so the response is complete, language-correct HTML for any
// client — including crawlers that do not execute JavaScript. Previously the
// title, description, canonical, hreflang, body copy, navigation, footer and
// JSON-LD were all applied in the browser by public/i18n.js and public/nav.js,
// so /de/ URLs served English HTML with lang="en" to anything without JS.
//
// Scoped deliberately to the two language prefixes: a root functions/_middleware.js
// would match /* and disable the entire _redirects file, including the .html ->
// clean-URL 301s and the retired-page redirects.

import {
  SUPPORTED,
  LEGACY_SLUG_REDIRECTS,
  pages,
  pageForSlug,
  pageForAnySlug,
  pagePath,
  defaultLangFor,
  templatePath,
  localizeHref,
  localizeHtmlLinks,
} from './_i18n-content.js';
import { navMarkup, footerMarkup } from './_nav-markup.js';
import { schemaFor, SITE_ORIGIN } from './_schema.js';

// Search Console / Bing site verification. Values come from the property setup
// in each console; leave empty until then — an empty tag is worse than none.
const VERIFICATION = {
  google: '', // TODO: google-site-verification token
  bing: '', // TODO: msvalidate.01 token
};

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function absoluteUrl(page, lang) {
  return SITE_ORIGIN + pagePath(page, lang);
}

// The complete SEO head, generated rather than patched: several pages ship no
// description, canonical or OG tags at all, so there would be nothing to patch.
function headMarkup(page, lang) {
  const entry = pages[page] || {};
  const title = entry.title?.[lang] || '';
  const description = entry.description?.[lang] || '';
  const canonical = absoluteUrl(page, lang);
  const xDefault = absoluteUrl(page, defaultLangFor(page));
  const image = `${SITE_ORIGIN}/gioia_logo.png`;
  const out = [];

  if (title) out.push(`<title>${esc(title)}</title>`);
  if (description) out.push(`<meta name="description" content="${esc(description)}">`);
  out.push(`<link rel="canonical" href="${canonical}">`);
  out.push(`<link rel="alternate" hreflang="en" href="${absoluteUrl(page, 'en')}">`);
  out.push(`<link rel="alternate" hreflang="de" href="${absoluteUrl(page, 'de')}">`);
  out.push(`<link rel="alternate" hreflang="x-default" href="${xDefault}">`);

  out.push('<meta property="og:type" content="website">');
  out.push('<meta property="og:site_name" content="learning with gioia">');
  out.push(`<meta property="og:locale" content="${lang === 'de' ? 'de_CH' : 'en_GB'}">`);
  out.push(`<meta property="og:locale:alternate" content="${lang === 'de' ? 'en_GB' : 'de_CH'}">`);
  if (title) out.push(`<meta property="og:title" content="${esc(title)}">`);
  if (description) out.push(`<meta property="og:description" content="${esc(description)}">`);
  out.push(`<meta property="og:url" content="${canonical}">`);
  out.push(`<meta property="og:image" content="${image}">`);

  out.push('<meta name="twitter:card" content="summary">');
  if (title) out.push(`<meta name="twitter:title" content="${esc(title)}">`);
  if (description) out.push(`<meta name="twitter:description" content="${esc(description)}">`);
  out.push(`<meta name="twitter:image" content="${image}">`);

  if (VERIFICATION.google)
    out.push(`<meta name="google-site-verification" content="${esc(VERIFICATION.google)}">`);
  if (VERIFICATION.bing)
    out.push(`<meta name="msvalidate.01" content="${esc(VERIFICATION.bing)}">`);

  out.push(`<script type="application/ld+json">${schemaFor(page, lang)}</script>`);

  return out.join('\n  ');
}

export async function render(context, lang) {
  const { request, env, params } = context;

  if (!SUPPORTED.includes(lang)) return new Response('Not found', { status: 404 });

  // [[path]] yields an array of segments; empty for /en and /en/.
  const segments = Array.isArray(params?.path) ? params.path : params?.path ? [params.path] : [];
  const slug = segments.join('/').replace(/\.html$/, '');

  const legacy = LEGACY_SLUG_REDIRECTS[slug];
  if (legacy) return Response.redirect(SITE_ORIGIN + legacy(lang), 301);

  const page = pageForSlug(slug, lang);
  if (!page) {
    // The slug belongs to the other language (/de/german-courses, or an old
    // bookmark from before the German slugs were localized). Send it to the
    // same page's slug in the language the prefix asked for, so the language
    // the visitor chose is the one they get.
    const foreign = pageForAnySlug(slug);
    if (!foreign) return new Response('Not found', { status: 404 });
    return Response.redirect(SITE_ORIGIN + pagePath(foreign, lang), 301);
  }

  const url = new URL(request.url);
  const assetResponse = await env.ASSETS.fetch(new URL(templatePath(page), url.origin));
  if (!assetResponse.ok) return new Response('Not found', { status: 404 });

  const response = new Response(assetResponse.body, assetResponse);
  // The template path is noindex so the raw copy under /pages/ cannot be
  // indexed; the rendered page it produces must not inherit that.
  response.headers.delete('x-robots-tag');

  const entry = pages[page] || {};
  const rewriter = new HTMLRewriter()
    .on('html', {
      element(el) {
        el.setAttribute('lang', lang);
      },
    })
    // Strip the SEO tags the static files carry so the generated block below is
    // the single source and cannot contradict them. Every selector is scoped to
    // head: a bare `title` would also match the <title> inside the homepage's
    // inline SVG logo, which is its accessible name.
    .on(
      'head title, head meta[name="description"], head link[rel="canonical"], head meta[property^="og:"], head meta[name^="twitter:"]',
      {
        element(el) {
          el.remove();
        },
      }
    )
    .on('head', {
      element(el) {
        el.append('\n  ' + headMarkup(page, lang) + '\n', { html: true });
      },
    })
    .on('body', {
      element(el) {
        el.prepend(navMarkup(page, lang), { html: true });
        el.append(footerMarkup(page, lang), { html: true });
      },
    })
    .on('a[href]', {
      element(el) {
        const localized = localizeHref(el.getAttribute('href'), lang);
        if (localized) el.setAttribute('href', localized);
      },
    });

  // Apply the page copy. Each selector's value may contain HTML.
  for (const [selector, copy] of Object.entries(entry.text || {})) {
    const value = copy[lang];
    if (value === undefined) continue;
    rewriter.on(selector, {
      element(el) {
        if (copy.attr) el.setAttribute(copy.attr, value);
        else el.setInnerContent(localizeHtmlLinks(value, lang), { html: true });
      },
    });
  }

  return rewriter.transform(response);
}
