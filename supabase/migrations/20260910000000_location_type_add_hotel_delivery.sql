-- Adds the two missing location_type categories (hotel, delivery) needed
-- for a real, filterable Location Type layer — see docs/ARCHITECTURE.md's
-- "Multi-emirate locations" section and the UAE-wide location architecture
-- data requirements report (project doc, 2026-08-30).
--
-- Must run as its own migration: Postgres does not allow a newly added
-- enum value to be used in the same transaction that adds it, so the
-- column/backfill changes that reference 'hotel'/'delivery' are a
-- separate, subsequent migration (20260910000001).
alter type location_type add value if not exists 'hotel';
alter type location_type add value if not exists 'delivery';
