# Learning with Gioia

Language courses, exam preparation and tutoring in Zurich.

## Architecture

- **Frontend:** Static HTML, CSS, vanilla JavaScript (no framework, no build step)
- **Backend:** Cloudflare Pages Functions (serverless API, 36 endpoints in `functions/api/`)
- **Database:** Supabase (PostgreSQL + authentication)
- **Email:** Resend (transactional email)
- **Calendar:** Google Calendar integration via OAuth
- **Invoicing:** Swiss QR bill PDF generation (pure JS, no dependencies)

## Project structure

```
.
├── *.html              # Static pages (index, info, enquiry, etc.)
├── *.css               # Page-specific stylesheets
├── shared.css          # Global styles, navigation, animations
├── nav.js              # Injected navigation component
├── device-detect.js    # Responsive device detection (mobile/tablet/desktop)
├── admin/              # Admin dashboard modules (13 JS files + CSS)
│   ├── main.js         # Entry point, event delegation, tab switching
│   ├── auth.js         # Supabase authentication
│   ├── api.js          # API fetch wrapper
│   └── ...             # Feature modules (courses, students, billing, etc.)
└── functions/api/      # Cloudflare Pages Functions (serverless API)
    ├── _utils.js       # Shared utilities (auth, rate limiting, CORS)
    ├── _validate.js    # Input validation schemas
    ├── _logger.js      # Structured logging
    ├── _pdf-builder.js # Minimal PDF generator
    ├── _qr-utils.js    # Swiss QR bill utilities
    ├── _calendar.js    # Google Calendar helpers
    └── *.js            # API endpoints
```

## Local development

1. Copy `.dev.vars.example` to `.dev.vars` and fill in credentials
2. Install dev dependencies: `npm install`
3. Start the dev server: `npm run dev`

This runs `wrangler pages dev .` which serves static files and executes the API functions locally.

## Environment variables

See `.dev.vars.example` for the full list. Key variables:

| Variable               | Purpose                                   |
| ---------------------- | ----------------------------------------- |
| `SUPABASE_URL`         | Supabase project URL                      |
| `SUPABASE_ANON_KEY`    | Supabase anonymous key (frontend)         |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (API functions) |
| `RESEND_API_KEY`       | Resend email service key                  |
| `GOOGLE_CLIENT_ID`     | Google OAuth client ID (calendar)         |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret                |
| `QR_IBAN`              | Swiss QR-IBAN for invoice payment slips   |

## Deployment

The site is deployed on Cloudflare Pages. Pushes to `main` trigger automatic deployment. No build step is needed — files are served directly.

## Code quality

- **Lint:** `npm run lint`
- **Format:** `npm run format:check` (check) / `npm run format` (fix)
- **CI:** GitHub Actions runs lint + format check on push/PR to main
