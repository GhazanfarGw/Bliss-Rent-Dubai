# Live Edge Function snapshot — 23 Oct 2026

`create-booking` and `confirm-payment` running in Supabase are NEWER than the
code in `supabase/functions/` on `main` (they use the first/last-name checkout).
This folder is the exact live source, downloaded 23 Oct 2026, with two changes:

1. `supabase/functions/_shared/email/brand.ts` + `components.ts` — real contact
   details in the email footer instead of the "(placeholder)" block.
2. `create-booking/src/lib/pricing.ts` — prorated `quoteForDays` (same as
   `src/lib/pricing.ts` on this branch).

Deploy (from this folder, per function):

    cd live-snapshot-2026-10-23/create-booking
    supabase functions deploy create-booking --project-ref blsuohqmeyzrqycqcjdr
    cd ../confirm-payment
    supabase functions deploy confirm-payment --project-ref blsuohqmeyzrqycqcjdr

Then merge this branch so the website shows the same prorated prices, and
move these files back into `supabase/functions/` so the repo matches live.
