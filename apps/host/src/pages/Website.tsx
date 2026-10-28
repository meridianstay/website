import { useEffect, useState } from 'react'
import { ErrorNote, PageHeader, Panel, PhotoUpload, Spinner } from '@meridian/ui'
import {
  CLIENT_SITE_LIMITS, cleanDomain, dnsRecords, hasUnpublishedChanges, siteAddress, siteSlug,
  type ClientSite, type ClientSiteContent, type DnsTarget, type DomainCheck,
} from '@meridian/shared'
import { ApiError, hostApi } from '@meridian/shared/client'

// "My website": the client writes their own site here — their logo, who they are, their policies
// and their domain — and sends it to the Meridian team to put live.

export function Website() {
  const [site, setSite] = useState<ClientSite | null>(null)
  const [base, setBase] = useState('meridianstay.com')
  const [dns, setDns] = useState<DnsTarget | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setError(null)
    hostApi.website().then((r) => { setSite(r.site); setBase(r.baseDomain); setDns(r.dns) }).catch((e) => setError(e.message))
  }
  useEffect(load, [])

  if (error && !site) return <ErrorNote message={error} onRetry={load} />
  if (!site) return <Spinner />

  return (
    <>
      <PageHeader
        title="My website"
        description="Your own website, carrying your logo and your words, at your own address. Guests book on it exactly as they would on Meridian — dates, payment and your payouts all keep working the way they do now."
      />
      <StatusBanner site={site} base={base} />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <ContentForm site={site} base={base} onSaved={setSite} />
        <div className="space-y-8">
          <DomainPanel site={site} base={base} dns={dns} onSaved={setSite} />
          <PoliciesForm site={site} onSaved={setSite} />
        </div>
      </div>
    </>
  )
}

function StatusBanner({ site, base }: { site: ClientSite; base: string }) {
  const address = siteAddress(site.published?.slug ?? site.content.slug, site.domain, base)
  const waiting = hasUnpublishedChanges(site)
  const tone = {
    Draft: 'bg-slate-100 text-slate-700',
    Pending: 'bg-amber-50 text-amber-800',
    Approved: 'bg-brand-50 text-brand-800',
    Rejected: 'bg-rose-50 text-rose-700',
  }[site.status]

  return (
    <div className={`rounded-2xl p-4 mb-8 text-sm ${tone}`}>
      {site.status === 'Approved' && (
        <p className="font-semibold">
          <i className="fa-solid fa-circle-check mr-2" aria-hidden="true"></i>
          Your website is live at <a href={`https://${address}`} target="_blank" rel="noopener noreferrer" className="underline font-mono">{address}</a>
          {waiting && <span className="block font-normal mt-1">Your latest changes are waiting to be checked. Until then, visitors see the version that was approved.</span>}
        </p>
      )}
      {site.status === 'Pending' && (
        <p className="font-semibold">
          <i className="fa-solid fa-hourglass-half mr-2" aria-hidden="true"></i>
          With the Meridian team to be checked. {site.published ? 'Your live site keeps running in the meantime.' : 'You will see it go live here.'}
        </p>
      )}
      {site.status === 'Rejected' && (
        <p className="font-semibold">
          <i className="fa-solid fa-circle-exclamation mr-2" aria-hidden="true"></i>Sent back: {site.rejectionReason}
          <span className="block font-normal mt-1">Make the change and send it again.</span>
        </p>
      )}
      {site.status === 'Draft' && (
        <p>
          <i className="fa-solid fa-circle-info mr-2" aria-hidden="true"></i>
          Not sent in yet. Fill this in and press <span className="font-semibold">Send for checking</span>; it goes live once our team approves it.
        </p>
      )}
    </div>
  )
}

const field = 'w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:border-brand-500'

function ContentForm({ site, base, onSaved }: { site: ClientSite; base: string; onSaved: (s: ClientSite) => void }) {
  const [form, setForm] = useState<ClientSiteContent>(site.content)
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [fields, setFields] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const set = <K extends keyof ClientSiteContent>(key: K, value: ClientSiteContent[K]) => {
    setForm({ ...form, [key]: value })
    setState('idle')
  }
  const slug = siteSlug(form.slug || form.businessName)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setState('saving')
    setError(null)
    setFields({})
    try {
      const { site: next } = await hostApi.saveWebsite(form)
      onSaved(next)
      setForm(next.content)
      setState('saved')
    } catch (err) {
      setFields((err as ApiError).fields ?? {})
      setError((err as Error).message)
      setState('idle')
    }
  }

  const send = async () => {
    setSending(true)
    setError(null)
    try {
      const { site: next } = await hostApi.saveWebsite(form)
      onSaved(next)
      onSaved((await hostApi.submitWebsite()).site)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSending(false)
    }
  }

  return (
    <Panel title="Your business">
      <form onSubmit={save} className="space-y-4" noValidate>
        <div>
          <label htmlFor="biz-name" className="block text-xs font-bold uppercase text-slate-500 mb-1">Business name</label>
          <input id="biz-name" value={form.businessName} maxLength={CLIENT_SITE_LIMITS.businessName}
            onChange={(e) => set('businessName', e.target.value)} className={field} placeholder="Green Valley Farmstays" />
          {fields.businessName && <p className="text-xs text-rose-600 font-semibold mt-1">{fields.businessName}</p>}
          <p className="text-xs text-slate-500 mt-1">Shown large in your header, beside the Meridian mark.</p>
        </div>

        <div>
          <label htmlFor="biz-slug" className="block text-xs font-bold uppercase text-slate-500 mb-1">Your Meridian address</label>
          <div className="flex items-center">
            <input id="biz-slug" value={form.slug} onChange={(e) => set('slug', e.target.value)} className={`${field} rounded-r-none font-mono`} placeholder={siteSlug(form.businessName)} />
            <span className="px-3 py-2.5 bg-slate-100 border border-l-0 border-slate-200 rounded-r-xl text-sm text-slate-600 font-mono whitespace-nowrap">.{base}</span>
          </div>
          {fields.slug && <p className="text-xs text-rose-600 font-semibold mt-1">{fields.slug}</p>}
          <p className="text-xs text-slate-500 mt-1">
            Your website works at <span className="font-mono">{slug || 'your-name'}.{base}</span> whether or not you have a domain of your own.
          </p>
        </div>

        <div>
          <span className="block text-xs font-bold uppercase text-slate-500 mb-1">Your logo</span>
          <div className="flex items-center gap-4">
            {form.logoUrl
              ? <img src={form.logoUrl} alt="" className="w-16 h-16 rounded-2xl object-cover border border-slate-200 bg-white" />
              : <span className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400"><i className="fa-solid fa-image" aria-hidden="true"></i></span>}
            <div className="flex-1">
              <PhotoUpload purpose="brand" onUploaded={(url) => set('logoUrl', url)} />
              {form.logoUrl && <button type="button" onClick={() => set('logoUrl', '')} className="text-xs font-bold text-slate-500 hover:text-rose-600 mt-2">Remove</button>}
            </div>
          </div>
          {fields.logoUrl && <p className="text-xs text-rose-600 font-semibold mt-1">{fields.logoUrl}</p>}
          <p className="text-xs text-slate-500 mt-2">A square image works best. Meridian's own mark is shown beside it, smaller.</p>
        </div>

        <div>
          <label htmlFor="biz-tagline" className="block text-xs font-bold uppercase text-slate-500 mb-1">One line about you</label>
          <input id="biz-tagline" value={form.tagline} maxLength={CLIENT_SITE_LIMITS.tagline}
            onChange={(e) => set('tagline', e.target.value)} className={field} placeholder="Coffee-estate stays in the hills of Coorg" />
        </div>

        <div>
          <label htmlFor="biz-about" className="block text-xs font-bold uppercase text-slate-500 mb-1">About your business</label>
          <textarea id="biz-about" rows={6} value={form.about} maxLength={CLIENT_SITE_LIMITS.about}
            onChange={(e) => set('about', e.target.value)} className={field} placeholder="Who you are, how long you have been hosting, what guests can expect." />
          <p className="text-xs text-slate-400 mt-1">{form.about.length} / {CLIENT_SITE_LIMITS.about}</p>
        </div>

        <fieldset className="border-t border-slate-100 pt-4">
          <legend className="text-xs font-bold uppercase text-slate-500">How guests reach you</legend>
          <div className="grid sm:grid-cols-2 gap-4 mt-3">
            <div>
              <label htmlFor="biz-phone" className="block text-xs text-slate-500 mb-1">Phone</label>
              <input id="biz-phone" value={form.contact.phone} onChange={(e) => set('contact', { ...form.contact, phone: e.target.value })} className={field} />
              {fields['contact.phone'] && <p className="text-xs text-rose-600 font-semibold mt-1">{fields['contact.phone']}</p>}
            </div>
            <div>
              <label htmlFor="biz-email" className="block text-xs text-slate-500 mb-1">Email</label>
              <input id="biz-email" type="email" value={form.contact.email} onChange={(e) => set('contact', { ...form.contact, email: e.target.value })} className={field} />
              {fields['contact.email'] && <p className="text-xs text-rose-600 font-semibold mt-1">{fields['contact.email']}</p>}
            </div>
            <div>
              <label htmlFor="biz-wa" className="block text-xs text-slate-500 mb-1">WhatsApp (optional)</label>
              <input id="biz-wa" value={form.contact.whatsapp} onChange={(e) => set('contact', { ...form.contact, whatsapp: e.target.value })} className={field} />
            </div>
            <div>
              <label htmlFor="biz-addr" className="block text-xs text-slate-500 mb-1">Address shown on the page</label>
              <input id="biz-addr" value={form.contact.address} maxLength={CLIENT_SITE_LIMITS.address}
                onChange={(e) => set('contact', { ...form.contact, address: e.target.value })} className={field} />
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            These appear on your own website for anyone to see. On the Meridian marketplace they are still only shared with a guest once their booking is paid.
          </p>
        </fieldset>

        {error && !Object.keys(fields).length && <p role="alert" className="text-xs text-rose-600 font-semibold">{error}</p>}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button type="submit" disabled={state === 'saving'} className="bg-slate-900 disabled:bg-slate-400 text-white font-bold py-2.5 px-6 rounded-2xl text-sm">
            {state === 'saving' ? 'Saving…' : 'Save'}
          </button>
          <button type="button" onClick={send} disabled={sending || !form.businessName} className="bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 text-white font-bold py-2.5 px-6 rounded-2xl text-sm">
            {sending ? 'Sending…' : 'Send for checking'}
          </button>
          {state === 'saved' && <p role="status" className="text-sm font-semibold text-brand-700"><i className="fa-solid fa-check mr-1" aria-hidden="true"></i>Saved</p>}
        </div>
      </form>
    </Panel>
  )
}

function PoliciesForm({ site, onSaved }: { site: ClientSite; onSaved: (s: ClientSite) => void }) {
  const [policies, setPolicies] = useState(site.content.policies)
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [error, setError] = useState<string | null>(null)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setState('saving')
    setError(null)
    try {
      const { site: next } = await hostApi.saveWebsite({ ...site.content, policies })
      onSaved(next)
      setState('saved')
    } catch (err) {
      setError((err as Error).message)
      setState('idle')
    }
  }

  const boxes: [key: keyof typeof policies, label: string, hint: string][] = [
    ['terms', 'Property terms', 'House rules, ID, guest numbers, damage.'],
    ['payment', 'Payment policy', 'What is taken, when, and how.'],
    ['cancellation', 'Cancellation policy', 'What a guest gets back, and by when.'],
  ]

  return (
    <Panel title="Terms &amp; policies">
      <form onSubmit={save} className="space-y-4">
        <p className="text-sm text-slate-500">
          Shown on your website as three cards. Meridian's own cancellation handling still decides what is actually refunded — keep these in step with it.
        </p>
        {boxes.map(([key, label, hint]) => (
          <div key={key}>
            <label htmlFor={`pol-${key}`} className="block text-xs font-bold uppercase text-slate-500 mb-1">{label}</label>
            <textarea id={`pol-${key}`} rows={5} value={policies[key]} maxLength={CLIENT_SITE_LIMITS.policy}
              onChange={(e) => { setPolicies({ ...policies, [key]: e.target.value }); setState('idle') }} className={field} />
            <p className="text-xs text-slate-400 mt-1">{hint}</p>
          </div>
        ))}
        {error && <p role="alert" className="text-xs text-rose-600 font-semibold">{error}</p>}
        <div className="flex items-center gap-3">
          <button type="submit" disabled={state === 'saving'} className="bg-slate-900 disabled:bg-slate-400 text-white font-bold py-2.5 px-6 rounded-2xl text-sm">
            {state === 'saving' ? 'Saving…' : 'Save'}
          </button>
          {state === 'saved' && <p role="status" className="text-sm font-semibold text-brand-700"><i className="fa-solid fa-check mr-1" aria-hidden="true"></i>Saved</p>}
        </div>
      </form>
    </Panel>
  )
}

function DomainPanel({ site, base, dns, onSaved }: { site: ClientSite; base: string; dns?: DnsTarget; onSaved: (s: ClientSite) => void }) {
  const [domain, setDomain] = useState(site.domain.name)
  const [busy, setBusy] = useState<'save' | 'check' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [check, setCheck] = useState<DomainCheck | null>(null)
  const cleaned = cleanDomain(domain)
  const subdomain = `${site.published?.slug || site.content.slug || 'your-name'}.${base}`

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy('save')
    setError(null)
    setMessage(null)
    setCheck(null)
    try {
      const { site: next } = await hostApi.saveWebsiteDomain(cleaned)
      onSaved(next)
      setDomain(next.domain.name)
      setMessage(next.domain.name ? 'Saved. Add the records below, then press Check now.' : 'Removed. Your Meridian address keeps working.')
    } catch (err) {
      const fields = (err as ApiError).fields ?? {}
      setError(Object.values(fields)[0] ?? (err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  /** Looks up what the domain publishes now, and whether it reaches us with its certificate. */
  const runCheck = async () => {
    setBusy('check')
    setError(null)
    setMessage(null)
    try {
      const r = await hostApi.checkWebsiteDomain()
      setCheck(r.check)
      onSaved(r.site)
      if (r.check.reachable) setMessage('Your domain is working. It is live now.')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const badge = {
    none: ['bg-slate-100 text-slate-600', 'No domain'],
    pending: ['bg-amber-100 text-amber-800', 'Waiting for DNS'],
    live: ['bg-brand-100 text-brand-700', 'Live'],
    failed: ['bg-rose-100 text-rose-700', 'Not working'],
  }[site.domain.status]

  return (
    <Panel title="Your address" action={<span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${badge[0]}`}>{badge[1]}</span>}>
      <div className="space-y-4">
        <div className="bg-slate-50 rounded-2xl p-4">
          <p className="text-xs font-bold uppercase text-slate-500">Always works</p>
          <p className="font-mono text-sm font-bold text-slate-900 mt-1 break-all">{subdomain}</p>
          <p className="text-xs text-slate-500 mt-1">Given to you with your Meridian account. Nothing to set up.</p>
        </div>

        <form onSubmit={save} className="space-y-3">
          <label htmlFor="own-domain" className="block text-xs font-bold uppercase text-slate-500">Your own domain (optional)</label>
          <input id="own-domain" value={domain} onChange={(e) => setDomain(e.target.value)} className={`${field} font-mono`} placeholder="greenvalleystays.com" />
          {error && <p role="alert" className="text-xs text-rose-600 font-semibold">{error}</p>}
          {message && <p role="status" className="text-xs text-brand-700 font-semibold">{message}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={!!busy} className="bg-slate-900 disabled:bg-slate-400 text-white font-bold py-2.5 px-6 rounded-2xl text-sm">
              {busy === 'save' ? 'Saving…' : site.domain.name ? 'Update domain' : 'Use my domain'}
            </button>
            {site.domain.name && (
              <>
                <button type="button" onClick={runCheck} disabled={!!busy}
                  className="bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 font-bold py-2.5 px-5 rounded-2xl text-sm">
                  <i className="fa-solid fa-rotate mr-1.5" aria-hidden="true"></i>{busy === 'check' ? 'Checking…' : 'Check now'}
                </button>
                <a href={`https://${site.domain.status === 'live' ? site.domain.name : subdomain}`} target="_blank" rel="noopener noreferrer"
                  className="bg-brand-600 hover:bg-brand-700 text-white font-bold py-2.5 px-5 rounded-2xl text-sm">
                  <i className="fa-solid fa-arrow-up-right-from-square mr-1.5" aria-hidden="true"></i>Visit my site
                </a>
              </>
            )}
          </div>
        </form>

        {check && <CheckResult check={check} />}

        {site.domain.name && site.domain.status !== 'live' && (
          <div className="border-t border-slate-100 pt-4">
            <p className="text-sm font-bold text-slate-900">Add these where you bought {site.domain.name}</p>
            <p className="text-xs text-slate-500 mt-1 mb-3">
              In your domain provider's DNS settings. Once they are in, tell us — our team switches it on at our end, usually the same day.
            </p>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase text-slate-400">
                  <th className="py-1.5 font-bold">Type</th><th className="py-1.5 font-bold">Name</th><th className="py-1.5 font-bold">Points to</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {dnsRecords(site.domain.name, dns).map((r) => (
                  <tr key={r.type + r.name}>
                    <td className="py-2 font-bold">{r.type}</td>
                    <td className="py-2">{r.name}</td>
                    <td className="py-2 select-all break-all">{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {site.domain.note && <p className="text-xs text-rose-600 font-semibold mt-3">{site.domain.note}</p>}
          </div>
        )}
      </div>
    </Panel>
  )
}

/** What the last check found, record by record, so a client can see which one is missing. */
function CheckResult({ check }: { check: DomainCheck }) {
  return (
    <div className={`rounded-2xl p-4 text-sm ${check.reachable ? 'bg-brand-50 text-brand-800' : 'bg-amber-50 text-amber-900'}`}>
      <p className="font-bold">
        <i className={`fa-solid ${check.reachable ? 'fa-circle-check' : 'fa-hourglass-half'} mr-2`} aria-hidden="true"></i>
        {check.reachable ? 'Working — your domain is serving your website over a secure connection.' : 'Not working yet'}
      </p>
      {check.detail && <p className="mt-1">{check.detail}</p>}
      <ul className="mt-3 space-y-1.5 text-xs">
        {check.records.map((r) => (
          <li key={r.type + r.name} className="flex items-start gap-2">
            <i className={`fa-solid ${r.ok ? 'fa-circle-check text-brand-600' : 'fa-circle-xmark text-slate-400'} mt-0.5`} aria-hidden="true"></i>
            <span className="font-mono break-all">
              {r.type} {r.name} → {r.ok ? r.expected : `expected ${r.expected}${r.found.length ? `, found ${r.found.join(', ')}` : ', nothing published yet'}`}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs mt-3 opacity-80">
        The secure certificate is issued automatically and renews itself — there is nothing to buy or install.
      </p>
    </div>
  )
}
