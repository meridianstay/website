-- Meridian Stay: admin control center, host availability and editable site content.

-- ─── Moderation flags ───────────────────────────────────────────────────────

-- Suspended users can't log in; their sessions are removed when suspended.
ALTER TABLE users ADD COLUMN suspended_at timestamptz;

-- Hidden reviews stay in the database for the record but aren't shown or counted.
ALTER TABLE reviews ADD COLUMN hidden_at timestamptz;

-- Featured listings appear first on the homepage, in featured_rank order.
ALTER TABLE properties ADD COLUMN featured_rank smallint;
CREATE INDEX properties_featured_idx ON properties (featured_rank) WHERE featured_rank IS NOT NULL;

-- ─── Host availability ──────────────────────────────────────────────────────

-- Nights a host has closed (maintenance, personal use). [start_date, end_date) like bookings.
CREATE TABLE availability_blocks (
  id           integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  property_id  integer     NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  start_date   date        NOT NULL,
  end_date     date        NOT NULL,
  note         text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date > start_date),
  CONSTRAINT availability_blocks_no_overlap EXCLUDE USING gist (
    property_id WITH =,
    daterange(start_date, end_date) WITH &&
  )
);

-- ─── Editable site content ──────────────────────────────────────────────────

-- Small JSON documents the admin edits: homepage hero, announcement banner, …
CREATE TABLE site_settings (
  key         text        PRIMARY KEY,
  value       jsonb       NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  integer     REFERENCES users(id) ON DELETE SET NULL
);

-- Information pages (help, policies, about…). sections = [{ "heading": text, "body": [text] }]
CREATE TABLE content_pages (
  slug        text        PRIMARY KEY CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title       text        NOT NULL,
  intro       text        NOT NULL DEFAULT '',
  sections    jsonb       NOT NULL DEFAULT '[]',
  is_draft    boolean     NOT NULL DEFAULT false,   -- shows a "draft" notice on the page
  published   boolean     NOT NULL DEFAULT true,    -- unpublished pages return 404
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  integer     REFERENCES users(id) ON DELETE SET NULL
);

-- ─── Audit log ──────────────────────────────────────────────────────────────

-- Every admin action, for accountability.
CREATE TABLE admin_audit_log (
  id           integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admin_id     integer     REFERENCES users(id) ON DELETE SET NULL,
  action       text        NOT NULL,              -- e.g. 'listing.approve'
  target_type  text        NOT NULL,              -- e.g. 'property'
  target_id    text,
  details      jsonb       NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_audit_log_created_idx ON admin_audit_log (created_at DESC);
