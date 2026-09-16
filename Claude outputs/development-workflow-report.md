# Development Workflow Report — Bliss Rent (Sept 11–14, 2026)

*SEO/metadata work is covered in a separate report. This report covers all other development work over the same period.*

## Overview

| | |
|---|---|
| Period | Sept 11 – Sept 14, 2026 |
| Commits | 82 |
| Files touched | 893 |
| Lines changed | +75,073 / −2,708 |

Work spanned a features pass, two customer-flow fixes, a temporary payment workaround, and a full front-end redesign plus a new support-chat system.

## Day by day

**Sept 11 — Features & audit**
- Fleet listings: public cards now require a price and an image before showing, and identical Make+Model+Year listings group into one card with a quantity count. Reserved/duplicate copies are excluded from all public views.
- Added a WhatsApp contact button to every vehicle card (and fixed a pre-existing wrong phone number in the header).
- Contact Us: admins can now reply to a customer complaint and the customer receives that reply by email. **Deployed to production.**
- Stripe payments audited end-to-end — confirmed live, secure, and free of any customer-visible test-mode messaging. No changes needed.
- Found and fixed a production bug: Contact Us submissions had been silently failing due to a missing database function that was never applied to the live database.
- Split "Find My Car" (status check only) apart from "Manage Booking" (full lookup/extend/pay) — production already had this; brought this machine's local copy in line.
- Built a temporary checkout flow: customers are shown their booking reference and directed to WhatsApp to complete payment with staff, instead of the live card-payment form. This was a deliberate, easily-reversible front-end swap — the real Stripe integration underneath was left completely untouched and can be switched back on with a two-line change whenever needed.

**Sept 12 — Fixes & prep**
- Fixed the mobile header menu (links weren't clickable).
- Fixed Hero section buttons to navigate directly instead of just scrolling.
- Batch of image/asset uploads and a cleanup of the scripts folder ahead of the redesign work.

**Sept 13 — Full front-end redesign (largest day, ~50 commits)**
- Site-wide "sharp-editorial" redesign rolled out in phases: design system foundations, navigation/footer, homepage, vehicle browsing/detail/search pages, content pages, and checkout.
- About page rebuilt end-to-end with real fleet/coverage content and a genuine company-profile layout, including a business-model diagram.
- New header Cities dropdown; language switcher updated with real UAE/UK flag icons.
- Manage Booking redesigned as a simpler, flat, airline-style lookup form.
- Added a site-wide Feedback widget and a header Site Search; Contact page got a phone/FAQ section.
- Fixed a sitewide bug where "sticky" elements (the filter sidebar, mobile filter bar, search bar, and the homepage ticker) had silently stopped sticking — traced to a global CSS rule that was breaking vertical scroll-tracking for the whole page. Fixed without any visible side effects.

**Sept 14 — Support chat**
- Shipped a full customer support chat system: an FAQ bot plus live two-way chat, with an admin dashboard for staff to answer conversations in real time. This was the single largest commit of the week.
- Restored the homepage Hero to full-height on mobile and removed the ticker bar.
- Merged in a concurrent edit made directly on GitHub.

## Current repo state (for whoever picks this up next)

- Two local branches exist: `main` (matches what's on GitHub, includes the full redesign and support chat) and `master` (a separate line containing the SEO work, the temporary WhatsApp checkout, and a run of earlier polish commits) — the two have not yet been reconciled into one.
- This development machine currently has no network access to GitHub, so nothing from `master` can be pushed until that's resolved (or pushed from another machine).
- The temporary WhatsApp checkout flow is still active on `master` and has not been deployed anywhere yet — needs a decision on whether to go live or revert to card payments.

## Outstanding decisions

1. Push/merge `master` into `main` once GitHub access is restored.
2. Decide on the temporary WhatsApp checkout flow: keep, deploy, or revert to Stripe.
