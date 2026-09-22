-- Vehicle specifications: the technical details and background shown on each
-- car's card and detail page (engine, power, origin, history...).
--
-- Every column is nullable and additive: a car with nothing entered simply
-- shows nothing for that field — the site never invents a figure. Admins can
-- edit all of these from Admin -> Fleet -> Edit vehicle.
--
-- The backfill below fills ONLY the facts that are the same for every car sold
-- under that make + model (country of origin, body/doors, drive layout, and the
-- engine/power where the model has a single well-known configuration) plus a
-- short "about / history" text. Where the exact variant of a car is not
-- recorded (e.g. which engine a Corolla or Continental GT has) the figure is
-- left NULL rather than guessed. It only touches rows that have no "about" yet,
-- so it is safe to re-run and never overwrites what an admin has entered.
--
-- Undo: supabase/rollback/vehicle_specifications.rollback.sql

alter table public.vehicles
  add column if not exists engine text,
  add column if not exists horsepower integer,
  add column if not exists torque_nm integer,
  add column if not exists top_speed_kmh integer,
  add column if not exists acceleration_0_100 numeric(3,1),
  add column if not exists fuel_type text,
  add column if not exists fuel_consumption_l100km numeric(4,1),
  add column if not exists drivetrain text,
  add column if not exists doors smallint,
  add column if not exists origin_country text,
  add column if not exists about text,
  add column if not exists about_ar text;

comment on column public.vehicles.engine is 'Engine description, e.g. "4.0L twin-turbo V8".';
comment on column public.vehicles.horsepower is 'Manufacturer headline power in hp (PS).';
comment on column public.vehicles.torque_nm is 'Peak torque in Nm.';
comment on column public.vehicles.top_speed_kmh is 'Top speed in km/h (as published; may be electronically limited).';
comment on column public.vehicles.acceleration_0_100 is '0-100 km/h time in seconds.';
comment on column public.vehicles.fuel_type is 'Petrol, Diesel, Hybrid, Electric...';
comment on column public.vehicles.fuel_consumption_l100km is 'Combined fuel consumption in L/100 km. The site also shows the km/L equivalent.';
comment on column public.vehicles.drivetrain is 'RWD, FWD, AWD or 4WD.';
comment on column public.vehicles.doors is 'Number of doors.';
comment on column public.vehicles.origin_country is 'Country of the manufacturer / where the car is made.';
comment on column public.vehicles.about is 'Short "about this car" text: what it is, its history, why it is special (English).';
comment on column public.vehicles.about_ar is 'Arabic version of "about"; the site falls back to the English text when empty.';

alter table public.vehicles drop constraint if exists vehicles_horsepower_check;
alter table public.vehicles add constraint vehicles_horsepower_check check (horsepower is null or horsepower between 1 and 3000);
alter table public.vehicles drop constraint if exists vehicles_torque_nm_check;
alter table public.vehicles add constraint vehicles_torque_nm_check check (torque_nm is null or torque_nm between 1 and 5000);
alter table public.vehicles drop constraint if exists vehicles_top_speed_kmh_check;
alter table public.vehicles add constraint vehicles_top_speed_kmh_check check (top_speed_kmh is null or top_speed_kmh between 1 and 500);
alter table public.vehicles drop constraint if exists vehicles_acceleration_0_100_check;
alter table public.vehicles add constraint vehicles_acceleration_0_100_check check (acceleration_0_100 is null or acceleration_0_100 between 1 and 60);
alter table public.vehicles drop constraint if exists vehicles_fuel_consumption_check;
alter table public.vehicles add constraint vehicles_fuel_consumption_check check (fuel_consumption_l100km is null or fuel_consumption_l100km between 1 and 60);
alter table public.vehicles drop constraint if exists vehicles_doors_check;
alter table public.vehicles add constraint vehicles_doors_check check (doors is null or doors between 1 and 6);

-- Backfill (matched by make + model, like the fleet-category migration).
update public.vehicles v
set engine = s.engine,
    horsepower = s.horsepower,
    torque_nm = s.torque_nm,
    top_speed_kmh = s.top_speed_kmh,
    acceleration_0_100 = s.acceleration_0_100,
    fuel_type = s.fuel_type,
    drivetrain = s.drivetrain,
    doors = s.doors,
    origin_country = s.origin_country,
    about = s.about
from (values
  ('Aston Martin', 'DB11', null::text, null::integer, null::integer, null::integer, null::numeric, 'Petrol'::text, 'RWD'::text, 2::smallint, 'United Kingdom'::text,
    $t$Unveiled at the 2016 Geneva Motor Show as the successor to the DB9, the DB11 opened a new chapter for Aston Martin and introduced turbocharging to its V12 line-up. A hand-finished grand tourer built at the Gaydon factory in England, it blends long-distance comfort with genuine sports-car pace, and was succeeded by the DB12 in 2023.$t$),
  ('Audi', 'R8', '5.2L V10 (naturally aspirated)', null, null, null, null, 'Petrol', null, 2, 'Germany',
    $t$Audi's mid-engined flagship arrived in 2006 and brought supercar performance with everyday usability, sharing its underpinnings with the Lamborghini Gallardo and later the Huracán. Its 5.2-litre V10 is one of the last naturally aspirated V10 engines in production, and the car is built by hand in Neckarsulm, Germany.$t$),
  ('Bentley', 'Continental GT', null, null, null, null, null, 'Petrol', 'AWD', 2, 'United Kingdom',
    $t$Launched in 2003, the Continental GT defined the modern grand tourer and transformed Bentley's fortunes under Volkswagen Group ownership. The current third generation, introduced in 2017, is hand-built in Crewe, England, and pairs a hand-stitched leather-and-wood cabin with effortless all-wheel-drive performance.$t$),
  ('BMW', 'M8 Competition', '4.4L twin-turbo V8', 625, 750, 250, 3.2, 'Petrol', 'AWD', null, 'Germany',
    $t$The M8 Competition is the flagship of BMW's M division, launched in 2019 on the 8 Series. Its 4.4-litre twin-turbo V8 sends power to all four wheels through M xDrive, and the car is built at BMW's Dingolfing plant in Germany. Top speed is electronically limited to 250 km/h.$t$),
  ('Brabus', 'G800 Widestar', '4.0L twin-turbo V8 (Brabus-tuned)', 800, 1000, 240, 4.1, 'Petrol', 'AWD', 5, 'Germany',
    $t$Brabus, founded in Bottrop, Germany, in 1977, is the world's best-known Mercedes tuner. The G800 Widestar starts from the Mercedes-AMG G 63, whose boxy design has barely changed since 1979 and is hand-assembled in Graz, Austria, then adds Brabus's wide-body kit, upgraded turbochargers and 800 hp for a G-Class with unmistakable presence.$t$),
  ('Cadillac', 'Escalade', '6.2L V8', 420, 624, null, null, 'Petrol', null, 5, 'United States',
    $t$Introduced in 1999, the Escalade has been Cadillac's full-size luxury SUV flagship for over two decades. The current fifth generation, launched for 2021, is best known for its huge curved OLED display and seating for up to seven, and is built in Arlington, Texas.$t$),
  ('Chevrolet', 'Camaro', null, null, null, null, null, 'Petrol', 'RWD', 2, 'United States',
    $t$Chevrolet introduced the Camaro in 1966 as its answer to the Ford Mustang, and the two have been rivals ever since. The sixth generation, launched for 2016 on GM's lightweight Alpha platform, is a rear-wheel-drive muscle car built in Lansing, Michigan.$t$),
  ('Chevrolet', 'Malibu', null, null, null, null, null, 'Petrol', 'FWD', 4, 'United States',
    $t$The Malibu name dates back to 1964, and the current ninth generation arrived in 2016 as a roomy, refined family sedan built for comfortable everyday driving. It is a practical, easy-to-drive choice for city use and longer trips alike.$t$),
  ('Citroen', 'C4X', null, null, null, null, null, 'Petrol', 'FWD', null, 'France',
    $t$Founded in Paris in 1919 by André Citroën, the brand is known for comfort-first engineering. The C4 X, unveiled in 2022, is a fastback sedan version of the C4 that combines a compact footprint with a generous boot and a soft, comfortable ride.$t$),
  ('Ferrari', '488 Spider', '3.9L twin-turbo V8', 670, 760, 325, 3.0, 'Petrol', 'RWD', 2, 'Italy',
    $t$Unveiled at the 2015 Frankfurt Motor Show, the 488 Spider is the open-top version of the 488 GTB, with a retractable hard top that folds away in 14 seconds. Its 3.9-litre twin-turbo V8 won International Engine of the Year, and the car was built by hand in Maranello, Italy, before being succeeded by the F8 Spider in 2019.$t$),
  ('Ford', 'Mustang', null, null, null, null, null, 'Petrol', 'RWD', 2, 'United States',
    $t$Introduced in 1964, the Mustang created the "pony car" class and has stayed in continuous production ever since. The current sixth generation, launched in 2015, was the first Mustang designed for global sale and is built in Flat Rock, Michigan.$t$),
  ('Hyundai', 'Elantra', null, null, null, null, null, 'Petrol', 'FWD', 4, 'South Korea',
    $t$The Elantra has been part of Hyundai's line-up since 1990 and is one of the brand's best-selling models worldwide. The current seventh generation, launched in 2020, is known for its sharp, angular styling and generous equipment, making it a comfortable, economical choice for daily driving.$t$),
  ('JAC', 'J7', null, null, null, null, null, 'Petrol', 'FWD', null, 'China',
    $t$JAC Motors, founded in 1964 and based in Hefei, China, is one of the country's long-established vehicle makers and sells in markets across the Middle East. The J7 is its roomy, modern sedan, offering good equipment and plenty of space for the price.$t$),
  ('Lamborghini', 'Huracan EVO', '5.2L V10 (naturally aspirated)', 640, 600, 325, 2.9, 'Petrol', 'AWD', 2, 'Italy',
    $t$The Huracán EVO, introduced in 2019, is the evolution of the Huracán that replaced the Gallardo in 2014. Its 5.2-litre naturally aspirated V10 produces 640 hp, and Lamborghini's predictive vehicle-dynamics system makes it quicker and more responsive than ever. Every one is built in Sant'Agata Bolognese, Italy, where Ferruccio Lamborghini founded the company in 1963.$t$),
  ('Land Rover', 'Defender 110', null, null, null, null, null, null, 'AWD', 5, 'United Kingdom',
    $t$The Defender's roots go back to the original 1948 Land Rover, one of the world's most capable off-roaders. The all-new Defender relaunched in 2020 with modern technology and a monocoque body, and the "110" is the longer five-door version. It is built in Nitra, Slovakia, and remains famous for going almost anywhere.$t$),
  ('Mansory', 'Mercedes-AMG G63', '4.0L twin-turbo V8', null, null, null, null, 'Petrol', 'AWD', 5, 'Germany',
    $t$Mansory is a German luxury tuning house, founded in 1989, famous for bespoke carbon-fibre body kits and one-off interiors. This G-Class starts as a Mercedes-AMG G 63, powered by AMG's 4.0-litre twin-turbo V8 and hand-assembled in Graz, Austria, and is then individually customised by Mansory.$t$),
  ('Maserati', 'Levante Trofeo', '3.8L twin-turbo V8', 580, 730, 302, 3.9, 'Petrol', 'AWD', 5, 'Italy',
    $t$Maserati's first SUV, the Levante was launched in 2016 and brought the Trident brand's Italian style and sound to the SUV segment. In Trofeo form it uses a 3.8-litre twin-turbo V8 built by Ferrari and is assembled in Turin, Italy — the fastest and most powerful Levante.$t$),
  ('McLaren', '720S', '4.0L twin-turbo V8', 720, 770, 341, 2.9, 'Petrol', 'RWD', 2, 'United Kingdom',
    $t$Unveiled in 2017, the 720S is built around a carbon-fibre Monocage II tub and has a 4.0-litre twin-turbo V8 producing 720 PS, hence the name. It is assembled by hand at the McLaren Production Centre in Woking, England, and its dihedral doors and glass-canopy roof make it one of the most striking supercars of its era.$t$),
  ('Mercedes-Benz', 'S580', '4.0L twin-turbo V8 with 48V mild hybrid', 503, 700, 250, 4.4, 'Petrol (mild hybrid)', 'AWD', 4, 'Germany',
    $t$The S-Class has set the benchmark for luxury saloons since the name was introduced in 1972, and it regularly debuts technology that later spreads to every other car. The current generation, launched in 2020, is built in Sindelfingen, Germany; the S 580 4MATIC pairs a twin-turbo V8 with a 48-volt mild-hybrid system and all-wheel drive.$t$),
  ('MG', '3', null, null, null, null, null, 'Petrol', 'FWD', 5, 'China',
    $t$MG, short for Morris Garages, was founded in Oxford, England, in 1924 and is now owned by China's SAIC Motor. The MG 3 is a compact, value-focused hatchback with a bright, sporty look — easy to park and economical around town, which makes it a practical choice for city driving.$t$),
  ('MG', '5', null, null, null, null, null, 'Petrol', 'FWD', 4, 'China',
    $t$MG, short for Morris Garages, was founded in Oxford, England, in 1924 and is now owned by China's SAIC Motor. The MG 5 is a compact sedan that pairs a roomy cabin and a large boot with modern equipment at an accessible price.$t$),
  ('MG', '5 Plus', null, null, null, null, null, 'Petrol', 'FWD', 4, 'China',
    $t$MG, short for Morris Garages, was founded in Oxford, England, in 1924 and is now owned by China's SAIC Motor. The MG 5 Plus is a sleek, well-equipped sedan that offers good space and modern features at an accessible price.$t$),
  ('MG', '7', null, null, null, null, null, 'Petrol', 'FWD', null, 'China',
    $t$MG, short for Morris Garages, was founded in Oxford, England, in 1924 and is now owned by China's SAIC Motor. The MG 7 is the brand's larger, sportier-looking sedan, aimed at drivers who want more space and presence than a compact car offers.$t$),
  ('Nissan', 'Altima', '2.5L 4-cylinder', 188, 244, null, null, 'Petrol', 'FWD', 4, 'Japan',
    $t$The Altima nameplate arrived in 1992, and the current sixth generation, launched in 2018, is Nissan's comfortable mid-size sedan, with "Zero Gravity" seats and a quiet, relaxed ride. Its 2.5-litre engine and CVT are tuned for smooth, efficient cruising.$t$),
  ('Nissan', 'Sentra', null, null, null, null, null, 'Petrol', 'FWD', 4, 'Japan',
    $t$The Sentra has been a fixture in Nissan's range since 1982. The current generation, launched in 2019, is a sharper-looking compact sedan with a roomy cabin and a comfortable, easy-to-drive character, ideal for city use.$t$),
  ('Porsche', '911 Carrera S', '3.0L twin-turbo flat-six', null, null, null, null, 'Petrol', 'RWD', 2, 'Germany',
    $t$First shown in 1963 and on sale from 1964, the 911 is the definitive sports car, keeping its rear-mounted flat-six layout for six decades. The Carrera S adds extra power over the standard Carrera, and the current 992 generation is built in Stuttgart-Zuffenhausen, Germany, combining track-ready handling with real everyday usability.$t$),
  ('Range Rover', 'Sport Autobiography', null, null, null, null, null, null, 'AWD', 5, 'United Kingdom',
    $t$Launched in 2005 as a sportier sibling to the Range Rover, the Range Rover Sport blends luxury with real off-road ability. The third generation arrived in 2022, and the Autobiography trim adds the most luxurious materials and equipment. It is built in Solihull, England, the home of Land Rover.$t$),
  ('Rolls-Royce', 'Cullinan', '6.75L twin-turbo V12', 563, 850, 250, 5.2, 'Petrol', 'AWD', 4, 'United Kingdom',
    $t$Launched in 2018 as Rolls-Royce's first SUV, the Cullinan is named after the 3,106-carat Cullinan diamond, the largest gem-quality diamond ever found. Its 6.75-litre twin-turbo V12 delivers silent, effortless power, and every car is hand-built at the Goodwood factory in England with the brand's famous "magic carpet" ride.$t$),
  ('Toyota', 'Corolla', null, null, null, null, null, 'Petrol', 'FWD', 4, 'Japan',
    $t$Introduced in 1966, the Corolla is the best-selling nameplate in automotive history, with more than 50 million sold worldwide. Known for reliability, low running costs and easy driving, the current twelfth generation (2018) is a sensible choice for city trips and longer journeys alike.$t$)
) as s(make, model, engine, horsepower, torque_nm, top_speed_kmh, acceleration_0_100, fuel_type, drivetrain, doors, origin_country, about)
where v.make = s.make
  and v.model = s.model
  and v.about is null;
