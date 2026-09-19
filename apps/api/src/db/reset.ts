import { pool } from './pool'

// `npm run db:reset`: wipes every table so the next start re-migrates and re-seeds. Never for production.
if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to reset a production database.')
  process.exit(1)
}

await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
console.log('Database wiped. Run `npm run db:migrate` and `npm run db:seed`, or just start the API in development.')
await pool.end()
