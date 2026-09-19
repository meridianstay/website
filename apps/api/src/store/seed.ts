import { fileURLToPath } from 'node:url'
import { addDays, commissionMinor, defaultCommission, galleryImages as g, images, quoteStay, REQUEST_HOURS, todayISO } from '@meridian/shared'
import { auth } from './firebase'
import { C, col, datesOf, daysOf, firestore, nightsOf } from './seedHelpers'
import { newBookingCode } from '../services/bookings'
import { reviewerName } from '../services/reviews'

// Demo data for development and client previews. Everything is fictional.
// Dates are relative to the day the seed runs, so there are always past and upcoming stays.
// Every demo account signs in with a test phone number (see DEMO_PHONES) and the code DEMO_OTP.

/** Code for the demo test phone numbers (add them in Firebase: Authentication → Sign-in method → Phone). */
export const DEMO_OTP = '123456'

const amenities: [name: string, icon: string][] = [
  ['Wifi', 'wifi'], ['Free parking', 'square-parking'], ['Breakfast included', 'mug-hot'], ['Kitchen', 'kitchen-set'],
  ['Garden', 'seedling'], ['Bonfire area', 'fire'], ['Pet friendly', 'paw'], ['Infinity pool', 'water-ladder'],
  ['Private pool', 'water-ladder'], ['Spa', 'spa'], ['Restaurant', 'utensils'], ['Air conditioning', 'snowflake'],
  ['Room service', 'bell-concierge'], ['Fireplace', 'fire-flame-curved'], ['Heating', 'temperature-arrow-up'],
  ['Mountain view', 'mountain-sun'], ['Game room', 'chess'], ['Chef on request', 'utensils'], ['Vineyard tours', 'wine-glass'],
  ['Kid friendly', 'children'], ['Rainforest view', 'tree'], ['Yoga deck', 'om'],
]

type Role = 'guest' | 'host' | 'admin'
/** Demo people. `phone` doubles as their Firebase test sign-in number. */
export const users: { key: string; name: string; role: Role; phone: string; avatar?: string; suspended?: boolean; joinedDaysAgo: number }[] = [
  { key: 'admin', name: 'Aarav Sharma', role: 'admin', phone: '+919000000001', joinedDaysAgo: 400 },
  { key: 'ops', name: 'Ishita Bose', role: 'admin', phone: '+919000000002', joinedDaysAgo: 210 },
  { key: 'meera', name: 'Meera Nair', role: 'host', phone: '+919000000003', joinedDaysAgo: 380 },
  { key: 'karan', name: 'Karan Mehta', role: 'host', phone: '+919000000004', joinedDaysAgo: 350 },
  { key: 'tenzin', name: 'Tenzin Dorje', role: 'host', phone: '+919000000005', joinedDaysAgo: 260 },
  { key: 'anjali', name: 'Anjali Rao', role: 'host', phone: '+919000000006', joinedDaysAgo: 190 },
  { key: 'farhan', name: 'Farhan Qureshi', role: 'host', phone: '+919000000007', joinedDaysAgo: 120 },
  { key: 'rohit', name: 'Rohit Verma', role: 'host', phone: '+919000000008', joinedDaysAgo: 75 },
  { key: 'priya', name: 'Priya Natarajan', role: 'guest', phone: '+919000000011', avatar: images.avatar, joinedDaysAgo: 300 },
  { key: 'sid', name: 'Siddharth Kumar', role: 'guest', phone: '+919000000012', joinedDaysAgo: 240 },
  { key: 'ananya', name: 'Ananya Sen', role: 'guest', phone: '+919000000013', joinedDaysAgo: 170 },
  { key: 'rahul', name: 'Rahul Menon', role: 'guest', phone: '+919000000014', joinedDaysAgo: 150 },
  { key: 'neha', name: 'Neha Kapoor', role: 'guest', phone: '+919000000015', joinedDaysAgo: 140 },
  { key: 'maya', name: 'Maya Dsouza', role: 'guest', phone: '+919000000016', joinedDaysAgo: 90 },
  { key: 'arjun', name: 'Arjun Iyer', role: 'guest', phone: '+919000000017', joinedDaysAgo: 45 },
  { key: 'vikram', name: 'Vikram Pillai', role: 'guest', phone: '+919000000018', suspended: true, joinedDaysAgo: 60 },
]

interface SeedProperty {
  slug: string; host: string; title: string; type: string; city: string; region: string; country?: string
  price: number; rating: number; reviewCount: number; beds: number; baths: number; maxGuests: number
  status: 'Approved' | 'Pending' | 'Rejected' | 'Draft'; rejectionReason?: string; featured?: number
  /** Run by Meridian (instant booking, higher commission). Otherwise host-managed, request to book. */
  managed?: boolean
  cover: string; photos: string[]; amenities: string[]; lat: number; lng: number; description: string
  reviews: [author: string, rating: number, comment: string, daysAgo: number][]
}

const properties: SeedProperty[] = [
  {
    slug: 'green-valley-organic-farmstay', host: 'meera', title: 'Green Valley Organic Farmstay', type: 'Farmstay',
    city: 'Coorg', region: 'Karnataka', price: 6500, rating: 4.92, reviewCount: 128, beds: 3, baths: 2, maxGuests: 6, status: 'Approved', featured: 1,
    cover: images.farmstay, photos: [g.livingCozy, g.kitchen, g.bedroomClassic, g.spa],
    amenities: ['Wifi', 'Free parking', 'Breakfast included', 'Kitchen', 'Garden', 'Bonfire area', 'Pet friendly'], lat: 12.4244, lng: 75.7382,
    description: 'Wake up to the aroma of coffee blossoms and fresh organic breakfasts. Enjoy guided plantation walks and bonfire evenings.\n\nThe farmhouse sits on a working coffee and pepper estate. Three bedrooms open onto a wraparound veranda, and meals are cooked with produce picked the same morning.',
    reviews: [['Rohan D.', 5, 'Peaceful, spotless and the hosts made us feel like family.', 200], ['Kavya S.', 5, 'The plantation walk at sunrise was magical. Food was outstanding.', 150]],
  },
  {
    slug: 'golden-sunset-hillside-resort', managed: true, host: 'karan', title: 'Golden Sunset Hillside Resort', type: 'Resort',
    city: 'Wayanad', region: 'Kerala', price: 12500, rating: 4.88, reviewCount: 94, beds: 4, baths: 4, maxGuests: 8, status: 'Approved', featured: 2,
    cover: images.resort, photos: [g.poolDusk, g.mountainDeck, g.spa, g.bedroomDark],
    amenities: ['Wifi', 'Infinity pool', 'Spa', 'Restaurant', 'Air conditioning', 'Free parking', 'Room service'], lat: 11.6854, lng: 76.132,
    description: 'A luxurious mountain resort with infinity pool overlooking misty green valleys and world-class spa facilities.\n\nFour spacious suites, an in-house restaurant serving Kerala cuisine, and sunset views from every balcony.',
    reviews: [['Rahul M.', 5, 'World-class infinity pool and the views at sunset are unreal.', 90], ['Deepa K.', 4, 'Beautiful property. The spa was a highlight, the Wi-Fi less so.', 60]],
  },
  {
    slug: 'whispering-pines-forest-cottage', host: 'meera', title: 'Whispering Pines Forest Cottage', type: 'Cottage',
    city: 'Manali', region: 'Himachal Pradesh', price: 5200, rating: 4.95, reviewCount: 210, beds: 2, baths: 1, maxGuests: 4, status: 'Approved', featured: 3,
    cover: images.cottage, photos: [g.forestCabin, g.livingCozy, g.bedroomClassic, g.kitchen],
    amenities: ['Wifi', 'Fireplace', 'Heating', 'Kitchen', 'Mountain view', 'Free parking'], lat: 32.2432, lng: 77.1892,
    description: 'A rustic wooden cabin nestled inside pine forests with mountain views, fireplace, and stargazing deck.\n\nIt’s a ten-minute walk to Old Manali’s cafés, yet you’ll hear nothing but the river at night.',
    reviews: [['Kabir T.', 5, 'Cosiest cabin we have ever stayed in. The fireplace and the stars made it.', 120]],
  },
  {
    slug: 'emerald-luxury-pool-villa', managed: true, host: 'karan', title: 'Emerald Luxury Pool Villa', type: 'Villa',
    city: 'Lonavala', region: 'Maharashtra', price: 18500, rating: 4.97, reviewCount: 82, beds: 5, baths: 5, maxGuests: 10, status: 'Approved', featured: 4,
    cover: images.villa, photos: [g.villaPool, g.livingBright, g.bedroomClassic, g.kitchen],
    amenities: ['Wifi', 'Private pool', 'Air conditioning', 'Kitchen', 'Game room', 'Chef on request', 'Free parking'], lat: 18.7537, lng: 73.4068,
    description: 'An architectural masterpiece featuring private plunge pool, manicured lawns, indoor game lounge, and private chef on request.\n\nIdeal for families and groups of friends, two hours from Mumbai and Pune.',
    reviews: [['Vikas P.', 5, 'Perfect for our family reunion. The pool and lawns kept the kids busy all weekend.', 45]],
  },
  {
    slug: 'sunny-citrus-farm-estate', host: 'meera', title: 'Sunny Citrus Farm & Estate', type: 'Farmstay',
    city: 'Nashik', region: 'Maharashtra', price: 7200, rating: 4.85, reviewCount: 64, beds: 3, baths: 2, maxGuests: 6, status: 'Approved', featured: 5,
    cover: images.citrusFarm, photos: [images.farmstay, g.apartment, g.bedroomClassic, g.kitchen],
    amenities: ['Wifi', 'Vineyard tours', 'Breakfast included', 'Garden', 'Free parking', 'Kid friendly'], lat: 19.9975, lng: 73.7898,
    description: 'Experience vineyard tours and citrus picking in a sprawling eco-friendly family farmstay.\n\nThe estate runs on solar power and harvests rainwater. Children can help feed the animals every morning.',
    reviews: [['Neha K.', 4, 'Lovely farm and wonderful hosts. The vineyard tour is a must.', 70]],
  },
  {
    slug: 'bamboo-zen-treehouse-cottage', managed: true, host: 'karan', title: 'Bamboo Zen Treehouse Cottage', type: 'Cottage',
    city: 'Ubud', region: 'Bali', country: 'Indonesia', price: 9800, rating: 4.99, reviewCount: 312, beds: 1, baths: 1, maxGuests: 2, status: 'Approved', featured: 6,
    cover: images.treehouse, photos: [g.mountainDeck, g.cliffPool, g.spa, g.bedroomDark],
    amenities: ['Wifi', 'Rainforest view', 'Breakfast included', 'Yoga deck', 'Air conditioning'], lat: -8.5069, lng: 115.2625,
    description: 'A stunning architectural bamboo treehouse overlooking lush green tropical rainforests and river streams.\n\nBuilt for two, with an open-air bath, a yoga deck and breakfast delivered in a basket each morning.',
    reviews: [['Maya L.', 5, 'Magical. Falling asleep to the sound of the river was unforgettable.', 30]],
  },
  {
    slug: 'alleppey-backwater-houseboat', host: 'meera', title: 'Alleppey Backwater Houseboat', type: 'Cottage',
    city: 'Alleppey', region: 'Kerala', price: 8900, rating: 4.96, reviewCount: 143, beds: 2, baths: 2, maxGuests: 4, status: 'Approved',
    cover: g.houseboat, photos: [g.backwaters, g.bedroomDark, g.kitchen],
    amenities: ['Air conditioning', 'Breakfast included', 'Room service', 'Wifi'], lat: 9.4981, lng: 76.3388,
    description: 'A traditional kettuvallam houseboat with two air-conditioned bedrooms, drifting through palm-lined backwaters.\n\nYour crew cooks Kerala meals on board and moors each evening in a quiet village canal.',
    reviews: [['Sanjana R.', 5, 'The crew’s fish curry and the sunset over the paddy fields were unforgettable.', 110]],
  },
  {
    slug: 'himalayan-pine-view-resort', managed: true, host: 'tenzin', title: 'Himalayan Pine View Resort', type: 'Resort',
    city: 'Gangtok', region: 'Sikkim', price: 11000, rating: 4.9, reviewCount: 118, beds: 4, baths: 4, maxGuests: 8, status: 'Approved',
    cover: g.himalaya, photos: [g.mountainDeck, g.spa, g.bedroomDark, g.livingCozy],
    amenities: ['Wifi', 'Mountain view', 'Restaurant', 'Spa', 'Heating', 'Room service'], lat: 27.3389, lng: 88.6065,
    description: 'Wake up to Kanchenjunga from your balcony at this family-run resort above Gangtok.\n\nMomos in the restaurant, a hot-stone spa after long hikes, and monastery visits arranged by the hosts.',
    reviews: [['Aditya G.', 5, 'Clear views of Kanchenjunga at dawn and the warmest hosts.', 40]],
  },
  {
    slug: 'naggar-apple-orchard-farmstay', host: 'tenzin', title: 'Naggar Apple Orchard Farmstay', type: 'Farmstay',
    city: 'Naggar', region: 'Himachal Pradesh', price: 4200, rating: 4.83, reviewCount: 52, beds: 2, baths: 1, maxGuests: 5, status: 'Approved',
    cover: g.gardenCottage, photos: [g.livingCozy, g.kitchen, g.bedroomClassic],
    amenities: ['Wifi', 'Garden', 'Breakfast included', 'Heating', 'Mountain view', 'Kid friendly'], lat: 32.1167, lng: 77.1667,
    description: 'A wooden farmhouse in a working apple orchard above the Kullu valley.\n\nPick apples in season, walk to Naggar Castle, and end the day with home-made cider by the stove.',
    reviews: [['Ira P.', 5, 'Our kids loved picking apples. Simple, clean and very peaceful.', 25]],
  },
  {
    slug: 'jaipur-heritage-haveli-room', host: 'farhan', title: 'Heritage Haveli Courtyard Room', type: 'Room',
    city: 'Jaipur', region: 'Rajasthan', price: 3800, rating: 4.81, reviewCount: 57, beds: 1, baths: 1, maxGuests: 2, status: 'Approved',
    cover: g.hotelRoom, photos: [g.jaipurPalace, g.jaipurFort, g.brightRoom],
    amenities: ['Wifi', 'Air conditioning', 'Breakfast included', 'Room service'], lat: 26.9239, lng: 75.8267,
    description: 'A private room in a restored 19th-century haveli, a short walk from Hawa Mahal.\n\nBreakfast is served in the painted courtyard, and the rooftop has views over the old city.',
    reviews: [['Tara B.', 5, 'Stunning haveli right in the old city. Rooftop breakfast was a treat.', 35]],
  },
  {
    slug: 'rishikesh-riverside-homestay-room', host: 'rohit', title: 'Riverside Homestay Room', type: 'Room',
    city: 'Rishikesh', region: 'Uttarakhand', price: 2400, rating: 4.76, reviewCount: 41, beds: 1, baths: 1, maxGuests: 2, status: 'Approved',
    cover: g.brightRoom, photos: [g.livingCozy, g.mountainDeck],
    amenities: ['Wifi', 'Mountain view', 'Breakfast included', 'Yoga deck'], lat: 30.0869, lng: 78.2676,
    description: 'A bright private room in a family home a few steps from the Ganga.\n\nMorning yoga on the terrace, evening aarti at the ghats, and home-cooked vegetarian meals.',
    reviews: [['Jonas W.', 5, 'Kind family, great food and the yoga deck faces the river.', 20]],
  },
  {
    slug: 'assagao-coconut-grove-villa', managed: true, host: 'anjali', title: 'Coconut Grove Pool Villa', type: 'Villa',
    city: 'Assagao', region: 'Goa', price: 16500, rating: 4.93, reviewCount: 76, beds: 4, baths: 4, maxGuests: 8, status: 'Approved',
    cover: g.modernVilla, photos: [g.beachPool, g.livingBright, g.bedroomClassic, g.kitchen],
    amenities: ['Wifi', 'Private pool', 'Air conditioning', 'Kitchen', 'Free parking', 'Pet friendly'], lat: 15.5937, lng: 73.7652,
    description: 'A Portuguese-style villa in a quiet coconut grove, ten minutes from Anjuna beach.\n\nFour en-suite bedrooms, a private pool and a caretaker who can arrange a Goan cook.',
    reviews: [['Karthik N.', 5, 'Gorgeous villa, spotless pool and perfectly placed for north Goa.', 55]],
  },
  {
    slug: 'gokarna-cliffside-resort', managed: true, host: 'anjali', title: 'Gokarna Cliffside Resort', type: 'Resort',
    city: 'Gokarna', region: 'Karnataka', price: 13500, rating: 4.87, reviewCount: 66, beds: 5, baths: 5, maxGuests: 10, status: 'Approved',
    cover: g.seasideResort, photos: [g.cliffPool, g.beachPool, g.spa, g.bedroomClassic],
    amenities: ['Wifi', 'Infinity pool', 'Restaurant', 'Spa', 'Air conditioning'], lat: 14.5479, lng: 74.3188,
    description: 'Suites above Om Beach with an infinity pool facing the Arabian Sea.\n\nWalk the cliff trail to Half Moon beach, then come back for seafood on the terrace.',
    reviews: [['Leela M.', 4, 'Breathtaking location. Service was a little slow at dinner.', 15]],
  },
  {
    slug: 'sunrise-garden-view-private-room', host: 'meera', title: 'Sunrise Garden View Private Room', type: 'Room',
    city: 'Ooty', region: 'Tamil Nadu', price: 2800, rating: 0, reviewCount: 0, beds: 1, baths: 1, maxGuests: 2, status: 'Pending',
    cover: images.room, photos: [g.apartment, g.bedroomClassic],
    amenities: ['Wifi', 'Garden', 'Heating', 'Breakfast included'], lat: 11.4102, lng: 76.695,
    description: 'A cozy private room with ensuite bathroom and gorgeous hillside garden views.', reviews: [],
  },
  {
    slug: 'chikmagalur-coffee-estate-bungalow', host: 'meera', title: 'Coffee Estate Bungalow', type: 'Farmstay',
    city: 'Chikmagalur', region: 'Karnataka', price: 8500, rating: 0, reviewCount: 0, beds: 3, baths: 3, maxGuests: 6, status: 'Pending',
    cover: g.livingBright, photos: [g.bedroomClassic, g.kitchen],
    amenities: ['Wifi', 'Breakfast included', 'Garden', 'Free parking', 'Bonfire area'], lat: 13.3161, lng: 75.772,
    description: 'A colonial planter’s bungalow on a 40-acre coffee estate, with estate tours and tastings.', reviews: [],
  },
  {
    slug: 'thar-desert-glamping-camp', host: 'farhan', title: 'Thar Desert Glamping Camp', type: 'Resort',
    city: 'Jaisalmer', region: 'Rajasthan', price: 7500, rating: 0, reviewCount: 0, beds: 6, baths: 6, maxGuests: 12, status: 'Rejected',
    rejectionReason: 'Please add photos of the tents and bathrooms, and describe how guests reach the camp from Jaisalmer.',
    cover: g.tentView, photos: [], amenities: ['Bonfire area', 'Restaurant'], lat: 26.9157, lng: 70.9083,
    description: 'Luxury tents in the dunes with folk music, camel rides and dinner under the stars.', reviews: [],
  },
  {
    slug: 'nainital-lakeview-stone-cottage', host: 'rohit', title: 'Lakeview Stone Cottage', type: 'Cottage',
    city: 'Nainital', region: 'Uttarakhand', price: 5800, rating: 4.7, reviewCount: 23, beds: 2, baths: 1, maxGuests: 4, status: 'Draft',
    cover: g.forestCabin, photos: [g.livingCozy, g.bedroomClassic],
    amenities: ['Wifi', 'Fireplace', 'Mountain view', 'Kitchen'], lat: 29.3919, lng: 79.4542,
    description: 'A stone cottage above Naini Lake, paused by the host during renovation.', reviews: [],
  },
]


interface SeedBooking {
  property: string; guest: string; start: number; nights: number; guests: number
  /** Requested: waiting for the host, `hoursLeft` of the 24 to answer. */
  status?: 'Confirmed' | 'Cancelled' | 'Requested' | 'Declined' | 'Expired'; hoursLeft?: number; method?: 'upi' | 'card' | 'netbanking'; requests?: string
  review?: [rating: number, comment: string]
}

const bookings: SeedBooking[] = [
  // Priya: the main demo guest has something in every state.
  { property: 'green-valley-organic-farmstay', guest: 'priya', start: 12, nights: 5, guests: 2, requests: 'We’ll arrive around 4 pm. Vegetarian meals please.' },
  { property: 'whispering-pines-forest-cottage', guest: 'priya', start: 60, nights: 4, guests: 3 },
  { property: 'assagao-coconut-grove-villa', guest: 'priya', start: 100, nights: 4, guests: 4, method: 'card' },
  { property: 'sunny-citrus-farm-estate', guest: 'priya', start: -40, nights: 2, guests: 2 },
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
  // Requests waiting for self-managed hosts (Meera, Tenzin), plus answered ones.
  { property: 'green-valley-organic-farmstay', guest: 'ananya', start: 28, nights: 3, guests: 4, status: 'Requested', hoursLeft: 19, requests: 'Travelling with two kids (6 and 9). Is the farm walk OK for them?' },
  { property: 'alleppey-backwater-houseboat', guest: 'priya', start: 75, nights: 2, guests: 2, status: 'Requested', hoursLeft: 6, requests: 'Anniversary trip, a candle-light dinner on deck would be lovely.' },
  { property: 'naggar-apple-orchard-farmstay', guest: 'rahul', start: 18, nights: 2, guests: 3, status: 'Requested', hoursLeft: 22 },
  { property: 'whispering-pines-forest-cottage', guest: 'maya', start: 14, nights: 2, guests: 2, status: 'Declined' },
  { property: 'sunny-citrus-farm-estate', guest: 'sid', start: 9, nights: 2, guests: 2, status: 'Expired' },
]

const messages: [name: string, email: string, topic: string, message: string, status: 'new' | 'read' | 'closed', daysAgo: number][] = [
  ['Asha Kulkarni', 'asha.k@example.com', 'Hosting', 'I have two cottages near Coorg. Can I list both under one account?', 'new', 1],
  ['Dev Malhotra', 'dev.m@example.com', 'Booking help', 'Can I change the dates of my houseboat booking instead of cancelling?', 'new', 2],
  ['Ritu Sharma', 'ritu@example.com', 'Payments & refunds', 'When will online payments be available? I’d like to pay by UPI.', 'read', 6],
  ['The Travel Desk', 'press@example.com', 'Press', 'We’re writing about farmstays in South India and would love to feature Meridian Stay.', 'read', 9],
  ['Kiran Joshi', 'kiran.j@example.com', 'Trust & safety', 'A listing I viewed used photos I think belong to another property.', 'closed', 20],
]


// Property details (demo): area, capacities, rules, deposit, a sample address, and day use on a few properties.
const DAY_USE: Record<string, { price: number; extra: number; block: number }> = {
  'green-valley-organic-farmstay': { price: 4500, extra: 600, block: 6 },
  'emerald-luxury-pool-villa': { price: 12000, extra: 1800, block: 6 },
  'assagao-coconut-grove-villa': { price: 9500, extra: 1500, block: 8 },
  'sunny-citrus-farm-estate': { price: 3800, extra: 500, block: 6 },
}
function details(s: SeedProperty) {
  const big = s.type === 'Villa' || s.type === 'Resort'
  const d = DAY_USE[s.slug]
  return {
    areaSqft: { Room: 350, Cottage: 1100, Farmstay: 2400, Villa: 4200, Resort: 9000 }[s.type as 'Room'] ?? 1200,
    gatheringCapacity: d ? s.maxGuests * 3 : big ? s.maxGuests * 2 : null,
    checkInTime: '14:00', checkOutTime: s.type === 'Resort' ? '12:00' : '11:00',
    houseRules: {
      couples: true, pets: s.amenities.includes('Pet friendly'), nonVeg: s.slug !== 'jaipur-heritage-haveli-room' && s.slug !== 'rishikesh-riverside-homestay-room',
      alcohol: big, parties: big || !!d, bachelors: big, smoking: false, quietAfter: big ? '23:00' : '22:00',
      notes: s.type === 'Farmstay' ? 'Please don’t pick fruit or disturb the animals without the caretaker. Bonfire until 11 pm.' : '',
    },
    securityDepositMinor: (big ? 5000 : s.type === 'Room' ? 0 : 2000) * 100,
    address: `Sample address: ${s.title}, near the main road, ${s.city}, ${s.region} (demo)`,
    overnight: true,
    dayUse: d
      ? { enabled: true, blockHours: d.block, priceMinor: d.price * 100, extraHourMinor: d.extra * 100, opensAt: '08:00', closesAt: '22:00' }
      : { enabled: false, blockHours: 6, priceMinor: 300000, extraHourMinor: 40000, opensAt: '08:00', closesAt: '22:00' },
  }
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString()

/**
 * Loads the demo data into an empty project. Returns false if there are already users,
 * unless `force` (used by the demo reset, after it has cleared the demo records).
 */
export async function seed(log = console.log, force = false): Promise<boolean> {
  const existing = await col(C.users).get()
  if (!existing.empty && !force) return false
  // Real accounts kept through a demo reset keep their numbers; new ones continue after the highest.
  const highestUserId = Math.max(0, ...existing.docs.map((d) => Number(d.data().id) || 0))
  const today = todayISO()
  const w = firestore.bulkWriter()

  amenities.forEach(([name, icon], order) => w.set(col(C.amenities).doc(name), { name, icon, order }))

  // People: a Firebase sign-in (by phone) plus a users document keyed by the same id.
  const ids = new Map<string, { id: number; uid: string; name: string; phone: string }>()
  // Sign-ins are created in parallel (they already exist after a demo reset, which is fine).
  await Promise.all(users.map((u) =>
    auth.createUser({ uid: `demo-${u.key}`, phoneNumber: u.phone, displayName: u.name, disabled: !!u.suspended }).catch(() => {})))
  for (const [i, u] of users.entries()) {
    const uid = `demo-${u.key}`
    const id = i + 1
    ids.set(u.key, { id, uid, name: u.name, phone: u.phone })
    w.set(col(C.users).doc(uid), {
      id, uid, name: u.name, email: null, phone: u.phone, role: u.role, avatarUrl: u.avatar ?? null, createdAt: daysAgo(u.joinedDaysAgo),
      suspendedAt: u.suspended ? daysAgo(10) : null, sessionsRevokedAt: null,
    })
  }

  // Listings, with their earlier reviews (counts and averages include them).
  const props = new Map<string, { id: number; price: number; seed: SeedProperty; rating: number; count: number }>()
  let reviewId = 0
  for (const [i, p] of properties.entries()) {
    const id = i + 1
    props.set(p.slug, { id, price: p.price, seed: p, rating: p.rating, count: p.reviewCount })
    for (const [author, rating, comment, ago] of p.reviews) {
      reviewId++
      w.set(col(C.reviews).doc(String(reviewId)), { id: reviewId, propertyId: id, userId: null, bookingCode: null, authorName: author, rating, comment, createdAt: daysAgo(ago), hiddenAt: null })
    }
  }
  // A spam review an admin already hid, to show moderation.
  reviewId++
  w.set(col(C.reviews).doc(String(reviewId)), {
    id: reviewId, propertyId: props.get('assagao-coconut-grove-villa')!.id, userId: null, bookingCode: null, authorName: 'Unknown', rating: 1,
    comment: 'Don’t book here!!! Message me on WhatsApp for cheaper rooms nearby.', createdAt: daysAgo(12), hiddenAt: daysAgo(11),
  })

  // Bookings, each claiming its nights while confirmed.
  for (const [i, b] of bookings.entries()) {
    const p = props.get(b.property)!
    const guest = ids.get(b.guest)!
    const host = ids.get(p.seed.host)!
    const checkIn = addDays(today, b.start)
    const checkOut = addDays(checkIn, b.nights)
    const q = quoteStay(p.price, checkIn, checkOut, b.guests)
    const code = newBookingCode()
    const status = b.status ?? 'Confirmed'
    const totalMinor = q.total * 100
    const pct = p.seed.managed ? defaultCommission.managedPct : defaultCommission.selfPct
    const createdAt = status === 'Requested' ? new Date(Date.now() - (REQUEST_HOURS - (b.hoursLeft ?? 12)) * 3_600_000).toISOString()
      : new Date(Date.parse(checkIn) - 21 * 86_400_000).toISOString()
    const expiresAt = status === 'Requested' ? new Date(Date.now() + (b.hoursLeft ?? 12) * 3_600_000).toISOString() : null
    const everConfirmed = status === 'Confirmed' || status === 'Cancelled'
    // Cancelled well ahead of check-in: refunded in full.
    const refundedMinor = status === 'Cancelled' ? totalMinor : 0
    const kept = everConfirmed ? totalMinor - refundedMinor : 0
    const commission = commissionMinor(status === 'Requested' ? totalMinor : kept, pct)
    w.set(col(C.bookings).doc(code), {
      id: i + 1, code, propertyId: p.id, hostId: host.id, guestId: guest.id,
      property: { slug: p.seed.slug, title: p.seed.title, type: p.seed.type, location: `${p.seed.city}, ${p.seed.region}`, image: p.seed.cover },
      guest: { name: guest.name, email: null, phone: guest.phone },
      checkIn, checkOut, nights: q.nights, guests: b.guests, currency: 'INR', pricePerNightMinor: p.price * 100,
      baseMinor: q.baseAmount * 100, extraGuestMinor: q.extraGuestAmount * 100, serviceFeeMinor: 0, totalMinor,
      management: p.seed.managed ? 'managed' : 'self', instantBook: !!p.seed.managed,
      commissionPct: pct, commissionMinor: commission, hostPayoutMinor: (status === 'Requested' ? totalMinor : kept) - commission,
      status, paymentMethod: b.method ?? 'upi', paymentStatus: 'test', razorpayOrderId: null, razorpayPaymentId: null, refundedMinor,
      expiresAt, contactPhone: guest.phone, specialRequests: b.requests ?? null, createdAt,
      confirmedAt: everConfirmed ? createdAt : null,
      cancelledAt: status === 'Cancelled' ? new Date(Date.parse(checkIn) - 7 * 86_400_000).toISOString() : null,
      decidedAt: status === 'Declined' || status === 'Expired' ? new Date(Date.parse(createdAt) + 20 * 3_600_000).toISOString() : null,
      declineReason: status === 'Declined' ? 'Sorry, we have a family function at the cottage those nights.' : null, reviewed: !!b.review,
    })
    if (status === 'Confirmed' || status === 'Requested') {
      for (const d of datesOf(checkIn, checkOut)) w.set(nightsOf(p.id).doc(d), { kind: 'booking', ref: code, holdUntil: expiresAt })
    }
    if (b.review) {
      reviewId++
      w.set(col(C.reviews).doc(String(reviewId)), {
        id: reviewId, propertyId: p.id, userId: guest.id, bookingCode: code, authorName: reviewerName(guest.name), rating: b.review[0],
        comment: b.review[1], createdAt: new Date(Date.parse(checkOut) + 2 * 86_400_000).toISOString(), hiddenAt: null,
      })
      p.rating = Math.round(((p.rating * p.count + b.review[0]) / (p.count + 1)) * 100) / 100
      p.count++
    }
  }

  for (const p of props.values()) {
    const s = p.seed
    w.set(col(C.properties).doc(String(p.id)), {
      id: p.id, slug: s.slug, hostId: ids.get(s.host)!.id, title: s.title, type: s.type, description: s.description, city: s.city, region: s.region,
      country: s.country ?? 'India', lat: s.lat, lng: s.lng, currency: 'INR', pricePerNightMinor: s.price * 100, management: s.managed ? 'managed' : 'self', bedrooms: s.beds, bathrooms: s.baths,
      maxGuests: s.maxGuests, status: s.status, rejectionReason: s.rejectionReason ?? null, coverImageUrl: s.cover, photos: s.photos,
      amenities: s.amenities, ratingAvg: p.rating, reviewCount: p.count, featuredRank: s.featured ?? null,
      approvedAt: s.status === 'Approved' ? daysAgo(30) : null, createdAt: daysAgo(60 - p.id), updatedAt: daysAgo(30),
      ...details(s),
    })
  }

  // Host blocks, claiming their nights.
  const blocks: [slug: string, start: number, nights: number, note: string][] = [
    ['whispering-pines-forest-cottage', 25, 3, 'Chimney maintenance'],
    ['himalayan-pine-view-resort', 40, 4, 'Staff holiday'],
    ['assagao-coconut-grove-villa', 20, 5, 'Family visiting'],
  ]
  for (const [i, [slug, start, nights, note]] of blocks.entries()) {
    const propertyId = props.get(slug)!.id
    const checkIn = addDays(today, start)
    const checkOut = addDays(checkIn, nights)
    w.set(col(C.blocks).doc(String(i + 1)), { id: i + 1, propertyId, checkIn, checkOut, note, createdAt: daysAgo(5) })
    for (const d of datesOf(checkIn, checkOut)) w.set(nightsOf(propertyId).doc(d), { kind: 'block', ref: String(i + 1) })
  }

  const wishlists: Record<string, string[]> = {
    priya: ['green-valley-organic-farmstay', 'whispering-pines-forest-cottage', 'bamboo-zen-treehouse-cottage', 'himalayan-pine-view-resort', 'jaipur-heritage-haveli-room'],
    sid: ['emerald-luxury-pool-villa', 'gokarna-cliffside-resort'],
    ananya: ['alleppey-backwater-houseboat', 'naggar-apple-orchard-farmstay'],
    neha: ['bamboo-zen-treehouse-cottage'],
  }
  for (const [who, slugs] of Object.entries(wishlists)) {
    for (const [i, slug] of slugs.entries()) {
      const userId = ids.get(who)!.id
      const propertyId = props.get(slug)!.id
      w.set(col(C.wishlists).doc(`${userId}_${propertyId}`), { userId, propertyId, createdAt: daysAgo(20 - i) })
    }
  }

  for (const [i, [name, email, topic, message, status, ago]] of messages.entries()) {
    w.set(col(C.messages).doc(String(i + 1)), { id: i + 1, name, email, topic, message, status, createdAt: daysAgo(ago) })
  }

  const admin = (key: string) => ({ adminId: ids.get(key)!.id, adminName: ids.get(key)!.name })
  const audit: [who: string, action: string, type: string, target: string, details: object, ago: number][] = [
    ['admin', 'listing.approve', 'property', String(props.get('gokarna-cliffside-resort')!.id), {}, 30],
    ['ops', 'listing.approve', 'property', String(props.get('rishikesh-riverside-homestay-room')!.id), {}, 28],
    ['admin', 'listing.feature', 'property', String(props.get('bamboo-zen-treehouse-cottage')!.id), { rank: 6 }, 27],
    ['ops', 'listing.reject', 'property', String(props.get('thar-desert-glamping-camp')!.id), { reason: props.get('thar-desert-glamping-camp')!.seed.rejectionReason }, 14],
    ['admin', 'review.hide', 'review', String(reviewId), {}, 11],
    ['admin', 'user.suspend', 'user', String(ids.get('vikram')!.id), {}, 10],
    ['ops', 'message.status', 'message', '5', { status: 'closed' }, 5],
  ]
  for (const [who, action, targetType, targetId, details, ago] of audit) {
    w.set(col(C.audit).doc(), { ...admin(who), action, targetType, targetId, details, createdAt: daysAgo(ago) })
  }

  // Two day-use bookings ("Day out") for the demo.
  const dayOuts: [slug: string, guest: string, inDays: number, start: string, hours: number, party: number][] = [
    ['emerald-luxury-pool-villa', 'neha', 9, '10:00', 8, 12],
    ['green-valley-organic-farmstay', 'sid', 20, '09:00', 6, 8],
  ]
  for (const [i, [slug, who, inDays, start, hours, people]] of dayOuts.entries()) {
    const p = props.get(slug)!
    const d = DAY_USE[slug]
    const guest = ids.get(who)!
    const date = addDays(today, inDays)
    const end = `${String(Number(start.slice(0, 2)) + hours).padStart(2, '0')}:00`
    const totalMinor = (d.price + Math.max(0, hours - d.block) * d.extra) * 100
    const pct = p.seed.managed ? defaultCommission.managedPct : defaultCommission.selfPct
    const commission = commissionMinor(totalMinor, pct)
    const code = newBookingCode()
    w.set(col(C.bookings).doc(code), {
      id: bookings.length + i + 1, code, propertyId: p.id, hostId: ids.get(p.seed.host)!.id, guestId: guest.id,
      property: { slug, title: p.seed.title, type: p.seed.type, location: `${p.seed.city}, ${p.seed.region}`, image: p.seed.cover },
      guest: { name: guest.name, email: null, phone: guest.phone }, checkIn: date, checkOut: addDays(date, 1), nights: 0, guests: people,
      currency: 'INR', pricePerNightMinor: d.price * 100, baseMinor: d.price * 100, extraGuestMinor: Math.max(0, hours - d.block) * d.extra * 100,
      serviceFeeMinor: 0, totalMinor, management: p.seed.managed ? 'managed' : 'self', instantBook: !!p.seed.managed,
      commissionPct: pct, commissionMinor: commission, hostPayoutMinor: totalMinor - commission, status: 'Confirmed', paymentMethod: 'upi',
      paymentStatus: 'test', razorpayOrderId: null, razorpayPaymentId: null, refundedMinor: 0, expiresAt: null, contactPhone: guest.phone,
      specialRequests: i === 0 ? 'Birthday pool party for 12. We’ll bring our own cake and decorations.' : 'Family picnic, please arrange a farm walk for the kids.',
      createdAt: daysAgo(3), confirmedAt: daysAgo(3), cancelledAt: null, decidedAt: null, declineReason: null, reviewed: false,
      kind: 'dayuse', startTime: start, endTime: end, hours, guestBreakdown: { adults: people - 2, children: 2, infants: 0, pets: 0 },
      securityDepositMinor: details(p.seed).securityDepositMinor, checkInTime: '14:00', checkOutTime: '11:00', address: details(p.seed).address,
    })
    w.set(daysOf(p.id).doc(date), { slots: [{ ref: code, start, end, holdUntil: null }] })
  }

  const counters = { users: Math.max(users.length, highestUserId), properties: properties.length, reviews: reviewId, bookings: bookings.length + dayOuts.length, blocks: blocks.length, messages: messages.length }
  for (const [name, value] of Object.entries(counters)) w.set(col(C.counters).doc(name), { value })

  // A visible announcement so the preview shows the banner.
  w.set(col(C.settings).doc('announcement'), {
    value: { enabled: true, text: 'Preview mode: explore freely. Payments run in test mode until Razorpay keys are added.', linkLabel: 'How it works', linkUrl: '/how-it-works' },
    updatedAt: new Date().toISOString(), updatedBy: null,
  })

  await w.close()
  log(`Seeded demo data: ${users.length} users, ${properties.length} listings, ${bookings.length} bookings. Demo sign-in code: ${DEMO_OTP}.`)
  return true
}

// `npm run seed -w @meridian/api`
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seed()
    .then((seeded) => { if (!seeded) console.log('The project already has users; nothing seeded.') })
    .catch((err) => { console.error(err.message); process.exitCode = 1 })
}
