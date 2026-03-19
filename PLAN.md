# Code Cleanup Plan

## Overview
This is a Cloudflare Pages site with vanilla HTML/JS frontend and 15 serverless API functions. The main cleanup targets are duplication, inconsistencies, and a couple of bugs in the `functions/api/` directory.

---

## ✅ COMPLETED: Frontend CSS/Nav/JS Deduplication

### Problem
All 8 HTML pages duplicated ~120 lines of nav CSS, ~15 lines of nav HTML (including a ~3KB base64 PNG), ~70 lines of nav JavaScript, and ~25 lines of device detection script. Total: ~1,870 duplicated lines across the site.

### Solution — 4 new shared files

1. **`shared.css`** (151 lines) — Base reset, nav styles, overlay, ripple animation, `fadeUp`/`fadeIn` keyframes, and all device-aware nav overrides (mobile/tablet/desktop).

2. **`device-detect.js`** (33 lines) — Synchronous device detection script (phone/tablet/desktop). Runs in `<head>` before first paint. Sets `data-device` and `data-touch` attributes on `<html>`.

3. **`nav.js`** (87 lines) — Injects nav HTML (overlay, cloud icon, menu links) into `<body>` and handles all nav behavior: scroll-hide, cloud click toggle, ripple animation, document click-to-close, touch handler. Exposes `window.__navToggle()` for pages that need programmatic nav control (e.g. logo click on index page).

4. **`cloud.png`** (21KB) — The cloud menu icon, extracted from the ~3KB base64 string that was duplicated in every HTML file.

### Bugs fixed
- Duplicate `<div class="nav-overlay" id="nav-overlay"></div>` in 6 of 8 pages (two overlay divs with the same ID).

### Results

| File               | Before | After | Saved |
|--------------------|--------|-------|-------|
| index.html         |    441 |   143 |   298 |
| info.html          |    378 |   188 |   190 |
| booking.html       |  1,059 |   783 |   276 |
| contact.html       |    465 |   185 |   280 |
| contact-details.html |  879 |   669 |   210 |
| sessions.html      |    549 |   273 |   276 |
| thankyou.html      |    293 |   123 |   170 |
| admin.html         |  1,476 | 1,305 |   171 |
| **TOTAL**          |**5,540**|**3,669**|**1,871**|

Each page now includes 3 lines instead of ~230 lines of duplicated code:
```html
<link rel="stylesheet" href="shared.css">
<script src="device-detect.js"></script>  <!-- in <head> -->
<script src="nav.js"></script>            <!-- in <body> -->
```

---

## ✅ COMPLETED: Backend API shared utilities (`functions/api/_utils.js`)

Extracted repeated code into a single shared file imported by all API functions:
- `supabaseHeaders(key)` — Header helper
- `requireAdminAuth(request, env)` — Password check
- `getValidAccessToken(teacher, env)` — Google OAuth token refresh

All API files already import from `_utils.js`.

---

## Remaining opportunities (not in scope for this cleanup)

- **Standardize response helpers** — Add `jsonResponse(data, status)` / `errorResponse(message, status)` to `_utils.js` to replace the repeated `new Response(JSON.stringify(...))` pattern across all API files.
- **Add TypeScript** — Would catch bugs at build time.
- **Add tests** — No existing test infrastructure.
- **Rate limiting / request logging** — Not currently implemented.
