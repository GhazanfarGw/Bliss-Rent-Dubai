import { postCity, type BlogCategoryId, type BlogPost } from '@/features/blog/blogPosts'
import { CITY_PHOTOS } from '@/features/booking/cityPhotos'
import dubaiRentalGuide from '@/assets/blog/dubai-rental-guide-generated.webp'
import dubaiCityItinerary from '@/assets/blog/dubai-city-itinerary-generated.webp'
import abuDhabiRoadTrip from '@/assets/blog/abu-dhabi-road-trip-generated.webp'
import dubaiDrivingTips from '@/assets/blog/dubai-driving-tips-generated.webp'
import airportRental from '@/assets/blog/dubai-airport-car-rental-generated.webp'
import rentalDocuments from '@/assets/blog/documents-needed-to-rent-a-car-uae-generated.webp'
import onlineBooking from '@/assets/blog/how-to-book-a-rental-car-online-uae-generated.webp'
import rentalCarTypes from '@/assets/blog/economy-sedan-suv-or-luxury-rental-car-generated.webp'
import rentalPeriods from '@/assets/blog/monthly-and-weekly-car-rental-uae-generated.webp'
import abuDhabiWeekend from '@/assets/blog/abu-dhabi-weekend-by-car-generated.webp'
import sharjahAjman from '@/assets/blog/sharjah-and-ajman-by-car-generated.webp'
import ummAlQuwain from '@/assets/blog/umm-al-quwain-by-car-generated.webp'
import hattaRoadTrip from '@/assets/blog/dubai-to-hatta-road-trip-generated.webp'
import jebelJaisRoadTrip from '@/assets/blog/ras-al-khaimah-jebel-jais-road-trip-generated.webp'
import fujairahRoadTrip from '@/assets/blog/fujairah-east-coast-road-trip-generated.webp'
import alAinDayTrip from '@/assets/blog/al-ain-day-trip-by-car-generated.webp'
import firstTimeDriving from '@/assets/blog/driving-in-the-uae-first-timers-checklist-generated.webp'

/**
 * Every published article has its own generated artwork, chosen from its
 * heading and content. Keep this mapping and assets/blog/generated-images.json
 * in sync when adding articles; the coverage test catches missing or reused art.
 * City/category fallbacks remain available while drafting new articles.
 */
export interface PostImage {
  src: string
  /** Licensed city-photo fallbacks must display the author and licence. */
  credit?: { author: string; license: string }
}

const ARTICLE_IMAGES: Record<string, string> = {
  'car-rental-dubai-complete-guide': dubaiRentalGuide,
  'dubai-in-three-days-by-car': dubaiCityItinerary,
  'dubai-to-abu-dhabi-road-trip': abuDhabiRoadTrip,
  'salik-parking-and-fines-uae-rental-car': dubaiDrivingTips,
  'dubai-airport-car-rental': airportRental,
  'documents-needed-to-rent-a-car-uae': rentalDocuments,
  'how-to-book-a-rental-car-online-uae': onlineBooking,
  'economy-sedan-suv-or-luxury-rental-car': rentalCarTypes,
  'monthly-and-weekly-car-rental-uae': rentalPeriods,
  'abu-dhabi-weekend-by-car': abuDhabiWeekend,
  'sharjah-and-ajman-by-car': sharjahAjman,
  'umm-al-quwain-by-car': ummAlQuwain,
  'dubai-to-hatta-road-trip': hattaRoadTrip,
  'ras-al-khaimah-jebel-jais-road-trip': jebelJaisRoadTrip,
  'fujairah-east-coast-road-trip': fujairahRoadTrip,
  'al-ain-day-trip-by-car': alAinDayTrip,
  'driving-in-the-uae-first-timers-checklist': firstTimeDriving,
}

const CATEGORY_DEFAULTS: Record<BlogCategoryId, string> = {
  'rental-guides': dubaiRentalGuide,
  'city-guides': dubaiCityItinerary,
  'road-trips': abuDhabiRoadTrip,
  'travel-tips': dubaiDrivingTips,
}

export function postImage(post: BlogPost): PostImage {
  const image = ARTICLE_IMAGES[post.slug]
  if (image) return { src: image }

  const city = postCity(post)
  const photo = city && !post.noCityPhoto ? CITY_PHOTOS[city.city] : undefined
  if (photo) return { src: photo.largeSrc, credit: { author: photo.author, license: photo.license } }

  return { src: CATEGORY_DEFAULTS[post.category] }
}
