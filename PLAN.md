# Code Cleanup Plan

## Overview
This is a Cloudflare Pages site with vanilla HTML/JS frontend and 15 serverless API functions. The main cleanup targets are duplication, inconsistencies, and a couple of bugs in the `functions/api/` directory.

---

## 1. Create a shared utility module (`functions/api/_utils.js`)

Extract repeated code into a single shared file imported by all API functions:

- **`getValidAccessToken(env, teacherId)`** — Duplicated identically across 4 files:
  - `confirm-booking.js`, `sync-calendar.js`, `cancel-session.js`, `delete-course.js`

- **`supabaseHeaders(key)`** — Header helper duplicated across 7+ files with inconsistent naming (`H`, `HEADERS`, inline). Standardize to one exported function.

- **`requireAdminAuth(request, env)`** — Password check pattern repeated in 12+ endpoints. Extract to one function that returns a `Response` on failure or `null` on success.

- **`jsonResponse(data, status)`** / **`errorResponse(message, status)`** — Standardize the error/success response construction repeated across all files.

---

## 2. Update all API files to use the shared utilities

Replace the duplicated code in each file with imports from `_utils.js`:

- `confirm-booking.js` — use shared `getValidAccessToken`, `supabaseHeaders`, `requireAdminAuth`
- `sync-calendar.js` — use shared `getValidAccessToken`, `supabaseHeaders`, `requireAdminAuth`
- `cancel-session.js` — use shared `getValidAccessToken`, `supabaseHeaders`, `requireAdminAuth`
- `delete-course.js` — use shared `getValidAccessToken`, `supabaseHeaders`, `requireAdminAuth`
- `get-courses.js` — use shared `supabaseHeaders`, `requireAdminAuth`
- `get-enquiries.js` — use shared `supabaseHeaders`, `requireAdminAuth`
- `get-teachers.js` — use shared `supabaseHeaders`, `requireAdminAuth`
- `log-session.js` — use shared `supabaseHeaders`, `requireAdminAuth`
- `update-student.js` — use shared `supabaseHeaders`, `requireAdminAuth`
- `update-enquiry.js` — use shared `supabaseHeaders`, `requireAdminAuth`
- `delete-enquiry.js` — use shared `supabaseHeaders`, `requireAdminAuth`
- `student-sessions.js` — use shared `supabaseHeaders`
- `submit-enquiry.js` — use shared `supabaseHeaders`

---

## 3. Fix bugs

- **`submit-enquiry.js`**: `enquiry_id` referenced but not defined in that scope — fix the variable reference.
- **`confirm-booking.js`**: Same `enquiry_id` scope bug.

---

## 4. Standardize environment variable extraction

All files should use the same destructuring pattern:
```js
const { SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_PASSWORD, ... } = env;
```

---

## What is NOT in scope
- HTML/CSS cleanup (large files, low risk/reward)
- Adding tests (no existing test infrastructure)
- Adding rate limiting or request logging
- TypeScript migration
