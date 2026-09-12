-- Second half of the UAE-wide location architecture migration (see
-- 20260910000000_location_type_add_hotel_delivery, applied immediately
-- before this): adds `country` (future-proofs the Country level of the
-- Country -> City -> Type -> Location hierarchy — free-text, not an
-- enum, same pattern as `city`) and `airport_code` (real IATA data
-- instead of parsing it out of the `name` string), then re-tags the one
-- existing "hotel delivery" row from the city-type naming hack to the
-- real `hotel` type and backfills airport_code for the existing airport
-- rows from their own names (values are already public/well-known, not
-- invented).

alter table locations
  add column country text not null default 'United Arab Emirates';

alter table locations
  add column airport_code text; -- nullable; IATA code, only meaningful when type = 'airport'

comment on column locations.country is
  'Country this location is in. Free-text, not an enum, same pattern as city -- a future non-UAE country is a new value here, never a schema change. Defaults to United Arab Emirates for every existing row (the only country the business operates in today).';

comment on column locations.airport_code is
  'IATA airport code (e.g. DXB, AUH), set only when type = ''airport''. NULL for every other type.';

update locations
set type = 'hotel'
where name ilike '%hotel delivery%';

update locations set airport_code = 'DXB' where name ilike '%DXB%';
update locations set airport_code = 'DWC' where name ilike '%DWC%';
update locations set airport_code = 'AUH' where name ilike '%AUH%';
