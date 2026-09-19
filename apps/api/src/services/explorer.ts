import { isISODate } from '@meridian/shared'
import { pool, query, queryOne } from '../db/pool'
import { tables, type TableConfig } from '../explorer/registry'
import { auditLogRepo } from '../repositories'
import { AppError, notFound } from '../http/errors'

// The admin Database screen: browse any registered table, edit whitelisted columns, delete where allowed.
// Table and column names only ever come from the registry and the live schema, never from the request.

export interface ColumnInfo {
  name: string
  type: string
  nullable: boolean
  hasDefault: boolean
  editable: boolean
  insertable: boolean
  isKey: boolean
  /** Allowed values for enum columns. */
  options?: string[]
}

type Row = Record<string, unknown>

const ident = (name: string) => `"${name.replace(/"/g, '""')}"`
const MAX_PAGE_SIZE = 100

function config(table: string): TableConfig {
  const t = tables[table]
  if (!t) throw notFound('table')
  return t
}

async function columns(table: string): Promise<ColumnInfo[]> {
  const t = config(table)
  const rows = await query<{ column_name: string; data_type: string; udt_name: string; is_nullable: string; column_default: string | null; is_identity: string }>(
    `SELECT column_name, data_type, udt_name, is_nullable, column_default, is_identity
     FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
    [table],
  )
  const enums = await query<{ typname: string; labels: string[] }>(
    `SELECT t.typname, array_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels
     FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid GROUP BY t.typname`,
  )
  const enumMap = new Map(enums.map((e) => [e.typname, e.labels]))
  return rows
    .filter((c) => !t.hidden?.includes(c.column_name))
    .map((c) => ({
      name: c.column_name,
      type: c.data_type === 'USER-DEFINED' ? c.udt_name : c.data_type,
      nullable: c.is_nullable === 'YES',
      hasDefault: c.column_default !== null || c.is_identity === 'YES',
      editable: !!t.editable?.includes(c.column_name),
      insertable: !!t.insertable?.includes(c.column_name),
      isKey: t.primaryKey.includes(c.column_name),
      options: enumMap.get(c.udt_name) ?? (table === 'contact_messages' && c.column_name === 'status' ? ['new', 'read', 'closed'] : undefined),
    }))
}

/** Converts a value from the browser to what the column expects, or throws a readable error. */
function coerce(col: ColumnInfo, raw: unknown): unknown {
  if (raw === null || raw === undefined || raw === '') {
    if (col.nullable) return null
    throw new AppError(400, `${col.name} can’t be empty.`, { [col.name]: 'This can’t be empty.' })
  }
  const bad = (msg: string) => new AppError(400, `${col.name}: ${msg}`, { [col.name]: msg })
  const s = String(raw).trim()
  if (['integer', 'smallint', 'bigint'].includes(col.type)) {
    if (!/^-?\d+$/.test(s)) throw bad('Enter a whole number.')
    return Number(s)
  }
  if (['numeric', 'real', 'double precision'].includes(col.type)) {
    if (!Number.isFinite(Number(s))) throw bad('Enter a number.')
    return s
  }
  if (col.type === 'boolean') {
    if (raw === true || s === 'true') return true
    if (raw === false || s === 'false') return false
    throw bad('Choose true or false.')
  }
  if (col.type === 'date') {
    if (!isISODate(s)) throw bad('Use the format YYYY-MM-DD.')
    return s
  }
  if (col.type === 'jsonb' || col.type === 'json') {
    try {
      return JSON.stringify(typeof raw === 'string' ? JSON.parse(raw) : raw)
    } catch {
      throw bad('Enter valid JSON.')
    }
  }
  if (col.options && !col.options.includes(s)) throw bad(`Choose one of: ${col.options.join(', ')}.`)
  if (s.length > 4000) throw bad('Keep this under 4,000 characters.')
  return s
}

/** Turns database rule violations into messages an admin can act on. */
function translatePgError(err: unknown): never {
  const e = err as { code?: string; detail?: string; constraint?: string }
  const known: Record<string, string> = {
    '23505': 'Another row already uses that value.',
    '23503': 'Other records depend on this row (or it points to a row that doesn’t exist).',
    '23514': 'That value breaks one of the database’s rules.',
    '23P01': 'Those dates overlap an existing entry.',
    '22P02': 'That value has the wrong format.',
    '22001': 'That value is too long.',
  }
  if (e.code && known[e.code]) throw new AppError(400, `${known[e.code]}${e.constraint ? ` (${e.constraint})` : ''}`)
  throw err
}

function keyFilter(t: TableConfig, key: Record<string, unknown>, offset = 0) {
  const missing = t.primaryKey.filter((k) => key[k] === undefined || key[k] === null)
  if (missing.length) throw new AppError(400, 'Missing row key.')
  return {
    where: t.primaryKey.map((k, i) => `${ident(k)} = $${i + 1 + offset}`).join(' AND '),
    values: t.primaryKey.map((k) => key[k]),
  }
}

function serialize(row: Row, cols: ColumnInfo[]) {
  const out: Row = {}
  for (const c of cols) {
    const v = row[c.name]
    out[c.name] = v instanceof Date ? v.toISOString() : v
  }
  return out
}

export const explorerService = {
  /** Every registered table with its row count. */
  async listTables() {
    const counts = await query<{ relname: string; n: string }>(
      `SELECT relname, n_live_tup::text AS n FROM pg_stat_user_tables WHERE schemaname = 'public'`,
    )
    const estimate = new Map(counts.map((c) => [c.relname, Number(c.n)]))
    const exact = await Promise.all(
      Object.keys(tables).map(async (name) => {
        // Exact counts are cheap at this size; fall back to the planner's estimate for big tables.
        const est = estimate.get(name) ?? 0
        if (est > 50_000) return est
        return Number((await queryOne<{ n: string }>(`SELECT count(*)::text AS n FROM ${ident(name)}`))!.n)
      }),
    )
    return Object.entries(tables).map(([name, t], i) => ({
      name, label: t.label, description: t.description, rows: exact[i],
      canEdit: !!t.editable?.length, canInsert: !!t.insertable?.length, canDelete: !!t.deletable,
    }))
  },

  async browse(table: string, opts: { page?: number; pageSize?: number; q?: string; sort?: string; dir?: string }) {
    const t = config(table)
    const cols = await columns(table)
    const names = cols.map((c) => c.name)
    const sort = opts.sort && names.includes(opts.sort) ? opts.sort : t.defaultSort
    const dir = opts.dir === 'asc' ? 'ASC' : 'DESC'
    const pageSize = Math.min(Math.max(opts.pageSize ?? 25, 1), MAX_PAGE_SIZE)
    const page = Math.max(opts.page ?? 1, 1)
    const q = opts.q?.trim()
    const search = q ? `WHERE ${names.map((n) => `${ident(n)}::text ILIKE $1`).join(' OR ')}` : ''
    const params: unknown[] = q ? [`%${q}%`] : []

    const select = [...new Set([...names, ...t.primaryKey.filter((k) => !names.includes(k))])]
    const [rows, total] = await Promise.all([
      query<Row>(
        `SELECT ${select.map(ident).join(', ')} FROM ${ident(table)} ${search}
         ORDER BY ${ident(sort)} ${dir} NULLS LAST LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
        params,
      ),
      queryOne<{ n: string }>(`SELECT count(*)::text AS n FROM ${ident(table)} ${search}`, params),
    ])
    return {
      table: { name: table, label: t.label, description: t.description, note: t.note ?? null, primaryKey: t.primaryKey,
        canInsert: !!t.insertable?.length, canDelete: !!t.deletable },
      columns: cols,
      rows: rows.map((r) => serialize(r, cols)),
      // The key identifies a row for editing even when key columns are hidden (e.g. sessions).
      keys: t.hidden?.some((h) => t.primaryKey.includes(h)) ? rows.map(() => null) : rows.map((r) => Object.fromEntries(t.primaryKey.map((k) => [k, r[k]]))),
      total: Number(total!.n),
      page,
      pageSize,
      sort,
      dir: dir.toLowerCase(),
    }
  },

  async update(adminId: number, table: string, key: Record<string, unknown>, changes: Record<string, unknown>) {
    const t = config(table)
    const cols = await columns(table)
    const entries = Object.entries(changes)
    if (!entries.length) throw new AppError(400, 'Nothing to save.')
    const values: unknown[] = []
    const sets = entries.map(([name, raw]) => {
      const col = cols.find((c) => c.name === name)
      if (!col?.editable) throw new AppError(400, `${name} can’t be edited here.`)
      values.push(coerce(col, raw))
      return `${ident(name)} = $${values.length}`
    })
    const filter = keyFilter(t, key, values.length)
    const before = await queryOne<Row>(`SELECT * FROM ${ident(table)} WHERE ${keyFilter(t, key).where}`, keyFilter(t, key).values)
    if (!before) throw notFound('row')
    try {
      const row = await queryOne<Row>(
        `UPDATE ${ident(table)} SET ${sets.join(', ')} WHERE ${filter.where} RETURNING *`,
        [...values, ...filter.values],
      )
      const changed = Object.fromEntries(entries.map(([n]) => [n, { from: before[n], to: row![n] }]))
      await auditLogRepo.record(adminId, 'db.update', table, JSON.stringify(key), changed)
      return serialize(row!, cols)
    } catch (err) {
      translatePgError(err)
    }
  },

  async insert(adminId: number, table: string, input: Record<string, unknown>) {
    const t = config(table)
    if (!t.insertable?.length) throw new AppError(400, 'Rows can’t be added to this table here.')
    const cols = await columns(table)
    const names: string[] = []
    const values: unknown[] = []
    for (const name of t.insertable) {
      const col = cols.find((c) => c.name === name)!
      const raw = input[name]
      if ((raw === undefined || raw === '') && col.hasDefault) continue
      names.push(name)
      values.push(coerce(col, raw))
    }
    try {
      const row = await queryOne<Row>(
        `INSERT INTO ${ident(table)} (${names.map(ident).join(', ')}) VALUES (${values.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
        values,
      )
      await auditLogRepo.record(adminId, 'db.insert', table, JSON.stringify(Object.fromEntries(t.primaryKey.map((k) => [k, row![k]]))), serialize(row!, cols))
      return serialize(row!, cols)
    } catch (err) {
      translatePgError(err)
    }
  },

  async remove(adminId: number, table: string, key: Record<string, unknown>) {
    const t = config(table)
    if (!t.deletable) throw new AppError(400, 'Rows can’t be deleted from this table here.')
    const cols = await columns(table)
    const filter = keyFilter(t, key)
    try {
      const row = await queryOne<Row>(`DELETE FROM ${ident(table)} WHERE ${filter.where} RETURNING *`, filter.values, pool)
      if (!row) throw notFound('row')
      await auditLogRepo.record(adminId, 'db.delete', table, JSON.stringify(key), serialize(row, cols))
    } catch (err) {
      if (err instanceof AppError) throw err
      translatePgError(err)
    }
  },
}
