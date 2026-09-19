# Meridian Stay

An Airbnb-style marketplace for local, nature-first stays: farmstays, private rooms, cottages, resorts and villas. Guests find and book stays, property owners list them, and the Meridian team runs the platform from a control center.

The whole platform is web-based and lives in this one repository.

- **What changed and when:** [CHANGELOG.md](CHANGELOG.md)
- **API reference (every endpoint):** [docs/api.md](docs/api.md)
- **Data model, Firebase and backend layers:** [docs/database.md](docs/database.md)
- **Deploying (Vercel + Firebase):** [docs/deployment.md](docs/deployment.md)

## The four web apps

Everything is served from one domain. Each app can later move to its own subdomain (see [deployment](docs/deployment.md#moving-an-app-to-a-subdomain)).

| Address | App | Who it's for | What it does |
| --- | --- | --- | --- |
| `/` | `apps/website` | Everyone | Search by place, dates and guests; filters, sorting and map view; stay pages with gallery, amenities, map, reviews and live pricing; checkout; booking confirmation; guest login (`/login`); help and policy pages; contact form |
| `/account` | `apps/account` | Guests | Upcoming and past trips, cancel a booking, write a review, wishlist, profile and photo |
| `/host` | `apps/host` | Property owners | Own login (`/host/login`), earnings dashboard, listings with approval status, a step-by-step listing wizard with map pin and photo uploads, calendar to block dates, pause or relist, bookings with guest contact details |
| `/admin` | `apps/admin` | Meridian team | Own login (`/admin/login`, not linked from the website), stats overview, approve or reject listings, choose homepage featured stays, manage bookings, users (roles, suspend), reviews (hide/restore), contact inbox, edit homepage text, announcement banner and information pages, activity log, Database screen, Settings (Firebase status, sign-in methods, upload limit) |

The API lives in `apps/api` and is served at `/api`. It runs on **Firebase** (Firestore, Authentication, Storage) through the Admin SDK and is layered: routes (HTTP) → services (business rules) → repositories (all Firestore access). See [docs/api.md](docs/api.md).

## Try it with demo data

In development (and on a preview deployment with `SEED_DEMO_DATA=true`) the platform is filled with fictional demo data: 16 people, 17 listings across India and Bali, bookings in every state, reviews, blocked dates, messages and admin history.

Sign-in is by **Google** or **phone OTP**; there are no passwords. Demo accounts use phone numbers, and each login page lists them for one tap:

| Role | Phone | Good for |
| --- | --- | --- |
| Guest | `+91 90000 00011` | Trips in every state, a stay ready to review, a wishlist |
| Host | `+91 90000 00003` | Live and pending listings, bookings and earnings |
| Host | `+91 90000 00007` | A rejected listing with the admin's reason |
| Admin | `+91 90000 00001` | The full control center |

Locally, the code appears via **Fill code from emulator** on the login page. On the live project, add the numbers as Firebase test numbers with code `123456` ([how](docs/deployment.md#demo-accounts)).

## Getting started

You need Node.js 22+ and Java 17+ (for the Firebase emulators).

```bash
npm install
npm run emulators   # terminal 1: Firebase Auth, Firestore and Storage on your machine
npm run dev         # terminal 2: the API and all four apps
```

Open http://localhost:5173. The API loads the demo data into the emulators on first start. The Emulator UI at http://localhost:4000 shows the data, sign-ins and uploaded files.

The website's dev server also forwards `/admin`, `/host`, `/account` and `/api` to the other servers, so the whole platform, and its login, works from `localhost:5173`.

### Commands

| Command | What it does |
| --- | --- |
| `npm run emulators` | Start the Firebase emulators (data is kept in memory) |
| `npm run dev` | Run the API and all four apps |
| `npm run dev:website` (or `dev:admin`, `dev:host`, `dev:account`, `dev:api`) | Run one part |
| `npm run typecheck` | Type-check every workspace |
| `npm test` | Run the backend tests on their own, separate emulators |
| `npm run build` | Production build of the four web apps |
| `npm run seed -w @meridian/api` | Load demo data into an empty project |

## Repository layout

```
apps/
  website/   public site              (React, Vite, React Router, Leaflet maps)
  account/   guest panel              (React, Vite, React Router)
  host/      property-owner portal    (React, Vite, React Router, Leaflet maps)
  admin/     control center           (React, Vite, React Router)
  api/       HTTP API                 (Hono on Node, Firebase Admin SDK)
    src/routes/        HTTP endpoints
    src/services/      business rules
    src/repositories/  all Firestore access, one file per collection
    src/store/         Firebase connection, demo data
    src/tests/         automated tests
firebase/                  Firestore and Storage security rules
packages/
  shared/            types, pricing, dates, default site content, API client
  ui/                logo, panel layout, sign-in handling, loaders, animations
  tailwind-config/   brand colours, font and motion
  tsconfig/          shared TypeScript settings
scripts/build-vercel.mjs   builds everything for Vercel
reference/index.html       the original single-file prototype
```

## How things work

- **Sign-in** is by Google or phone OTP through Firebase Authentication. Guests, hosts and admins each have their own login page; the admin one isn't linked from the website and only accepts admins. The API then sets a secure, HTTP-only session cookie shared by every app. Admins choose which sign-in methods are on in Settings.
- **Roles:** everyone signs up as a guest. Creating a first listing makes you a host. Only an admin can make someone an admin.
- **Listings** go live only after an admin approves them. Any edit sends a listing back for review.
- **Pricing** is in Indian rupees (₹) and calculated on the server when booking: the nightly price covers two guests and each extra guest adds 15%. Guests pay **no booking fee**. Money is stored in paise.
- **Two kinds of property.** *Managed* properties are run and maintained by Meridian: guests **book instantly** and Meridian's commission is **30%**. *Self-managed* properties are run by the host: guests send a **request**, the host accepts or declines within **24 hours**, and the commission is **15%**. Admins set each listing's type (Listings page) and the rates (Settings → Commission).
- **Payments** go through **Razorpay** (UPI, cards, net banking). Admins enter the Razorpay keys in Settings → Payments; secrets are encrypted before they're stored and never shown again. Instant bookings are charged at checkout. Requests are only authorised at checkout and charged when the host accepts; declined or expired requests are never charged. Until payments are switched on, everything runs in test mode without taking money.
- **Cancellations:** full refund up to 48 hours before check-in, otherwise everything except the first night. Refunds go back through Razorpay automatically.
- **Photos** upload to Firebase Storage through the API. Browsers have no direct access to Firestore or Storage.
- **Double bookings** are impossible: each booked or blocked night is claimed inside a Firestore transaction, so two guests can never get the same night.
- **Reviews** can only be written by a guest whose stay has finished, once per booking.

## Installing as a phone app

The website is a **Progressive Web App**: the **Download app** button in the header adds Meridian Stay to a phone's home screen with its own icon, opening full screen. Android and desktop Chrome/Edge get a one-tap install prompt; iPhones get Safari's "Add to Home Screen" steps. The files are in `apps/website/public`: `manifest.webmanifest` (name, colours, icons, shortcuts), `icons/`, `sw.js` (offline page only, no caching of data) and `offline.html`. The install logic is `apps/website/src/lib/install.ts`.

To change the app icon, replace the PNGs in `apps/website/public/icons/` (192×192 and 512×512, plus a 512×512 `maskable` version with the logo inside the middle 80%, and a 180×180 `apple-touch-icon`).

## Keeping this up to date

Every change to the repository gets an entry in [CHANGELOG.md](CHANGELOG.md), in the same commit.
