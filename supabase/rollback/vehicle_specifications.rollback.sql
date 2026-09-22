-- Undo supabase/migrations/20260921175100_vehicle_specifications.sql.
-- Drops the specification columns from public.vehicles (and everything entered
-- in them, including anything an admin typed). The rest of the vehicle row is
-- untouched.

alter table public.vehicles
  drop constraint if exists vehicles_horsepower_check,
  drop constraint if exists vehicles_torque_nm_check,
  drop constraint if exists vehicles_top_speed_kmh_check,
  drop constraint if exists vehicles_acceleration_0_100_check,
  drop constraint if exists vehicles_fuel_consumption_check,
  drop constraint if exists vehicles_doors_check;

alter table public.vehicles
  drop column if exists engine,
  drop column if exists horsepower,
  drop column if exists torque_nm,
  drop column if exists top_speed_kmh,
  drop column if exists acceleration_0_100,
  drop column if exists fuel_type,
  drop column if exists fuel_consumption_l100km,
  drop column if exists drivetrain,
  drop column if exists doors,
  drop column if exists origin_country,
  drop column if exists about,
  drop column if exists about_ar;
