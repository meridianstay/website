# Changelog

Every change to Meridian Stay is recorded here, newest first. Each entry says what changed for the people using the platform, then the notable technical changes.

## 0.5.0 — 2026-09-19

The platform now runs entirely on **Firebase**, as the client requested. PostgreSQL has been removed.

### Sign-in
- Sign in with **Google** or a **phone OTP**; there are no passwords. First sign-in creates the account, and phone users are asked their name.
- **Three separate login pages:** guests at `/login` (on the website), hosts at `/host/login` (linked from the website as "Host login"), and the control center at `/admin/login`, which isn't linked from the website, is hidden from search engines and only accepts admin accounts.
- Each app sends signed-out visitors to its own login page and back to where they were afterwards.
- Logging out signs you out on every device. Suspending a user also disables their Firebase account.

### Photos
- Hosts **upload photos** in the listing wizard (cover and up to 12 more), with pasting a link still possible. Guests and hosts can upload a **profile photo**. Photos are stored in Firebase Storage.

### Control center
- New **Settings** page: Firebase connection status (Firestore, Authentication, Storage), turn Google and phone sign-in on or off for guests and hosts, and set the largest photo size. The Firebase key is never shown.
- The **Database** screen now browses Firestore collections, with type and range checks on every edit.
- The website's account menu no longer links to the control center.

### Account
- The change-password form is gone (there are no passwords); the profile now has a photo upload and a contact phone.

### Backend
- Repositories rewritten for **Cloud Firestore** through the Firebase Admin SDK; services, routes and the API itself are unchanged for the apps. See [docs/database.md](docs/database.md) for the data model.
- Double bookings are still impossible: each booked or blocked night is claimed in a Firestore transaction. A new test races three guests for the same nights; exactly one wins.
- Local development and tests use the **Firebase emulators** (`npm run emulators`); tests get their own separate emulators.
- 32 automated tests, rewritten for Firebase.
- Security rules in `firebase/` block all direct browser access to Firestore and Storage.
- The Vercel build bundles the API, including `firebase-admin`, into one function file. The Firebase web config for the client's project (`meridianstay-bcfd0`) is in `.env.production`; the service key goes in Vercel as `FIREBASE_SERVICE_ACCOUNT`.
- Demo data recreated in Firebase, with test phone numbers for every demo account (code `123456`).

### Docs
- Rewritten [database](docs/database.md), [deployment](docs/deployment.md) and [API](docs/api.md) guides and README for Firebase.

### Fixes
- The Vercel API function now reports configuration problems (missing, malformed or incomplete `FIREBASE_SERVICE_ACCOUNT`, unreachable Firebase) as a readable message instead of crashing. Errors never include any part of the key.
- Fixed the API crashing on Vercel after the Firebase move: `firebase-admin` is now bundled into the function file instead of installed beside it.

## 0.4.0 — 2026-09-19

### Control center
- New **Database** screen: browse all 15 tables with live row counts, search every column, sort, page through rows, and open any row. Safe columns can be edited, some tables allow adding and deleting rows, and the database's own rules still reject invalid values. Passwords and session tokens are never shown. Every change is recorded in the activity log with the old and new values.

### Backend
- Reorganised the API into layers: **repositories** (all SQL, one file per table), **services** (business rules) and thin **routes**. Behaviour is unchanged; every earlier flow was re-tested.
- One error type for the whole API, so every failure returns a consistent, user-friendly message.
- Shared API types moved out of the browser-only client, so the backend and frontends use the same definitions.
- **Automated tests**: 31 tests covering pricing, double bookings, host blocks, cancellations, reviews and ratings, sign-up, log-in, suspension, password changes, listing rules and the Database screen. Run with `npm test`.

### Docs
- New [API reference](docs/api.md) listing every endpoint with access rules, inputs and responses.
- The [database guide](docs/database.md) now explains the backend layers, tests and ways to manage data.

## 0.3.0 — 2026-09-19

The platform now works end to end: guests can search and book, hosts can list and manage properties, and admins can run the platform and edit the website, all on a real database.

### Website (`/`)
- Search works: destination (with suggestions), a date-range calendar and a guest count, from both the homepage and the header on every page, including phones.
- New **search results** page with type filters, price range, sorting, and a map view with price pins. Only stays free on the chosen dates are shown. Search settings live in the address, so results can be shared.
- Category tiles now open the matching results. Rooms appear in search.
- New **stay page**: photo gallery with a full-screen viewer, host, size, description, amenities, map, reviews, share and save buttons, and a booking box with a calendar that blocks booked dates and shows the full price breakdown.
- New **checkout** (login required) with contact details, a message for the host, payment method and terms. Payments are in **test mode**: no money is taken and no card details are collected.
- New **booking confirmation** page with the booking reference.
- **Log in and sign up** pages. The header shows the signed-in user and an account menu (trips, wishlist, profile, host dashboard, admin console, log out). Visitors who aren't signed in no longer see a stock profile photo.
- Wishlist hearts save to the account and ask visitors to log in first.
- Guests who finished a stay can **leave a review** on the stay page, once per booking.
- **Information pages** for every footer link (how it works, help, policies and more), a **contact form**, a **sitemap** and a proper **"not found"** page. Admins edit these pages.
- The homepage headline, featured stays and an optional **announcement banner** come from the control center.
- "Become a Host" and "Meridian your home" open the host portal.
- Fixed: sections reached from links were hidden under the sticky header; dates used UTC and could show the wrong day in India; the copyright year was fixed at 2026.

### Guest account (`/account`)
- Trips from the database: upcoming, completed and cancelled, with **cancel booking** (until the day before check-in) and **write a review** for finished stays.
- Wishlist and profile (name and phone) save to the account. New **change password** form.

### Host portal (`/host`)
- Dashboard with real earnings (after service fees), live listings, upcoming stays and average rating.
- **Listing wizard** in six steps: type, location with a map pin, rooms and amenities, photos and description, price (with a guest-price preview), review. The same wizard edits existing listings.
- New listings and every edit go to admins for review. Rejected listings show the admin's reason.
- **Calendar** per listing to block and unblock dates.
- **Pause** a listing, or send a paused or rejected listing back for review.
- Bookings list with guest name, phone, message and payout.
- Anyone signed in can start hosting; their first listing makes them a host.

### Control center (`/admin`)
- Overview with live statistics, listings waiting for review and the latest bookings.
- **Listings:** search and filter, approve, reject or take down with a reason, feature on the homepage.
- **Bookings:** search and cancel.
- **Users:** search, filter by role, change roles, suspend and restore. Suspended users are signed out immediately and can't log in.
- **Reviews:** hide and restore. Ratings update automatically.
- **Messages:** contact-form inbox with reply-by-email, read and closed states.
- **Website content:** homepage headline and featured-section text, announcement banner, and information pages (edit, create, unpublish, delete).
- **Activity log** of every admin action.

### Whole platform
- Branded **preloader**, page transitions, and entrance and interaction animations (menus, dialogs, cards, wishlist heart, booking checkmark). Motion is reduced for visitors who ask their device for less motion.
- The four apps share one domain (`/`, `/account`, `/host`, `/admin`) and one login. They can move to subdomains later with settings only.
- **Demo data** for client previews: 16 users, 17 listings across India and Bali, bookings in every state, reviews, date blocks, messages and admin history. Every demo account uses the password `meridian123`.

### Technical
- New `apps/api`: Hono on Node with PostgreSQL (`pg`). Versioned SQL migrations run automatically; see [docs/database.md](docs/database.md).
- Double bookings are prevented by a PostgreSQL exclusion constraint, and prices are recalculated on the server.
- Sessions use HTTP-only cookies with hashed tokens; passwords use scrypt; log-in, sign-up and contact are rate-limited.
- Shared packages: API client and response types in `@meridian/shared`; sign-in handling, loaders and panel layout in `@meridian/ui`; motion in the Tailwind preset.
- Font Awesome now loads only the solid icon set; maps use Leaflet with OpenStreetMap.
- New Vercel build (`vercel.json`, `scripts/build-vercel.mjs`) serving all four apps and the API from one project; see [docs/deployment.md](docs/deployment.md). This fixes the failed Vercel deployment after the monorepo change.
- Removed the old in-browser sample data.

## 0.2.0 — 2026-09-19

- Split the project into a monorepo: `apps/website`, `apps/admin`, `apps/host`, `apps/account`, with shared `ui`, `shared`, `tailwind-config` and `tsconfig` packages (npm workspaces and Turborepo).
- First versions of the admin, host and account panels, using sample data.

## 0.1.0 — 2026-09-19

- Built the Meridian Stay homepage in React from the design: header, hero search, property types, featured stays, host banner and footer.

## Not yet built

- **Real payments.** Connect a provider (for example Razorpay for UPI, cards and net banking) at checkout, with refunds on cancellation.
- **Emails and SMS**: booking confirmations and cancellation notices (Firebase only sends the sign-in codes).
- **Messaging** between guests and hosts.
- **Currency and prices** for a local market (currently USD; one setting switches it) and taxes such as GST on invoices.
- **Host payouts** and payout details.
- **Search engine pages.** Stay pages are built in the browser; moving the website to server rendering (e.g. Next.js) would help Google and link previews.
- **Legal review** of the pages marked "draft".
- Automated tests.
