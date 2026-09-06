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
  faqHtml,
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
  assert.equal(pageForAnySlug('group-courses'), '/group-courses.html');
  assert.equal(pageForAnySlug('gruppenkurse'), '/group-courses.html');
  assert.equal(pageForAnySlug('anfrage'), '/enquiry.html');

  // And the redirect target is the same page in the requested language.
  assert.equal(pagePath(pageForAnySlug('group-courses'), 'de'), '/de/gruppenkurse');
  assert.equal(pagePath(pageForAnySlug('gruppenkurse'), 'en'), '/en/group-courses');
});

// The course pages, /about and /faq were folded into the homepage. Their
// slugs, in both languages, must keep resolving — to the section, in the
// language the prefix asked for — and must not be live routes any more.
const RETIRED = {
  'language-courses': [
    'german-courses',
    'deutschkurse',
    'swiss-german',
    'schweizerdeutsch',
    'english-courses',
    'englischkurse',
    'exam-preparation',
    'pruefungsvorbereitung',
    'company-courses',
    'firmenkurse',
    'lunch-time-german',
    'kurs-nach-mass',
    'online-lessons',
    'online-unterricht',
    'private-lessons',
    'einzelunterricht',
    'english-exams',
  ],
  gymivorbereitung: ['gymivorbereitung'],
  about: ['about', 'ueber-uns'],
  faq: ['faq'],
};

function homepageIds() {
  const html = readFileSync('public/pages/index.html', 'utf8');
  return new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
}

test('retired slugs 301 to a homepage section in the requested language', () => {
  const ids = homepageIds();
  for (const [anchor, slugs] of Object.entries(RETIRED)) {
    assert.ok(ids.has(anchor), `homepage has no element with id="${anchor}"`);
    for (const slug of slugs) {
      assert.equal(pageForAnySlug(slug), null, `${slug} is still a live route`);
      const target = LEGACY_SLUG_REDIRECTS[slug];
      assert.ok(target, `${slug} has no legacy redirect`);
      for (const lang of SUPPORTED) {
        assert.equal(target(lang), `/${lang}/#${anchor}`);
      }
    }
  }
});

test('_redirects sends the retired .html URLs and prefixed slugs to the same anchors', () => {
  const redirects = readFileSync('public/_redirects', 'utf8');
  const retired = Object.values(RETIRED).flat();
  for (const line of redirects.split('\n')) {
    const [from, to] = line.trim().split(/\s+/);
    if (!from || from.startsWith('#')) continue;
    for (const slug of retired) {
      assert.ok(!to.includes(`/${slug}`), `${from} redirects to retired ${to}`);
    }
  }
  for (const [anchor, slugs] of Object.entries(RETIRED)) {
    for (const slug of slugs) {
      for (const lang of SUPPORTED) {
        assert.match(
          redirects,
          new RegExp(`^/${lang}/${slug}\\s+/${lang}/#${anchor}\\s+301`, 'm'),
          `_redirects lacks /${lang}/${slug} -> /${lang}/#${anchor}`
        );
      }
    }
  }
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
  assert.equal(templatePath('/group-courses.html'), '/pages/group-courses');
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
  assert.equal(localizeHref('/group-courses.html', 'de'), '/de/gruppenkurse');
  assert.equal(localizeHref('/group-courses.html', 'en'), '/en/group-courses');
  assert.equal(localizeHref('/index.html#offer-details', 'de'), '/de/#offer-details');
  assert.equal(localizeHref('/enquiry.html?ref=x', 'en'), '/en/enquiry?ref=x');
  assert.equal(localizeHref('/enquiry.html?ref=x', 'de'), '/de/anfrage?ref=x');
  // Already localised, and therefore unchanged.
  assert.equal(localizeHref('/de/gruppenkurse', 'de'), null);
  // Written with the English slug under the German prefix: still resolves, and
  // is corrected rather than left to 301 at request time.
  assert.equal(localizeHref('/de/group-courses', 'de'), '/de/gruppenkurse');
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
  const html = 'Try our <a href="/niveaus.html">self-assessment</a>.';
  assert.match(localizeHtmlLinks(html, 'de'), /href="\/de\/niveaus"/);
  assert.match(localizeHtmlLinks(html, 'en'), /href="\/en\/niveaus"/);
  const anchored = 'See <a href="/index.html#language-courses">the courses</a>.';
  assert.match(localizeHtmlLinks(anchored, 'de'), /href="\/de\/#language-courses"/);
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
    const markup = navMarkup('/niveaus.html', lang) + footerMarkup('/niveaus.html', lang);
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
    assert.match(markup, new RegExp(`<a class="language-option" href="/${other}/niveaus"`));
    // The current page is marked once.
    assert.equal((markup.match(/aria-current="page"/g) || []).length, 1);
    assert.ok(markup.includes(nav.impressum[lang]), 'footer missing legal links');

    // The homepage sections the nav points at exist, and the retired pages are
    // gone from it. The call sub-tab is a hash with no element: call-booking.js
    // opens the panel for it.
    const ids = homepageIds();
    for (const hash of [
      'language-courses',
      'tutoring',
      'gymivorbereitung',
      'about',
      'faq',
      'enquiry',
    ]) {
      assert.ok(hrefs.includes(`/${lang}/#${hash}`), `nav lacks /${lang}/#${hash}`);
      assert.ok(ids.has(hash), `homepage has no id="${hash}"`);
    }
    assert.ok(hrefs.includes(`/${lang}/#book-a-call`), 'nav lacks the book-a-call sub-tab');
    for (const slug of Object.values(RETIRED).flat()) {
      assert.ok(!hrefs.some((h) => h.endsWith(`/${slug}`)), `nav still links /${slug}`);
    }
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

function homeCourse(id, lang) {
  const graph = JSON.parse(schemaFor('/index.html', lang))['@graph'];
  return graph.find((n) => n['@type'] === 'Course' && n['@id'].endsWith(`#course-${id}`));
}

test('the homepage carries every Course node, offered both onsite and online', () => {
  const ids = homepageIds();
  for (const lang of SUPPORTED) {
    for (const [id, data] of Object.entries(COURSES)) {
      const course = homeCourse(id, lang);
      assert.ok(course, `${lang} homepage has no Course node for ${id}`);
      // The url is the section that describes it, and that section exists.
      assert.ok(course.url.endsWith(`#${data.anchor}`), `${id} url ${course.url}`);
      assert.ok(ids.has(data.anchor), `homepage has no id="${data.anchor}"`);
      const modes = new Set(course.hasCourseInstance.map((i) => i.courseMode));
      assert.ok(modes.has('online'), `${id} missing online instance`);
      assert.ok(modes.has('onsite'), `${id} missing onsite instance`);
      for (const instance of course.hasCourseInstance) {
        assert.match(instance.courseWorkload, /^PT\d+H$/, `${id} bad workload`);
      }
    }
  }
  // No other document describes a course, so none may claim one.
  for (const page of Object.keys(ROUTES)) {
    if (page === '/index.html') continue;
    const graph = JSON.parse(schemaFor(page, 'en'))['@graph'];
    assert.ok(!graph.some((n) => n['@type'] === 'Course'), `${page} carries a Course node`);
  }
});

test('company courses quote no price, priced courses always do', () => {
  const company = homeCourse('company-courses', 'en');
  for (const instance of company.hasCourseInstance) {
    assert.equal(instance.offers, undefined, 'company course must not quote a price');
  }
  const german = homeCourse('german-courses', 'en');
  for (const instance of german.hasCourseInstance) {
    assert.equal(instance.offers.priceCurrency, 'CHF');
    assert.match(instance.offers.price, /^\d+$/);
  }
  // The rates in the graph are the ones the page shows.
  assert.equal(german.offers.price, '50');
  assert.equal(homeCourse('gymivorbereitung', 'en').offers.price, '80');
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
    '/index.html': [
      '#about-personal-list',
      '#faq-courses-list',
      '#faq-swiss-list',
      '#faq-online-list',
      '#faq-gymi-list',
      '#faq-company-list',
    ],
  };

  // The markup carries the prose without its tags, so compare like with like:
  // an answer that links out is still the same answer.
  const asText = (html) =>
    String(html)
      .replace(/<[^>]*>/g, '')
      .replace(/&amp;/g, '&');

  for (const [page, selectors] of Object.entries(faqPages)) {
    for (const lang of SUPPORTED) {
      const rendered = asText(selectors.map((s) => pages[page].text[s][lang]).join(''));
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

  // No other page renders a Q&A block, so none may carry FAQPage markup. Same
  // rule from the other side: it catches markup left behind, or added later,
  // for answers a visitor cannot see.
  for (const page of Object.keys(ROUTES)) {
    if (faqPages[page]) continue;
    for (const lang of SUPPORTED) {
      const node = JSON.parse(schemaFor(page, lang))['@graph'].find(
        (n) => n['@type'] === 'FAQPage'
      );
      assert.ok(!node, `${page} ${lang} has FAQPage markup but renders no Q&A block`);
    }
  }
});

test('faqHtml renders one collapsible item per entry, question first', () => {
  for (const [group, items] of Object.entries(FAQ)) {
    for (const lang of SUPPORTED) {
      const html = faqHtml(items, lang);
      const count = (html.match(/<details class="faq-item">/g) || []).length;
      assert.equal(count, items.length, `${group} ${lang}: ${count} items for ${items.length}`);
      assert.match(html, /^<details class="faq-item"><summary><h3>/);
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

  // Every linked URL must be one the router actually serves; an anchor must
  // name a real element on the homepage.
  const urls = [...txt.matchAll(/\]\(https:\/\/learningwithgioia\.ch(\/[^)]*)\)/g)].map(
    (m) => m[1]
  );
  assert.ok(urls.length >= 15, `only ${urls.length} page links in llms.txt`);
  const served = new Set(
    Object.keys(ROUTES).flatMap((page) => SUPPORTED.map((lang) => pagePath(page, lang)))
  );
  const ids = homepageIds();
  for (const url of urls) {
    const [path, hash] = url.split('#');
    assert.ok(served.has(path), `llms.txt links ${url}, which is not a route`);
    if (hash !== undefined) {
      assert.equal(path, '/en/', `llms.txt anchors into ${path}, which is not the homepage`);
      assert.ok(ids.has(hash), `llms.txt links #${hash}, which is not on the homepage`);
    }
  }

  // The commercially important sections and pages must not be missing.
  for (const url of [
    '/en/#language-courses',
    '/en/#tutoring',
    '/en/#gymivorbereitung',
    '/en/#faq',
    '/en/#about',
    '/en/#enquiry',
    '/en/group-courses',
    '/en/enquiry',
    '/en/niveaus',
  ]) {
    assert.ok(urls.includes(url), `llms.txt omits ${url}`);
  }

  // The positioning fact the whole site rests on, and the prices in the
  // model the page shows.
  assert.match(txt, /native speaker of both Swiss German and German/);
  assert.match(txt, /CHF 50 per person per 60 minutes/);
  assert.match(txt, /CHF 80 per person per 60 minutes/);
  assert.match(txt, /FIDE/);
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
  const graph = JSON.parse(schemaFor('/index.html', 'en'))['@graph'];
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

// public/i18n.js is an IIFE with no exports, and group-courses.js and
// call-booking.js call localizeInternalLinks(document) on every homepage and
// group-courses load. The switcher is the one link on the page that points at
// the *other* language, so a document-wide rewrite to the current language
// silently turns EN/DE into a self-link and the toggle stops working. Run the
// real function over the real nav markup rather than trusting a comment.
function loadI18nWithLinks(pathname, anchors) {
  const source = readFileSync('public/i18n.js', 'utf8');
  const documentStub = {
    readyState: 'complete',
    documentElement: { lang: pathname.split('/')[1] || 'en' },
    addEventListener() {},
    dispatchEvent() {},
    // Only ever called with 'a[href]' by the code under test.
    querySelectorAll: () => anchors,
  };
  const windowStub = {
    location: { pathname, origin: 'https://learningwithgioia.ch' },
  };
  new Function('window', 'document', 'CustomEvent', source)(
    windowStub,
    documentStub,
    class CustomEvent {}
  );
  return windowStub.LWG_I18N;
}

function parseAnchors(html) {
  return [...html.matchAll(/<a\s([^>]*)>/g)].map((tag) => {
    const attrs = {};
    for (const [, name, value] of tag[1].matchAll(/([\w-]+)="([^"]*)"/g)) attrs[name] = value;
    return {
      attrs,
      getAttribute(name) {
        return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null;
      },
      hasAttribute(name) {
        return Object.prototype.hasOwnProperty.call(this.attrs, name);
      },
      get href() {
        return this.attrs.href;
      },
      set href(value) {
        this.attrs.href = value;
      },
    };
  });
}

test('localizeInternalLinks leaves the EN/DE switcher pointing at the other language', () => {
  for (const page of ['/index.html', '/group-courses.html']) {
    for (const lang of SUPPORTED) {
      const other = lang === 'en' ? 'de' : 'en';
      const anchors = parseAnchors(navMarkup(page, lang) + footerMarkup(page, lang));
      const switcher = anchors.find((a) => a.getAttribute('data-lang') === other);
      assert.ok(switcher, `no ${other} switcher link in the ${lang} nav for ${page}`);

      loadI18nWithLinks(pagePath(page, lang), anchors).localizeInternalLinks();

      assert.equal(
        switcher.href,
        pagePath(page, other),
        `the ${other} switcher on ${pagePath(page, lang)} was rewritten to ${switcher.href}`
      );
    }
  }
});

test('translation never rewrites an element id, so the reader keeps their place across a switch', () => {
  // nav.js holds the reader's position across a language switch as "this far
  // into this section", keyed by the section's id. That only works because the
  // ids come from the template and are identical in both languages — the copy
  // dictionary replaces text, not structure. An `attr: 'id'` entry, or a
  // selector translating an id into German, would silently drop the switch
  // back to a top-of-page landing on exactly the page it matters most.
  const structural = new Set(['id', 'href', 'name', 'class']);
  for (const [page, entry] of Object.entries(pages)) {
    for (const [selector, copy] of Object.entries(entry.text || {})) {
      if (!copy.attr) continue;
      assert.ok(
        !structural.has(copy.attr),
        `${page} ${selector} translates the ${copy.attr} attribute, which is structural`
      );
    }
  }
});

test('the homepage sections the switcher restores against are uniquely identified', () => {
  // A duplicate id makes getElementById pick the first match, so a reader
  // switching language halfway down would be restored against the wrong one.
  const html = readFileSync('public/pages/index.html', 'utf8');
  const ids = [...html.matchAll(/<section[^>]*\sid="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(ids.length >= 5, 'the homepage should still be a multi-section scroll page');
  assert.equal(new Set(ids).size, ids.length, 'duplicate section ids on the homepage');
  for (const id of [
    'language-courses',
    'tutoring',
    'gymivorbereitung',
    'levels',
    'materials',
    'reviews',
    'about',
    'enquiry',
  ]) {
    assert.ok(ids.includes(id), `homepage lost its #${id} section`);
  }
  // #faq is the questions block inside the About section rather than a section
  // of its own, so the switcher restores against #about — but the anchor still
  // has to exist, because /faq, /ueber-uns and /info all 301 to it.
  assert.ok(homepageIds().has('faq'), 'homepage lost its #faq anchor');

  // Every id on the page is unique, not just the sections': the copy
  // dictionary and the fact tiles are addressed by id.
  const all = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(all).size, all.length, 'duplicate ids on the homepage');
});
