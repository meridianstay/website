# Changelog

Every change to Meridian Stay is recorded here, newest first. Each entry says what changed for the people using the platform, then the notable technical changes.

## 0.6.0 — 2026-09-19

Rupee pricing, commission, two booking modes and Razorpay payments.

### Pricing and commission
- All prices are in **Indian rupees (₹)**, with Indian digit grouping (₹1,32,829.50). Demo listings have rupee prices.
- Guests pay **no booking fee**; the fee line is gone from every price breakdown.
- Meridian earns a **commission** taken from the host's payout: **30%** on properties Meridian manages and **15%** on properties hosts manage themselves. Admins can change both rates in Settings → Commission (new rates apply to new bookings).

### Two booking modes
- **Managed properties** (run and maintained by Meridian) book **instantly**.
- **Self-managed properties** take **booking requests**: the guest's dates are held while the host accepts or declines within **24 hours**. Unanswered requests expire and free the dates. Guests can withdraw a request free of charge.
- Admins set each listing to managed or self-managed on the Listings page. New host listings start as self-managed.
- Stay pages and checkout say which mode applies ("Instant book" or "Request to book").

### Payments (Razorpay)
- New **Settings → Payments** in the control center: switch online payments on, enter the Razorpay Key ID, key secret and webhook secret, and test the connection. Secrets are **encrypted** (AES-256-GCM, with `SETTINGS_ENCRYPTION_KEY` from Vercel) and are never shown again. Changes are logged in the activity log without the secrets.
- Checkout opens **Razorpay Checkout** (UPI, cards, net banking). Every payment's signature is checked on the server before a booking is confirmed.
- Instant bookings are charged at checkout. Requests are only **authorised**, then charged when the host accepts; declined or expired requests are never charged.
- Dates are held for 15 minutes while a guest pays. Guests who close the payment window can finish paying from the booking page.
- A **Razorpay webhook** (`/api/payments/razorpay/webhook`) confirms bookings even if the guest closes the page right after paying.
- **Refunds** go back through Razorpay automatically: full refund up to 48 hours before check-in, otherwise everything except the first night. Admin cancellations refund in full. If Razorpay refuses a refund, the booking is flagged and an admin can retry it.
- Without keys, everything runs in **test mode** as before.

### Host portal
- **Requests to answer**, with time left, the guest's message, commission and payout, and Accept / Decline (with an optional message the guest sees).
- The dashboard shows a banner for waiting requests, and earnings are now payouts after commission.
- Bookings list the guest's payment, the commission and the host's payout. The listing wizard shows the payout after commission and the property's booking mode.

### Guest account and website
- Trips show requests waiting for a host (with the deadline), unfinished payments, and refunds. Cancelling shows how much comes back.
- The booking page explains each state: payment pending, request sent, confirmed, declined (with the host's message), expired or cancelled.

### Control center
- Overview shows **commission earned**, bookings awaiting hosts and gross booking value after refunds.
- Bookings can be filtered by status and show payment, commission and host payout; cancel any upcoming booking or request with a full refund.
- **Reset demo data** (only while `SEED_DEMO_DATA=true`) replaces listings, bookings and reviews with fresh demo data, keeping real accounts, content and payment keys. Use it once on the live preview to switch it to rupee prices.

### Backend
- New booking states: `AwaitingPayment`, `Requested`, `Declined`, `Expired`. Booking documents store the management type, commission rate, commission, host payout, Razorpay order and payment ids, refunds and the expiry time.
- Night documents carry `holdUntil` for payment holds and requests; a lapsed hold counts as free and the next booking takes it over in the same transaction. Lapsed holds are also swept on reads, and by `GET /api/cron/expire` (with `CRON_SECRET`) for an optional scheduler.
- New endpoints: `GET /bookings/:code/payment`, `POST /bookings/:code/pay`, `POST /host/bookings/:code/accept|decline`, `POST /admin/listings/:id/management`, `POST /admin/bookings/:code/refund`, `GET|PUT /admin/payments`, `POST /admin/payments/test`, `GET /admin/demo`, `POST /admin/demo/reset`, `POST /payments/razorpay/webhook`. `POST /bookings` now also returns `payment`, and `GET /site` returns `paymentsOnline`.
- 53 automated tests (up from 32), including commission, request accept / decline / expiry, hold takeover, and payments against a fake Razorpay (signature checks, capture on accept, refunds, webhook, encryption).

### Fixes
- **Host bookings page showed a blank page** when bookings made before this version were listed (they had no commission or refund values, which reached the page as empty numbers and crashed it). Older bookings now get commission, payout and refund values filled in, and prices that are missing show as "—" instead of breaking the page.
- **Reset demo data** now deletes and recreates everything in parallel, so it finishes well within the hosting time limit on the live Firebase project.
- The sign-in error "This sign-in method isn't switched on in Firebase yet" means Google or Phone isn't enabled in the Firebase console; the deployment guide now says exactly where.
- Login pages now say when phone codes are blocked by Firebase's **SMS region policy** (India not allowed) instead of saying the method is off, and when phone sign-in needs the Blaze plan. The deployment guide covers the region policy and authorized domains.

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
- `/api/health` now checks that Firestore answers and reports Firebase's reason when it doesn't.
- The Vercel API function now reports configuration problems (missing, malformed or incomplete `FIREBASE_SERVICE_ACCOUNT`, unreachable Firebase) as a readable message instead of crashing. Errors never include any part of the key.
- Fixed the API crashing on Vercel after the Firebase move: `firebase-admin` is now bundled into the function file instead of installed beside it, with the CommonJS globals (`__dirname`, `__filename`, `require`) its dependencies expect.

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

- **Emails and SMS**: booking confirmations and cancellation notices (Firebase only sends the sign-in codes).
- **Messaging** between guests and hosts.
- **GST invoices** and taxes on bookings and commission.
- **Host payouts**: sending hosts their share (e.g. Razorpay Route) and collecting their bank details. Payout amounts are already calculated.
- **Search engine pages.** Stay pages are built in the browser; moving the website to server rendering (e.g. Next.js) would help Google and link previews.
- **Legal review** of the pages marked "draft".
- Automated tests.
