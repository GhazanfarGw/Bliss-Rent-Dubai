-- Split the fleet from two catch-all categories (Economy / Luxury) into four
-- real ones: Economy, Sports & Supercars, SUV, Luxury. Until now every sports
-- car, SUV and flagship sedan lived under "Luxury".
--
-- Vehicles are matched by make + model (not by id) so this also applies
-- cleanly to a fresh database seeded with the same fleet. Idempotent: safe to
-- run twice. Undo: supabase/rollback/split_fleet_into_four_categories.rollback.sql

insert into public.vehicle_categories (name, description)
select 'Sports & Supercars', 'Supercars, sports coupes, convertibles and muscle cars for drivers who want to feel every mile.'
where not exists (select 1 from public.vehicle_categories where name = 'Sports & Supercars');

insert into public.vehicle_categories (name, description)
select 'SUV', 'Premium SUVs with space, presence and confidence — for groups, families and longer drives.'
where not exists (select 1 from public.vehicle_categories where name = 'SUV');

-- The old descriptions quoted a "~35% / ~65% fleet mix" that no longer
-- describes the fleet.
update public.vehicle_categories
set description = 'Hatchbacks and sedans for everyday city driving and budget-friendly trips.'
where name = 'Economy';

update public.vehicle_categories
set description = 'Flagship luxury sedans, grand tourers and ultra-luxury models for special occasions and effortless arrivals.'
where name = 'Luxury';

-- Sports cars, supercars, grand tourers and muscle cars.
update public.vehicles v
set category_id = c.id
from public.vehicle_categories c
where c.name = 'Sports & Supercars'
  and (v.make, v.model) in (
    ('Aston Martin', 'DB11'),
    ('Audi', 'R8'),
    ('BMW', 'M8 Competition'),
    ('Chevrolet', 'Camaro'),
    ('Ferrari', '488 Spider'),
    ('Ford', 'Mustang'),
    ('Lamborghini', 'Huracan EVO'),
    ('McLaren', '720S'),
    ('Porsche', '911 Carrera S')
  );

-- SUVs.
update public.vehicles v
set category_id = c.id
from public.vehicle_categories c
where c.name = 'SUV'
  and (v.make, v.model) in (
    ('Brabus', 'G800 Widestar'),
    ('Cadillac', 'Escalade'),
    ('Land Rover', 'Defender 110'),
    ('Mansory', 'Mercedes-AMG G63'),
    ('Maserati', 'Levante Trofeo'),
    ('Range Rover', 'Sport Autobiography')
  );

-- Luxury keeps the flagship sedan / grand tourer / ultra-luxury models
-- (Mercedes-Benz S580, Bentley Continental GT, Rolls-Royce Cullinan) — no
-- update needed, they are already in it. Economy is unchanged.
