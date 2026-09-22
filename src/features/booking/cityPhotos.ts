import dubai from '@/assets/cities/dubai.jpg'
import abuDhabi from '@/assets/cities/abu-dhabi.jpg'
import sharjah from '@/assets/cities/sharjah.jpg'
import ajman from '@/assets/cities/ajman.jpg'
import ummAlQuwain from '@/assets/cities/umm-al-quwain.jpg'
import rasAlKhaimah from '@/assets/cities/ras-al-khaimah.jpg'
import fujairah from '@/assets/cities/fujairah.jpg'
import alAin from '@/assets/cities/al-ain.jpg'
import dubaiLarge from '@/assets/cities/large/dubai.jpg'
import abuDhabiLarge from '@/assets/cities/large/abu-dhabi.jpg'
import sharjahLarge from '@/assets/cities/large/sharjah.jpg'
import ajmanLarge from '@/assets/cities/large/ajman.jpg'
import ummAlQuwainLarge from '@/assets/cities/large/umm-al-quwain.jpg'
import rasAlKhaimahLarge from '@/assets/cities/large/ras-al-khaimah.jpg'
import fujairahLarge from '@/assets/cities/large/fujairah.jpg'
import alAinLarge from '@/assets/cities/large/al-ain.jpg'

export interface CityPhoto {
  /** Bundled, resized (500px wide) copy — small enough for the homepage hover card. */
  src: string
  /** Bundled, larger (up to 960px wide) copy — for the city page's own photo. */
  largeSrc: string
  /** The photographer, as credited on Wikimedia Commons. */
  author: string
  /** Short license name, e.g. "CC BY-SA 4.0". */
  license: string
  /** The photo's own Wikimedia Commons page (author, license and original). */
  sourceUrl: string
}

/**
 * Real photographs of each emirate's main city, keyed by the exact
 * `locations.city` value — used by the homepage coverage map's hover cards
 * (LocationsPreviewSection) and by each city's page (CityPage). Every photo is from Wikimedia Commons under a
 * free license (CC BY or CC BY-SA, nothing "non-free"); the files here are
 * only resized copies (500px and up-to-960px wide, no other edits). Those licenses require
 * crediting the author and license, so `author`/`license`/`sourceUrl` are
 * kept next to each image, and the city's own page (CityPage.tsx) shows
 * them in the photo's caption — add or replace a photo only together with
 * its credit.
 *
 * A city with no entry simply gets no photo (the hover card falls back to a
 * plain placeholder) — never a stock image of somewhere else.
 */
export const CITY_PHOTOS: Record<string, CityPhoto> = {
  Dubai: {
    src: dubai,
    largeSrc: dubaiLarge,
    author: 'imran shahabuddin',
    license: 'CC BY 2.0',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Burj_Khalifa_(worlds_tallest_building)_and_the_Dubai_skyline_(25781049892).jpg',
  },
  'Abu Dhabi': {
    src: abuDhabi,
    largeSrc: abuDhabiLarge,
    author: 'Wadiia',
    license: 'CC BY-SA 4.0',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Abu_dhabi_skylines_2014.jpg',
  },
  Sharjah: {
    src: sharjah,
    largeSrc: sharjahLarge,
    author: 'Firoze Edassery',
    license: 'CC BY-SA 3.0',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Al_Qasba.jpg',
  },
  Ajman: {
    src: ajman,
    largeSrc: ajmanLarge,
    author: 'Ulises Icardi',
    license: 'CC BY-SA 4.0',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Palacio_del_Emir_de_Ajm%C3%A1n.jpg',
  },
  'Umm Al Quwain': {
    src: ummAlQuwain,
    largeSrc: ummAlQuwainLarge,
    author: 'Peter Dowley',
    license: 'CC BY 2.0',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Umm_Al_Quwain_mangroves_(7267363924).jpg',
  },
  'Ras Al Khaimah': {
    src: rasAlKhaimah,
    largeSrc: rasAlKhaimahLarge,
    author: 'Stevenmccombe',
    license: 'CC BY-SA 4.0',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Aerial_view_of_RAK_City_from_Al_Qawasim_Corniche_flagpole.jpg',
  },
  Fujairah: {
    src: fujairah,
    largeSrc: fujairahLarge,
    author: 'Aumars',
    license: 'CC BY-SA 4.0',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Hills_in_Fujairah_2012_01.jpg',
  },
  'Al Ain': {
    src: alAin,
    largeSrc: alAinLarge,
    author: 'Shahinmusthafa Shahin Olakara',
    license: 'CC BY-SA 3.0',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Jabal_hafeet_shahin.jpg',
  },
}
