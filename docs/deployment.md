# Deploying Meridian Stay

The platform deploys as **one Vercel project** from this repository, with a **hosted PostgreSQL database**.

| Part | Where it runs |
| --- | --- |
| Website, account, host portal, admin | Vercel static hosting at `/`, `/account`, `/host`, `/admin` |
| API | A Vercel serverless function at `/api` |
| Database | Hosted PostgreSQL (recommended: Neon, connected through Vercel) |

`vercel.json` tells Vercel to run `scripts/build-vercel.mjs`, which builds all four apps, bundles the API into one function and writes the routing rules ([Build Output API](https://vercel.com/docs/build-output-api)).

## Why the database is hosted separately

Vercel runs code; it doesn't store a database for you. The API connects to a PostgreSQL server over the internet using the `DATABASE_URL` setting. Nothing is uploaded from your computer: on its first request the API creates every table (from `apps/api/db/migrations`) and, if you ask it to, loads the demo data.

## First-time setup

### 1. Create the database (recommended: Neon through Vercel)

1. Open your project on [vercel.com](https://vercel.com) → **Storage** → **Create Database** → **Neon** (Serverless Postgres).
2. Pick the free plan and a region close to your users (for India, Singapore `ap-southeast-1`).
3. Connect it to this project for **Production** and **Preview**. Vercel adds `DATABASE_URL` to the project's environment variables automatically.

Any other PostgreSQL 14+ host works too (Supabase, Railway, Render, AWS RDS). Copy its connection string into a `DATABASE_URL` environment variable yourself. Use the **pooled** connection string when the provider offers one.

### 2. Set environment variables

In **Settings → Environment Variables**:

| Variable | Value | Why |
| --- | --- | --- |
| `DATABASE_URL` | Set by Neon, or your provider's connection string | Where the data lives |
| `SEED_DEMO_DATA` | `true` for a test/demo deployment, leave unset for real launch | Loads demo listings and accounts into an empty database, and shows the demo logins on the login page |

### 3. Check the project settings

In **Settings → General**:

- **Root Directory:** empty (the repository root)
- **Framework Preset:** Other (`vercel.json` sets this)
- **Node.js Version:** 22.x

### 4. Deploy

Push to `main` (or press **Redeploy**). When it finishes:

- `https://<your-domain>/` — website
- `https://<your-domain>/account/` — guest panel
- `https://<your-domain>/host/` — host portal
- `https://<your-domain>/admin/` — control center
- `https://<your-domain>/api/health` — should show `{"ok":true}`

The first request after a deploy may take a few seconds while the API prepares the database.

## Before a real launch

- Remove `SEED_DEMO_DATA`, and start from a fresh database, or delete the demo accounts (all `@meridianstay.test`).
- Connect a payment provider; bookings currently confirm in test mode without taking payment.
- Have a lawyer review the pages marked "draft" (terms, privacy, cancellation policy, host protection). They can be edited in **Admin → Website content**.
- Add your own domain in Vercel (**Settings → Domains**).

## Moving an app to a subdomain

Each panel can move to its own subdomain, e.g. `admin.meridianstay.com`, when needed:

1. Create another Vercel project from the same repository with **Root Directory** `apps/admin`, build command `npm run build`, output `dist`, and environment variable `VITE_BASE_PATH=/`.
2. In every project, set the app addresses so links between apps point to the right place: `VITE_WEBSITE_URL`, `VITE_ADMIN_URL`, `VITE_HOST_URL`, `VITE_ACCOUNT_URL` (full `https://` addresses).
3. Set `COOKIE_DOMAIN=.meridianstay.com` on the API so one login works across subdomains.
4. Route `/api` on the new subdomain to the main project (a rewrite in that project's `vercel.json`), so the login cookie stays first-party.

## Running migrations by hand

Migrations run automatically, but you can apply them yourself against any database:

```bash
DATABASE_URL="postgres://…" npm run db:migrate -w @meridian/api
DATABASE_URL="postgres://…" npm run db:seed -w @meridian/api   # demo data, empty databases only
```
