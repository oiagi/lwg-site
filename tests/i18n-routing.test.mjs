// Run with: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import {
  SUPPORTED,
  ROUTES,
  DEFAULT_BY_PAGE,
  LEGACY_SLUG_REDIRECTS,
  pages,
  nav,
  pageForSlug,
  pagePath,
  templatePath,
  defaultLangFor,
  localizeHref,
  localizeHtmlLinks,
  hasRoute,
} from '../functions/_i18n-content.js';
import { schemaFor, COURSES } from '../functions/_schema.js';
import { navMarkup, footerMarkup } from '../functions/_nav-markup.js';
import { buildSitemap } from '../functions/_sitemap.js';

test('pageForSlug resolves every route, and the bare language prefix', () => {
  for (const [page, slug] of Object.entries(ROUTES)) {
    assert.equal(pageForSlug(slug), page, `slug ${slug}`);
  }
  // /en and /en/ both arrive with no segments.
  assert.equal(pageForSlug(''), '/index.html');
  assert.equal(pageForSlug('/'), '/index.html');
});

test('pageForSlug returns null for unknown slugs so the Function can 404', () => {
  for (const slug of ['nonexistent', 'german-course', 'admin', 'api/config', 'pages/index']) {
    assert.equal(pageForSlug(slug), null, slug);
  }
});

test('pagePath round-trips through pageForSlug for both languages', () => {
  for (const page of Object.keys(ROUTES)) {
    for (const lang of SUPPORTED) {
      const path = pagePath(page, lang);
      assert.ok(path.startsWith(`/${lang}/`), `${page} ${lang} -> ${path}`);
      const slug = path.slice(lang.length + 2);
      assert.equal(pageForSlug(slug), page, path);
    }
  }
});

test('templatePath is extensionless and points into /pages', () => {
  assert.equal(templatePath('/index.html'), '/pages/');
  assert.equal(templatePath('/german-courses.html'), '/pages/german-courses');
  for (const page of Object.keys(ROUTES)) {
    assert.ok(!templatePath(page).endsWith('.html'), page);
  }
});

test('every routed page has a template file on disk', () => {
  const files = new Set(readdirSync('public/pages'));
  for (const page of Object.keys(ROUTES)) {
    assert.ok(files.has(page.slice(1)), `missing public/pages${page}`);
  }
});

test('every routed page has a title and description in both languages', () => {
  // Flow pages are noindex, so a description is optional there.
  const noindex = new Set(['/intake.html', '/feedback.html', '/thankyou.html']);
  for (const page of Object.keys(ROUTES)) {
    const entry = pages[page];
    assert.ok(entry, `no dictionary entry for ${page}`);
    for (const lang of SUPPORTED) {
      assert.ok(entry.title?.[lang], `${page} missing ${lang} title`);
      if (!noindex.has(page)) {
        assert.ok(entry.description?.[lang], `${page} missing ${lang} description`);
      }
    }
  }
});

test('titles are distinct per page and carry the brand', () => {
  for (const lang of SUPPORTED) {
    const seen = new Map();
    for (const page of Object.keys(ROUTES)) {
      const title = pages[page].title[lang];
      assert.ok(
        title.includes('Learning with Gioia'),
        `${page} ${lang} title lacks the brand: ${title}`
      );
      // A bare one-word title is the regression this replaced.
      assert.ok(title.length > 20, `${page} ${lang} title too thin: ${title}`);
      assert.ok(!seen.has(title), `${page} duplicates the ${lang} title of ${seen.get(title)}`);
      seen.set(title, page);
    }
  }
});

test('every copy selector has both languages', () => {
  for (const [page, entry] of Object.entries(pages)) {
    for (const [selector, copy] of Object.entries(entry.text || {})) {
      for (const lang of SUPPORTED) {
        assert.notEqual(copy[lang], undefined, `${page} ${selector} missing ${lang}`);
      }
    }
  }
});

test('copy selectors use only the subset HTMLRewriter supports', () => {
  // tag, #id, .class, [attr=…] and descendant combinators. A pseudo-class or
  // sibling combinator would be silently dropped at render time.
  for (const [page, entry] of Object.entries(pages)) {
    for (const selector of Object.keys(entry.text || {})) {
      assert.ok(!/[:>+~]/.test(selector), `${page}: unsupported selector ${selector}`);
    }
  }
});

test('x-default resolves to one language per page, consistent with _redirects', () => {
  const redirects = readFileSync('public/_redirects', 'utf8');
  for (const page of Object.keys(ROUTES)) {
    const lang = defaultLangFor(page);
    assert.ok(SUPPORTED.includes(lang), `${page} -> ${lang}`);
    // Where _redirects canonicalises the legacy .html URL, it must agree.
    const rule = redirects.match(new RegExp(`^\\${page}\\s+(\\S+)\\s+301`, 'm'));
    if (rule) {
      assert.equal(rule[1], pagePath(page, lang), `_redirects disagrees on ${page}`);
    }
  }
});

test('DEFAULT_BY_PAGE and LEGACY_SLUG_REDIRECTS reference real pages and slugs', () => {
  for (const page of Object.keys(DEFAULT_BY_PAGE)) {
    assert.ok(hasRoute(page), `DEFAULT_BY_PAGE has unknown page ${page}`);
  }
  for (const [slug, target] of Object.entries(LEGACY_SLUG_REDIRECTS)) {
    assert.equal(pageForSlug(slug), null, `${slug} is both a live route and a legacy redirect`);
    for (const lang of SUPPORTED) {
      assert.ok(target(lang).startsWith(`/${lang}/`), `${slug} -> ${target(lang)}`);
    }
  }
});

test('localizeHref rewrites internal links and leaves everything else alone', () => {
  assert.equal(localizeHref('/german-courses.html', 'de'), '/de/german-courses');
  assert.equal(localizeHref('/index.html#offer-details', 'de'), '/de/#offer-details');
  assert.equal(localizeHref('/enquiry.html?ref=x', 'en'), '/en/enquiry?ref=x');
  // Already localised, and therefore unchanged.
  assert.equal(localizeHref('/de/german-courses', 'de'), null);
  // Not ours to touch.
  for (const href of [
    '#offer',
    'mailto:info@learningwithgioia.ch',
    'tel:+41000000000',
    'https://example.com/page.html',
    '//cdn.example.com/x.js',
    '/admin/index.html',
    '/contract-upload.html',
    'relative.html',
  ]) {
    assert.equal(localizeHref(href, 'de'), null, href);
  }
});

test('localizeHtmlLinks rewrites links inside injected copy', () => {
  const html = 'We offer <a href="/lunch-time-german.html">tailored programmes</a>.';
  assert.match(localizeHtmlLinks(html, 'de'), /href="\/de\/lunch-time-german"/);
  const external = '<a href="https://example.com/a.html">x</a>';
  assert.equal(localizeHtmlLinks(external, 'de'), external);
});

test('no dictionary copy links to a .html URL that would 301', () => {
  for (const [page, entry] of Object.entries(pages)) {
    for (const [selector, copy] of Object.entries(entry.text || {})) {
      for (const lang of SUPPORTED) {
        const localized = localizeHtmlLinks(copy[lang] ?? '', lang);
        const stale = localized.match(/href="\/[^"]*\.html[^"]*"/g);
        assert.equal(stale, null, `${page} ${selector} ${lang}: ${stale}`);
      }
    }
  }
});

test('nav and footer markup are complete, localised and self-consistent', () => {
  for (const lang of SUPPORTED) {
    const markup =
      navMarkup('/gymivorbereitung.html', lang) + footerMarkup('/gymivorbereitung.html', lang);
    // Every internal link carries the language prefix and no .html.
    const hrefs = [...markup.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(hrefs.length > 15, `only ${hrefs.length} nav links`);
    for (const href of hrefs) {
      if (href.startsWith('#')) continue;
      assert.ok(
        href.startsWith(`/${lang}/`) || href.startsWith(`/${SUPPORTED.find((l) => l !== lang)}/`),
        `unprefixed nav href ${href}`
      );
      assert.ok(!href.includes('.html'), `nav href still points at a file: ${href}`);
    }
    // The other language is reachable by a real link, not a button.
    const other = SUPPORTED.find((l) => l !== lang);
    assert.match(
      markup,
      new RegExp(`<a class="language-option" href="/${other}/gymivorbereitung"`)
    );
    // The current page is marked once.
    assert.equal((markup.match(/aria-current="page"/g) || []).length, 1);
    assert.ok(markup.includes(nav.impressum[lang]), 'footer missing legal links');
  }
});

test('schemaFor emits valid JSON with resolvable @id references', () => {
  for (const page of Object.keys(ROUTES)) {
    for (const lang of SUPPORTED) {
      const json = schemaFor(page, lang);
      const parsed = JSON.parse(json); // throws if the graph is malformed
      const graph = parsed['@graph'];
      assert.ok(Array.isArray(graph) && graph.length >= 3, `${page} ${lang} graph too small`);

      const ids = new Set(graph.map((node) => node['@id']).filter(Boolean));
      const referenced = [...json.matchAll(/"@id":"([^"]+)"/g)].map((m) => m[1]);
      for (const ref of referenced) {
        assert.ok(ids.has(ref), `${page} ${lang}: dangling @id ${ref}`);
      }
      // JSON-LD is inlined into HTML, so it must not be able to close the tag.
      assert.ok(!/<\/script/i.test(json), `${page} ${lang}: JSON-LD can break out of <script>`);
    }
  }
});

test('course pages carry a Course node offered both onsite and online', () => {
  for (const page of Object.keys(COURSES)) {
    const graph = JSON.parse(schemaFor(page, 'de'))['@graph'];
    const course = graph.find((node) => node['@type'] === 'Course');
    assert.ok(course, `${page} has no Course node`);
    const modes = new Set(course.hasCourseInstance.map((i) => i.courseMode));
    assert.ok(modes.has('onsite'), `${page} missing onsite instance`);
    assert.ok(modes.has('online'), `${page} missing online instance`);
    for (const instance of course.hasCourseInstance) {
      assert.match(instance.courseWorkload, /^PT\d+H$/, `${page} bad workload`);
    }
  }
});

test('company courses quote no price, priced courses always do', () => {
  const company = JSON.parse(schemaFor('/company-courses.html', 'en'))['@graph'].find(
    (n) => n['@type'] === 'Course'
  );
  for (const instance of company.hasCourseInstance) {
    assert.equal(instance.offers, undefined, 'company course must not quote a price');
  }
  const german = JSON.parse(schemaFor('/german-courses.html', 'en'))['@graph'].find(
    (n) => n['@type'] === 'Course'
  );
  for (const instance of german.hasCourseInstance) {
    assert.equal(instance.offers.priceCurrency, 'CHF');
    assert.match(instance.offers.price, /^\d+$/);
  }
});

test('the sitemap lists every indexable page in both languages', () => {
  const sitemap = buildSitemap();
  const noindex = new Set(['/intake.html', '/feedback.html', '/thankyou.html']);
  for (const page of Object.keys(ROUTES)) {
    for (const lang of SUPPORTED) {
      const url = `https://learningwithgioia.ch${pagePath(page, lang)}`;
      if (noindex.has(page)) {
        assert.ok(!sitemap.includes(`<loc>${url}</loc>`), `noindex page in sitemap: ${url}`);
      } else {
        assert.ok(sitemap.includes(`<loc>${url}</loc>`), `sitemap missing <loc> for ${url}`);
      }
    }
  }
});

test('sitemap hreflang alternates are reciprocal — every alternate is also a loc', () => {
  const sitemap = buildSitemap();
  const locs = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
  const alternates = [...sitemap.matchAll(/hreflang="(?!x-default)[a-z-]+" href="([^"]+)"/g)].map(
    (m) => m[1]
  );
  assert.ok(alternates.length > 0);
  for (const href of alternates) {
    // The old hand-written sitemap declared /en/impressum as an alternate
    // without ever listing it as a <loc>. That state is now unreachable.
    assert.ok(locs.has(href), `alternate ${href} is never a <loc>`);
  }
});

test('sitemap x-default agrees with the renderer', () => {
  const sitemap = buildSitemap();
  for (const page of Object.keys(ROUTES)) {
    if (['/intake.html', '/feedback.html', '/thankyou.html'].includes(page)) continue;
    const expected = `https://learningwithgioia.ch${pagePath(page, defaultLangFor(page))}`;
    const block = sitemap
      .split('<url>')
      .find((b) => b.includes(`<loc>https://learningwithgioia.ch${pagePath(page, 'en')}</loc>`));
    assert.ok(block, `no sitemap entry for ${page}`);
    assert.ok(
      block.includes(`hreflang="x-default" href="${expected}"`),
      `${page}: x-default should be ${expected}`
    );
  }
});

test('robots.txt disallows the template directory and the API', () => {
  const robots = readFileSync('public/robots.txt', 'utf8');
  for (const rule of ['Disallow: /pages/', 'Disallow: /api/', 'Disallow: /admin/']) {
    assert.ok(robots.includes(rule), `robots.txt missing "${rule}"`);
  }
  for (const bot of ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'OAI-SearchBot']) {
    assert.ok(robots.includes(`User-agent: ${bot}`), `robots.txt does not name ${bot}`);
  }
  assert.ok(robots.includes('Sitemap: https://learningwithgioia.ch/sitemap.xml'));
});
