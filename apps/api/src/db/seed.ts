import { fileURLToPath } from 'node:url'
import { addDays, galleryImages as g, images, quoteStay, todayISO } from '@meridian/shared'
import { hashPassword } from '../lib/passwords'
import { newBookingCode } from '../lib/bookingCode'
import { pool, query, queryOne, transaction, type Queryable } from './pool'

// Demo data for development and client previews. Everything is fictional.
// Dates are relative to the day the seed runs, so there are always past and upcoming stays.

/** Password for every demo account. Development and staging only. */
export const DEMO_PASSWORD = 'meridian123'

const amenities: [name: string, icon: string][] = [
  ['Wifi', 'wifi'], ['Free parking', 'square-parking'], ['Breakfast included', 'mug-hot'], ['Kitchen', 'kitchen-set'],
  ['Garden', 'seedling'], ['Bonfire area', 'fire'], ['Pet friendly', 'paw'], ['Infinity pool', 'water-ladder'],
  ['Private pool', 'water-ladder'], ['Spa', 'spa'], ['Restaurant', 'utensils'], ['Air conditioning', 'snowflake'],
  ['Room service', 'bell-concierge'], ['Fireplace', 'fire-flame-curved'], ['Heating', 'temperature-arrow-up'],
  ['Mountain view', 'mountain-sun'], ['Game room', 'chess'], ['Chef on request', 'utensils'], ['Vineyard tours', 'wine-glass'],
  ['Kid friendly', 'children'], ['Rainforest view', 'tree'], ['Yoga deck', 'om'],
]

type Role = 'guest' | 'host' | 'admin'
const users: { key: string; name: string; role: Role; avatar?: string; phone?: string; suspended?: boolean; joinedDaysAgo: number }[] = [
  { key: 'admin', name: 'Aarav Sharma', role: 'admin', joinedDaysAgo: 400 },
  { key: 'ops', name: 'Ishita Bose', role: 'admin', joinedDaysAgo: 210 },
  { key: 'meera', name: 'Meera Nair', role: 'host', phone: '+91 98450 11223', joinedDaysAgo: 380 },
  { key: 'karan', name: 'Karan Mehta', role: 'host', phone: '+91 98200 44556', joinedDaysAgo: 350 },
  { key: 'tenzin', name: 'Tenzin Dorje', role: 'host', phone: '+91 94340 77881', joinedDaysAgo: 260 },
  { key: 'anjali', name: 'Anjali Rao', role: 'host', phone: '+91 98220 33445', joinedDaysAgo: 190 },
  { key: 'farhan', name: 'Farhan Qureshi', role: 'host', phone: '+91 94140 66778', joinedDaysAgo: 120 },
  { key: 'rohit', name: 'Rohit Verma', role: 'host', phone: '+91 99170 22334', joinedDaysAgo: 75 },
  { key: 'priya', name: 'Priya Natarajan', role: 'guest', avatar: images.avatar, phone: '+91 98765 43210', joinedDaysAgo: 300 },
  { key: 'sid', name: 'Siddharth Kumar', role: 'guest', phone: '+91 90000 12345', joinedDaysAgo: 240 },
  { key: 'ananya', name: 'Ananya Sen', role: 'guest', phone: '+91 98300 55667', joinedDaysAgo: 170 },
  { key: 'rahul', name: 'Rahul Menon', role: 'guest', phone: '+91 94470 88990', joinedDaysAgo: 150 },
  { key: 'neha', name: 'Neha Kapoor', role: 'guest', phone: '+91 98110 99887', joinedDaysAgo: 140 },
  { key: 'maya', name: 'Maya Dsouza', role: 'guest', phone: '+91 98230 11009', joinedDaysAgo: 90 },
  { key: 'arjun', name: 'Arjun Iyer', role: 'guest', phone: '+91 99400 77665', joinedDaysAgo: 45 },
  { key: 'vikram', name: 'Vikram Pillai', role: 'guest', suspended: true, joinedDaysAgo: 60 },
]
const email = (key: string) => `${key}@meridianstay.test`

interface SeedProperty {
  slug: string; host: string; title: string; type: string; city: string; region: string; country?: string
  price: number; rating: number; reviewCount: number; beds: number; baths: number; maxGuests: number
  status: 'Approved' | 'Pending' | 'Rejected' | 'Draft'; rejectionReason?: string; featured?: number
  cover: string; photos: string[]; amenities: string[]; lat: number; lng: number; description: string
  reviews: [author: string, rating: number, comment: string, daysAgo: number][]
}

const properties: SeedProperty[] = [
  {
    slug: 'green-valley-organic-farmstay', host: 'meera', title: 'Green Valley Organic Farmstay', type: 'Farmstay',
    city: 'Coorg', region: 'Karnataka', price: 145, rating: 4.92, reviewCount: 128, beds: 3, baths: 2, maxGuests: 6, status: 'Approved', featured: 1,
    cover: images.farmstay, photos: [g.livingCozy, g.kitchen, g.bedroomClassic, g.spa],
    amenities: ['Wifi', 'Free parking', 'Breakfast included', 'Kitchen', 'Garden', 'Bonfire area', 'Pet friendly'], lat: 12.4244, lng: 75.7382,
    description: 'Wake up to the aroma of coffee blossoms and fresh organic breakfasts. Enjoy guided plantation walks and bonfire evenings.\n\nThe farmhouse sits on a working coffee and pepper estate. Three bedrooms open onto a wraparound veranda, and meals are cooked with produce picked the same morning.',
    reviews: [['Rohan D.', 5, 'Peaceful, spotless and the hosts made us feel like family.', 200], ['Kavya S.', 5, 'The plantation walk at sunrise was magical. Food was outstanding.', 150]],
  },
  {
    slug: 'golden-sunset-hillside-resort', host: 'karan', title: 'Golden Sunset Hillside Resort', type: 'Resort',
    city: 'Wayanad', region: 'Kerala', price: 240, rating: 4.88, reviewCount: 94, beds: 4, baths: 4, maxGuests: 8, status: 'Approved', featured: 2,
    cover: images.resort, photos: [g.poolDusk, g.mountainDeck, g.spa, g.bedroomDark],
    amenities: ['Wifi', 'Infinity pool', 'Spa', 'Restaurant', 'Air conditioning', 'Free parking', 'Room service'], lat: 11.6854, lng: 76.132,
    description: 'A luxurious mountain resort with infinity pool overlooking misty green valleys and world-class spa facilities.\n\nFour spacious suites, an in-house restaurant serving Kerala cuisine, and sunset views from every balcony.',
    reviews: [['Rahul M.', 5, 'World-class infinity pool and the views at sunset are unreal.', 90], ['Deepa K.', 4, 'Beautiful property. The spa was a highlight, the Wi-Fi less so.', 60]],
  },
  {
    slug: 'whispering-pines-forest-cottage', host: 'meera', title: 'Whispering Pines Forest Cottage', type: 'Cottage',
    city: 'Manali', region: 'Himachal Pradesh', price: 120, rating: 4.95, reviewCount: 210, beds: 2, baths: 1, maxGuests: 4, status: 'Approved', featured: 3,
    cover: images.cottage, photos: [g.forestCabin, g.livingCozy, g.bedroomClassic, g.kitchen],
    amenities: ['Wifi', 'Fireplace', 'Heating', 'Kitchen', 'Mountain view', 'Free parking'], lat: 32.2432, lng: 77.1892,
    description: 'A rustic wooden cabin nestled inside pine forests with mountain views, fireplace, and stargazing deck.\n\nIt’s a ten-minute walk to Old Manali’s cafés, yet you’ll hear nothing but the river at night.',
    reviews: [['Kabir T.', 5, 'Cosiest cabin we have ever stayed in. The fireplace and the stars made it.', 120]],
  },
  {
    slug: 'emerald-luxury-pool-villa', host: 'karan', title: 'Emerald Luxury Pool Villa', type: 'Villa',
    city: 'Lonavala', region: 'Maharashtra', price: 320, rating: 4.97, reviewCount: 82, beds: 5, baths: 5, maxGuests: 10, status: 'Approved', featured: 4,
    cover: images.villa, photos: [g.villaPool, g.livingBright, g.bedroomClassic, g.kitchen],
    amenities: ['Wifi', 'Private pool', 'Air conditioning', 'Kitchen', 'Game room', 'Chef on request', 'Free parking'], lat: 18.7537, lng: 73.4068,
    description: 'An architectural masterpiece featuring private plunge pool, manicured lawns, indoor game lounge, and private chef on request.\n\nIdeal for families and groups of friends, two hours from Mumbai and Pune.',
    reviews: [['Vikas P.', 5, 'Perfect for our family reunion. The pool and lawns kept the kids busy all weekend.', 45]],
  },
  {
    slug: 'sunny-citrus-farm-estate', host: 'meera', title: 'Sunny Citrus Farm & Estate', type: 'Farmstay',
    city: 'Nashik', region: 'Maharashtra', price: 160, rating: 4.85, reviewCount: 64, beds: 3, baths: 2, maxGuests: 6, status: 'Approved', featured: 5,
    cover: images.citrusFarm, photos: [images.farmstay, g.apartment, g.bedroomClassic, g.kitchen],
    amenities: ['Wifi', 'Vineyard tours', 'Breakfast included', 'Garden', 'Free parking', 'Kid friendly'], lat: 19.9975, lng: 73.7898,
    description: 'Experience vineyard tours and citrus picking in a sprawling eco-friendly family farmstay.\n\nThe estate runs on solar power and harvests rainwater. Children can help feed the animals every morning.',
    reviews: [['Neha K.', 4, 'Lovely farm and wonderful hosts. The vineyard tour is a must.', 70]],
  },
  {
    slug: 'bamboo-zen-treehouse-cottage', host: 'karan', title: 'Bamboo Zen Treehouse Cottage', type: 'Cottage',
    city: 'Ubud', region: 'Bali', country: 'Indonesia', price: 195, rating: 4.99, reviewCount: 312, beds: 1, baths: 1, maxGuests: 2, status: 'Approved', featured: 6,
    cover: images.treehouse, photos: [g.mountainDeck, g.cliffPool, g.spa, g.bedroomDark],
    amenities: ['Wifi', 'Rainforest view', 'Breakfast included', 'Yoga deck', 'Air conditioning'], lat: -8.5069, lng: 115.2625,
    description: 'A stunning architectural bamboo treehouse overlooking lush green tropical rainforests and river streams.\n\nBuilt for two, with an open-air bath, a yoga deck and breakfast delivered in a basket each morning.',
    reviews: [['Maya L.', 5, 'Magical. Falling asleep to the sound of the river was unforgettable.', 30]],
  },
  {
    slug: 'alleppey-backwater-houseboat', host: 'meera', title: 'Alleppey Backwater Houseboat', type: 'Cottage',
    city: 'Alleppey', region: 'Kerala', price: 175, rating: 4.96, reviewCount: 143, beds: 2, baths: 2, maxGuests: 4, status: 'Approved',
    cover: g.houseboat, photos: [g.backwaters, g.bedroomDark, g.kitchen],
    amenities: ['Air conditioning', 'Breakfast included', 'Room service', 'Wifi'], lat: 9.4981, lng: 76.3388,
    description: 'A traditional kettuvallam houseboat with two air-conditioned bedrooms, drifting through palm-lined backwaters.\n\nYour crew cooks Kerala meals on board and moors each evening in a quiet village canal.',
    reviews: [['Sanjana R.', 5, 'The crew’s fish curry and the sunset over the paddy fields were unforgettable.', 110]],
  },
  {
    slug: 'himalayan-pine-view-resort', host: 'tenzin', title: 'Himalayan Pine View Resort', type: 'Resort',
    city: 'Gangtok', region: 'Sikkim', price: 210, rating: 4.9, reviewCount: 118, beds: 4, baths: 4, maxGuests: 8, status: 'Approved',
    cover: g.himalaya, photos: [g.mountainDeck, g.spa, g.bedroomDark, g.livingCozy],
    amenities: ['Wifi', 'Mountain view', 'Restaurant', 'Spa', 'Heating', 'Room service'], lat: 27.3389, lng: 88.6065,
    description: 'Wake up to Kanchenjunga from your balcony at this family-run resort above Gangtok.\n\nMomos in the restaurant, a hot-stone spa after long hikes, and monastery visits arranged by the hosts.',
    reviews: [['Aditya G.', 5, 'Clear views of Kanchenjunga at dawn and the warmest hosts.', 40]],
  },
  {
    slug: 'naggar-apple-orchard-farmstay', host: 'tenzin', title: 'Naggar Apple Orchard Farmstay', type: 'Farmstay',
    city: 'Naggar', region: 'Himachal Pradesh', price: 98, rating: 4.83, reviewCount: 52, beds: 2, baths: 1, maxGuests: 5, status: 'Approved',
    cover: g.gardenCottage, photos: [g.livingCozy, g.kitchen, g.bedroomClassic],
    amenities: ['Wifi', 'Garden', 'Breakfast included', 'Heating', 'Mountain view', 'Kid friendly'], lat: 32.1167, lng: 77.1667,
    description: 'A wooden farmhouse in a working apple orchard above the Kullu valley.\n\nPick apples in season, walk to Naggar Castle, and end the day with home-made cider by the stove.',
    reviews: [['Ira P.', 5, 'Our kids loved picking apples. Simple, clean and very peaceful.', 25]],
  },
  {
    slug: 'jaipur-heritage-haveli-room', host: 'farhan', title: 'Heritage Haveli Courtyard Room', type: 'Room',
    city: 'Jaipur', region: 'Rajasthan', price: 95, rating: 4.81, reviewCount: 57, beds: 1, baths: 1, maxGuests: 2, status: 'Approved',
    cover: g.hotelRoom, photos: [g.jaipurPalace, g.jaipurFort, g.brightRoom],
    amenities: ['Wifi', 'Air conditioning', 'Breakfast included', 'Room service'], lat: 26.9239, lng: 75.8267,
    description: 'A private room in a restored 19th-century haveli, a short walk from Hawa Mahal.\n\nBreakfast is served in the painted courtyard, and the rooftop has views over the old city.',
    reviews: [['Tara B.', 5, 'Stunning haveli right in the old city. Rooftop breakfast was a treat.', 35]],
  },
  {
    slug: 'rishikesh-riverside-homestay-room', host: 'rohit', title: 'Riverside Homestay Room', type: 'Room',
    city: 'Rishikesh', region: 'Uttarakhand', price: 65, rating: 4.76, reviewCount: 41, beds: 1, baths: 1, maxGuests: 2, status: 'Approved',
    cover: g.brightRoom, photos: [g.livingCozy, g.mountainDeck],
    amenities: ['Wifi', 'Mountain view', 'Breakfast included', 'Yoga deck'], lat: 30.0869, lng: 78.2676,
    description: 'A bright private room in a family home a few steps from the Ganga.\n\nMorning yoga on the terrace, evening aarti at the ghats, and home-cooked vegetarian meals.',
    reviews: [['Jonas W.', 5, 'Kind family, great food and the yoga deck faces the river.', 20]],
  },
  {
    slug: 'assagao-coconut-grove-villa', host: 'anjali', title: 'Coconut Grove Pool Villa', type: 'Villa',
    city: 'Assagao', region: 'Goa', price: 280, rating: 4.93, reviewCount: 76, beds: 4, baths: 4, maxGuests: 8, status: 'Approved',
    cover: g.modernVilla, photos: [g.beachPool, g.livingBright, g.bedroomClassic, g.kitchen],
    amenities: ['Wifi', 'Private pool', 'Air conditioning', 'Kitchen', 'Free parking', 'Pet friendly'], lat: 15.5937, lng: 73.7652,
    description: 'A Portuguese-style villa in a quiet coconut grove, ten minutes from Anjuna beach.\n\nFour en-suite bedrooms, a private pool and a caretaker who can arrange a Goan cook.',
    reviews: [['Karthik N.', 5, 'Gorgeous villa, spotless pool and perfectly placed for north Goa.', 55]],
  },
  {
    slug: 'gokarna-cliffside-resort', host: 'anjali', title: 'Gokarna Cliffside Resort', type: 'Resort',
    city: 'Gokarna', region: 'Karnataka', price: 230, rating: 4.87, reviewCount: 66, beds: 5, baths: 5, maxGuests: 10, status: 'Approved',
    cover: g.seasideResort, photos: [g.cliffPool, g.beachPool, g.spa, g.bedroomClassic],
    amenities: ['Wifi', 'Infinity pool', 'Restaurant', 'Spa', 'Air conditioning'], lat: 14.5479, lng: 74.3188,
    description: 'Suites above Om Beach with an infinity pool facing the Arabian Sea.\n\nWalk the cliff trail to Half Moon beach, then come back for seafood on the terrace.',
    reviews: [['Leela M.', 4, 'Breathtaking location. Service was a little slow at dinner.', 15]],
  },
  {
    slug: 'sunrise-garden-view-private-room', host: 'meera', title: 'Sunrise Garden View Private Room', type: 'Room',
    city: 'Ooty', region: 'Tamil Nadu', price: 80, rating: 0, reviewCount: 0, beds: 1, baths: 1, maxGuests: 2, status: 'Pending',
    cover: images.room, photos: [g.apartment, g.bedroomClassic],
    amenities: ['Wifi', 'Garden', 'Heating', 'Breakfast included'], lat: 11.4102, lng: 76.695,
    description: 'A cozy private room with ensuite bathroom and gorgeous hillside garden views.', reviews: [],
  },
  {
    slug: 'chikmagalur-coffee-estate-bungalow', host: 'meera', title: 'Coffee Estate Bungalow', type: 'Farmstay',
    city: 'Chikmagalur', region: 'Karnataka', price: 185, rating: 0, reviewCount: 0, beds: 3, baths: 3, maxGuests: 6, status: 'Pending',
    cover: g.livingBright, photos: [g.bedroomClassic, g.kitchen],
    amenities: ['Wifi', 'Breakfast included', 'Garden', 'Free parking', 'Bonfire area'], lat: 13.3161, lng: 75.772,
    description: 'A colonial planter’s bungalow on a 40-acre coffee estate, with estate tours and tastings.', reviews: [],
  },
  {
    slug: 'thar-desert-glamping-camp', host: 'farhan', title: 'Thar Desert Glamping Camp', type: 'Resort',
    city: 'Jaisalmer', region: 'Rajasthan', price: 150, rating: 0, reviewCount: 0, beds: 6, baths: 6, maxGuests: 12, status: 'Rejected',
    rejectionReason: 'Please add photos of the tents and bathrooms, and describe how guests reach the camp from Jaisalmer.',
    cover: g.tentView, photos: [], amenities: ['Bonfire area', 'Restaurant'], lat: 26.9157, lng: 70.9083,
    description: 'Luxury tents in the dunes with folk music, camel rides and dinner under the stars.', reviews: [],
  },
  {
    slug: 'nainital-lakeview-stone-cottage', host: 'rohit', title: 'Lakeview Stone Cottage', type: 'Cottage',
    city: 'Nainital', region: 'Uttarakhand', price: 130, rating: 4.7, reviewCount: 23, beds: 2, baths: 1, maxGuests: 4, status: 'Draft',
    cover: g.forestCabin, photos: [g.livingCozy, g.bedroomClassic],
    amenities: ['Wifi', 'Fireplace', 'Mountain view', 'Kitchen'], lat: 29.3919, lng: 79.4542,
    description: 'A stone cottage above Naini Lake, paused by the host during renovation.', reviews: [],
  },
]

interface SeedBooking {
  property: string; guest: string; start: number; nights: number; guests: number
  status?: 'Confirmed' | 'Cancelled'; method?: 'upi' | 'card' | 'netbanking'; requests?: string
  review?: [rating: number, comment: string]
}

const bookings: SeedBooking[] = [
  // Priya: the main demo guest has something in every state.
  { property: 'green-valley-organic-farmstay', guest: 'priya', start: 12, nights: 5, guests: 2, requests: 'We’ll arrive around 4 pm. Vegetarian meals please.' },
  { property: 'whispering-pines-forest-cottage', guest: 'priya', start: 60, nights: 4, guests: 3 },
  { property: 'assagao-coconut-grove-villa', guest: 'priya', start: 100, nights: 4, guests: 4, method: 'card' },
  { property: 'sunny-citrus-farm-estate', guest: 'priya', start: -40, nights: 2, guests: 2 }, // completed, not yet reviewed
  { property: 'alleppey-backwater-houseboat', guest: 'priya', start: -95, nights: 3, guests: 2, review: [5, 'Floating through the backwaters for three days was the best trip we’ve taken. Superb food on board.'] },
  { property: 'emerald-luxury-pool-villa', guest: 'priya', start: 30, nights: 2, guests: 4, status: 'Cancelled' },
  { property: 'golden-sunset-hillside-resort', guest: 'sid', start: 20, nights: 3, guests: 2, method: 'card' },
  { property: 'emerald-luxury-pool-villa', guest: 'sid', start: 5, nights: 2, guests: 6, requests: 'Celebrating a birthday. Could the chef bake a cake?' },
  { property: 'jaipur-heritage-haveli-room', guest: 'sid', start: -20, nights: 2, guests: 2, review: [5, 'Beautiful haveli, helpful host and a perfect base for the old city.'] },
  { property: 'himalayan-pine-view-resort', guest: 'ananya', start: 8, nights: 4, guests: 3 },
  { property: 'alleppey-backwater-houseboat', guest: 'ananya', start: 45, nights: 2, guests: 2, method: 'netbanking' },
  { property: 'whispering-pines-forest-cottage', guest: 'ananya', start: -60, nights: 3, guests: 2, review: [5, 'Snow outside, fire inside. Exactly what we hoped for.'] },
  { property: 'assagao-coconut-grove-villa', guest: 'rahul', start: 2, nights: 3, guests: 6 },
  { property: 'gokarna-cliffside-resort', guest: 'rahul', start: -10, nights: 3, guests: 4, review: [4, 'Incredible views and pool. Dinner service could be quicker.'] },
  { property: 'jaipur-heritage-haveli-room', guest: 'neha', start: 15, nights: 2, guests: 2 },
  { property: 'bamboo-zen-treehouse-cottage', guest: 'neha', start: 33, nights: 5, guests: 2, method: 'card' },
  { property: 'green-valley-organic-farmstay', guest: 'neha', start: -120, nights: 3, guests: 4, review: [5, 'Kids loved the farm animals and we loved the coffee.'] },
  { property: 'rishikesh-riverside-homestay-room', guest: 'maya', start: 3, nights: 3, guests: 1 },
  { property: 'himalayan-pine-view-resort', guest: 'maya', start: -30, nights: 3, guests: 2 },
  { property: 'golden-sunset-hillside-resort', guest: 'maya', start: 50, nights: 2, guests: 2, status: 'Cancelled' },
  { property: 'emerald-luxury-pool-villa', guest: 'arjun', start: 70, nights: 3, guests: 8, requests: 'Team offsite. We’ll need the game room.' },
  { property: 'naggar-apple-orchard-farmstay', guest: 'arjun', start: 25, nights: 4, guests: 4 },
  { property: 'gokarna-cliffside-resort', guest: 'vikram', start: 40, nights: 2, guests: 2, status: 'Cancelled' },
]

const messages: [name: string, email: string, topic: string, message: string, status: 'new' | 'read' | 'closed', daysAgo: number][] = [
  ['Asha Kulkarni', 'asha.k@example.com', 'Hosting', 'I have two cottages near Coorg. Can I list both under one account?', 'new', 1],
  ['Dev Malhotra', 'dev.m@example.com', 'Booking help', 'Can I change the dates of my houseboat booking instead of cancelling?', 'new', 2],
  ['Ritu Sharma', 'ritu@example.com', 'Payments & refunds', 'When will online payments be available? I’d like to pay by UPI.', 'read', 6],
  ['The Travel Desk', 'press@example.com', 'Press', 'We’re writing about farmstays in South India and would love to feature Meridian Stay.', 'read', 9],
  ['Kiran Joshi', 'kiran.j@example.com', 'Trust & safety', 'A listing I viewed used photos I think belong to another property.', 'closed', 20],
]

async function insertBooking(db: Queryable, propertyId: number, price: number, guestId: number, b: SeedBooking, today: string) {
  const checkIn = addDays(today, b.start)
  const checkOut = addDays(checkIn, b.nights)
  const q = quoteStay(price, checkIn, checkOut, b.guests)
  const row = await queryOne<{ id: number }>(
    `INSERT INTO bookings (code, property_id, guest_id, check_in, check_out, nights, guests, currency, price_per_night_minor,
       base_amount_minor, extra_guest_amount_minor, service_fee_minor, total_minor, status, payment_method, payment_status,
       contact_phone, special_requests, created_at, cancelled_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'USD',$8,$9,$10,$11,$12,$13::booking_status,$14,'test',$15,$16,
       ($4::date - interval '21 days'), CASE WHEN $13::booking_status = 'Cancelled' THEN ($4::date - interval '7 days') END)
     RETURNING id`,
    [newBookingCode(), propertyId, guestId, checkIn, checkOut, q.nights, b.guests, q.pricePerNight * 100, q.baseAmount * 100,
      q.extraGuestAmount * 100, q.serviceFee * 100, q.total * 100, b.status ?? 'Confirmed', b.method ?? 'upi',
      users.find((u) => u.key === b.guest)?.phone ?? '+91 90000 00000', b.requests ?? null],
    db,
  )
  return { id: row!.id, checkOut }
}

/** Inserts demo data into an empty database. Returns false if users already exist. */
export async function seed(log = console.log): Promise<boolean> {
  const existing = await queryOne<{ n: number }>('SELECT count(*)::int AS n FROM users')
  if (existing && existing.n > 0) return false
  const today = todayISO()

  await transaction(async (db) => {
    const amenityIds = new Map<string, number>()
    for (const [name, icon] of amenities) {
      const row = await queryOne<{ id: number }>(
        'INSERT INTO amenities (name, icon) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET icon = EXCLUDED.icon RETURNING id', [name, icon], db)
      amenityIds.set(name, row!.id)
    }

    const passwordHash = hashPassword(DEMO_PASSWORD)
    const userIds = new Map<string, number>()
    for (const u of users) {
      const row = await queryOne<{ id: number }>(
        `INSERT INTO users (name, email, role, avatar_url, phone, password_hash, created_at, suspended_at)
         VALUES ($1, $2, $3, $4, $5, $6, now() - make_interval(days => $7), CASE WHEN $8 THEN now() - interval '10 days' END) RETURNING id`,
        [u.name, email(u.key), u.role, u.avatar ?? null, u.phone ?? null, passwordHash, u.joinedDaysAgo, !!u.suspended], db,
      )
      userIds.set(u.key, row!.id)
    }

    const props = new Map<string, { id: number; price: number }>()
    for (const p of properties) {
      const row = await queryOne<{ id: number }>(
        `INSERT INTO properties (slug, host_id, title, type, description, city, region, country, latitude, longitude,
           price_per_night_minor, bedrooms, bathrooms, max_guests, status, rejection_reason, cover_image_url, rating_avg,
           review_count, featured_rank, approved_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::listing_status,$16,$17,$18,$19,$20,
           CASE WHEN $15::listing_status = 'Approved' THEN now() - interval '30 days' END)
         RETURNING id`,
        [p.slug, userIds.get(p.host), p.title, p.type, p.description, p.city, p.region, p.country ?? 'India', p.lat, p.lng,
          p.price * 100, p.beds, p.baths, p.maxGuests, p.status, p.rejectionReason ?? null, p.cover, p.rating, p.reviewCount,
          p.featured ?? null], db,
      )
      const id = row!.id
      props.set(p.slug, { id, price: p.price })
      for (const [i, url] of p.photos.entries()) {
        await query('INSERT INTO property_photos (property_id, url, position) VALUES ($1, $2, $3)', [id, url, i], db)
      }
      for (const name of p.amenities) {
        await query('INSERT INTO property_amenities (property_id, amenity_id) VALUES ($1, $2)', [id, amenityIds.get(name)], db)
      }
      // Earlier reviews (rating_avg / review_count above already include them).
      for (const [author, rating, comment, daysAgo] of p.reviews) {
        await query(
          `INSERT INTO reviews (property_id, author_name, rating, comment, created_at) VALUES ($1, $2, $3, $4, now() - make_interval(days => $5))`,
          [id, author, rating, comment, daysAgo], db)
      }
    }

    // A spam review that an admin has already hidden, to show moderation.
    await query(
      `INSERT INTO reviews (property_id, author_name, rating, comment, created_at, hidden_at)
       VALUES ($1, 'Unknown', 1, 'Don’t book here!!! Message me on WhatsApp for cheaper rooms nearby.', now() - interval '12 days', now() - interval '11 days')`,
      [props.get('assagao-coconut-grove-villa')!.id], db)

    for (const b of bookings) {
      const p = props.get(b.property)!
      const guestId = userIds.get(b.guest)!
      const { id, checkOut } = await insertBooking(db, p.id, p.price, guestId, b, today)
      if (b.review) {
        const u = users.find((x) => x.key === b.guest)!
        const [first, ...rest] = u.name.split(' ')
        await query(
          `INSERT INTO reviews (property_id, user_id, booking_id, author_name, rating, comment, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7::date + interval '2 days')`,
          [p.id, guestId, id, `${first} ${rest[rest.length - 1][0]}.`, b.review[0], b.review[1], checkOut], db)
        await query(
          `UPDATE properties SET rating_avg = round((rating_avg * review_count + $2) / (review_count + 1), 2), review_count = review_count + 1 WHERE id = $1`,
          [p.id, b.review[0]], db)
      }
    }

    const block = (slug: string, start: number, nights: number, note: string) =>
      query('INSERT INTO availability_blocks (property_id, start_date, end_date, note) VALUES ($1, $2, $3, $4)',
        [props.get(slug)!.id, addDays(today, start), addDays(today, start + nights), note], db)
    await block('whispering-pines-forest-cottage', 25, 3, 'Chimney maintenance')
    await block('himalayan-pine-view-resort', 40, 4, 'Staff holiday')
    await block('assagao-coconut-grove-villa', 20, 5, 'Family visiting')

    const wishlists: Record<string, string[]> = {
      priya: ['green-valley-organic-farmstay', 'whispering-pines-forest-cottage', 'bamboo-zen-treehouse-cottage', 'himalayan-pine-view-resort', 'jaipur-heritage-haveli-room'],
      sid: ['emerald-luxury-pool-villa', 'gokarna-cliffside-resort'],
      ananya: ['alleppey-backwater-houseboat', 'naggar-apple-orchard-farmstay'],
      neha: ['bamboo-zen-treehouse-cottage'],
    }
    for (const [who, slugs] of Object.entries(wishlists)) {
      for (const slug of slugs) {
        await query('INSERT INTO wishlist_items (user_id, property_id) VALUES ($1, $2)', [userIds.get(who), props.get(slug)!.id], db)
      }
    }

    for (const [name, mail, topic, message, status, daysAgo] of messages) {
      await query(
        `INSERT INTO contact_messages (name, email, topic, message, status, created_at) VALUES ($1, $2, $3, $4, $5, now() - make_interval(days => $6))`,
        [name, mail, topic, message, status, daysAgo], db)
    }

    // Recent control-center history.
    const audit: [admin: string, action: string, type: string, target: string, details: object, daysAgo: number][] = [
      ['admin', 'listing.approve', 'property', String(props.get('gokarna-cliffside-resort')!.id), {}, 30],
      ['ops', 'listing.approve', 'property', String(props.get('rishikesh-riverside-homestay-room')!.id), {}, 28],
      ['admin', 'listing.feature', 'property', String(props.get('bamboo-zen-treehouse-cottage')!.id), { rank: 6 }, 27],
      ['ops', 'listing.reject', 'property', String(props.get('thar-desert-glamping-camp')!.id),
        { reason: properties.find((p) => p.slug === 'thar-desert-glamping-camp')!.rejectionReason }, 14],
      ['admin', 'review.hide', 'review', 'spam', {}, 11],
      ['admin', 'user.suspend', 'user', String(userIds.get('vikram')), {}, 10],
      ['ops', 'message.status', 'message', 'closed', { status: 'closed' }, 5],
    ]
    for (const [admin, action, type, target, details, daysAgo] of audit) {
      await query(
        `INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details, created_at) VALUES ($1, $2, $3, $4, $5, now() - make_interval(days => $6))`,
        [userIds.get(admin), action, type, target, JSON.stringify(details), daysAgo], db)
    }

    // A visible announcement so the preview shows the banner.
    await query(
      `INSERT INTO site_settings (key, value) VALUES ('announcement', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [JSON.stringify({ enabled: true, text: 'Preview mode: explore freely. Bookings are confirmed without taking payment.', linkLabel: 'How it works', linkUrl: '/how-it-works' })], db)
  })

  log(`Seeded demo data: ${users.length} users, ${properties.length} listings, ${bookings.length} bookings. Password for every demo account: "${DEMO_PASSWORD}".`)
  return true
}

// `npm run db:seed`
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seed()
    .then((seeded) => { if (!seeded) console.log('Database already has users; nothing seeded.') })
    .catch((err) => { console.error(err.message); process.exitCode = 1 })
    .finally(() => pool.end())
}
