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
  pageForAnySlug,
  pagePath,
  templatePath,
  defaultLangFor,
  localizeHref,
  localizeHtmlLinks,
  hasRoute,
  FAQ,
} from '../functions/_i18n-content.js';
import { schemaFor, COURSES, BUSINESS, CREDENTIALS } from '../functions/_schema.js';
import { navMarkup, footerMarkup } from '../functions/_nav-markup.js';
import { buildSitemap } from '../functions/_sitemap.js';
import { buildLlmsTxt } from '../functions/_llms.js';

test('pageForSlug resolves every route, and the bare language prefix', () => {
  for (const [page, slugs] of Object.entries(ROUTES)) {
    for (const lang of SUPPORTED) {
      assert.equal(pageForSlug(slugs[lang], lang), page, `${lang} slug ${slugs[lang]}`);
    }
  }
  // /en and /en/ both arrive with no segments.
  for (const lang of SUPPORTED) {
    assert.equal(pageForSlug('', lang), '/index.html');
    assert.equal(pageForSlug('/', lang), '/index.html');
  }
});

test('pageForSlug returns null for unknown slugs so the Function can 404', () => {
  for (const slug of ['nonexistent', 'german-course', 'admin', 'api/config', 'pages/index']) {
    for (const lang of SUPPORTED) {
      assert.equal(pageForSlug(slug, lang), null, `${lang} ${slug}`);
    }
  }
  assert.equal(pageForAnySlug('nonexistent'), null);
});

test('pagePath round-trips through pageForSlug for both languages', () => {
  for (const page of Object.keys(ROUTES)) {
    for (const lang of SUPPORTED) {
      const path = pagePath(page, lang);
      assert.ok(path.startsWith(`/${lang}/`), `${page} ${lang} -> ${path}`);
      const slug = path.slice(lang.length + 2);
      assert.equal(pageForSlug(slug, lang), page, path);
    }
  }
});

test('every slug is unique within its language, so no page shadows another', () => {
  for (const lang of SUPPORTED) {
    const seen = new Map();
    for (const [page, slugs] of Object.entries(ROUTES)) {
      const slug = slugs[lang];
      assert.ok(
        !seen.has(slug),
        `${lang} slug "${slug}" used by both ${seen.get(slug)} and ${page}`
      );
      seen.set(slug, page);
    }
  }
});

test('a slug from the other language resolves, so _render.js can 301 rather than 404', () => {
  // The case that matters: German URLs that existed before the slugs were
  // localized must keep working.
  assert.equal(pageForAnySlug('german-courses'), '/german-courses.html');
  assert.equal(pageForAnySlug('deutschkurse'), '/german-courses.html');
  assert.equal(pageForAnySlug('firmenkurse'), '/company-courses.html');

  // And the redirect target is the same page in the requested language.
  assert.equal(pagePath(pageForAnySlug('german-courses'), 'de'), '/de/deutschkurse');
  assert.equal(pagePath(pageForAnySlug('deutschkurse'), 'en'), '/en/german-courses');
});

test('German slugs never contain characters that need URL-encoding', () => {
  for (const [page, slugs] of Object.entries(ROUTES)) {
    for (const lang of SUPPORTED) {
      const slug = slugs[lang];
      assert.match(slug, /^[a-z0-9-]*$/, `${page} ${lang} slug "${slug}" is not URL-safe`);
      assert.equal(encodeURIComponent(slug), slug, `${page} ${lang} slug needs encoding`);
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
    assert.equal(
      pageForAnySlug(slug),
      null,
      `${slug} is both a live route and a legacy redirect, so the redirect would shadow the page`
    );
    for (const lang of SUPPORTED) {
      assert.ok(target(lang).startsWith(`/${lang}/`), `${slug} -> ${target(lang)}`);
    }
  }
});

test('localizeHref rewrites internal links and leaves everything else alone', () => {
  assert.equal(localizeHref('/german-courses.html', 'de'), '/de/deutschkurse');
  assert.equal(localizeHref('/german-courses.html', 'en'), '/en/german-courses');
  assert.equal(localizeHref('/index.html#offer-details', 'de'), '/de/#offer-details');
  assert.equal(localizeHref('/enquiry.html?ref=x', 'en'), '/en/enquiry?ref=x');
  assert.equal(localizeHref('/enquiry.html?ref=x', 'de'), '/de/anfrage?ref=x');
  // Already localised, and therefore unchanged.
  assert.equal(localizeHref('/de/deutschkurse', 'de'), null);
  // Written with the English slug under the German prefix: still resolves, and
  // is corrected rather than left to 301 at request time.
  assert.equal(localizeHref('/de/german-courses', 'de'), '/de/deutschkurse');
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
  assert.match(localizeHtmlLinks(html, 'de'), /href="\/de\/kurs-nach-mass"/);
  assert.match(localizeHtmlLinks(html, 'en'), /href="\/en\/lunch-time-german"/);
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
    // Every course is bookable online. Only the online-lessons page is online
    // *only* — it must not claim a Zürich classroom slot it does not offer.
    assert.ok(modes.has('online'), `${page} missing online instance`);
    if (page === '/online-lessons.html') {
      assert.ok(!modes.has('onsite'), 'the online-lessons page must not claim an onsite instance');
    } else {
      assert.ok(modes.has('onsite'), `${page} missing onsite instance`);
    }
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

// public/i18n.js is an IIFE, not a module, so its ROUTES mirror cannot be
// imported. Parse the literal out of the source instead: a stale mirror sends
// JS-inserted links to the wrong language slug, which is silent in every other
// test because the server never reads it.
test('the ROUTES mirror in public/i18n.js matches the server map exactly', () => {
  const source = readFileSync('public/i18n.js', 'utf8');
  const match = source.match(/const ROUTES = (\{[\s\S]*?\n {2}\});/);
  assert.ok(match, 'could not find the ROUTES literal in public/i18n.js');

  const mirror = new Function(`return ${match[1]}`)();
  assert.deepEqual(
    mirror,
    ROUTES,
    'public/i18n.js ROUTES has drifted from functions/_i18n-content.js'
  );
});

test('FAQ markup only claims answers that are rendered on the page', () => {
  // Marking up an answer that is not visible is a Google violation and gives
  // assistants text a visitor cannot find. Both come from FAQ in
  // _i18n-content.js, so this checks the wiring rather than the wording.
  const faqPages = {
    '/faq.html': [
      '#faq-courses-list',
      '#faq-online-list',
      '#faq-gymi-list',
      '#faq-company-list',
      '#faq-booking-list',
    ],
    '/online-lessons.html': ['#online-faq-list'],
    '/private-lessons.html': ['#private-faq-list'],
  };

  for (const [page, selectors] of Object.entries(faqPages)) {
    for (const lang of SUPPORTED) {
      const rendered = selectors.map((s) => pages[page].text[s][lang]).join('');
      const node = JSON.parse(schemaFor(page, lang))['@graph'].find(
        (n) => n['@type'] === 'FAQPage'
      );
      assert.ok(node, `${page} has no FAQPage node`);
      assert.ok(node.mainEntity.length > 0, `${page} FAQPage is empty`);
      for (const q of node.mainEntity) {
        assert.ok(
          rendered.includes(q.name),
          `${page} ${lang}: "${q.name}" is marked up but not rendered`
        );
        assert.ok(
          rendered.includes(q.acceptedAnswer.text),
          `${page} ${lang}: answer to "${q.name}" is marked up but not rendered`
        );
      }
    }
  }
});

test('every FAQ entry has a question and an answer in both languages', () => {
  for (const [group, items] of Object.entries(FAQ)) {
    assert.ok(items.length, `FAQ group ${group} is empty`);
    for (const item of items) {
      for (const lang of SUPPORTED) {
        assert.ok(item.q?.[lang]?.length > 5, `${group}: missing ${lang} question`);
        assert.ok(item.a?.[lang]?.length > 20, `${group}: thin ${lang} answer for "${item.q?.en}"`);
      }
    }
  }
});

test('llms.txt lists real URLs and states the facts an assistant is asked for', () => {
  const txt = buildLlmsTxt('en');

  // Every linked URL must be one the router actually serves.
  const urls = [...txt.matchAll(/\]\(https:\/\/learningwithgioia\.ch(\/[^)]*)\)/g)].map(
    (m) => m[1]
  );
  assert.ok(urls.length > 15, `only ${urls.length} page links in llms.txt`);
  const served = new Set(
    Object.keys(ROUTES).flatMap((page) => SUPPORTED.map((lang) => pagePath(page, lang)))
  );
  for (const url of urls) {
    assert.ok(served.has(url), `llms.txt links ${url}, which is not a route`);
  }

  // The commercially important pages must not be missing from it.
  for (const page of [
    '/company-courses.html',
    '/swiss-german.html',
    '/gymivorbereitung.html',
    '/online-lessons.html',
    '/private-lessons.html',
    '/faq.html',
    '/about.html',
  ]) {
    assert.ok(urls.includes(pagePath(page, 'en')), `llms.txt omits ${page}`);
  }

  // The positioning fact the whole site rests on.
  assert.match(txt, /native speaker of both Swiss German and German/);
  assert.match(txt, /info@learningwithgioia\.ch/);
  assert.ok(!txt.includes('undefined'), 'llms.txt contains an undefined value');
});

test('llms.txt omits the telephone line until a number is published', () => {
  // Guards the pattern rather than the value: an unset fact must be absent,
  // never rendered as an empty or undefined line.
  const txt = buildLlmsTxt('en');
  if (BUSINESS.telephone) {
    assert.ok(txt.includes(`- Telephone: ${BUSINESS.telephone}`));
  } else {
    assert.ok(!/- Telephone:/.test(txt), 'telephone line rendered with no number set');
  }
});

test('unset schema facts are omitted from the graph, never emitted empty', () => {
  const graph = JSON.parse(schemaFor('/about.html', 'en'))['@graph'];
  const business = graph.find((n) => String(n['@type']).includes('LocalBusiness'));
  const person = graph.find((n) => n['@type'] === 'Person');

  // sameAs was dropped by choice: no social profiles are published.
  assert.ok(!('sameAs' in business), 'sameAs should be omitted, not empty');
  assert.ok(!('sameAs' in person), 'sameAs should be omitted, not empty');

  for (const [node, key, fact] of [
    [business, 'telephone', BUSINESS.telephone],
    [person, 'alumniOf', CREDENTIALS.alumniOf],
  ]) {
    if (fact) assert.ok(key in node, `${key} is set but missing from the graph`);
    else assert.ok(!(key in node), `${key} is unset but present in the graph`);
  }
});

test('every page template has exactly one h1', () => {
  // The flow pages carry several mutually-exclusive state panels; only the
  // first is the page heading, the rest are h2.state-title.
  for (const file of readdirSync('public/pages')) {
    const html = readFileSync(`public/pages/${file}`, 'utf8');
    const count = (html.match(/<h1[\s>]/g) || []).length;
    assert.equal(count, 1, `public/pages/${file} has ${count} <h1> elements`);
  }
});

test('descriptions are long enough to be used as a snippet, and not truncated', () => {
  const noindex = new Set(['/intake.html', '/feedback.html', '/thankyou.html']);
  for (const page of Object.keys(ROUTES)) {
    if (noindex.has(page)) continue;
    for (const lang of SUPPORTED) {
      const d = pages[page].description[lang];
      assert.ok(d.length >= 70, `${page} ${lang} description is only ${d.length} chars: ${d}`);
      assert.ok(d.length <= 200, `${page} ${lang} description is ${d.length} chars, will be cut`);
    }
  }
});

test('_redirects sends retired pages straight to their final URL', () => {
  // A rule whose target is itself redirected costs the visitor a round trip
  // and dilutes the signal for a crawler.
  const lines = readFileSync('public/_redirects', 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

  const sources = new Set(lines.map((l) => l.split(/\s+/)[0]));
  for (const line of lines) {
    const [from, to] = line.split(/\s+/);
    const target = to.split('#')[0];
    assert.ok(!sources.has(target), `${from} redirects to ${target}, which is itself redirected`);
  }
});
