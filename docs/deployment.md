# Deploying Meridian Stay

The platform deploys as **one Vercel project** from this repository, backed by **one Firebase project**.

| Part | Where it runs |
| --- | --- |
| Website, account, host portal, control center | Vercel static hosting at `/`, `/account`, `/host`, `/admin` |
| API | A Vercel serverless function at `/api` (Firebase Admin SDK) |
| Data, sign-in, photos | Firebase: Firestore, Authentication, Storage (project `meridianstay-bcfd0`) |

`vercel.json` runs `scripts/build-vercel.mjs`, which builds the four apps, bundles the API (including `firebase-admin`) into a single function file, and writes the routing rules ([Build Output API](https://vercel.com/docs/build-output-api)).

## 1. Firebase project setup (once)

In the [Firebase console](https://console.firebase.google.com):

1. **Blaze plan.** Upgrade to pay-as-you-go. Firebase requires it for Storage and for SMS sign-in; a free monthly allowance still applies. Set a **budget alert** in Google Cloud Billing.
2. **Firestore.** Build → Firestore Database → Create database, **production mode**, location **`asia-south1` (Mumbai)**. The location can't be changed later.
3. **Storage.** Build → Storage → Get started, same location.
4. **Authentication.** Build → Authentication → **Get started**, then Sign-in method → **Add new provider**:
   - **Google** → Enable → choose a project support email → Save.
   - **Phone** → Enable → Save.

   Under Settings → **Authorized domains**, add `website-seven-sable-30.vercel.app` and your final domain (without it, Google sign-in fails on the live site).

   Under Settings → **SMS region policy**, choose **Allow** and add **India** (or allow all regions). Without it, Firebase refuses to send codes to +91 numbers, even test numbers, and the login page says text messages to this country aren't enabled. If a login page says *"This sign-in method isn't switched on in Firebase yet"*, the provider you tried isn't enabled here.
5. **Security rules.** Deploy the rules in [`firebase/`](../firebase), which block all direct browser access (everything goes through the API):

   ```bash
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json npx firebase deploy --only firestore:rules,storage --project production
   ```

   Or paste the contents of `firebase/firestore.rules` and `firebase/storage.rules` into the Rules tabs in the console.

### Demo accounts

For client previews, add these under **Authentication → Sign-in method → Phone → Phone numbers for testing**, each with the code **`123456`**. Test numbers never send SMS and cost nothing.

| Number | Account | Role |
| --- | --- | --- |
| `+91 90000 00001` | Aarav Sharma | Admin |
| `+91 90000 00002` | Ishita Bose | Admin |
| `+91 90000 00003` | Meera Nair | Host (live and pending listings) |
| `+91 90000 00004` | Karan Mehta | Host |
| `+91 90000 00005` | Tenzin Dorje | Host |
| `+91 90000 00006` | Anjali Rao | Host |
| `+91 90000 00007` | Farhan Qureshi | Host (a rejected listing) |
| `+91 90000 00008` | Rohit Verma | Host (a paused listing) |
| `+91 90000 00011` | Priya Natarajan | Guest (trips in every state) |
| `+91 90000 00012`–`00017` | Siddharth, Ananya, Rahul, Neha, Maya, Arjun | Guests |
| `+91 90000 00018` | Vikram Pillai | Suspended guest (can't sign in) |

The demo data creates these people when `SEED_DEMO_DATA=true`, linked to these numbers. Remove the test numbers before a real launch.

While `SEED_DEMO_DATA=true`, **Admin → Settings → Demo data → Reset demo data** replaces all listings, bookings and reviews with fresh demo data (real accounts, content and payment keys are kept). Use it after upgrading to 0.6.0 so the preview shows rupee prices and booking requests.

## 2. Vercel settings

**Settings → Environment Variables** (Production, and Preview if you use it):

| Variable | Value | Secret? |
| --- | --- | --- |
| `FIREBASE_SERVICE_ACCOUNT` | The **entire contents** of the service-account JSON (Firebase → Project settings → Service accounts → Generate new private key) | **Yes.** Never share it in chat or email. Delete the downloaded file after pasting. |
| `SEED_DEMO_DATA` | `true` for a client preview; remove for the real launch | No |
| `SETTINGS_ENCRYPTION_KEY` | Any long random text (e.g. from `openssl rand -base64 32`). Encrypts the Razorpay secrets saved in Settings. **Don't change it later**, or the saved keys must be entered again. | **Yes** |
| `CRON_SECRET` | Optional. Random text; lets a scheduler call `GET /api/cron/expire` with `Authorization: Bearer <secret>` to expire lapsed requests promptly (they also expire whenever someone opens bookings). | Yes |
| `FIREBASE_STORAGE_BUCKET` | Only if the bucket isn't `meridianstay-bcfd0.firebasestorage.app` | No |

The Firebase **web config** (API key, project id and so on) is already in [`.env.production`](../.env.production). Those values are public by design and are built into the pages.

**Settings → General:** Root Directory empty (repository root), Framework Preset *Other*, Node.js 22.x.

You can delete the old `DATABASE_URL` variable (from the earlier Postgres version).

## 3. Razorpay (payments)

Until this is done, bookings run in test mode and no money is taken.

1. In the [Razorpay Dashboard](https://dashboard.razorpay.com), go to **Account & Settings → API Keys** and generate a key. Start with **Test mode** keys (`rzp_test_…`); switch to Live keys (`rzp_live_…`) after KYC.
2. In the control center, open **Settings → Payments**, paste the **Key ID** and **Key secret**, turn on **Take payments online**, Save, then press **Test connection**.
3. In Razorpay, go to **Webhooks → Add new webhook**. Use the webhook URL shown in Settings → Payments (`https://<domain>/api/payments/razorpay/webhook`), choose a secret, and tick `payment.authorized`, `payment.captured` and `payment.failed`. Paste the same secret into **Webhook secret** in Settings → Payments and Save.
4. Make a test booking with Razorpay's [test cards or UPI](https://razorpay.com/docs/payments/payments/test-card-upi-details/).

How money moves: instant bookings (managed properties) are captured at checkout. Requests (self-managed properties) are only authorised; the payment is captured when the host accepts, and Razorpay releases uncaptured authorisations automatically when a request is declined or expires. Refunds on cancellation are sent through Razorpay automatically.

## 4. Deploy and check

Push to `main`, or press **Redeploy**. Then:

- `https://<domain>/api/health` → `{"ok":true}`
- `https://<domain>/` → the website, with stays
- `https://<domain>/login` → the one login for guests and hosts (Google or phone)
- `https://<domain>/admin/login` → control-center login (not linked from the website)
- **Admin → Settings** shows *Live Firebase project* with Firestore, Authentication and Storage all connected.

Without `FIREBASE_SERVICE_ACCOUNT`, the API answers every request with "isn’t connected to Firebase yet".

## Security notes

- The **admin login** isn't linked anywhere on the website and is hidden from search engines, but its real protection is that the API checks the admin role on every request. To make it harder to find, you can move the control center to an unlisted path or subdomain (below).
- Only admins can grant the admin role (Admin → Users). Nobody can change their own role or suspend themselves.
- The service-account key lives only in Vercel. The admin panel shows the connection status but never the key.
- Optional hardening: in Google Cloud Console → APIs & Services → Credentials, restrict the browser API key to your domains (HTTP referrers).

## Before a real launch

- Remove `SEED_DEMO_DATA` and the demo test phone numbers, and start from a clean project (or delete the demo users, whose ids start with `demo-`).
- Switch Razorpay to **Live** keys in Settings → Payments.
- Have the pages marked "draft" (terms, privacy, cancellation, host protection) reviewed; edit them in Admin → Website content.
- Add your own domain in Vercel, and to Firebase Authentication's authorized domains.

## Moving an app to a subdomain

1. Create another Vercel project from the same repository with **Root Directory** `apps/admin` (for example), build command `npm run build`, output `dist`, and `VITE_BASE_PATH=/`.
2. In every project set the app addresses so links between apps work: `VITE_WEBSITE_URL`, `VITE_ADMIN_URL`, `VITE_HOST_URL`, `VITE_ACCOUNT_URL` (full `https://` addresses).
3. Set `COOKIE_DOMAIN=.yourdomain.com` on the API so one login works across subdomains, and add each subdomain to Firebase's authorized domains.
4. Route `/api` on the new subdomain to the main project (a rewrite in that project's `vercel.json`).

## Icons

The apps ship a cut-down icon set instead of all of Font Awesome: `packages/ui/src/icons.css`
(only the rules for icons we use) and `packages/ui/src/fa-subset.woff2` (only those glyphs).
Both are generated and committed, so nothing extra runs at deploy time.

After adding an icon, run:

```bash
npm run icons
```

It rewrites `icons.css` and `fa-subset.json`, and prints a `pyftsubset` command when the glyph list
changed — run that too (it needs Python's `fonttools` and `brotli`) and commit the new `.woff2`.
Tests fail if either file falls behind, so a missing icon can't slip through as a blank space.
Icons an admin can choose in the control centre come from `ICON_CHOICES` in `packages/shared/src/icons.ts`.
