# Admin Monolith Refactor — Plan

## Problem

The admin dashboard lives in two monolithic files:
- `admin.html` — **683 lines** (HTML structure + all CSS inlined in `<style>`)
- `admin.js` — **1483 lines** (all JS for 4 tabs: Enquiries, Courses, Companies, Billing)

Everything is global, tightly coupled, and hard to navigate. Adding a new feature means scrolling through 1,400+ lines of JS and 680+ lines of HTML/CSS.

---

## Goal

Split the monolith into **per-tab modules** while keeping the vanilla JS, no-build-tool approach. The result: each tab's logic and styles live in their own files, the shared shell stays thin, and new features are easy to add in isolation.

---

## Step 1 — Extract CSS into separate files

Move all `<style>` content out of `admin.html` into dedicated CSS files:

| New file | Contains |
|----------|----------|
| `admin/shared.css` | Login screen, dashboard shell, tabs, modal base styles, utility classes |
| `admin/enquiries.css` | Enquiry list, detail panel, status dots, confirm panel |
| `admin/courses.css` | Course list, sessions, attendance modal, new-course modal |
| `admin/companies.css` | Company list, company modal |
| `admin/billing.css` | Invoice list, invoice detail modal, create-invoice modal |

`admin.html` replaces the `<style>` block with `<link>` tags.

---

## Step 2 — Split `admin.js` into per-tab modules

Extract each tab's logic into its own ES module. Use native `<script type="module">` — no bundler needed.

| New file | Functions moved | Lines (approx) |
|----------|----------------|-----------------|
| `admin/api.js` | Shared `apiFetch()` helper, `adminPassword` export, login logic | ~50 |
| `admin/enquiries.js` | `loadEnquiries`, `renderEnquiries`, `saveStatus`, `saveNotes`, `deleteEnquiry`, `toggleDetail`, `confirmBooking`, teacher helpers | ~350 |
| `admin/courses.js` | `loadCourses`, `renderCourses`, `filterCourses`, `toggleCourse`, `syncCalendar`, `cancelSession`, `logSession`, `saveStudent`, new-course modal, `deleteCourse`, attendance modal | ~400 |
| `admin/companies.js` | `loadCompanies`, `renderCompanies`, `filterCompanies`, `toggleCompany`, company modal CRUD | ~200 |
| `admin/billing.js` | `loadInvoices`, `renderInvoices`, `filterInvoices`, invoice detail modal, create-invoice modal, PDF download | ~350 |
| `admin/tabs.js` | `switchTab` logic, wires up tab buttons, imports and calls each module's loader | ~30 |

### Module interface pattern

Each tab module exports an `init(apiFetch)` function and its loader:

```js
// admin/enquiries.js
export function init(apiFetch) { /* bind event listeners */ }
export async function loadEnquiries(status) { /* ... */ }
```

The main entry point (`admin/main.js`) imports all modules, handles login, and calls `init()` on each.

---

## Step 3 — Slim down `admin.html`

After extraction, `admin.html` becomes a thin shell:
- `<link>` tags for each CSS file
- HTML structure for login screen + dashboard skeleton (tab bar + empty panels)
- `<script type="module" src="admin/main.js">`
- Each tab's HTML markup stays inline (it's mostly structural, not logic)

Estimated: **~250 lines** (down from 683).

---

## Step 4 — Shared helpers

Move reusable utilities into `admin/helpers.js`:
- `fmt(dateStr)` — date formatter
- `dl(key, val)` — detail-row builder
- `showSavedMsg(id)` — flash "saved" indicator
- Any other shared DOM helpers

---

## File structure after refactor

```
admin.html                    (slim shell, ~250 lines)
admin/
  main.js                     (entry point: login, init modules, tab switching)
  api.js                      (apiFetch helper, password management)
  helpers.js                  (shared formatters & DOM utilities)
  enquiries.js                (enquiries tab logic)
  courses.js                  (courses tab logic)
  companies.js                (companies tab logic)
  billing.js                  (billing tab logic)
  shared.css                  (login, shell, tabs, modal base)
  enquiries.css               (enquiries styles)
  courses.css                 (courses styles)
  companies.css               (companies styles)
  billing.css                 (billing styles)
```

---

## Implementation order

1. Create `admin/` directory and CSS files (extract styles from `admin.html`)
2. Create `admin/api.js` and `admin/helpers.js` (shared utilities)
3. Extract `admin/enquiries.js` (largest, most self-contained tab)
4. Extract `admin/courses.js` (second largest, depends on teachers cache)
5. Extract `admin/companies.js`
6. Extract `admin/billing.js`
7. Create `admin/main.js` and `admin/tabs.js` — wire everything together
8. Update `admin.html` to use `<link>` + `<script type="module">`
9. Delete `admin.js` (old monolith)
10. Smoke-test all 4 tabs end-to-end

---

## Constraints & decisions

- **No build tools** — stays vanilla ES modules, native `<script type="module">`
- **No framework** — no React/Vue/Svelte, keeps the lightweight aesthetic
- **Cloudflare Pages compatible** — static files served as-is, no SSR needed
- **Backwards-compatible URLs** — `admin.html` stays at the same path
- **Incremental** — each step produces a working state; can commit after each tab extraction
