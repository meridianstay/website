import { isISODate, todayISO, type PropertyType, type SearchQuery } from '@meridian/shared'

// Search state lives in the URL so results can be shared, bookmarked and reloaded.

export interface SearchState {
  where: string
  checkIn: string
  checkOut: string
  guests: number
}

export const PROPERTY_TYPES: { type: PropertyType; label: string; icon: string }[] = [
  { type: 'Farmstay', label: 'Farmstays', icon: 'seedling' },
  { type: 'Room', label: 'Rooms', icon: 'door-open' },
  { type: 'Resort', label: 'Resorts', icon: 'umbrella-beach' },
  { type: 'Cottage', label: 'Cottages', icon: 'house-chimney' },
  { type: 'Villa', label: 'Villas', icon: 'hotel' },
]

export const SORT_OPTIONS: { value: NonNullable<SearchQuery['sort']>; label: string }[] = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Top rated' },
  { value: 'newest', label: 'Newest' },
  { value: 'nearest', label: 'Nearest first' },
]

export function readSearch(params: URLSearchParams): SearchState & Pick<SearchQuery, 'type' | 'minPrice' | 'maxPrice' | 'sort' | 'lat' | 'lng'> {
  const today = todayISO()
  const checkIn = params.get('checkIn') ?? ''
  const checkOut = params.get('checkOut') ?? ''
  const validDates = isISODate(checkIn) && isISODate(checkOut) && checkIn >= today && checkOut > checkIn
  const guests = Number(params.get('guests'))
  const type = params.get('type') as PropertyType | null
  const num = (key: string) => {
    const v = Number(params.get(key))
    return params.get(key) && Number.isFinite(v) && v >= 0 ? v : undefined
  }
  const sort = params.get('sort') as SearchQuery['sort'] | null
  const coord = (key: string, max: number) => {
    const v = Number(params.get(key))
    return params.get(key) && Number.isFinite(v) && Math.abs(v) <= max ? v : undefined
  }
  return {
    where: params.get('where') ?? '',
    checkIn: validDates ? checkIn : '',
    checkOut: validDates ? checkOut : '',
    guests: Number.isInteger(guests) && guests > 0 ? Math.min(guests, 16) : 0,
    type: PROPERTY_TYPES.some((t) => t.type === type) ? type! : undefined,
    minPrice: num('minPrice'),
    maxPrice: num('maxPrice'),
    sort: SORT_OPTIONS.some((s) => s.value === sort) ? sort! : undefined,
    lat: coord('lat', 90),
    lng: coord('lng', 180),
  }
}

export function searchUrl(state: Partial<SearchState> & Partial<Pick<SearchQuery, 'type' | 'minPrice' | 'maxPrice' | 'sort' | 'lat' | 'lng'>>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(state)) {
    if (value !== undefined && value !== '' && value !== 0) params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `/search?${qs}` : '/search'
}

export const guestLabel = (n: number) => (n ? `${n} guest${n === 1 ? '' : 's'}` : 'Add guests')
