import { readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pool } from './pool'

const migrationsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../db/migrations')

/** Applies every .sql file in db/migrations that hasn't run yet, in filename order. */
export async function migrate(log = console.log) {
  const client = await pool.connect()
  try {
    // An advisory lock stops two app instances migrating at the same time.
    await client.query('SELECT pg_advisory_lock(727274)')
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`)
    const { rows } = await client.query<{ name: string }>('SELECT name FROM schema_migrations')
    const applied = new Set(rows.map((r) => r.name))

    // Bundled deployments (Vercel) ship the .sql files next to the function and point MIGRATIONS_DIR at them.
    const dir = process.env.MIGRATIONS_DIR ?? migrationsDir
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
      if (applied.has(file)) continue
      const sql = readFileSync(resolve(dir, file), 'utf8')
      await client.query('BEGIN')
      try {
        await client.query(sql)
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file])
        await client.query('COMMIT')
        log(`Applied migration ${file}`)
      } catch (err) {
        await client.query('ROLLBACK')
        throw new Error(`Migration ${file} failed: ${(err as Error).message}`)
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock(727274)').catch(() => {})
    client.release()
  }
}

// `npm run db:migrate`
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  migrate()
    .then(() => console.log('Database is up to date.'))
    .catch((err) => {
      console.error(err.message)
      process.exitCode = 1
    })
    .finally(() => pool.end())
}
