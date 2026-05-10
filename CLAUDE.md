# Development Guidelines

## Quick start

```bash
npm install                      # ESLint + Prettier (dev deps only)
cp .dev.vars.example .dev.vars   # fill in secrets
npm run dev                      # wrangler dev server on localhost:8788
```

## Code conventions

### Frontend (`public/admin/`)

- Always wrap user data with `esc()` from `helpers.js` when inserting into innerHTML
- Use `apiFetch()` from `api.js` for all API calls (handles Bearer token)
- Use `data-action` attributes + event delegation in `main.js` for click handlers
- Use `dl()` helper for key/value display rows (auto-escapes)

### Backend (`functions/api/`)

- Wrap handlers with `withErrorHandling()` from `_utils.js` for consistent logging
- Use `requireAdminAuth(request, env)` for admin endpoints — returns 401 Response or null
- Use `validateOrigin(request, env)` for public form endpoints (CSRF protection)
- Use `_validate.js` schemas for request body validation
- `SUPABASE_SERVICE_KEY` must only be used server-side, never returned to the browser
