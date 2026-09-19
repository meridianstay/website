# Meridian Stay

A stay-booking marketplace for farmstays, rooms, resorts, cottages and villas. Guests find and book stays, local property owners list them, and the Meridian team moderates the platform.

This repo is a monorepo with one app per audience and shared packages for the brand, UI and data.

## Apps

| App | Package | Who it's for | Dev URL |
| --- | --- | --- | --- |
| `apps/website` | `@meridian/website` | Public site: browse and book stays | http://localhost:5173 |
| `apps/admin` | `@meridian/admin` | Meridian team: moderate listings, bookings, users | http://localhost:5174 |
| `apps/host` | `@meridian/host` | Property owners: onboarding, listings, bookings, earnings | http://localhost:5175 |
| `apps/account` | `@meridian/account` | Guests: trips, wishlist, profile | http://localhost:5176 |

## Packages

| Package | What it holds |
| --- | --- |
| `@meridian/ui` | Logo, dashboard layout (`AppShell`), `PageHeader`, `Panel`, `StatCard`, `StatusBadge` |
| `@meridian/shared` | Types (`Property`, `Booking`, `User`), images, pricing helpers, sample data |
| `@meridian/tailwind-config` | Brand colours and Inter font as a Tailwind preset |
| `@meridian/tsconfig` | Base TypeScript config |

Shared packages are consumed as TypeScript source, so there is no build step for them.

## Stack

React 19, TypeScript, Vite, Tailwind CSS 3, React Router 7 (dashboard apps), Font Awesome 6, npm workspaces and Turborepo.

## Commands

```bash
npm install          # install everything
npm run dev          # run all four apps
npm run dev:website  # or one app: dev:admin, dev:host, dev:account
npm run typecheck    # typecheck every workspace
npm run build        # production build of every app
```

## Current state

- All data comes from `packages/shared/src/sample-data.ts`. There is no backend or login yet; each panel shows a demo user.
- Changes made in the admin, host and account panels (approving listings, the onboarding wizard, removing wishlist items) live in memory and reset on reload.
- Prices are shown in USD. Switch the whole platform by changing `CURRENCY` in `packages/shared/src/pricing.ts`.
- `reference/index.html` is the original single-file prototype the design came from.
