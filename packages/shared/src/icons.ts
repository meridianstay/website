// The site ships a cut-down icon font holding only the icons it actually uses (scripts/build-icons.mjs),
// so an icon typed into the control centre has to come from a known list — otherwise it would simply
// render as nothing. These are the ones offered for About us cards and anywhere else an admin picks one.

export const ICON_CHOICES: string[] = [
  'leaf', 'seedling', 'tree', 'mountain-sun', 'water-ladder', 'fire', 'sun', 'cloud-sun', 'wind', 'snowflake',
  'house-chimney', 'hotel', 'door-open', 'umbrella-beach', 'campground', 'bed', 'key', 'map-location-dot', 'compass', 'route',
  'heart', 'star', 'handshake', 'people-group', 'user-group', 'hand-holding-heart', 'face-smile', 'comments', 'envelope', 'phone',
  'shield-halved', 'circle-check', 'award', 'medal', 'gem', 'crown', 'thumbs-up', 'lightbulb', 'bullseye',
  'rocket', 'chart-line', 'earth-asia', 'globe', 'building-columns', 'briefcase', 'calendar-days', 'clock', 'eye', 'wallet',
  'utensils', 'mug-hot', 'wifi', 'car', 'paw', 'camera', 'music', 'book-open', 'graduation-cap', 'recycle',
  'bolt', 'handshake-angle', 'headset', 'house-circle-check', 'indian-rupee-sign', 'location-dot', 'lock',
  'magnifying-glass-location', 'moon', 'people-roof', 'plane-arrival', 'rotate-left', 'screwdriver-wrench', 'shield-heart',
]

export const isIconName = (name: string) => ICON_CHOICES.includes(name)
