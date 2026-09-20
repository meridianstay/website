// Which Firestore collections the admin Database screen shows, and what admins may do there.
// Business actions (approving listings, suspending users, cancelling bookings, hiding reviews, host blocks)
// stay on their own admin pages so their rules and side effects always apply.

export type FieldType = 'string' | 'number' | 'boolean' | 'json'

export interface FieldConfig {
  name: string
  type: FieldType
  editable?: boolean
  insertable?: boolean
  nullable?: boolean
  options?: string[]
}

export interface CollectionConfig {
  label: string
  description: string
  fields: FieldConfig[]
  deletable?: boolean
  /** Document id for new rows comes from this field (otherwise Firestore picks one). */
  idFrom?: string
  defaultSort: string
  note?: string
}

const ro = (name: string, type: FieldType = 'string'): FieldConfig => ({ name, type })
const ed = (name: string, type: FieldType = 'string', extra: Partial<FieldConfig> = {}): FieldConfig => ({ name, type, editable: true, ...extra })

export const collections: Record<string, CollectionConfig> = {
  users: {
    label: 'Users', description: 'Everyone with an account (keyed by Firebase sign-in id).', defaultSort: 'id',
    fields: [ro('id', 'number'), ed('name'), ro('email'), ed('phone', 'string', { nullable: true }), ro('role'), ed('avatarUrl', 'string', { nullable: true }),
      ro('createdAt'), ro('suspendedAt')],
    note: 'Change roles and suspend accounts on the Users page. Sign-in details live in Firebase Authentication.',
  },
  properties: {
    label: 'Listings', description: 'Every stay, in any status.', defaultSort: 'id',
    fields: [ro('id', 'number'), ro('slug'), ro('hostId', 'number'), ed('title'), ro('type'), ro('status'), ed('description'), ed('city'), ed('region'), ed('country'),
      ed('lat', 'number'), ed('lng', 'number'), ed('pricePerNightMinor', 'number'), ed('bedrooms', 'number'), ed('bathrooms', 'number'), ed('maxGuests', 'number'),
      ed('coverImageUrl'), ro('photos', 'json'), ro('amenities', 'json'), ed('featuredRank', 'number', { nullable: true }), ro('ratingAvg', 'number'),
      ro('reviewCount', 'number'), ro('management'), ro('assured', 'boolean'), ro('rejectionReason'), ro('createdAt'), ro('updatedAt')],
    note: 'Approve, reject, feature and set management on the Listings page. Prices are in paise (650000 = ₹6,500).',
  },
  bookings: {
    label: 'Bookings', description: 'Every reservation. Amounts are in paise (100 paise = ₹1).', defaultSort: 'createdAt',
    fields: [ro('code'), ro('id', 'number'), ro('propertyId', 'number'), ro('guestId', 'number'), ro('hostId', 'number'), ro('checkIn'), ro('checkOut'),
      ro('nights', 'number'), ro('guests', 'number'), ro('totalMinor', 'number'), ro('commissionPct', 'number'), ro('commissionMinor', 'number'),
      ro('hostPayoutMinor', 'number'), ro('refundedMinor', 'number'), ro('status'), ro('management'), ro('paymentMethod'), ro('paymentStatus'),
      ro('razorpayOrderId'), ro('razorpayPaymentId'), ro('expiresAt'),
      ed('contactPhone'), ed('specialRequests', 'string', { nullable: true }), ro('reviewed', 'boolean'), ro('property', 'json'), ro('guest', 'json'),
      ro('createdAt'), ro('confirmedAt'), ro('cancelledAt'), ro('declineReason')],
    note: 'Cancel bookings on the Bookings page so the nights are freed. Prices are a snapshot from booking time.',
  },
  reviews: {
    label: 'Reviews', description: 'Guest reviews, including hidden ones.', defaultSort: 'id',
    fields: [ro('id', 'number'), ro('propertyId', 'number'), ro('authorName'), ro('rating', 'number'), ro('comment'), ro('bookingCode'), ro('createdAt'), ro('hiddenAt')],
    note: 'Hide and restore reviews on the Reviews page so ratings stay correct.',
  },
  availabilityBlocks: {
    label: 'Blocked dates', description: 'Nights hosts have closed.', defaultSort: 'checkIn',
    fields: [ro('id', 'number'), ro('propertyId', 'number'), ro('checkIn'), ro('checkOut'), ed('note', 'string', { nullable: true }), ro('createdAt')],
    note: 'Hosts add and remove blocks from their calendar so the nights stay in sync.',
  },
  wishlists: {
    label: 'Wishlists', description: 'Stays guests have saved.', defaultSort: 'createdAt', deletable: true,
    fields: [ro('userId', 'number'), ro('propertyId', 'number'), ro('createdAt')],
  },
  amenities: {
    label: 'Amenities', description: 'The amenity list hosts choose from.', defaultSort: 'order', deletable: true, idFrom: 'name',
    fields: [{ name: 'name', type: 'string', insertable: true }, ed('icon', 'string', { insertable: true }), ed('order', 'number', { insertable: true })],
    note: 'Icons are Font Awesome names, e.g. wifi, mug-hot, water-ladder.',
  },
  contactMessages: {
    label: 'Contact messages', description: 'Messages from the contact form.', defaultSort: 'createdAt', deletable: true,
    fields: [ro('id', 'number'), ro('name'), ro('email'), ro('topic'), ro('message'), ed('status', 'string', { options: ['new', 'read', 'closed'] }), ro('createdAt')],
  },
  siteSettings: {
    label: 'Site settings', description: 'Homepage text, banner, sign-in methods and upload limits.', defaultSort: 'updatedAt',
    fields: [ro('value', 'json'), ro('updatedAt'), ro('updatedBy', 'number')],
    note: 'Edit these on the Website content and Settings pages.',
  },
  contentPages: {
    label: 'Information pages', description: 'Help, policies and other pages.', defaultSort: 'slug',
    fields: [ro('slug'), ro('title'), ro('intro'), ro('published', 'boolean'), ro('draft', 'boolean'), ro('sections', 'json'), ro('updatedAt')],
    note: 'Edit these on the Website content page.',
  },
  auditLog: {
    label: 'Activity log', description: 'Every admin action, including changes made here.', defaultSort: 'createdAt',
    fields: [ro('adminName'), ro('action'), ro('targetType'), ro('targetId'), ro('details', 'json'), ro('createdAt')],
  },
  counters: {
    label: 'Counters', description: 'The last number used for each kind of record.', defaultSort: 'value',
    fields: [ro('value', 'number')],
  },
}
