-- Meridian Stay: initial schema.
-- Money is stored in minor units (cents / paise) as integers, with a currency code alongside.
-- Dates of stay are DATE; everything else that records a moment is TIMESTAMPTZ.

CREATE EXTENSION IF NOT EXISTS citext;      -- case-insensitive emails
CREATE EXTENSION IF NOT EXISTS btree_gist;  -- lets the double-booking constraint mix = and &&

-- ─── Enums ──────────────────────────────────────────────────────────────────

CREATE TYPE user_role       AS ENUM ('guest', 'host', 'admin');
CREATE TYPE property_type   AS ENUM ('Farmstay', 'Room', 'Resort', 'Cottage', 'Villa');
CREATE TYPE listing_status  AS ENUM ('Draft', 'Pending', 'Approved', 'Rejected');
CREATE TYPE booking_status  AS ENUM ('Confirmed', 'Cancelled');
CREATE TYPE payment_method  AS ENUM ('upi', 'card', 'netbanking');
CREATE TYPE payment_status  AS ENUM ('test', 'pending', 'paid', 'refunded', 'failed');

-- Keeps updated_at current on every UPDATE.
CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── Users & sessions ───────────────────────────────────────────────────────

CREATE TABLE users (
  id             integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name           text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  email          citext      NOT NULL UNIQUE,
  phone          text,
  password_hash  text        NOT NULL,
  role           user_role   NOT NULL DEFAULT 'guest',
  avatar_url     text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Only a SHA-256 hash of each session token is stored; the raw token lives in the browser cookie.
CREATE TABLE sessions (
  token_hash  text        PRIMARY KEY,
  user_id     integer     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);
CREATE INDEX sessions_user_id_idx ON sessions (user_id);
CREATE INDEX sessions_expires_at_idx ON sessions (expires_at);

-- ─── Listings ───────────────────────────────────────────────────────────────

CREATE TABLE properties (
  id                     integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug                   text           NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  host_id                integer        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title                  text           NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  type                   property_type  NOT NULL,
  description            text           NOT NULL,
  city                   text           NOT NULL,
  region                 text           NOT NULL,
  country                text           NOT NULL DEFAULT 'India',
  latitude               numeric(9, 6)  NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude              numeric(9, 6)  NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  currency               char(3)        NOT NULL DEFAULT 'USD',
  price_per_night_minor  integer        NOT NULL CHECK (price_per_night_minor > 0),
  bedrooms               smallint       NOT NULL CHECK (bedrooms >= 0),
  bathrooms              smallint       NOT NULL CHECK (bathrooms >= 0),
  max_guests             smallint       NOT NULL CHECK (max_guests >= 1),
  status                 listing_status NOT NULL DEFAULT 'Pending',
  rejection_reason       text,
  cover_image_url        text           NOT NULL,
  -- Denormalised from reviews so listing pages don't aggregate on every request.
  rating_avg             numeric(3, 2)  NOT NULL DEFAULT 0 CHECK (rating_avg BETWEEN 0 AND 5),
  review_count           integer        NOT NULL DEFAULT 0 CHECK (review_count >= 0),
  approved_at            timestamptz,
  created_at             timestamptz    NOT NULL DEFAULT now(),
  updated_at             timestamptz    NOT NULL DEFAULT now()
);
CREATE INDEX properties_status_type_idx ON properties (status, type);
CREATE INDEX properties_host_id_idx ON properties (host_id);
CREATE INDEX properties_city_idx ON properties (lower(city));
CREATE TRIGGER properties_updated_at BEFORE UPDATE ON properties FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE property_photos (
  id           integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  property_id  integer  NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  url          text     NOT NULL,
  caption      text,
  position     smallint NOT NULL CHECK (position >= 0),
  UNIQUE (property_id, position)
);

CREATE TABLE amenities (
  id    integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name  text NOT NULL UNIQUE,
  icon  text NOT NULL  -- Font Awesome icon name, e.g. 'wifi'
);

CREATE TABLE property_amenities (
  property_id  integer NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  amenity_id   integer NOT NULL REFERENCES amenities(id) ON DELETE CASCADE,
  PRIMARY KEY (property_id, amenity_id)
);

-- ─── Bookings ───────────────────────────────────────────────────────────────

CREATE TABLE bookings (
  id                        integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code                      text           NOT NULL UNIQUE,   -- shown to guests, e.g. MS-7K3F9Q
  property_id               integer        NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  guest_id                  integer        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  check_in                  date           NOT NULL,
  check_out                 date           NOT NULL,
  nights                    smallint       NOT NULL CHECK (nights >= 1),
  guests                    smallint       NOT NULL CHECK (guests >= 1),
  -- Price snapshot at booking time, so later price changes don't alter past bookings.
  currency                  char(3)        NOT NULL,
  price_per_night_minor     integer        NOT NULL,
  base_amount_minor         integer        NOT NULL,
  extra_guest_amount_minor  integer        NOT NULL DEFAULT 0,
  service_fee_minor         integer        NOT NULL,
  total_minor               integer        NOT NULL,
  status                    booking_status NOT NULL DEFAULT 'Confirmed',
  payment_method            payment_method NOT NULL,
  payment_status            payment_status NOT NULL DEFAULT 'pending',
  payment_reference         text,          -- provider's payment id once a real gateway is connected
  contact_phone             text           NOT NULL,
  special_requests          text,
  created_at                timestamptz    NOT NULL DEFAULT now(),
  updated_at                timestamptz    NOT NULL DEFAULT now(),
  cancelled_at              timestamptz,
  CHECK (check_out > check_in),
  CHECK (total_minor = base_amount_minor + extra_guest_amount_minor + service_fee_minor),
  -- Two confirmed bookings for the same property can never overlap. Check-out day may equal
  -- the next check-in day because daterange is half-open: [check_in, check_out).
  CONSTRAINT bookings_no_overlap EXCLUDE USING gist (
    property_id WITH =,
    daterange(check_in, check_out) WITH &&
  ) WHERE (status = 'Confirmed')
);
CREATE INDEX bookings_guest_id_idx ON bookings (guest_id, check_in DESC);
CREATE TRIGGER bookings_updated_at BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── Reviews, wishlist, contact ─────────────────────────────────────────────

CREATE TABLE reviews (
  id           integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  property_id  integer     NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  user_id      integer     REFERENCES users(id) ON DELETE SET NULL,
  booking_id   integer     UNIQUE REFERENCES bookings(id) ON DELETE SET NULL,  -- one review per stay
  author_name  text        NOT NULL,
  rating       smallint    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment      text        NOT NULL CHECK (char_length(comment) BETWEEN 10 AND 2000),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reviews_property_idx ON reviews (property_id, created_at DESC);

CREATE TABLE wishlist_items (
  user_id      integer     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id  integer     NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, property_id)
);

CREATE TABLE contact_messages (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        text        NOT NULL,
  email       citext      NOT NULL,
  topic       text        NOT NULL,
  message     text        NOT NULL CHECK (char_length(message) BETWEEN 10 AND 5000),
  status      text        NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'closed')),
  created_at  timestamptz NOT NULL DEFAULT now()
);
