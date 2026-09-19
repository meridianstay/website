# Data and backend

Meridian Stay runs entirely on **Firebase**:

| Firebase service | What it holds |
| --- | --- |
| **Cloud Firestore** | All platform data: users, listings, bookings, reviews, wishlists, site content, messages, the admin activity log |
| **Authentication** | Sign-in with Google or phone OTP. Firebase keeps the sign-in identities; roles and profiles live in Firestore. |
| **Cloud Storage** | Uploaded listing photos and profile pictures |

Browsers never read or write Firestore or Storage directly. The security rules in [`firebase/`](../firebase) deny all direct access, and everything goes through the API (`apps/api`), which uses the Firebase Admin SDK and enforces roles and business rules.

## How the backend is organised

The API in `apps/api/src` is split into layers, and **Firestore is only used in the repositories**:

| Folder | Job |
| --- | --- |
| `routes/` | HTTP only: read the request, call a service or repository, send the reply |
| `services/` | Business rules: sign-in, booking checks, listing review, moderation, content, uploads |
| `repositories/` | All Firestore reads and writes, one file per collection or area |
| `store/` | Firebase connection (`firebase.ts`), collection names and helpers (`db.ts`), demo data (`seed.ts`) |
| `explorer/` | Which collections and fields the admin Database screen may show and edit |
| `http/` | Errors, sign-in middleware, validation, rate limits |
| `tests/` | Automated tests, run against their own Firebase emulators |

## Collections

Documents use short numeric ids (listing 7, user 12…) so links stay readable. The next number comes from the `counters` collection inside a transaction. Timestamps are ISO strings (`2026-09-19T08:30:00.000Z`); stay dates are `YYYY-MM-DD`. Money is in Indian rupees, stored as whole numbers of **paise** in fields ending in `Minor` (650000 = ₹6,500).

| Collection | Document id | Holds |
| --- | --- | --- |
| `users` | Firebase sign-in id (uid) | `id`, `name`, `email`, `phone`, `role` (guest, host, admin), `avatarUrl`, `createdAt`, `suspendedAt`, `sessionsRevokedAt` |
| `properties` | listing id | Everything about a stay: title, type, location and map position, price, rooms, `status`, `rejectionReason`, `coverImageUrl`, `photos`, `amenities`, `ratingAvg`, `reviewCount`, `featuredRank`, `management` (`managed`: instant booking; `self`: requests) |
| `properties/{id}/nights` | a date, e.g. `2026-10-21` | One document per booked, requested or blocked night: `{ kind: "booking" \| "block", ref, holdUntil }`. `holdUntil` is set while a payment or host answer is pending; once it has passed, the night counts as free. |
| `bookings` | booking code, e.g. `MS-7K3F9Q` | Dates, guests, a **copy of the price and listing at booking time**, the guest's contact details, `status` (`AwaitingPayment`, `Requested`, `Confirmed`, `Declined`, `Expired`, `Cancelled`), `management`, `commissionPct`, `commissionMinor`, `hostPayoutMinor`, `paymentStatus`, `razorpayOrderId`, `razorpayPaymentId`, `refundedMinor`, `expiresAt`, `declineReason`, `reviewed` |
| `reviews` | review id | `propertyId`, `rating`, `comment`, `authorName`, `bookingCode`, `hiddenAt` |
| `availabilityBlocks` | block id | Nights a host has closed: `propertyId`, `checkIn`, `checkOut`, `note` |
| `wishlists` | `{userId}_{propertyId}` | Stays a guest has saved |
| `amenities` | amenity name | `icon` (Font Awesome name) and display `order` |
| `siteSettings` | `homepage`, `announcement`, `signIn`, `uploads`, `commission` | Settings edited in the control center |
| `secrets` | `razorpay` | Razorpay Key ID, and the key secret and webhook secret **encrypted** with `SETTINGS_ENCRYPTION_KEY`. Not shown on the Database screen. |
| `contentPages` | page address, e.g. `help` | Title, intro and sections of information pages; `published`, `draft` |
| `contactMessages` | message id | Contact-form messages with status `new`, `read` or `closed` |
| `auditLog` | automatic | Every admin action: who, what, which record, details |
| `counters` | sequence name | The last number used for each kind of record |

### How double bookings are prevented

Every confirmed booking and every host block owns one document per night in `properties/{id}/nights`. A booking is created in a **Firestore transaction** that first checks those night documents and only then creates them. If two guests try to book the same night at the same moment, Firestore makes one transaction retry, which then sees the night taken and fails. The automated tests include this race. Cancelling a booking or removing a block deletes its night documents in the same transaction.

### Booking modes and payments

- **Managed** listings book instantly. With Razorpay on, the booking waits in `AwaitingPayment` (dates held for 15 minutes), then becomes `Confirmed` once the payment is verified and captured.
- **Self-managed** listings take requests: after payment is authorised (not captured) the booking is `Requested`, and the dates are held until the host answers or 24 hours pass. Accepting captures the payment and confirms; declining or expiry releases it.
- Commission (30% managed, 15% self-managed by default; Settings → Commission) is fixed on each booking when it's made. After a partial refund, commission and payout are recalculated on what the guest actually paid.
- Every state change goes through one transaction that updates the booking and its night documents together.

### Sign-in and sessions

1. The browser signs in with Firebase (Google popup or phone OTP) and sends the resulting ID token to `POST /api/auth/session`, saying which login page (portal) it came from.
2. The API verifies the token, creates the user on first sign-in (as a guest), refuses suspended users, and on the admin portal refuses anyone who isn't an admin.
3. It then sets a **Firebase session cookie** (HTTP-only, 14 days) shared by every app.
4. Logging out, or being suspended, sets `sessionsRevokedAt`, which invalidates every earlier session. Suspension also disables the account in Firebase Authentication.

Roles are stored only in Firestore and can only be changed by admins (or become `host` automatically with a first listing).

### Ratings

`ratingAvg` and `reviewCount` on each listing are updated in the same transaction as adding, hiding or restoring a review, so pages never need to recount. Demo listings start with imported totals.

## Managing data

- **Admin → Database** in the control center lets admins browse every collection, search, sort and edit the fields that are safe to change directly, with type checks and range checks. Every change is recorded in the activity log with before and after values. Business actions (approving listings, suspending users, cancelling bookings, hiding reviews, host blocks) stay on their own pages so their rules always apply. The allowed collections and fields are listed in [`explorer/registry.ts`](../apps/api/src/explorer/registry.ts).
- **The Firebase console** (Firestore, Authentication, Storage) shows the same data directly. Changes made there bypass the app's rules and aren't logged, so use it with care.

## Local development and tests

`npm run emulators` starts the Firebase emulators (Auth, Firestore, Storage, and an Emulator UI at http://localhost:4000). The API connects to them automatically in development (settings in `apps/api/.env.emulators`) and loads the demo data on first start. Emulator data is kept in memory, so restarting them clears it; restart the API afterwards to reload the demo data.

`npm test` starts a **separate** set of emulators (ports in `firebase.test.json`, project `demo-meridianstay-test`), runs the tests and shuts them down, so tests never touch your development data. The test helpers refuse to run against any project whose id doesn't end in `-test`.

The Firebase CLI in this repo is version 13, which works with Java 17. Newer versions need Java 21 (`brew install openjdk@21`).

## Demo data

[`store/seed.ts`](../apps/api/src/store/seed.ts) fills an empty project with fictional demo data: 16 people, 17 listings, bookings in every state, reviews, blocks, messages and admin history. It runs in development, and in production only when `SEED_DEMO_DATA=true`. It never runs if any users exist. Each demo person has a Firebase sign-in with a test phone number; see [deployment](deployment.md#demo-accounts).

## Scaling notes

Some list screens (search, admin tables, statistics) read whole collections and filter in the API. That is simple and fast at this platform's size (thousands of documents). When listings or bookings grow into the tens of thousands, add Firestore indexes (`firebase/firestore.indexes.json`) and move those filters into queries, starting with search and the admin bookings list.
