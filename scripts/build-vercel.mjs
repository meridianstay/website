// Builds the whole platform for Vercel using the Build Output API (https://vercel.com/docs/build-output-api):
//   /           website        /admin    admin control center
//   /host       host portal    /account  guest account
//   /api/*      serverless function (Hono API + Postgres)
import { execSync } from 'node:child_process'
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
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
  external: ['pg-native'],
  // Some bundled CommonJS dependencies call require(); give ESM a working one.
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  logLevel: 'info',
})
cpSync('apps/api/db/migrations', `${fn}/migrations`, { recursive: true })
writeFileSync(`${fn}/.vc-config.json`, JSON.stringify({ runtime: 'nodejs22.x', handler: 'index.mjs', launcherType: 'Nodejs', shouldAddHelpers: false, maxDuration: 30 }, null, 2))

// Hashed assets can be cached forever; HTML must always be fresh.
const immutable = { 'Cache-Control': 'public, max-age=31536000, immutable' }
writeFileSync(`${out}/config.json`, JSON.stringify({
  version: 3,
  routes: [
    { src: '^/api(?:/.*)?$', dest: '/api' },
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
