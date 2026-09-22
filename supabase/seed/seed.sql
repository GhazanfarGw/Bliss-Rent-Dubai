-- Minimal reference data only — no fake vehicles/bookings/customers.
-- Real fleet data should be entered through the admin dashboard once it
-- exists (Phase 1+), not hardcoded here.

insert into vehicle_categories (name, description) values
  ('Economy', 'Hatchbacks and sedans for everyday city driving and budget-friendly trips.'),
  ('Sports & Supercars', 'Supercars, sports coupes, convertibles and muscle cars for drivers who want to feel every mile.'),
  ('SUV', 'Premium SUVs with space, presence and confidence — for groups, families and longer drives.'),
  ('Luxury', 'Flagship luxury sedans, grand tourers and ultra-luxury models for special occasions and effortless arrivals.')
on conflict (name) do nothing;

insert into locations (name, type) values
  ('Dubai International Airport (DXB) — Terminal 1', 'airport'),
  ('Dubai International Airport (DXB) — Terminal 3', 'airport'),
  ('Al Maktoum International Airport (DWC)', 'airport')
on conflict (name) do nothing;
