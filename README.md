# Learning with Gioia

Language courses, exam preparation, and tutoring in Zurich.

## Architecture

- **Frontend:** Static HTML/CSS/vanilla JS in `public/` — no framework, no build step
- **Rendering:** page templates in `public/pages/` are rendered per language at the
  edge by `functions/{en,de}/[[path]].js` — see [Language rendering](#language-rendering)
- **Backend:** Cloudflare Pages Functions (serverless, `functions/api/`)
- **Database:** Supabase (PostgreSQL)
- **Email:** Resend (transactional)
- **Calendar:** Google Calendar via OAuth 2.0

## Project structure

```
.
├── public/                  # Static files served by Cloudflare Pages
│   ├── pages/               # Page templates — rendered per language, never linked directly
│   ├── shared.css           # Global styles, navigation, animations
│   ├── nav.js               # Nav behaviour (the markup is server-rendered)
│   ├── i18n.js              # Runtime strings for JS-rendered UI only
│   ├── device-detect.js     # Sets responsive device class on <body>
│   └── admin/               # Admin dashboard (single-page app)
│       ├── index.html       # SPA shell
│       ├── main.js          # Event delegation hub
│       ├── core/            # api.js, auth.js, constants.js, helpers.js
│       ├── features/        # One module per domain (courses, students, teachers, invoices, …)
│       ├── pages/           # Full-page views: course-edit, course-new, student-form
│       └── panels/          # Tab panel HTML: courses, students, teachers, invoices, companies
├── functions/
│   ├── en/[[path]].js       # Renders /en/* — thin wrapper over _render.js
│   ├── de/[[path]].js       # Renders /de/*
│   ├── sitemap.xml.js       # Generated sitemap (no hand-maintained file)
│   ├── _render.js           # HTMLRewriter pipeline: head, copy, nav, footer, JSON-LD
│   ├── _i18n-content.js     # All page copy + routing tables — single source of truth
│   ├── _nav-markup.js       # Server-rendered nav, footer, language switcher
│   ├── _schema.js           # JSON-LD graph (LocalBusiness, Person, Course, …)
│   └── _sitemap.js
├── functions/api/           # Cloudflare Pages Functions
│   ├── _utils.js            # Auth, CORS, rate limiting, error handling
│   ├── _validate.js         # Request body validation schemas
│   ├── _calendar.js         # Google Calendar helpers
│   ├── _agb.js              # AGB/terms generation
│   ├── _public-course-booking.js
│   ├── _student-utils.js
│   └── *.js                 # 49 endpoint handlers (see API below)
└── supabase/migrations/     # SQL migration files — applied manually via Supabase dashboard
```

## Pages

| Page                 | File                         | Notes                                                            |
| -------------------- | ---------------------------- | ---------------------------------------------------------------- |
| Home                 | `index.html`                 | Includes courses and pricing (`#offer-details`)                  |
| Group courses        | `group-courses.html`         | Public listing + booking form                                    |
| Enquiry              | `enquiry.html`               | Contact form                                                     |
| Thank you            | `thankyou.html`              | Post-submission landing page                                     |
| Modal particles      | `modalpartikeln.html`        | Interactive German grammar tool                                  |
| Subjunctions         | `subjunktionen.html`         | Interactive German grammar tool                                  |
| Conjunctions         | `konjunktionen.html`         | Interactive German grammar tool                                  |
| Language levels      | `niveaus.html`               | CEFR levels (A1–C2) overview                                     |
| AGB                  | `agb.html`                   | Terms and conditions (DE default)                                |
| Impressum            | `impressum.html`             | Legal notice (DE default)                                        |
| Datenschutzerklärung | `datenschutzerklaerung.html` | Privacy policy (DE default)                                      |
| Intake               | `intake.html`                | Student intake form — linked from admin email, not in public nav |

## Admin dashboard

Single-page app at `/admin/`. Login via Supabase Auth (email/password — users are managed in the Supabase dashboard, not in env vars).

Covers: students, courses, enrolments, sessions, attendance, invoices, companies, teacher availability, 15-minute call windows and bookings, certificates, and course confirmations.

## API endpoints

All endpoints live at `/api/*`. Shared helpers are prefixed with `_` and not routable.

| Domain        | Endpoints                                                                                                                                      |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth          | `auth-login`, `auth-callback`                                                                                                                  |
| Courses       | `get-courses`, `update-course`, `delete-course`, `public-courses`                                                                              |
| Enrolments    | `add-enrolment`, `update-enrolment`, `remove-enrolment`, `cancel-course`                                                                       |
| Students      | `get-students`, `get-student-detail`, `save-student`, `update-student`, `delete-student`, `import-students`                                    |
| Sessions      | `log-session`, `cancel-session`, `get-attendance`, `save-attendance`, `send-session-schedule`                                                  |
| Bookings      | `book-course`, `confirm-booking`, `handle-course-booking`, `group-course-slots`, `group-course-access-code`                                    |
| Companies     | `get-companies`, `save-company`, `send-company-booking-code`, `company-intake`, `send-company-intake-link`                                     |
| Teachers      | `get-teachers`, `get-teacher-availability`                                                                                                     |
| Calls         | `call-slots`, `book-call`, `call-availability`, `call-bookings`                                                                                |
| Invoices      | `get-next-invoice-number`, `mark-invoice-paid`, `send-invoice`, `send-invoice-reminder`, `cancel-invoice`, `delete-invoice`, `invoice-archive` |
| Intake        | `intake`, `mark-intake-seen`, `send-intake-link`                                                                                               |
| Enquiry       | `submit-enquiry`, `get-enquiry`, `mark-enquiry-treated`                                                                                        |
| Calendar      | `sync-calendar`                                                                                                                                |
| Certificates  | `send-certificates`                                                                                                                            |
| Confirmations | `send-course-confirmation`                                                                                                                     |
| Config        | `config`                                                                                                                                       |

## Local development

```bash
npm install                      # install dev deps (ESLint, Prettier, Wrangler)
cp .dev.vars.example .dev.vars   # fill in secrets
npm run dev                      # serve on http://localhost:8788
```

Wrangler serves `public/` as static files and executes `functions/` locally.

## Language rendering

Every public page is served twice, at `/en/<slug>` and `/de/<slug>`, from a single
template in `public/pages/`. `functions/{en,de}/[[path]].js` resolves the slug,
fetches the template through `env.ASSETS`, and pipes it through `_render.js`,
which applies the language: `<html lang>`, title, meta description, canonical,
hreflang, body copy, navigation, footer, internal links and JSON-LD. The result is
complete HTML for clients that do not run JavaScript — which includes every AI
crawler. `public/i18n.js` is left with only the strings for content that appears
after a fetch (course cards, call slots, form states).

To change copy, edit `functions/_i18n-content.js`. To change page structure, edit
the template in `public/pages/`. Selectors in the copy dictionary must stay within
the subset HTMLRewriter supports — tag, `#id`, `.class`, `[attr=…]` and descendant
combinators. A pseudo-class such as `:nth-of-type` is accepted silently and then
never matches, so `tests/i18n-routing.test.mjs` fails the build on one.

Two constraints worth knowing before changing the routing:

- **`_redirects` does not apply to paths served by a Function.** A root
  `functions/_middleware.js` would match `/*` and silently disable the whole file,
  including the `.html` → clean-URL 301s. That is why the Functions are scoped to
  the two language prefixes.
- **`env.ASSETS.fetch()` goes through the same asset router, so it sees
  `_redirects` too.** Templates live in `public/pages/` precisely so their paths
  carry no redirect rule. `/pages/*` is `Disallow`ed in `robots.txt` and carries
  `X-Robots-Tag: noindex` from `_headers`, which `_render.js` strips from the page
  it returns.

## Environment variables

Defined in `.dev.vars` (local) and the Cloudflare Pages dashboard (production). See `.dev.vars.example` for the full list.

| Variable               | Purpose                                                          |
| ---------------------- | ---------------------------------------------------------------- |
| `SUPABASE_URL`         | Supabase project URL                                             |
| `SUPABASE_ANON_KEY`    | Public key (safe for browser)                                    |
| `SUPABASE_SERVICE_KEY` | Service role key — server-side only, never sent to the browser   |
| `RESEND_API_KEY`       | Resend email service                                             |
| `GOOGLE_CLIENT_ID`     | Google OAuth client ID                                           |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret                                       |
| `GOOGLE_REDIRECT_URI`  | Exact Google OAuth callback URI, if different from `SITE_URL`    |
| `SITE_URL`             | Canonical URL for OAuth redirects (falls back to request origin) |
| `ALLOWED_ORIGINS`      | Comma-separated CORS allowlist                                   |

## Deployment

Cloudflare Pages. Pushes to `main` deploy automatically — no build step needed. Cloudflare serves `public/` directly and runs `functions/` as Pages Functions.

## Code quality

```bash
npm run lint             # ESLint
npm run format:check     # Prettier (check)
npm run format           # Prettier (fix)
node --test tests/*.test.mjs   # unit tests (no dependencies — Node ≥22 built-in runner)
```

GitHub Actions runs lint + format check on every push and PR to `main`.

Unit tests in `tests/` cover the pure logic in `functions/api/_*.js` (booking
eligibility, schedule planning around blocked dates, validation schemas, OAuth
state signing).
