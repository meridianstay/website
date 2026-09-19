import pg from 'pg'

// Return DATE columns as "YYYY-MM-DD" strings instead of JS Dates (which would shift with timezones).
pg.types.setTypeParser(1082, (value) => value)

const connectionString = process.env.DATABASE_URL ?? 'postgres://localhost:5432/meridianstay_dev'

// Hosted providers (Neon, Supabase, Render, Railway…) require TLS; set DATABASE_SSL=false for local servers.
const ssl = process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined

// Serverless functions run many small instances, so each keeps only a few connections.
const defaultPoolSize = process.env.VERCEL ? 3 : 10
export const pool = new pg.Pool({ connectionString, ssl, max: Number(process.env.DATABASE_POOL_SIZE ?? defaultPoolSize) })

export type Queryable = Pick<pg.PoolClient, 'query'>

export async function query<T extends pg.QueryResultRow>(text: string, params: unknown[] = [], client: Queryable = pool) {
  const result = await client.query<T>(text, params)
  return result.rows
}

export async function queryOne<T extends pg.QueryResultRow>(text: string, params: unknown[] = [], client: Queryable = pool) {
  const rows = await query<T>(text, params, client)
  return rows[0] ?? null
}

/** Run fn inside a transaction; rolls back if it throws. */
export async function transaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
