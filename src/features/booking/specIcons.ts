import { Calendar, Car, Cog, DoorOpen, Fuel, Gauge, Globe, Route, RotateCw, Settings2, Tag, Timer, Users, Zap, type LucideIcon } from 'lucide-react'

/**
 * One icon per specification, keyed by the `key` that `src/lib/vehicleSpecs.ts`
 * gives every row — so the booking box and the full table picture the same fact
 * the same way. Kept out of the pure spec helpers so those stay free of React.
 */
const SPEC_ICONS: Record<string, LucideIcon> = {
  make: Car,
  model: Car,
  year: Calendar,
  category: Tag,
  engine: Cog,
  power: Zap,
  torque: RotateCw,
  acceleration: Timer,
  topSpeed: Gauge,
  fuelType: Fuel,
  fuelEconomy: Fuel,
  drivetrain: Route,
  transmission: Settings2,
  doors: DoorOpen,
  seats: Users,
  origin: Globe,
}

export function specIcon(key: string): LucideIcon {
  return SPEC_ICONS[key] ?? Cog
}
