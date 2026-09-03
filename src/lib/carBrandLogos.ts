// Named imports only (never `import * as`) — simple-icons ships thousands
// of brand marks in one module; naming exactly the ones we use lets the
// bundler tree-shake the rest out, instead of shipping the whole library.
import {
  siToyota,
  siNissan,
  siHyundai,
  siKia,
  siChevrolet,
  siSuzuki,
  siLamborghini,
  siFerrari,
  siBmw,
  siAudi,
  siHonda,
  siMazda,
  siVolkswagen,
  siFord,
  siJeep,
  siMitsubishi,
  siRenault,
  siPeugeot,
  siBentley,
  siRollsroyce,
  siPorsche,
  siMclaren,
  siMaserati,
  siBugatti,
  siCadillac,
  siInfiniti,
  siMg,
  siSkoda,
  siFiat,
  siMini,
  siAcura,
  siSubaru,
  siChrysler,
  siRam,
  siVolvo,
  siTesla,
  siOpel,
  siSeat,
  siCitroen,
  siAstonmartin,
  siProton,
  siTata,
  siSmart,
  siPolestar,
} from 'simple-icons'

export interface BrandLogo {
  title: string
  /** Official brand color, as published by simple-icons — hex without the leading '#'. */
  hex: string
  /** SVG path data for the logo mark, in a 24x24 viewBox. */
  path: string
}

/**
 * Real car-brand logos (Phase 11) — sourced from `simple-icons`, a
 * CC0-licensed open-source library of official brand marks. This
 * replaces BrandsMarquee's earlier hand-drawn approximations (which its
 * own prior comment already flagged as "a styling convenience, not a
 * source of truth"): every entry below is the brand's actual, accurate
 * logo shape, not an invented or AI-generated stand-in. `vehicles.make`
 * is a free-text field admins type when adding a car, so lookup is
 * normalized (lowercase, punctuation/spaces stripped) rather than an
 * exact-string match. A make with no entry here — because it isn't a
 * common rental-fleet brand, or simple-icons doesn't carry it (e.g. Land
 * Rover, Mercedes-Benz, Lexus, GMC, Genesis, Jaguar, Lincoln, Dodge at
 * the time of writing) — falls back to BrandsMarquee's plain initials
 * badge instead of a fabricated logo, exactly as before.
 */
const BRAND_LOGOS: Record<string, BrandLogo> = {
  toyota: siToyota,
  nissan: siNissan,
  hyundai: siHyundai,
  kia: siKia,
  chevrolet: siChevrolet,
  chevy: siChevrolet,
  suzuki: siSuzuki,
  lamborghini: siLamborghini,
  ferrari: siFerrari,
  bmw: siBmw,
  audi: siAudi,
  honda: siHonda,
  mazda: siMazda,
  volkswagen: siVolkswagen,
  vw: siVolkswagen,
  ford: siFord,
  jeep: siJeep,
  mitsubishi: siMitsubishi,
  renault: siRenault,
  peugeot: siPeugeot,
  bentley: siBentley,
  rollsroyce: siRollsroyce,
  porsche: siPorsche,
  mclaren: siMclaren,
  maserati: siMaserati,
  bugatti: siBugatti,
  cadillac: siCadillac,
  infiniti: siInfiniti,
  mg: siMg,
  skoda: siSkoda,
  fiat: siFiat,
  mini: siMini,
  acura: siAcura,
  subaru: siSubaru,
  chrysler: siChrysler,
  ram: siRam,
  volvo: siVolvo,
  tesla: siTesla,
  opel: siOpel,
  seat: siSeat,
  citroen: siCitroen,
  astonmartin: siAstonmartin,
  proton: siProton,
  tata: siTata,
  smart: siSmart,
  polestar: siPolestar,
}

/** lowercase + strip everything but letters/digits, so "Land Rover",
 *  "Mercedes-Benz", "VW", "Rolls Royce" etc. all normalize predictably. */
function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function getBrandLogo(make: string): BrandLogo | null {
  return BRAND_LOGOS[normalize(make)] ?? null
}
