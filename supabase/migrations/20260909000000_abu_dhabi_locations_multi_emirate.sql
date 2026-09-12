-- Multi-emirate locations: adds real Abu Dhabi pickup/drop-off points and a
-- `city` column on `locations` so the search widget and Locations page can
-- filter/group by emirate. See docs/ARCHITECTURE.md's "Multi-emirate
-- locations" section.
--
-- Source for the Abu Dhabi points: researched against DRIVUS.ae's real
-- service structure (drivus.ae/abu-dhabi, drivus.ae/location/...) — an
-- airport point (Abu Dhabi International Airport delivery/pickup), a
-- downtown/city drop-off point, and a hotel-delivery point covering the
-- Yas Island / Corniche / Saadiyat hotel districts DRIVUS itself serves
-- (DRIVUS has no single fixed hotel counter, so this is represented as a
-- `city`-type location with a descriptive name rather than a new
-- `location_type` enum value — avoids an enum/schema change for what is
-- otherwise a data-only addition).

insert into locations (name, type, is_active)
values
  ('Abu Dhabi International Airport (AUH)', 'airport', true),
  ('Abu Dhabi Downtown (City)', 'city', true),
  ('Abu Dhabi — Hotel Delivery (Yas Island / Corniche / Saadiyat)', 'city', true)
on conflict do nothing;

alter table locations
  add column city text default 'Dubai';

update locations
set city = 'Abu Dhabi'
where name like 'Abu Dhabi%';

alter table locations
  alter column city drop default;

alter table locations
  alter column city set not null;

comment on column locations.city is
  'Emirate/city this point is in, e.g. ''Dubai'', ''Abu Dhabi'' — drives the search widget''s Pickup City filter and the Locations page''s per-city grouping. Free-text by design: a future emirate is a new value, not a schema change.';
