// Which tables the admin Database screen shows, and what admins may do there.
// Business actions (approving listings, suspending users, cancelling bookings, hiding reviews) stay on
// their own admin pages so their rules and side effects always apply; this screen covers the rest.

export interface TableConfig {
  label: string
  description: string
  primaryKey: string[]
  /** Never sent to the browser. */
  hidden?: string[]
  /** Columns that can be changed here. */
  editable?: string[]
  /** Columns that can be filled in when adding a row (adding is off when absent). */
  insertable?: string[]
  deletable?: boolean
  defaultSort: string
  /** Shown above the table, e.g. where to make other changes. */
  note?: string
}

export const tables: Record<string, TableConfig> = {
  users: {
    label: 'Users', description: 'Everyone with an account.', primaryKey: ['id'], defaultSort: 'id',
    hidden: ['password_hash'], editable: ['name', 'phone', 'avatar_url'],
    note: 'Change roles and suspend accounts on the Users page. Passwords are never shown.',
  },
  properties: {
    label: 'Listings', description: 'Every stay, in any status.', primaryKey: ['id'], defaultSort: 'id',
    editable: ['title', 'description', 'city', 'region', 'country', 'latitude', 'longitude', 'price_per_night_minor',
      'bedrooms', 'bathrooms', 'max_guests', 'cover_image_url', 'featured_rank'],
    note: 'Approve, reject and feature on the Listings page. Prices are in cents (14500 = $145).',
  },
  property_photos: {
    label: 'Listing photos', description: 'Extra photos per listing, in display order.', primaryKey: ['id'], defaultSort: 'property_id',
    editable: ['url', 'caption', 'position'], insertable: ['property_id', 'url', 'caption', 'position'], deletable: true,
  },
  amenities: {
    label: 'Amenities', description: 'The amenity list hosts choose from.', primaryKey: ['id'], defaultSort: 'id',
    editable: ['name', 'icon'], insertable: ['name', 'icon'], deletable: true,
    note: 'Icons are Font Awesome names, e.g. wifi, mug-hot, water-ladder.',
  },
  property_amenities: {
    label: 'Listing amenities', description: 'Which listings offer which amenities.', primaryKey: ['property_id', 'amenity_id'],
    defaultSort: 'property_id', insertable: ['property_id', 'amenity_id'], deletable: true,
  },
  bookings: {
    label: 'Bookings', description: 'Every reservation. Amounts are in cents.', primaryKey: ['id'], defaultSort: 'id',
    editable: ['contact_phone', 'special_requests'],
    note: 'Cancel bookings on the Bookings page. Prices are a snapshot from booking time and can’t be edited.',
  },
  availability_blocks: {
    label: 'Blocked dates', description: 'Nights hosts have closed.', primaryKey: ['id'], defaultSort: 'start_date',
    editable: ['note'], deletable: true,
  },
  reviews: {
    label: 'Reviews', description: 'Guest reviews, including hidden ones.', primaryKey: ['id'], defaultSort: 'id',
    note: 'Hide and restore reviews on the Reviews page so ratings stay correct.',
  },
  wishlist_items: {
    label: 'Wishlists', description: 'Stays guests have saved.', primaryKey: ['user_id', 'property_id'], defaultSort: 'created_at', deletable: true,
  },
  contact_messages: {
    label: 'Contact messages', description: 'Messages from the contact form.', primaryKey: ['id'], defaultSort: 'id',
    editable: ['status'], deletable: true,
  },
  sessions: {
    label: 'Sessions', description: 'Signed-in browsers. Tokens are never shown.', primaryKey: ['token_hash'], defaultSort: 'created_at',
    hidden: ['token_hash'],
  },
  site_settings: {
    label: 'Site settings', description: 'Homepage text and the announcement banner.', primaryKey: ['key'], defaultSort: 'key',
    note: 'Edit these on the Website content page.',
  },
  content_pages: {
    label: 'Information pages', description: 'Help, policies and other pages.', primaryKey: ['slug'], defaultSort: 'slug',
    note: 'Edit these on the Website content page.',
  },
  admin_audit_log: {
    label: 'Activity log', description: 'Every admin action, including changes made here.', primaryKey: ['id'], defaultSort: 'id',
  },
  schema_migrations: {
    label: 'Migrations', description: 'Database structure versions that have been applied.', primaryKey: ['name'], defaultSort: 'name',
  },
}
