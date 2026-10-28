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
| `CRON_SECRET` | Random text. Vercel Cron sends it automatically once it is set, and the two scheduled jobs in [`vercel.json`](../vercel.json) refuse to run without it. **Check-in reminders, review invitations and scheduled offers only go out if this is set.** | Yes |
| `PUBLIC_SITE_URL` | Optional. The live address used in emails, texts and the sitemap, e.g. `https://meridianstay.com`. Guessed from the request when unset, which is wrong behind a proxy. | No |
| `COOKIE_DOMAIN` | Optional. The shared domain (e.g. `.meridianstay.com`) so one sign-in covers the website, account, host and admin panels. | No |
| `CLIENT_SITE_DOMAIN` | The domain clients' own websites sit under, e.g. `meridianstay.com` — see [client websites](#5-client-websites-the-wildcard-domain). | No |
| `CLIENT_DNS_CNAME` | The CNAME value this Vercel project is given, shown in Settings → Domains. Clients adding their own domain are told to point at it. | No |
| `CLIENT_DNS_APEX_IP` | Only if Vercel shows an A record other than `76.76.21.21`. | No |
| `FIREBASE_STORAGE_BUCKET` | Only if the bucket isn't `meridianstay-bcfd0.firebasestorage.app` | No |

The Firebase **web config** (API key, project id and so on) is already in [`.env.production`](../.env.production). Those values are public by design and are built into the pages.

**Settings → General:** Root Directory empty (repository root), Framework Preset *Other*, Node.js 22.x.

You can delete the old `DATABASE_URL` variable (from the earlier Postgres version).

**Control centre → Server** shows every variable on this list as set or missing (never its value), along with the region, the deployed commit, what the API is holding in memory and how big the database has grown. Check it after the first deploy.

### Scheduled jobs

[`vercel.json`](../vercel.json) asks Vercel to call two jobs each day:

| Job | When (UTC) | What it does |
| --- | --- | --- |
| `/api/cron/daily` | 02:30 (08:00 IST) | Check-in reminders, review invitations, and starting or finishing scheduled offers |
| `/api/cron/expire` | 03:00 | Releases dates held by an unpaid checkout or an unanswered request |

Vercel's Hobby plan allows two cron jobs, run once a day; more frequent schedules need Pro. Each run is recorded, and **Server → Scheduled jobs** shows when each last ran and what it did — plus a **Run now** button for when the schedule isn't set up yet.

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

## 5. Client websites: the wildcard domain

Every client gets a website of their own at `<their-business-name>.meridianstay.com`. One wildcard
domain makes all of them work at once — you add it to Vercel once, and nothing has to be done per
client. Until it is in place, a client's site is only reachable at `/c/<their-business-name>` on the
main domain, which is enough for them and your team to look at it, but not something to give guests.

### Add the wildcard to the project

1. Vercel → the project → **Settings → Domains → Add Domain**.
2. Enter `*.meridianstay.com` (with the `*.` prefix). This is separate from `meridianstay.com`
   itself, which stays as it is — the wildcard covers only what is in front of the dot.

A certificate for a wildcard can only be issued if Vercel can answer a DNS challenge, so one of the
two following setups is required. Vercel's Domains page shows which state yours is in.

### Either: let Vercel run the DNS (simplest)

Adding a wildcard turns Vercel's nameservers on for the domain and shows you two nameserver
addresses. Put those at your registrar in place of the current ones, and Vercel handles the wildcard
record and the certificate from then on.

**Before you switch nameservers, copy your existing DNS records into Vercel first** — in particular
your MX records, or email to your domain stops arriving, and any TXT records used to verify your
domain with other services.

### Or: keep your DNS where it is

If the domain's DNS has to stay with your current provider, hand Vercel just the certificate
challenge and keep everything else:

| Type | Name | Value |
| --- | --- | --- |
| `NS` | `_acme-challenge` | `ns1.vercel-dns.com.` |
| `NS` | `_acme-challenge` | `ns2.vercel-dns.com.` |
| `CNAME` | `*` | `cname.vercel-dns-0.com.` |

Both `NS` records are needed, and they must stay there — Vercel re-reads them every time the
certificate is renewed. The `CNAME` is what actually sends visitors to the deployment; check the
value against what your project's Domains page shows, since Vercel has changed it before.

Only use this route if the nameservers genuinely cannot move. Delegating `_acme-challenge` means no
other provider can issue a certificate using that same challenge name for this domain.

On the team's **Domains** page, open `meridianstay.com` and click **Enable Vercel DNS**, leaving the
nameservers at your registrar as they are. That is what makes the delegated challenge work.

### Tell the API which domain it is

Set `CLIENT_SITE_DOMAIN` in the project's environment variables to the domain the wildcard is on:

```
CLIENT_SITE_DOMAIN=meridianstay.com
```

The API uses it to work out which client a visitor's address belongs to, and the host portal uses it
to show each client their address. Left unset it falls back to `meridianstay.com`, so set it
explicitly if the platform ever runs on anything else.

### Check it

- `https://<any-client-slug>.meridianstay.com` → that client's website.
- `https://<something-nobody-has>.meridianstay.com` → the ordinary marketplace, not an error. An
  address we don't recognise is simply treated as the main site.
- A client's slug is on their **My website** page in the host portal, under "Your Meridian address".

### Sign-in on a client's address

Firebase will refuse to sign anyone in on a domain it doesn't know, and **its authorized-domains
list does not accept wildcards** — `*.meridianstay.com` cannot be entered there.

So before guests can log in or book on client addresses, in the Firebase console →
**Authentication → Settings → Authorized domains**, add each address guests will actually use. In
practice that means adding a client's address when you put their site live, in the same pass as
adding their custom domain to Vercel. The list has a size limit, so if you reach a point where every
client needs its own entry, move sign-in to the main domain instead: send guests to
`https://meridianstay.com/login` and back again, which works across subdomains because the session
cookie is set on `COOKIE_DOMAIN=.meridianstay.com`.

## 6. A client's own domain

A client who has their own domain (`greenvalleystays.com`) enters it in **Host portal → My website →
Your address**. That records the request and shows them the records to add at their registrar; it
does not make it work on its own. Your team does two things:

1. **Add the domain to the Vercel project** (Settings → Domains), exactly as it was entered. If
   Vercel says the domain is in use by another account, add the `TXT` record at `_vercel` that it
   shows — that proves access without moving the domain.
2. Once Vercel reports it as valid, open **Control centre → Client websites**, find the client and
   mark the domain **live**. Until you do, their Meridian address keeps serving and the custom one
   does nothing.

Also add the domain to Firebase's authorized domains, as above, or guests cannot sign in on it.

### The records the client is shown

The host portal shows an apex domain an `A` record and a `www` `CNAME`, and a subdomain a single
`CNAME`. **Vercel gives each project its own CNAME value** (something like
`d1d4fc829fe7bc7c.vercel-dns-017.com`), so set it once and every client is then told the right thing:

```
CLIENT_DNS_CNAME=d1d4fc829fe7bc7c.vercel-dns-017.com
CLIENT_DNS_APEX_IP=76.76.21.21
```

Both are optional and both have sensible fallbacks, but if the Domains page shows a CNAME different
from `cname.vercel-dns.com`, set `CLIENT_DNS_CNAME` or your clients will be given a value that does
not resolve. Copy the exact values from Vercel → Settings → Domains.

### How many you can have

A Hobby project allows **50 custom domains**, and every client's own domain counts against that; the
wildcard counts once however many clients sit behind it. Clients who stay on their
`*.meridianstay.com` address cost nothing from this allowance, so the limit only bites once fifty
clients have brought their own domains. Moving to a paid Vercel plan raises it.

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

## Notifications

Booking emails and texts are set up in **Control centre → Notifications**, not in environment
variables — the only thing the hosting needs is `SETTINGS_ENCRYPTION_KEY`, which is already required
for the Razorpay keys and is what encrypts the mail password too.

Email goes over plain SMTP, spoken directly by `services/delivery.ts`, so any mailbox works: Zoho,
Google Workspace, or whatever came with the hosting. Port 587 uses STARTTLS, 465 is TLS throughout.
SMS goes through MSG91 or Twilio over HTTPS; Indian gateways need a DLT-registered six-letter sender
ID. Both are optional, and each message says in the log why it could not be sent.

Set `PUBLIC_SITE_URL` so links inside messages point at the right place when nothing else tells us —
otherwise the host the request arrived on is used, which is right in every normal case.
