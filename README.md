# Meridian Stay

An Airbnb-style marketplace for local, nature-first stays: farmstays, private rooms, cottages, resorts and villas. Guests find and book stays, property owners list them, and the Meridian team runs the platform from a control center.

The whole platform is web-based and lives in this one repository.

- **What changed and when:** [CHANGELOG.md](CHANGELOG.md)
- **Database structure:** [docs/database.md](docs/database.md)
- **Deploying (Vercel + Postgres):** [docs/deployment.md](docs/deployment.md)

## The four web apps

Everything is served from one domain. Each app can later move to its own subdomain (see [deployment](docs/deployment.md#moving-an-app-to-a-subdomain)).

| Address | App | Who it's for | What it does |
| --- | --- | --- | --- |
| `/` | `apps/website` | Everyone | Search by place, dates and guests; filters, sorting and map view; stay pages with gallery, amenities, map, reviews and live pricing; checkout; booking confirmation; log in and sign up; help and policy pages; contact form |
| `/account` | `apps/account` | Guests | Upcoming and past trips, cancel a booking, write a review, wishlist, profile, change password |
| `/host` | `apps/host` | Property owners | Earnings dashboard, listings with approval status, a step-by-step listing wizard with map pin, calendar to block dates, pause or relist, bookings with guest contact details |
| `/admin` | `apps/admin` | Meridian team | Stats overview, approve or reject listings, choose homepage featured stays, manage bookings, users (roles, suspend), reviews (hide/restore), contact inbox, edit homepage text, announcement banner and information pages, activity log |

The API lives in `apps/api` and is served at `/api`.

## Try it with demo data

In development (and on a test deployment with `SEED_DEMO_DATA=true`) the database is filled with fictional demo data: 16 users, 17 listings across India and Bali, bookings in every state, reviews, blocked dates, messages and admin history.

Every demo account uses the password **`meridian123`**. The login page lists them for one-click sign-in.

| Role | Email | Good for |
| --- | --- | --- |
| Guest | `priya@meridianstay.test` | Trips in every state, a stay ready to review, a wishlist |
| Host | `meera@meridianstay.test` | Several live and pending listings, bookings and earnings |
| Host | `farhan@meridianstay.test` | A rejected listing with the admin's reason |
| Admin | `admin@meridianstay.test` | The full control center |

Other demo accounts: hosts `karan@`, `tenzin@`, `anjali@`, `rohit@`; guests `sid@`, `ananya@`, `rahul@`, `neha@`, `maya@`, `arjun@`; admin `ops@`; and `vikram@`, a suspended guest who can't log in. All use the `@meridianstay.test` domain.

## Getting started

You need Node.js 22+ and PostgreSQL 16+ running locally.

```bash
npm install
createdb meridianstay_dev
npm run dev
```

Open http://localhost:5173. The API creates the tables and loads the demo data on first start.

`npm run dev` starts all five processes. The website's dev server also forwards `/admin`, `/host`, `/account` and `/api` to the other servers, so the whole platform, and its login, works from `localhost:5173`.

### Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Run the API and all four apps |
| `npm run dev:website` (or `dev:admin`, `dev:host`, `dev:account`, `dev:api`) | Run one part |
| `npm run typecheck` | Type-check every workspace |
| `npm run build` | Production build of the four web apps |
| `npm run db:migrate -w @meridian/api` | Apply database migrations |
| `npm run db:seed -w @meridian/api` | Load demo data into an empty database |
| `npm run db:reset -w @meridian/api` | Wipe the local database (development only) |

To use a different database, copy `apps/api/.env.example` to `apps/api/.env` and set `DATABASE_URL`.

## Repository layout

```
apps/
  website/   public site              (React, Vite, React Router, Leaflet maps)
  account/   guest panel              (React, Vite, React Router)
  host/      property-owner portal    (React, Vite, React Router, Leaflet maps)
  admin/     control center           (React, Vite, React Router)
  api/       HTTP API                 (Hono on Node, PostgreSQL via node-postgres)
    db/migrations/   versioned SQL schema
packages/
  shared/            types, pricing, dates, default site content, API client
  ui/                logo, panel layout, sign-in handling, loaders, animations
  tailwind-config/   brand colours, font and motion
  tsconfig/          shared TypeScript settings
scripts/build-vercel.mjs   builds everything for Vercel
reference/index.html       the original single-file prototype
```

## How things work

- **Sign-in** uses a secure, HTTP-only session cookie shared by every app. Passwords are hashed with scrypt. Only a hash of each session token is stored.
- **Roles:** everyone signs up as a guest. Creating a first listing makes you a host. Only an admin can make someone an admin.
- **Listings** go live only after an admin approves them. Any edit sends a listing back for review.
- **Pricing** is calculated on the server when booking: the nightly price covers two guests, each extra guest adds 15%, plus a $45 service fee. Money is stored in cents.
- **Double bookings** are impossible: the database itself rejects overlapping confirmed bookings, and bookings can't overlap a host's blocked dates.
- **Reviews** can only be written by a guest whose stay has finished, once per booking.
- **Payments are in test mode.** Bookings are confirmed without taking money and no card details are collected. A payment provider (e.g. Razorpay) plugs in at checkout; see [what's pending](CHANGELOG.md#not-yet-built).
- **Prices are shown in US dollars.** Switch the whole platform by changing `CURRENCY` in `packages/shared/src/pricing.ts`.

## Keeping this up to date

Every change to the repository gets an entry in [CHANGELOG.md](CHANGELOG.md), in the same commit.
