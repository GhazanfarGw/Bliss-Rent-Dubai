# Email design system (Phase 9B)

Reusable, pure, framework-free HTML email rendering — no Deno APIs, no
Supabase client, no network calls. Same pattern as every other
`_shared` module in this directory (`validation.ts`, `errors.ts`): plain
TypeScript in, a string out, testable under Vitest exactly like the rest
of the app.

## What's here

- `brand.ts` — brand colors (copied from `src/index.css`), the
  `bliss.rent` sending domain, and the placeholder contact info (copied
  from `src/i18n/locales/en.ts`, per the confirmed Phase 9A decision to
  use placeholders for now).
- `strings.ts` — EN/AR chrome text, reusing existing wording from
  `src/i18n/locales/{en,ar}.ts` wherever an equivalent already exists.
- `escape.ts` — `escapeHtml`, used for every interpolated value.
- `manageBookingLink.ts` — builds the pre-filled `?ref=` Manage Booking
  link (confirmed Phase 9A decision, item 7).
- `types.ts` — shared prop interfaces for the two layouts.
- `components.ts` — reusable table-based fragments: header, status
  banner, booking summary card, CTA button, footer, and the admin-only
  priority bar / required-action block.
- `layout.ts` — `renderCustomerLayout(props)` and
  `renderAdminLayout(props)`, the two base templates from Section 10 of
  the Phase 9 report. Both return a complete, self-contained HTML
  document string.
- `previewData.ts` — fake QA data only, never used by a real send path.
- `*.test.ts` — Vitest coverage for every module above.
- `preview.test.ts` — renders both layouts in both languages with the
  fake QA data and writes them to `/email-previews` at the repo root
  (gitignored) so they can be opened directly in a browser. Run `npm
  test` and then open `email-previews/customer-en.html` (etc.) to see
  them.

## What is deliberately NOT here yet

Event triggers, Resend sending, the `email_log` table, cron-based
reminder scheduling, the `submit-complaint` function, and the admin
Email Management dashboard are 9C–9J's job, not 9B's — nothing here
sends anything or knows how these templates get used. See
`PHASE9_PRE_IMPLEMENTATION_REPORT_V2.md` and
`PHASE9_BUSINESS_DECISIONS_CONFIRMED.md` (project docs) for the full
sequence and the confirmed decisions this module implements.

## Known follow-up (flagged, not fixed here)

`buildManageBookingUrl` produces a `?ref=BLS-XXXXXXXX` link, but
`ManageBookingPage.tsx` doesn't yet read that query parameter — the
lookup field always starts empty today. Pre-filling it is a small,
separate frontend change, out of scope for 9B (template architecture
only). See the 9B completion report for details.
