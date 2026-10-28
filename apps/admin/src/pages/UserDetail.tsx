import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Avatar, ErrorNote, PageHeader, Panel, Spinner } from '@meridian/ui'
import { formatPrice, type ClientPlan, type PlanId } from '@meridian/shared'
import { adminApi, type AdminUserDetail } from '@meridian/shared/client'

// Everything about one person on one page, with the things you would want to do to them from here:
// approve their website, record a year of their plan, suspend them, open their listings and trips.

const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—')

export function UserDetail() {
  const { id = '' } = useParams()
  const [view, setView] = useState<AdminUserDetail | null>(null)
  const [plans, setPlans] = useState<ClientPlan[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = () => {
    setError(null)
    adminApi.user(Number(id)).then(setView).catch((e) => setError(e.message))
  }
  useEffect(load, [id])
  useEffect(() => { adminApi.subscriptions().then((r) => setPlans(r.plans)).catch(() => {}) }, [])

  if (error && !view) return <ErrorNote message={error} onRetry={load} />
  if (!view) return <Spinner />

  const { user, listings, bookings, subscription, site } = view
  const act = async (name: string, run: () => Promise<unknown>) => {
    setBusy(name)
    setError(null)
    try {
      await run()
      load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <nav className="text-xs text-slate-500 mb-4">
        <Link to="/users" className="hover:text-slate-900">Users</Link>
        <span className="mx-2">/</span>
        <span className="text-slate-700">{user.name}</span>
      </nav>

      <PageHeader
        title={user.name}
        description={`${user.role === 'host' ? 'Host' : user.role === 'admin' ? 'Team member' : 'Guest'} since ${when(user.createdAt)}${user.suspended ? ' · suspended' : ''}`}
      />

      {error && <p role="alert" className="rounded-2xl p-4 mb-6 text-sm bg-rose-50 text-rose-700 font-semibold">{error}</p>}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="space-y-8">
          <Panel title="Who they are">
            <div className="flex items-center gap-4 mb-5">
              <Avatar user={{ name: user.name, avatar: user.avatar }} />
              <div className="min-w-0">
                <p className="font-bold text-slate-900 truncate">{user.name}</p>
                <p className="text-xs text-slate-500">{user.role}{user.suspended && ' · suspended'}</p>
              </div>
            </div>
            <dl className="space-y-3 text-sm">
              <div><dt className="text-[10px] font-bold uppercase text-slate-400">Email</dt><dd className="text-slate-900 break-all">{user.email || '—'}</dd></div>
              <div><dt className="text-[10px] font-bold uppercase text-slate-400">Phone</dt><dd className="text-slate-900">{user.phone || '—'}</dd></div>
              <div><dt className="text-[10px] font-bold uppercase text-slate-400">Joined</dt><dd className="text-slate-900">{when(user.createdAt)}</dd></div>
            </dl>
            <div className="flex flex-wrap gap-3 mt-5 pt-5 border-t border-slate-100">
              {user.role === 'guest' && (
                <button type="button" disabled={!!busy} onClick={() => act('host', () => adminApi.updateUser(user.id, { role: 'host' }))}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2 px-4 rounded-xl text-xs">Make a host</button>
              )}
              <button type="button" disabled={!!busy} onClick={() => act('suspend', () => adminApi.updateUser(user.id, { suspended: !user.suspended }))}
                className={`font-bold py-2 px-4 rounded-xl text-xs ${user.suspended ? 'bg-brand-600 hover:bg-brand-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'}`}>
                {busy === 'suspend' ? 'Saving…' : user.suspended ? 'Lift suspension' : 'Suspend'}
              </button>
            </div>
          </Panel>

          <Panel title="At a glance">
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <Fact label="Listings" value={String(listings.length)} />
              <Fact label="Live" value={String(listings.filter((l) => l.status === 'Approved').length)} />
              <Fact label="Trips booked" value={String(bookings.asGuest.length)} />
              <Fact label="Spent as a guest" value={formatPrice(view.spent)} />
              <Fact label="Bookings taken" value={String(bookings.asHost.length)} />
              <Fact label="Paid us" value={formatPrice(subscription?.paid ?? 0)} />
            </dl>
          </Panel>
        </div>

        <div className="xl:col-span-2 space-y-8">
          <SitePanel site={site} busy={busy} act={act} hostId={user.id} />
          <PlanPanel subscription={subscription} plans={plans} busy={busy} act={act} hostId={user.id} />

          {listings.length > 0 && (
            <Panel title="Their listings" action={<Link to="/listings" className="text-xs font-bold text-brand-700">All listings</Link>}>
              <ul className="divide-y divide-slate-100">
                {listings.map((l) => (
                  <li key={l.id} className="py-3 flex items-center justify-between gap-4">
                    <span className="min-w-0">
                      <span className="block font-bold text-sm text-slate-900 truncate">{l.title}</span>
                      <span className="block text-xs text-slate-500">{l.location} · {formatPrice(l.price)} a night</span>
                    </span>
                    <span className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                      l.status === 'Approved' ? 'bg-brand-100 text-brand-700' : l.status === 'Pending' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                    }`}>{l.status}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {bookings.asGuest.length > 0 && (
            <Panel title="Their trips" action={<Link to="/bookings" className="text-xs font-bold text-brand-700">All bookings</Link>}>
              <ul className="divide-y divide-slate-100">
                {bookings.asGuest.slice(0, 8).map((b) => (
                  <li key={b.code} className="py-3 flex items-center justify-between gap-4 text-sm">
                    <span className="min-w-0">
                      <span className="block font-bold text-slate-900 truncate">{b.property.title}</span>
                      <span className="block text-xs text-slate-500 font-mono">{b.code} · {when(b.checkIn)}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-bold text-slate-900">{formatPrice(b.total)}</span>
                      <span className="block text-xs text-slate-500">{b.status}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {bookings.asHost.length > 0 && (
            <Panel title="Bookings at their stays" action={<Link to="/payouts" className="text-xs font-bold text-brand-700">Payouts</Link>}>
              <ul className="divide-y divide-slate-100">
                {bookings.asHost.slice(0, 8).map((b) => (
                  <li key={b.code} className="py-3 flex items-center justify-between gap-4 text-sm">
                    <span className="min-w-0">
                      <span className="block font-bold text-slate-900 truncate">{b.property.title}</span>
                      <span className="block text-xs text-slate-500 font-mono">{b.code} · {b.guestName} · {when(b.checkIn)}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-bold text-slate-900">{formatPrice(b.payout)}</span>
                      <span className="block text-xs text-slate-500">{b.status}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </>
  )
}

const Fact = ({ label, value }: { label: string; value: string }) => (
  <div>
    <dt className="text-[10px] font-bold uppercase text-slate-400">{label}</dt>
    <dd className="text-lg font-extrabold text-slate-900">{value}</dd>
  </div>
)

type Act = (name: string, run: () => Promise<unknown>) => Promise<void>

/** Their website, with the approval right here rather than on another page. */
function SitePanel({ site, busy, act, hostId }: { site: AdminUserDetail['site']; busy: string | null; act: Act; hostId: number }) {
  const [reason, setReason] = useState('')
  const [rejecting, setRejecting] = useState(false)

  if (!site) {
    return (
      <Panel title="Their website">
        <p className="text-sm text-slate-500">They have not started one. A client writes it in their own portal, under My website.</p>
      </Panel>
    )
  }

  const tone = { Pending: 'bg-amber-100 text-amber-800', Approved: 'bg-brand-100 text-brand-700', Rejected: 'bg-rose-100 text-rose-700', Draft: 'bg-slate-100 text-slate-600' }[site.status]

  return (
    <Panel
      title="Their website"
      action={<span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${tone}`}>{site.status}</span>}
    >
      <dl className="grid sm:grid-cols-2 gap-4 text-sm mb-4">
        <div><dt className="text-[10px] font-bold uppercase text-slate-400">Business</dt><dd className="font-semibold text-slate-900">{site.businessName || '—'}</dd></div>
        <div><dt className="text-[10px] font-bold uppercase text-slate-400">Address</dt><dd className="font-mono text-slate-900 break-all">{site.domain.status === 'live' && site.domain.name ? site.domain.name : site.slug}</dd></div>
      </dl>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={!!busy} onClick={() => act('approve', () => adminApi.approveClientSite(hostId))}
          className="bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white font-bold py-2 px-5 rounded-xl text-xs">
          {busy === 'approve' ? 'Approving…' : site.published ? 'Approve changes' : 'Approve and publish'}
        </button>
        {!rejecting ? (
          <button type="button" onClick={() => setRejecting(true)} className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2 px-5 rounded-xl text-xs">Send back</button>
        ) : (
          <>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What needs changing?"
              className="flex-1 min-w-[160px] bg-slate-50 border border-slate-200 rounded-xl p-2 text-sm" />
            <button type="button" disabled={!reason.trim() || !!busy} onClick={() => act('reject', () => adminApi.rejectClientSite(hostId, reason))}
              className="bg-rose-600 disabled:bg-slate-300 text-white font-bold py-2 px-4 rounded-xl text-xs">Send back</button>
          </>
        )}
        {site.domain.name && (
          <button type="button" disabled={!!busy} onClick={() => act('check', () => adminApi.checkClientDomain(hostId))}
            className="text-xs font-bold text-brand-700">
            {busy === 'check' ? 'Checking…' : 'Check their domain'}
          </button>
        )}
        <Link to="/client-sites" className="text-xs font-bold text-slate-500 ml-auto">Open in Client websites</Link>
      </div>
    </Panel>
  )
}

/** Their plan, with a year recordable without leaving the page. */
function PlanPanel({ subscription, plans, busy, act, hostId }: {
  subscription: AdminUserDetail['subscription']; plans: ClientPlan[]; busy: string | null; act: Act; hostId: number
}) {
  const [planId, setPlanId] = useState<PlanId>('single')
  const [note, setNote] = useState('')
  const [granting, setGranting] = useState(false)

  return (
    <Panel
      title="Their plan"
      action={subscription?.active
        ? <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-brand-100 text-brand-700">{subscription.planName ?? subscription.planId}</span>
        : <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-500">No plan</span>}
    >
      {subscription?.active ? (
        <p className="text-sm text-slate-600">
          Paid until <span className="font-bold text-slate-900">{when(subscription.expiresAt)}</span>
          {subscription.daysLeft !== null && <> — {subscription.daysLeft} days left</>}. {formatPrice(subscription.paid)} paid in total.
        </p>
      ) : (
        <p className="text-sm text-slate-500">
          {subscription?.expiresAt ? `Their plan ran out on ${when(subscription.expiresAt)}.` : 'They have never had a plan.'} Their listings and bookings keep working either way.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-slate-100">
        {granting ? (
          <>
            <select value={planId} onChange={(e) => setPlanId(e.target.value as PlanId)} className="bg-slate-50 border border-slate-200 rounded-xl p-2 text-sm font-semibold">
              {plans.map((p) => <option key={p.id} value={p.id}>{p.name} — {formatPrice(p.pricePerYear)}</option>)}
            </select>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="How it was paid"
              className="flex-1 min-w-[140px] bg-slate-50 border border-slate-200 rounded-xl p-2 text-sm" />
            <button type="button" disabled={!!busy} onClick={() => act('grant', () => adminApi.grantSubscription(hostId, planId, note))}
              className="bg-slate-900 disabled:bg-slate-400 text-white font-bold py-2 px-5 rounded-xl text-xs">
              {busy === 'grant' ? 'Recording…' : 'Record it'}
            </button>
            <button type="button" onClick={() => setGranting(false)} className="text-xs font-bold text-slate-600">Cancel</button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => setGranting(true)} className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2 px-5 rounded-xl text-xs">
              Record a year
            </button>
            {subscription?.active && (
              <button type="button" disabled={!!busy} onClick={() => act('cancel', () => adminApi.cancelSubscription(hostId))}
                className="text-xs font-bold text-slate-500 hover:text-rose-600">End the plan now</button>
            )}
            <Link to="/subscriptions" className="text-xs font-bold text-slate-500 ml-auto">Open in Subscriptions</Link>
          </>
        )}
      </div>
    </Panel>
  )
}
