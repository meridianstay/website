import { useEffect, useState } from 'react'
import { ErrorNote, PageHeader, Panel, Spinner } from '@meridian/ui'
import { hasUnpublishedChanges, siteAddress, type ClientSite, type DomainStatus } from '@meridian/shared'
import { adminApi } from '@meridian/shared/client'

// The websites clients have written for themselves, waiting for someone here to look at them. A page
// carries Meridian's mark alongside the client's, so nothing goes public until your team says so.

const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })

const STATUS: Record<ClientSite['status'], [tone: string, label: string]> = {
  Pending: ['bg-amber-100 text-amber-800', 'Waiting for you'],
  Approved: ['bg-brand-100 text-brand-700', 'Live'],
  Rejected: ['bg-rose-100 text-rose-700', 'Sent back'],
  Draft: ['bg-slate-100 text-slate-600', 'Not sent in'],
}

const DOMAIN: Record<DomainStatus, [tone: string, label: string]> = {
  none: ['bg-slate-100 text-slate-500', 'Meridian address only'],
  pending: ['bg-amber-100 text-amber-800', 'Domain waiting for you'],
  live: ['bg-brand-100 text-brand-700', 'Own domain live'],
  failed: ['bg-rose-100 text-rose-700', 'Domain not working'],
}

export function ClientSites() {
  const [sites, setSites] = useState<ClientSite[] | null>(null)
  const [base, setBase] = useState('meridianstay.com')
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'waiting' | 'all'>('waiting')

  const load = () => {
    setError(null)
    adminApi.clientSites().then((r) => { setSites(r.sites); setBase(r.baseDomain) }).catch((e) => setError(e.message))
  }
  useEffect(load, [])

  if (error && !sites) return <ErrorNote message={error} onRetry={load} />
  if (!sites) return <Spinner />

  const waiting = sites.filter((s) => s.status === 'Pending' || s.domain.status === 'pending')
  const shown = filter === 'waiting' ? waiting : sites

  return (
    <>
      <PageHeader
        title="Client websites"
        description="Each client's own website, at their Meridian address or their own domain. Nothing a client writes goes public until you approve it — their page carries your logo as well as theirs."
      />

      <div className="flex flex-wrap items-center gap-3 mb-8">
        {([['waiting', `Needs you (${waiting.length})`], ['all', `All clients (${sites.length})`]] as const).map(([value, label]) => (
          <button key={value} type="button" onClick={() => setFilter(value)}
            className={`text-xs font-bold py-2 px-4 rounded-xl ${filter === value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
            {label}
          </button>
        ))}
        <button type="button" onClick={load} className="text-xs font-bold text-brand-700 ml-auto">
          <i className="fa-solid fa-rotate mr-1" aria-hidden="true"></i>Refresh
        </button>
      </div>

      {!shown.length ? (
        <Panel title={filter === 'waiting' ? 'Nothing waiting' : 'No client websites yet'}>
          <p className="text-sm text-slate-500">
            {filter === 'waiting'
              ? 'Every client website is either live or still being written. Switch to “All clients” to see them.'
              : 'A client writes their website in their own portal, under My website, and sends it here to be checked.'}
          </p>
        </Panel>
      ) : (
        <div className="space-y-6">
          {shown.map((site) => <SiteCard key={site.hostId} site={site} base={base} onChanged={load} />)}
        </div>
      )}
    </>
  )
}

function SiteCard({ site, base, onChanged }: { site: ClientSite; base: string; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const content = site.content
  const live = site.published
  const address = siteAddress(live?.slug || content.slug, site.domain, base)
  const changed = hasUnpublishedChanges(site)
  const [tone, label] = STATUS[site.status]
  const [domainTone, domainLabel] = DOMAIN[site.domain.status]

  const act = async (name: string, run: () => Promise<unknown>) => {
    setBusy(name)
    setError(null)
    try {
      await run()
      setRejecting(false)
      setReason('')
      onChanged()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  // What the client has written, shown as your team will have to read it before approving.
  const previewUrl = `${window.location.origin.replace(/\/admin$/, '')}/c/${content.slug}`

  return (
    <Panel
      title={content.businessName || `Client ${site.hostId}`}
      action={
        <span className="flex flex-wrap items-center gap-2">
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${tone}`}>{label}</span>
          {changed && <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-800">Edited since</span>}
        </span>
      }
    >
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-[10px] font-bold uppercase text-slate-400">Address</dt>
              <dd className="font-mono text-slate-900 break-all">{address}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase text-slate-400">Last changed</dt>
              <dd className="font-semibold text-slate-900">{when(site.updatedAt)}</dd>
            </div>
          </dl>

          {content.tagline && <p className="text-sm text-slate-600 italic">“{content.tagline}”</p>}
          {content.about && <p className="text-sm text-slate-600 line-clamp-4 whitespace-pre-line">{content.about}</p>}

          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div><dt className="text-slate-400 font-bold uppercase text-[10px]">Phone</dt><dd className="text-slate-800">{content.contact.phone || '—'}</dd></div>
            <div><dt className="text-slate-400 font-bold uppercase text-[10px]">Email</dt><dd className="text-slate-800 break-all">{content.contact.email || '—'}</dd></div>
            <div><dt className="text-slate-400 font-bold uppercase text-[10px]">Logo</dt><dd className="text-slate-800">{content.logoUrl ? 'Uploaded' : 'None'}</dd></div>
          </dl>

          <p className="text-xs text-slate-500">
            Policies written:{' '}
            {(['terms', 'payment', 'cancellation'] as const).filter((k) => content.policies[k]).join(', ') || 'none yet'}
          </p>

          {site.status === 'Rejected' && site.rejectionReason && (
            <p className="text-xs text-rose-700 bg-rose-50 rounded-xl p-3">You sent this back: {site.rejectionReason}</p>
          )}
        </div>

        <div className="space-y-4">
          {content.logoUrl && <img src={content.logoUrl} alt="" className="w-20 h-20 rounded-2xl object-cover border border-slate-200 bg-white" />}
          <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="block text-xs font-bold text-brand-700">
            <i className="fa-solid fa-arrow-up-right-from-square mr-1.5" aria-hidden="true"></i>Read the page first
          </a>
          <p className="text-[11px] text-slate-400">
            Opens the client's page. Approving puts exactly this in front of their guests, beside your logo.
          </p>
        </div>
      </div>

      {error && <p role="alert" className="text-xs text-rose-600 font-semibold mt-4">{error}</p>}

      <div className="flex flex-wrap items-center gap-3 mt-5 pt-5 border-t border-slate-100">
        <button type="button" disabled={!!busy} onClick={() => act('approve', () => adminApi.approveClientSite(site.hostId))}
          className="bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white font-bold py-2.5 px-6 rounded-2xl text-sm">
          {busy === 'approve' ? 'Approving…' : live ? 'Approve the changes' : 'Approve and publish'}
        </button>
        {!rejecting ? (
          <button type="button" onClick={() => setRejecting(true)} className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2.5 px-5 rounded-2xl text-sm">
            Send back
          </button>
        ) : (
          <span className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What needs changing?"
              className="flex-1 min-w-[180px] bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm" />
            <button type="button" disabled={!reason.trim() || !!busy} onClick={() => act('reject', () => adminApi.rejectClientSite(site.hostId, reason))}
              className="bg-rose-600 disabled:bg-slate-300 text-white font-bold py-2.5 px-5 rounded-2xl text-sm">
              {busy === 'reject' ? 'Sending…' : 'Send back'}
            </button>
            <button type="button" onClick={() => setRejecting(false)} className="text-sm font-bold text-slate-600">Cancel</button>
          </span>
        )}
        {live && (
          <button type="button" disabled={!!busy} onClick={() => act('unpublish', () => adminApi.unpublishClientSite(site.hostId))}
            className="text-sm font-bold text-slate-500 hover:text-rose-600 ml-auto">
            {busy === 'unpublish' ? 'Taking down…' : 'Take the site down'}
          </button>
        )}
      </div>

      <div className="mt-5 pt-5 border-t border-slate-100">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold uppercase text-slate-500">Their own domain</span>
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${domainTone}`}>{domainLabel}</span>
          {site.domain.name && <span className="font-mono text-sm text-slate-900">{site.domain.name}</span>}
        </div>

        {site.domain.name ? (
          <>
            <p className="text-xs text-slate-500 mt-2">
              Add <span className="font-mono">{site.domain.name}</span> to this Vercel project under Settings → Domains, and to Firebase's authorized
              domains, before marking it live. {site.domain.checkedAt && <>Last changed {when(site.domain.checkedAt)}.</>}
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="A note for the client (optional)"
                className="flex-1 min-w-[200px] bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm" />
              <button type="button" disabled={!!busy} onClick={() => act('live', () => adminApi.setClientDomain(site.hostId, 'live', note))}
                className="bg-slate-900 disabled:bg-slate-400 text-white font-bold py-2 px-5 rounded-xl text-xs">
                {busy === 'live' ? 'Saving…' : 'Mark live'}
              </button>
              <button type="button" disabled={!!busy} onClick={() => act('failed', () => adminApi.setClientDomain(site.hostId, 'failed', note))}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-2 px-5 rounded-xl text-xs">
                Not working
              </button>
            </div>
            {site.domain.note && <p className="text-xs text-slate-500 mt-2">Your note: {site.domain.note}</p>}
          </>
        ) : (
          <p className="text-xs text-slate-500 mt-2">This client is on their Meridian address. Nothing to do.</p>
        )}
      </div>
    </Panel>
  )
}
