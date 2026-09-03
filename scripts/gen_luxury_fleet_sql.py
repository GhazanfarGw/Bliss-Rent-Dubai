import uuid

luxury_category_id = "07a326d6-1136-4a10-8c6a-d9ac6c4bfe77"

# (plate_suffix, make, model, seats, daily_list, daily_client)
cars = [
    ("03", "Aston Martin", "DB11", 4, 3800, 2900),
    ("04", "Audi", "R8", 2, 3000, 2300),
    ("05", "Bentley", "Continental GT", 4, 4500, 3450),
    ("06", "BMW", "M8 Competition", 4, 2600, 2000),
    ("07", "Brabus", "G800 Widestar", 5, 5500, 4200),
    ("08", "Cadillac", "Escalade", 7, 2200, 1700),
    ("09", "Ferrari", "488 Spider", 2, 7500, 5750),
    ("10", "Lamborghini", "Huracan EVO", 2, 7000, 5350),
    ("11", "Land Rover", "Defender 110", 5, 2000, 1550),
    ("12", "Mansory", "Mercedes-AMG G63", 5, 9500, 7300),
    ("13", "Maserati", "Levante Trofeo", 5, 2800, 2150),
    ("14", "McLaren", "720S", 2, 6500, 5000),
    ("15", "Mercedes-Benz", "S580", 5, 2400, 1850),
    ("16", "Porsche", "911 Carrera S", 4, 2800, 2150),
    ("17", "Range Rover", "Sport Autobiography", 5, 3200, 2450),
    ("18", "Rolls-Royce", "Cullinan", 5, 9800, 7550),
]

def r5(x):
    return int(round(x/5.0)*5)

vehicles_sql = []
pricing_sql = []
images_sql = []
rows_summary = []

for suffix, make, model, seats, dlist, dclient in cars:
    vid = str(uuid.uuid4())
    plate = "TEMP-LUX-" + suffix
    safe_make = make.replace(" ", "_").replace("-", "_")
    safe_model = model.replace(" ", "_").replace("-", "_")
    storage_path = plate + "_" + safe_make + "_" + safe_model + ".png"

    vehicles_sql.append(
        "('%s', '%s', '%s', '%s', 2024, 'automatic', %d, '%s', 'available')" % (vid, luxury_category_id, make, model, seats, plate)
    )

    terms = {
        "daily": (dlist, dclient),
        "weekly": (r5(dlist*6.3), r5(dclient*6.3)),
        "monthly": (r5(dlist*19.2), r5(dclient*19.2)),
        "3_month": (r5(dlist*14.04), r5(dclient*14.04)),
    }
    for term, (lp, cp) in terms.items():
        pricing_sql.append("('%s', '%s', %s, %s, 'AED')" % (vid, term, lp, cp))

    images_sql.append("('%s', '%s', true, 0)" % (vid, storage_path))

    rows_summary.append((plate, make, model, seats, terms, storage_path))

out_path = "/home/claude/blissrent-brand/scripts/luxury_insert.sql"
with open(out_path, "w") as f:
    f.write("-- Luxury fleet expansion (16 new vehicles)\n")
    f.write("INSERT INTO vehicles (id, category_id, make, model, model_year, transmission, seats, plate_number, status) VALUES\n")
    f.write(",\n".join(vehicles_sql) + ";\n\n")
    f.write("INSERT INTO pricing (vehicle_id, term, list_price, client_price, currency) VALUES\n")
    f.write(",\n".join(pricing_sql) + ";\n\n")
    f.write("INSERT INTO vehicle_images (vehicle_id, storage_path, is_primary, sort_order) VALUES\n")
    f.write(",\n".join(images_sql) + ";\n")

print("Wrote " + out_path)
print()
print("=== SUMMARY TABLE ===")
for plate, make, model, seats, terms, storage_path in rows_summary:
    print("%s | %s %s | seats=%d | daily %s | weekly %s | monthly %s | 3mo %s | img=%s" % (
        plate, make, model, seats, terms['daily'], terms['weekly'], terms['monthly'], terms['3_month'], storage_path
    ))
