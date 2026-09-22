# API reference

The Meridian Stay API is served at **`/api`** on the same domain as the apps, for example `https://website-seven-sable-30.vercel.app/api`. In development it runs at `http://localhost:8787/api`; the website's dev server forwards `/api` to it.

The code lives in [`apps/api`](../apps/api). Each endpoint below is defined in `src/routes/`. Routes call services (business rules), which call repositories (Firestore).

## Conventions

| Topic | Rule |
| --- | --- |
| Format | JSON in and out. Send `Content-Type: application/json` with a body. |
| Sign-in | Sign in with Firebase (Google or phone OTP) in the browser, then send the ID token to `POST /api/auth/session`. That sets a session cookie, `ms_session` (HTTP-only, 14 days), used by every app. |
| Access | **Public**: anyone. **User**: any signed-in account. **Admin**: accounts with the `admin` role. Signed-out calls to protected endpoints return `401`; wrong role returns `403`. |
| Money | Indian rupees, as normal amounts in API responses (e.g. `6500` = ₹6,500). The database stores paise. |
| Dates | Stay dates are `YYYY-MM-DD`. Timestamps are ISO 8601 (`2026-09-19T08:30:00.000Z`). |
| Stay ranges | `checkIn` up to, not including, `checkOut`. Back-to-back stays may share a day. |
| No content | Actions that return nothing reply `204 No Content`. |
| Rate limits | Sign-in: 30 per 15 minutes per IP. Uploads: 60. Contact form: 5. Over the limit returns `429`. |

### Errors

Every error returns a JSON body with a message that is safe to show to users. Validation errors (`400`) also list the fields that failed:

```json
{
  "error": "Check-in can’t be in the past.",
  "fields": { "checkIn": "Check-in can’t be in the past.", "contactPhone": "Enter a valid phone number, e.g. +91 98765 43210." }
}
```

| Status | Meaning |
| --- | --- |
| `400` | Invalid input, or an action not allowed in the current state |
| `401` | Not signed in, or the Firebase sign-in token is invalid or expired |
| `403` | Signed in but not allowed (wrong role, suspended account, review not allowed) |
| `404` | Not found, or not visible to you |
| `409` | Conflict: dates already booked or blocked |
| `429` | Too many attempts |
| `500` | Unexpected server error (details are logged, not returned) |
| `503` | Firebase not configured (`FIREBASE_SERVICE_ACCOUNT` missing) or still starting (Vercel only) |

---

## Health

| Method | Path | Access | Returns |
| --- | --- | --- | --- |
| GET | `/api/health` | Public | `{ "ok": true }` when Firestore answers; otherwise `503 { ok: false, firestore: "<Firebase's reason>" }` |

## Accounts and sign-in

| Method | Path | Access | Body | Returns |
| --- | --- | --- | --- | --- |
| GET | `/api/auth/me` | Public | — | `{ user }`, or `{ user: null }` when signed out |
| POST | `/api/auth/session` | Public | `{ idToken, portal: "guest" \| "host" \| "admin" }` | `{ user }` and sets the session cookie. First sign-in creates a guest account. `401` bad token; `403` suspended, method turned off in Settings, or a non-admin on the admin portal. |
| POST | `/api/auth/logout` | Public | — | `204`; signs the user out on every device |
| PATCH | `/api/me` | User | `{ name, phone }` (phone optional; a contact number) | `{ user }` |
| POST | `/api/uploads` | User | Multipart form: `file` (JPG, PNG or WebP), `purpose` = `listing` or `avatar` | `201 { url }`, a Firebase Storage link. `avatar` also sets the profile photo. Size limit set in Settings (max 4 MB). |

`idToken` comes from the Firebase JS SDK after `signInWithPopup` (Google) or `signInWithPhoneNumber` + `confirm` (phone): `await firebaseUser.getIdToken()`. The admin portal always accepts both methods; guest and host portals accept only the methods switched on in Admin → Settings.

**User object** (`user`): `{ id, name, email, phone, role: "guest" | "host" | "admin", avatar, createdAt }`. `email` is `null` for phone sign-ins.

## Stays (public)

| Method | Path | Access | Returns |
| --- | --- | --- | --- |
| GET | `/api/properties` | Public | `{ properties: PropertySummary[] }`, live listings only |
| GET | `/api/promoted` | Public | `?placement=search\|home\|destination&where=&type=` → `{ properties }` (each with `promotionId`). Counts one view per listing returned. |
| POST | `/api/promoted/:id/click` | Public | `204`, counts a click |
| GET | `/api/destinations` | Public | `{ destinations: [{ slug, name, kind: "city" \| "state", region, stays, image, lat, lng, types }] }`, most stays first |
| GET | `/sitemap.xml`, `/robots.txt` | Public | For search engines (served by the API) |
| GET | `/api/properties/:slug/day` | Public | `?date=YYYY-MM-DD` → `{ date, opensAt, closesAt, busy: [{ start, end, reason }] }` for day use |
| GET | `/api/properties/:slug` | Public | `{ property: PropertyDetail }`. Hosts and admins can also preview their listings that aren’t live yet. |
| GET | `/api/locations` | Public | `{ locations: ["Coorg, Karnataka", …] }` for search suggestions |
| GET | `/api/amenities` | Public | `{ amenities: [{ name, icon }] }` |

**`GET /api/properties` query parameters** (all optional):

| Parameter | Meaning |
| --- | --- |
| `where` | A property code (e.g. `MS007`) finds that stay; otherwise Text matched against title, city, region and country |
| `type` | `Farmstay`, `Room`, `Resort`, `Cottage` or `Villa` |
| `checkIn`, `checkOut` | Only stays free for the whole range (no bookings or host blocks) |
| `guests` | Stays that fit at least this many guests |
| `minPrice`, `maxPrice` | Nightly price range |
| `sort` | `recommended` (default), `price_asc`, `price_desc`, `rating`, `newest`, `nearest` (with `lat` and `lng`) |
| `lat`, `lng` | A point to measure distance from |
| `management` | `managed` (instant book only) or `self` (request to book only) |
| `featured` | `true`: only stays featured on the homepage, in featured order |
| `limit` | Up to 100 (default 50) |

**PropertySummary**: `{ id, slug, title, type, location, price, rating, reviewCount, beds, baths, maxGuests, image, description, lat, lng }`

**PropertyDetail** adds:
- `gallery`: photo URLs
- `amenities`: `[{ name, icon }]`
- `host`: `{ name, joinedAt, avatar }`
- `reviews`: the latest 30 visible reviews
- `bookedRanges`: `[{ checkIn, checkOut }]`, future booked or blocked nights
- `reviewableBookingCode`: the signed-in guest's finished, unreviewed stay here, or `null`

## Reviews

| Method | Path | Access | Body | Returns |
| --- | --- | --- | --- | --- |
| POST | `/api/properties/:slug/reviews` | User | `{ bookingCode, propertyRating: 1–5, serviceRating: 1–5, comment }` (comment 10–2000 characters; the overall rating is the average) | `201`. `403` unless the booking is yours, finished and not yet reviewed. |

## Bookings (guests)

| Method | Path | Access | Body | Returns |
| --- | --- | --- | --- | --- |
| POST | `/api/bookings` | User | `{ propertyId, checkIn, checkOut, guests, paymentMethod: "upi" \| "card" \| "netbanking", contactPhone, specialRequests?, adults?, children?, infants?, pets? }`. For a day out: `kind: "dayuse"`, `checkIn` (the date), `startTime: "HH:MM"`, `hours` (no `checkOut`). | `201 { booking, payment }`. Price is calculated by the server. `payment` is `null` in test mode, otherwise the details for Razorpay Checkout (below). `409` if the dates were just booked, requested or blocked. |
| POST | `/api/bookings/coupon` | User | `{ code, total, kind }` → `{ code, discount, label, description }`, or `400` with the reason |
| GET | `/api/bookings` | User | — | `{ bookings }`, your bookings, newest check-in first (abandoned checkouts are left out) |
| GET | `/api/bookings/:code` | User | — | `{ booking }`, if you are the guest, the host or an admin |
| GET | `/api/bookings/:code/payment` | User | — | `{ payment }` again for your unfinished checkout, while the dates are still held |
| POST | `/api/bookings/:code/pay` | User | `{ razorpay_order_id, razorpay_payment_id, razorpay_signature }` (what Razorpay Checkout returns) | `{ booking }`, now `Confirmed` (instant) or `Requested`. `400` if the signature doesn't verify. |
| POST | `/api/bookings/:code/cancel` | User | — | `{ booking }`. Cancel your booking, withdraw a request or abandon a checkout, until the day before check-in. Paid bookings are refunded in full up to 48 hours before check-in, otherwise minus the first night. |

Booking rules: check-in today or later, at most 30 nights, guests within the listing's limit, and you can't book your own listing. No guest fee is added.

Booking modes: listings with `management: "managed"` book instantly (`Confirmed`, or `AwaitingPayment` then `Confirmed` with Razorpay). Self-managed listings create a `Requested` booking the host must answer within 24 hours (`expiresAt`); with Razorpay the payment is only authorised until the host accepts.

**Booking object**: `{ id, code, property: { slug, title, type, location, image }, checkIn, checkOut, nights, guests, pricePerNight, baseAmount, extraGuestAmount, serviceFee (always 0), total, status: "AwaitingPayment" | "Requested" | "Confirmed" | "Completed" | "Declined" | "Expired" | "Cancelled", paymentMethod, paymentStatus: "test" | "created" | "authorized" | "paid" | "refunded" | "partially_refunded" | "released" | "failed", refunded, expiresAt, instantBook, declineReason, contactPhone, specialRequests, createdAt, reviewed }`

**Payment object**: `{ provider: "razorpay", keyId, orderId, amount (paise), currency: "INR", captureNow }`. Pass these to Razorpay Checkout, then send its result to `POST /api/bookings/:code/pay`.

## Payments (Razorpay)

| Method | Path | Access | Returns |
| --- | --- | --- | --- |
| POST | `/api/payments/razorpay/webhook` | Razorpay (checked by the `X-Razorpay-Signature` header and the webhook secret) | `{ ok: true }`. Handles `payment.authorized`, `payment.captured` and `payment.failed`, so bookings complete even if the guest's browser closed. |
| GET | `/api/cron/expire` | `Authorization: Bearer $CRON_SECRET` | `{ expired }`, the number of lapsed checkouts and requests closed |

## Wishlist

| Method | Path | Access | Returns |
| --- | --- | --- | --- |
| GET | `/api/wishlist` | User | `{ properties: PropertySummary[] }` |
| PUT | `/api/wishlist/:propertyId` | User | `204` (adding twice is fine) |
| DELETE | `/api/wishlist/:propertyId` | User | `204` |

## Website content (public)

| Method | Path | Access | Returns |
| --- | --- | --- | --- |
| GET | `/api/site` | Public | `{ homepage: {…}, announcement: { enabled, text, linkLabel, linkUrl }, signIn: { google, phone }, uploads: { maxMb }, commission: { managedPct, selfPct }, paymentsOnline }` |
| GET | `/api/home` | Public | `{ layout: { hero: { mode: "static" \| "slider", slides: [{ badge, title, highlight, subtitle, image, buttonLabel, buttonUrl }], intervalSec, showSearch }, blocks: [...] }, stays: { [blockId]: PropertySummary[] } }`. Only switched-on sections; `stays` has the listings for each "Stays" section. |
| GET | `/api/about` | Public | `{ page: { hero, sections: { company, mission, vision, journey, founder, team, goals, globalImpact, localImpact, whyUs } }, stats: { liveStays, hosts, destinations, states, guestNights, managedStays } }`. Each section is `{ title, tagline, body, items: [{ icon, title, meta, text, image }] }`; `{{name}}` in any text is a live figure from `stats`. |
| GET | `/api/pages` | Public | `{ pages: [{ slug, title }] }`, published pages |
| GET | `/api/pages/:slug` | Public | `{ page: { slug, title, intro, sections: [{ heading, body: [] }], draft } }` |
| POST | `/api/contact` | Public | Body `{ name, email, topic, message }`. `201`. |

Contact topics: `Booking help`, `Hosting`, `Payments & refunds`, `Trust & safety`, `Press`, `Partnerships & investors`, `Other`.

## Host portal

Every host endpoint needs a signed-in user and only acts on that user's own listings; other listings return `404`. Anyone signed in can create a listing, and their first listing makes them a host.

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/api/host/stats` | — | `{ earnings, requests, listings, live, rated, avgRating, upcoming }` (earnings are payouts after commission) |
| GET | `/api/host/listings` | — | `{ listings }` with `status` and `rejectionReason` |
| GET | `/api/host/listings/:id` | — | `{ listing }` in the editor's format (below) |
| POST | `/api/host/listings` | Listing (below) | `201 { id }`, status `Pending` |
| PUT | `/api/host/listings/:id` | Listing | `204`; the listing goes back to `Pending` |
| POST | `/api/host/listings/:id/pause` | — | `204`; live or pending → paused (`Draft`) |
| POST | `/api/host/listings/:id/relist` | — | `204`; paused or rejected → `Pending` |
| GET | `/api/host/listings/:id/calendar` | — | `{ blocks: [{ id, checkIn, checkOut, note }], bookings: [{ code, checkIn, checkOut, guestName, requested }] }` |
| POST | `/api/host/listings/:id/blocks` | `{ checkIn, checkOut, note? }` | `201`. `409` if guests booked those nights or it overlaps a block. |
| DELETE | `/api/host/listings/:id/blocks/:blockId` | — | `204` |
| GET | `/api/host/listings` | — | Each listing also has `promoted` (a promotion is showing today) |
| GET | `/api/host/promotions` | — | `{ campaigns, settings }` |
| POST | `/api/host/promotions` | `{ propertyId, placement, startDate, days }` | `201 { campaign, payment }` (`payment` is null in test mode) |
| POST | `/api/host/promotions/:id/pay` | Razorpay Checkout's result | `{ campaign }`, now waiting for review |
| POST | `/api/host/promotions/:id/cancel` | — | `{ campaign }`; unused days are refunded |
| GET | `/api/host/bookings` | — | `{ bookings }` for your listings, each with `guestName`, `guestEmail`, `commissionPct`, `commission` and `payout` |
| POST | `/api/host/bookings/:code/accept` | — | `{ booking }`, now `Confirmed`; the authorised payment is captured. `400` if already answered or expired. |
| POST | `/api/host/bookings/:code/decline` | `{ reason? }` (up to 300 characters, shown to the guest) | `{ booking }`, now `Declined`; the guest isn't charged |

**Listing map (host)**

| Method | Path | Body / query | Returns |
| --- | --- | --- | --- |
| GET | `/api/host/places` | `q` (3+ characters), `country` (default `in`) | `{ places: [{ label, lat, lng, city, region, country, address }] }` from OpenStreetMap, proxied and cached for an hour |
| GET | `/api/host/places/at` | `lat`, `lng` | `{ place }` at that point, or `null` |

**Language**: `/api/site`, `/api/home`, `/api/about` and `/api/pages/:slug` take `?lang=` (e.g. `?lang=mr`) and return the control centre's words already translated, leaving anything untranslated in its original wording.

**Privacy**: to guests, a listing's `title` is a description ("Farmstay in Coorg · MS007") and its slug matches. The real name, the owner's name, phone and email and the exact address are only returned to the owner, to our team, and to a guest whose booking on that property is `Confirmed`/`Completed` and paid (`revealed` on the property, `host`/`address` on the booking).

**Listing body**: `{ title, type, description, city, region, country, price, beds, baths, maxGuests, lat, lng, coverImage, photos: [url], videoUrl, amenities: [name] }`. `videoUrl` is optional and must be a YouTube or Vimeo link (videos are not hosted here). Photo links must start with `https://`; up to 12 photos.

## Control center (admins only)

Every change here is recorded in the activity log.

### Overview and listings

| Method | Path | Body / query | Returns |
| --- | --- | --- | --- |
| GET | `/api/admin/stats` | — | `{ listings, live, pending, users, hosts, suspended, bookings, upcoming, requests, gbv, commission, new_messages, reviews }` |
| GET | `/api/admin/listings` | `?status=Pending\|Approved\|Rejected\|Draft&q=` | `{ listings }` with host and `featuredRank` |
| POST | `/api/admin/listings/:id/approve` | — | `204` |
| POST | `/api/admin/listings/:id/reject` | `{ reason }` (5–500 characters, shown to the host) | `204` |
| POST | `/api/admin/listings/:id/assured` | `{ assured: boolean }` | `204`. Shows the “Meridian Assured” badge to guests. |
| POST | `/api/admin/listings/:id/management` | `{ management: "managed" \| "self" }` | `204`. Managed: instant booking and the managed commission. |
| POST | `/api/admin/listings/:id/feature` | `{ rank: 1–99 }` or `{ rank: null }` to remove | `204`; live listings only |

### Bookings, users, reviews, messages

| Method | Path | Body / query | Returns |
| --- | --- | --- | --- |
| GET | `/api/admin/bookings` | `?q=` (code, guest, email or stay), `&status=` | `{ bookings }` with commission, payout, payment status and `refundPending` |
| POST | `/api/admin/bookings/:code/cancel` | — | `204`; any booking, request or checkout that hasn't ended, refunded in full |
| POST | `/api/admin/bookings/:code/refund` | — | `204`; retries a refund Razorpay refused |
| GET | `/api/admin/promotions` | `?status=` | `{ campaigns }` |
| POST | `/api/admin/promotions/:id/approve` | — | `{ campaign }` |
| POST | `/api/admin/promotions/:id/reject` | `{ reason }` (shown to the host) | `{ campaign }`; the host is refunded |
| GET | `/api/admin/coupons` | — | `{ coupons }` |
| POST | `/api/admin/coupons` | A coupon | `201 { coupon }` |
| PUT | `/api/admin/coupons/:code` | A coupon | `{ coupon }` |
| DELETE | `/api/admin/coupons/:code` | — | `204` |
| GET | `/api/admin/users` | `?q=&role=guest\|host\|admin` | `{ users }` with `suspended`, `listings`, `bookings` |
| PATCH | `/api/admin/users/:id` | `{ role?, suspended? }` | `204`. Suspending signs the user out everywhere. You can't change yourself. |
| GET | `/api/admin/reviews` | `?q=` | `{ reviews }` with `hidden` |
| POST | `/api/admin/reviews/:id/hide` | — | `204`; removed from the listing's rating |
| POST | `/api/admin/reviews/:id/restore` | — | `204` |
| GET | `/api/admin/messages` | `?status=new\|read\|closed` | `{ messages }` |
| PATCH | `/api/admin/messages/:id` | `{ status }` | `204` |

### Website content and activity

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/api/admin/settings` | — | Same shape as `/api/site` |
| PUT | `/api/admin/settings/:key` | Full settings for `homepage` or `announcement` | `{ [key]: savedValue }` |
| GET | `/api/admin/homepage` | — | `{ layout }`, including hidden sections |
| PUT | `/api/admin/homepage` | `{ hero, blocks }` | `{ layout }` as saved. Section types: `stays` (`rule`: featured, top_rated, newest, instant, request, price_low, price_high, type + `propertyType`, location + `location`, budget + `maxPrice`; `limit` 3–12), `categories` (`cards: [{ type, label, tag, text, image }]`), `banner` (`badge, text, image, buttonLabel, buttonUrl, tone`). Up to 6 slides and 12 sections. |
| POST | `/api/admin/homepage/preview` | A `stays` section | `{ properties }` it would show right now |
| PUT | `/api/admin/branding` | `{ website, host, account, admin }`, each `{ logoUrl, showName, name, accent, subtitle }` | `{ branding }` as saved. `logoUrl` must be an uploaded or `https://` image. |
| GET | `/api/admin/translations` | — | `{ translations }`: every language's content translations, keyed by the English wording |
| PUT | `/api/admin/translations` | `{ [lang]: { [english]: translated } }` | `{ translations }` as saved. English and switched-off languages are dropped. |
| PUT | `/api/admin/languages` | `{ enabled: [code], fallback, autoDetect }` | `{ languages }` as saved. English is always added to `enabled`; `fallback` must be one of them. |
| PUT | `/api/admin/theme` | `{ brand, accent }` (six-digit hex) | `{ theme }` as saved. Every shade from 50 to 900 is mixed from the two colours. |
| PUT | `/api/admin/header` | `{ showSearch, showDestinations, showInstallApp, showCurrency, hostLinkLabel, links }` | `{ header }` as saved. Up to 3 extra links. |
| PUT | `/api/admin/footer` | `{ tagline, columns, social, showPopularSearches, legal, copyright }` | `{ footer }` as saved. Up to 4 columns of 8 links; links are a site path (`/about`) or `https://`; `{year}` in `copyright` becomes the current year. |
| GET | `/api/admin/about` | — | `{ page, stats }`, as `/api/about` |
| PUT | `/api/admin/about` | The whole page | `{ page }` as saved. Keeps only the fields each section uses; checks lengths, `https://` photo links and icon names. |
| GET | `/api/admin/pages` | — | `{ pages }`, including unpublished pages |
| PUT | `/api/admin/pages/:slug` | `{ title, intro, sections, draft, published }` | `204`; creates or updates. Some addresses are reserved (e.g. `search`, `admin`). |
| DELETE | `/api/admin/pages/:slug` | — | `204` |
| GET | `/api/admin/audit` | — | `{ entries: [{ action, targetType, targetId, details, adminName, createdAt }] }` (latest 300) |
| GET | `/api/admin/integrations` | — | `{ mode: "live" \| "emulator" \| "unconfigured", projectId, storageBucket, services: { firestore, auth, storage } }`, each `{ ok, message }`. Never includes keys. |

Settings keys for `PUT /api/admin/settings/:key`: `homepage`, `announcement`, `signIn` (`{ google, phone }`, at least one on), `uploads` (`{ maxMb: 1–4 }`), `commission` (`{ managedPct, selfPct }`, each 0–60) and `promotions` (`{ enabled, searchPerDay, homePerDay, destinationPerDay, maxDays }`).

### Payments and demo data

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/api/admin/payments` | — | `{ enabled, keyId, keySecretLast4, webhookSecretSet, mode: "test" \| "live" \| "unset", webhookUrl, encryptionReady, updatedAt }`. Secrets are never returned. |
| PUT | `/api/admin/payments` | `{ enabled, keyId, keySecret?, webhookSecret?, clearWebhookSecret? }` | The same view. Blank secrets keep the saved ones. `503` without `SETTINGS_ENCRYPTION_KEY`. |
| POST | `/api/admin/payments/test` | — | `{ ok, mode }`, or `502` with Razorpay's reason |
| GET | `/api/admin/demo` | — | `{ resetAllowed }` (true while `SEED_DEMO_DATA=true`) |
| POST | `/api/admin/demo/reset` | — | `204`; replaces listings, bookings, reviews and messages with fresh demo data |

### Database screen

Direct access to the Firestore collections listed in [`src/explorer/registry.ts`](../apps/api/src/explorer/registry.ts). Only registered fields are returned, only whitelisted fields can be edited, and values are type- and range-checked. Rows are identified by their Firestore document id, `_id`.

| Method | Path | Body / query | Returns |
| --- | --- | --- | --- |
| GET | `/api/admin/db/tables` | — | `{ tables: [{ name, label, description, rows, canEdit, canInsert, canDelete }] }` |
| GET | `/api/admin/db/tables/:table` | `?page=&pageSize=` (max 100) `&q=&sort=&dir=asc\|desc` | `{ table, columns, rows, keys, total, page, pageSize, sort, dir }` |
| POST | `/api/admin/db/tables/:table/rows` | Values for the table's insertable columns | `201 { row }` |
| PATCH | `/api/admin/db/tables/:table/rows` | `{ key: { _id: "5" }, changes: { title: "…" } }` | `{ row }` |
| DELETE | `/api/admin/db/tables/:table/rows` | `?key={"_id":"5"}` (URL-encoded JSON) | `204` |

## Trying it from the command line

Against the local emulators (`npm run emulators`, `npm run dev`), you can sign in by phone through the Auth emulator's REST API, then use the cookie:

```bash
AUTH=http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1
SESSION=$(curl -s -H 'Content-Type: application/json' -d '{"phoneNumber":"+919000000011","recaptchaToken":"x"}' \
  "$AUTH/accounts:sendVerificationCode?key=demo" | jq -r .sessionInfo)
CODE=$(curl -s http://127.0.0.1:9099/emulator/v1/projects/demo-meridianstay/verificationCodes | jq -r '.verificationCodes[-1].code')
TOKEN=$(curl -s -H 'Content-Type: application/json' -d "{\"sessionInfo\":\"$SESSION\",\"code\":\"$CODE\"}" \
  "$AUTH/accounts:signInWithPhoneNumber?key=demo" | jq -r .idToken)

curl -c cookies.txt -H 'Content-Type: application/json' -d "{\"idToken\":\"$TOKEN\",\"portal\":\"guest\"}" http://localhost:8787/api/auth/session
curl -b cookies.txt http://localhost:8787/api/bookings
```
