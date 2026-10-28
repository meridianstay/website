// Builds the whole platform for Vercel using the Build Output API (https://vercel.com/docs/build-output-api):
//   /           website        /admin    admin control center
//   /host       host portal    /account  guest account
//   /api/*      serverless function (Hono API + Firebase Admin SDK)
import { execSync } from 'node:child_process'
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { build } from 'esbuild'

const out = '.vercel/output'
const run = (cmd, env = {}) => execSync(cmd, { stdio: 'inherit', env: { ...process.env, ...env } })

// Demo logins are only shown on the login page when the deployment has demo data.
const demo = process.env.SEED_DEMO_DATA === 'true' ? 'true' : 'false'

console.log('▶ Building web apps')
run('npx turbo run build --filter=@meridian/website --filter=@meridian/admin --filter=@meridian/host --filter=@meridian/account', {
  VITE_SHOW_DEMO_ACCOUNTS: demo,
})

rmSync(out, { recursive: true, force: true })
mkdirSync(`${out}/static`, { recursive: true })
cpSync('apps/website/dist', `${out}/static`, { recursive: true })
for (const app of ['admin', 'host', 'account']) cpSync(`apps/${app}/dist`, `${out}/static/${app}`, { recursive: true })

console.log('▶ Bundling API function')
const fn = `${out}/functions/api.func`
mkdirSync(fn, { recursive: true })
await build({
  entryPoints: ['apps/api/src/vercel.ts'],
  outfile: `${fn}/index.mjs`,
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  // Everything, including firebase-admin, is bundled into one file (the shape Vercel runs most reliably).
  external: [],
  // Bundled CommonJS dependencies (firebase-admin, gRPC) expect require, __filename and __dirname.
  banner: {
    js: [
      "import { createRequire as __cr } from 'node:module';",
      "import { fileURLToPath as __fu } from 'node:url';",
      "import { dirname as __dn } from 'node:path';",
      'const require = __cr(import.meta.url);',
      'const __filename = __fu(import.meta.url);',
      'const __dirname = __dn(__filename);',
    ].join(' '),
  },
  logLevel: 'info',
})
writeFileSync(`${fn}/.vc-config.json`, JSON.stringify({ runtime: 'nodejs22.x', handler: 'index.mjs', launcherType: 'Nodejs', shouldAddHelpers: false, maxDuration: 30 }, null, 2))

// Hashed assets can be cached forever; HTML must always be fresh.
const immutable = { 'Cache-Control': 'public, max-age=31536000, immutable' }

/**
 * What a browser is allowed to load on our pages. Written out rather than guessed: every origin
 * here is one the platform actually talks to.
 *
 * It is sent as Report-Only for now. A policy that is slightly wrong does not show an error — it
 * silently stops a script, a font or the payment window from loading — so it is reported first and
 * enforced once the reports are quiet. To enforce it, rename the header to
 * `Content-Security-Policy`; to see what it would block, read the browser console on each app.
 */
const csp = [
  "default-src 'self'",
  // Razorpay Checkout; Google's reCAPTCHA, which phone sign-in uses.
  "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://www.google.com https://www.gstatic.com",
  // Tailwind ships real stylesheets, but React writes inline styles for the client page colours.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  // Uploaded photos, map tiles, and the stock images the demo content points at.
  "img-src 'self' data: blob: https://firebasestorage.googleapis.com https://*.tile.openstreetmap.org https://images.unsplash.com https://placehold.co",
  // Firebase sign-in and storage, the geocoder behind the map pin, Razorpay.
  "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://nominatim.openstreetmap.org https://api.razorpay.com https://lumberjack.razorpay.com",
  // The payment window, reCAPTCHA, and the video a listing may link to.
  "frame-src 'self' https://checkout.razorpay.com https://www.google.com https://api.razorpay.com https://www.youtube-nocookie.com https://www.youtube.com https://player.vimeo.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ')

/** Sent on every page. None of these can break a working site; the policy above is the risky one. */
const security = {
  // Two years, so the browser refuses plain HTTP to this domain long before it is asked to.
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  // Stops a browser guessing that an upload is really a script.
  'X-Content-Type-Options': 'nosniff',
  // No other site may put the control centre in a frame and click through it.
  'X-Frame-Options': 'DENY',
  // Our address never leaks to another site beyond its origin.
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // Nothing on these pages needs a camera, a microphone or a payment handler.
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self), payment=(), usb=(), interest-cohort=()',
  'Content-Security-Policy-Report-Only': csp,
}
writeFileSync(`${out}/config.json`, JSON.stringify({
  version: 3,
  routes: [
    // Every response carries these; `continue` lets the routes below still match.
    { src: '^/.*$', headers: security, continue: true },
    { src: '^/api(?:/.*)?$', dest: '/api' },
    { src: '^/(sitemap\\.xml|robots\\.txt)$', dest: '/api' },
    { src: '^/(?:admin/|host/|account/)?assets/.+$', headers: immutable, continue: true },
    { src: '^/(admin|host|account)$', status: 308, headers: { Location: '/$1/' } },
    { handle: 'filesystem' },
    { src: '^/admin/.*$', dest: '/admin/index.html' },
    { src: '^/host/.*$', dest: '/host/index.html' },
    { src: '^/account/.*$', dest: '/account/index.html' },
    { src: '^/.*$', dest: '/index.html' },
  ],
}, null, 2))

console.log(`✔ Vercel output ready in ${out}`)
