# Development Guidelines

## Quick start

```bash
npm install                # ESLint + Prettier (dev deps only)
cp .dev.vars.example .dev.vars  # fill in secrets
npm run dev                # wrangler dev server on localhost:8788
```

## Project layout

- Static HTML pages at repo root (no build step, no framework)
- `admin/` — single-page admin dashboard (vanilla JS modules)
- `functions/api/` — Cloudflare Pages Functions (serverless API)
- `shared.css` — global styles; page-specific CSS files alongside HTML

## Code conventions

### Frontend (admin/)

- Always wrap user data with `esc()` from `helpers.js` when inserting into innerHTML
- Use `apiFetch()` from `api.js` for all API calls (handles Bearer token)
- Use `data-action` attributes + event delegation in `main.js` for click handlers
- Use `dl()` helper for key/value display rows (auto-escapes)

### Backend (functions/api/)

- Wrap handlers with `withErrorHandling()` from `_utils.js` for consistent logging
- Use `requireAdminAuth(request, env)` for admin endpoints — returns 401 Response or null
- Use `validateOrigin(request, env)` for public form endpoints (CSRF protection)
- Use `_validate.js` schemas for request body validation
- Supabase service key (`SUPABASE_SERVICE_KEY`) must only be used server-side

## Environment variables

See `.dev.vars.example` for the full list. Key variables:

- `SITE_URL` — base URL for OAuth redirects (falls back to request origin)
- `ALLOWED_ORIGINS` — comma-separated CORS whitelist
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`

## Linting & formatting

```bash
npm run lint           # ESLint check
npm run format:check   # Prettier check
npm run format         # Prettier auto-fix
```

CI runs both on push/PR to main.
