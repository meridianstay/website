import type { DbBrowseResult, DbColumn, DbRow, Me } from '@meridian/shared'
import { col, firestore } from '../store/db'
import { collections, type CollectionConfig, type FieldConfig } from '../explorer/registry'
import { auditLogRepo } from '../repositories'
import { AppError, notFound } from '../http/errors'

// The admin Database screen over Firestore: browse registered collections, edit whitelisted fields,
// add and delete where allowed. Collection and field names only ever come from the registry.

const MAX_DOCS = 2000
const MAX_PAGE_SIZE = 100

function config(name: string): CollectionConfig {
  const c = collections[name]
  if (!c) throw notFound('table')
  return c
}

const columns = (c: CollectionConfig): DbColumn[] => [
  { name: '_id', type: 'document id', nullable: false, hasDefault: !c.idFrom, editable: false, insertable: false, isKey: true },
  ...c.fields.map((f) => ({
    name: f.name, type: f.type, nullable: !!f.nullable, hasDefault: false, editable: !!f.editable, insertable: !!f.insertable, isKey: false, options: f.options,
  })),
]

function coerce(f: FieldConfig, raw: unknown): unknown {
  const bad = (msg: string) => new AppError(400, `${f.name}: ${msg}`, { [f.name]: msg })
  if (raw === null || raw === undefined || raw === '') {
    if (f.nullable) return null
    throw bad('This can’t be empty.')
  }
  const s = String(raw).trim()
  if (f.type === 'number') {
    if (!Number.isFinite(Number(s))) throw bad('Enter a number.')
    return Number(s)
  }
  if (f.type === 'boolean') {
    if (raw === true || s === 'true') return true
    if (raw === false || s === 'false') return false
    throw bad('Choose true or false.')
  }
  if (f.type === 'json') {
    try {
      return typeof raw === 'string' ? JSON.parse(raw) : raw
    } catch {
      throw bad('Enter valid JSON.')
    }
  }
  if (f.options && !f.options.includes(s)) throw bad(`Choose one of: ${f.options.join(', ')}.`)
  if (s.length > 4000) throw bad('Keep this under 4,000 characters.')
  // Numbers that must stay sensible for the app to work.
  return s
}

function validateNumbers(name: string, values: Record<string, unknown>) {
  const positive = ['pricePerNightMinor', 'maxGuests']
  for (const [k, v] of Object.entries(values)) {
    if (typeof v !== 'number') continue
    if (positive.includes(k) && v < 1) throw new AppError(400, `${k} must be at least 1.`, { [k]: 'Must be at least 1.' })
    if (['bedrooms', 'bathrooms'].includes(k) && (v < 0 || !Number.isInteger(v))) throw new AppError(400, `${k} must be a whole number of 0 or more.`, { [k]: 'Whole number, 0 or more.' })
    if (name === 'properties' && k === 'lat' && Math.abs(v) > 90) throw new AppError(400, 'Latitude must be between -90 and 90.', { lat: 'Between -90 and 90.' })
    if (name === 'properties' && k === 'lng' && Math.abs(v) > 180) throw new AppError(400, 'Longitude must be between -180 and 180.', { lng: 'Between -180 and 180.' })
  }
}

const rowOf = (c: CollectionConfig, id: string, data: DbRow): DbRow =>
  Object.fromEntries([['_id', id], ...c.fields.map((f) => [f.name, data[f.name] ?? null])])

const keyId = (key: DbRow) => {
  const id = key._id
  if (typeof id !== 'string' || !id || id.includes('/')) throw new AppError(400, 'Missing row key.')
  return id
}

export const explorerService = {
  async listTables() {
    return Promise.all(Object.entries(collections).map(async ([name, c]) => ({
      name, label: c.label, description: c.description,
      rows: (await col(name).count().get()).data().count,
      canEdit: c.fields.some((f) => f.editable), canInsert: c.fields.some((f) => f.insertable), canDelete: !!c.deletable,
    })))
  },

  async browse(name: string, opts: { page?: number; pageSize?: number; q?: string; sort?: string; dir?: string }): Promise<DbBrowseResult> {
    const c = config(name)
    const cols = columns(c)
    const snap = await col(name).limit(MAX_DOCS).get()
    let rows = snap.docs.map((d) => rowOf(c, d.id, d.data()))
    const q = opts.q?.trim().toLowerCase()
    if (q) rows = rows.filter((r) => Object.values(r).some((v) => v != null && (typeof v === 'object' ? JSON.stringify(v) : String(v)).toLowerCase().includes(q)))
    const sort = opts.sort && cols.some((x) => x.name === opts.sort) ? opts.sort : c.defaultSort
    const dir = opts.dir === 'asc' ? 'asc' : 'desc'
    rows.sort((a, b) => {
      const x = a[sort], y = b[sort]
      if (x == null) return 1
      if (y == null) return -1
      const cmp = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))
      return dir === 'asc' ? cmp : -cmp
    })
    const pageSize = Math.min(Math.max(opts.pageSize ?? 25, 1), MAX_PAGE_SIZE)
    const page = Math.max(opts.page ?? 1, 1)
    const slice = rows.slice((page - 1) * pageSize, page * pageSize)
    return {
      table: { name, label: c.label, description: c.description, note: c.note ?? null, primaryKey: ['_id'], canInsert: c.fields.some((f) => f.insertable), canDelete: !!c.deletable },
      columns: cols, rows: slice, keys: slice.map((r) => ({ _id: r._id })), total: rows.length, page, pageSize, sort, dir,
    }
  },

  async update(admin: Me, name: string, key: DbRow, changes: DbRow) {
    const c = config(name)
    const id = keyId(key)
    const entries = Object.entries(changes)
    if (!entries.length) throw new AppError(400, 'Nothing to save.')
    const patch: Record<string, unknown> = {}
    for (const [field, raw] of entries) {
      const f = c.fields.find((x) => x.name === field)
      if (!f?.editable) throw new AppError(400, `${field} can’t be edited here.`)
      patch[field] = coerce(f, raw)
    }
    validateNumbers(name, patch)
    const ref = col(name).doc(id)
    const before = await firestore.runTransaction(async (tx) => {
      const snap = await tx.get(ref)
      if (!snap.exists) throw notFound('row')
      tx.update(ref, patch)
      return snap.data()!
    })
    await auditLogRepo.record(admin, 'db.update', name, id, Object.fromEntries(Object.keys(patch).map((k) => [k, { from: before[k] ?? null, to: patch[k] }])))
    return rowOf(c, id, { ...before, ...patch })
  },

  async insert(admin: Me, name: string, input: DbRow) {
    const c = config(name)
    const insertable = c.fields.filter((f) => f.insertable)
    if (!insertable.length) throw new AppError(400, 'Rows can’t be added to this table here.')
    const data: Record<string, unknown> = {}
    for (const f of insertable) data[f.name] = coerce(f, input[f.name])
    validateNumbers(name, data)
    const ref = c.idFrom ? col(name).doc(String(data[c.idFrom])) : col(name).doc()
    try {
      await ref.create(data)
    } catch {
      throw new AppError(400, 'Another row already uses that value.')
    }
    await auditLogRepo.record(admin, 'db.insert', name, ref.id, data)
    return rowOf(c, ref.id, data)
  },

  async remove(admin: Me, name: string, key: DbRow) {
    const c = config(name)
    if (!c.deletable) throw new AppError(400, 'Rows can’t be deleted from this table here.')
    const id = keyId(key)
    const ref = col(name).doc(id)
    const snap = await ref.get()
    if (!snap.exists) throw notFound('row')
    await ref.delete()
    await auditLogRepo.record(admin, 'db.delete', name, id, snap.data()!)
  },
}
