-- ROLLBACK for migration `split_fleet_into_four_categories` (2026-09-19).
--
-- Puts the fleet back exactly as it was before the split: two categories
-- (Economy, Luxury), with every sports car, SUV and luxury sedan under
-- Luxury. NOT a migration — it lives outside supabase/migrations on purpose
-- so it never runs automatically. Run it by hand only if you want to undo.
--
-- The vehicle ids below are the 16 rows the split moved out of Luxury,
-- captured from the live database immediately before it ran. Luxury's id
-- and the original descriptions are the pre-split values.
--
-- Caveat: `vehicles.category_id` is `on delete restrict`, so the two new
-- categories can only be deleted while no vehicle points at them. If you
-- have since ADDED vehicles to "Sports & Supercars" or "SUV", move those to
-- another category first, or the final DELETE will (safely) refuse.

-- 1. Move the 16 vehicles back to Luxury.
update public.vehicles
set category_id = '07a326d6-1136-4a10-8c6a-d9ac6c4bfe77' -- Luxury
where id in (
  'e41161ce-d0ac-4a75-9ed1-8d534f827dc9', -- Aston Martin DB11
  'ef1d46b1-612c-496b-9ee7-a7d49b89f39f', -- Aston Martin DB11 (retired)
  '7738b064-244b-4ad3-bd88-50ddd32163a8', -- Audi R8
  'eae61609-2d76-4735-8701-d110b43391f1', -- BMW M8 Competition
  '7c9da25e-350d-462a-b146-4644ed5e668d', -- Brabus G800 Widestar
  'f1e686ec-462e-4cf7-9fd8-21708cea474c', -- Cadillac Escalade
  '3ea5448a-7fc7-4041-b17c-749f13bf42c7', -- Chevrolet Camaro
  '91cdfe81-07c8-43ea-9aae-132f20112e7a', -- Ferrari 488 Spider
  '6f1b9780-d06f-463d-af13-e9980373b485', -- Ford Mustang
  '3823c9c7-118c-4115-965d-b26a7b049b64', -- Lamborghini Huracan EVO
  'de3c89fe-b485-43d3-84c9-11640f30ad86', -- Land Rover Defender 110
  'c0b487b7-a2a3-4027-97d4-c50b6e516735', -- Mansory Mercedes-AMG G63
  '6050bc99-aa11-4c29-bf01-942478810638', -- Maserati Levante Trofeo
  '51843ae7-eaa2-4007-a464-f849c3c3a9a3', -- McLaren 720S
  'fe7fca11-f238-4ca5-a017-161a2fe0eebb', -- Porsche 911 Carrera S
  'ce509e99-48e7-44db-a5be-747e616dc8b2'  -- Range Rover Sport Autobiography
);

-- 2. Remove the two categories the split added.
delete from public.vehicle_categories where name in ('Sports & Supercars', 'SUV');

-- 3. Restore the original descriptions.
update public.vehicle_categories
set description = 'Hatchback and sedan tier — the ~35% share of the current fleet mix.'
where name = 'Economy';

update public.vehicle_categories
set description = 'SUV and premium tier — the ~65% share of the current fleet mix.'
where name = 'Luxury';
