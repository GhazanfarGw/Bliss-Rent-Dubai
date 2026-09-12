-- Minimal reference data only — no fake vehicles/bookings/customers.
-- Real fleet data should be entered through the admin dashboard once it
-- exists (Phase 1+), not hardcoded here.

insert into vehicle_categories (name, description) values
  ('Economy', 'Hatchback and sedan tier — the ~35% share of the current fleet mix.'),
  ('Luxury', 'SUV and premium tier — the ~65% share of the current fleet mix.')
on conflict (name) do nothing;

insert into locations (name, type) values
  ('Dubai International Airport (DXB) — Terminal 1', 'airport'),
  ('Dubai International Airport (DXB) — Terminal 3', 'airport'),
  ('Al Maktoum International Airport (DWC)', 'airport')
on conflict (name) do nothing;
