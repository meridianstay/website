import { useCallback, useEffect, useState } from 'react'
import { ErrorNote, ImageField, PageHeader, Panel, Spinner, StatusBadge } from '@meridian/ui'
import {
  CAMPAIGN_AUDIENCES, CAMPAIGN_CHANNELS, CAMPAIGN_LIMITS, POPUP_FREQUENCIES, POPUP_PLACES,
  blankCampaign, formatDate, type Campaign, type CampaignAudience, type CampaignChannel,
} from '@meridian/shared'
import { ApiError, adminApi, appLink } from '@meridian/shared/client'

// Control centre → Offers & alerts. Anything your team wants to say that isn't tied to a booking:
// a festival discount, a new destination, a nudge to hosts. Shown as a popup on the website, pushed
// to phones that allowed it, or both — to whichever kinds of people it picks, now or on a date.

const input = 'w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:border-brand-500'
const label = 'block text-xs font-bold uppercase text-slate-500 mb-1'

type Draft = ReturnType<typeof blankCampaign> & { id?: number }

export function Campaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null)
  const [push, setPush] = useState<{ ready: boolean; subscribers: number; encryptionReady: boolean } | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [fields, setFields] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const load = useCallback(() => {
    adminApi.campaigns().then((r) => { setCampaigns(r.campaigns); setPush(r.push) }).catch((e) => setError(e.message))
  }, [])
  useEffect(load, [load])

  if (error && !campaigns) return <ErrorNote message={error} onRetry={load} />
  if (!campaigns || !push) return <Spinner />

  const run = async (fn: () => Promise<unknown>, message?: string) => {
    setBusy(true)
    setError(null)
    setNote(null)
    setFields({})
    try {
      await fn()
      if (message) setNote(message)
      load()
    } catch (e) {
      setFields((e as ApiError).fields ?? {})
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    if (!draft) return
    await run(async () => {
      const saved = draft.id
        ? (await adminApi.updateCampaign(draft.id, draft)).campaign
        : (await adminApi.createCampaign(draft)).campaign
      setDraft({ ...saved })
    }, 'Saved.')
  }

  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d))
  const setContent = (patch: Partial<Draft['content']>) => setDraft((d) => (d ? { ...d, content: { ...d.content, ...patch } } : d))
  const setPopup = (patch: Partial<Draft['popup']>) => setDraft((d) => (d ? { ...d, popup: { ...d.popup, ...patch } } : d))

  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value])
  const fieldError = (key: string) => fields[key] && <p className="text-xs text-rose-600 font-semibold mt-1">{fields[key]}</p>

  return (
    <>
      <PageHeader
        title="Offers & alerts"
        description="Anything you want to say that isn't tied to a booking. Show it as a popup while people browse, push it to phones that allowed notifications, or both."
        action={!draft && (
          <button type="button" onClick={() => setDraft(blankCampaign())} className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold py-3 px-5 rounded-2xl">
            <i className="fa-solid fa-plus mr-2" aria-hidden="true"></i>New campaign
          </button>
        )}
      />

      {note && <div className="mb-6 text-sm font-semibold text-brand-700"><i className="fa-solid fa-circle-check mr-1.5" aria-hidden="true"></i>{note}</div>}
      {error && <div className="mb-6"><ErrorNote message={error} /></div>}

      {draft ? (
        <div className="space-y-6">
          <Panel title={draft.id ? 'Edit campaign' : 'New campaign'} action={
            <button type="button" onClick={() => { setDraft(null); setFields({}) }} className="text-xs font-bold text-slate-600 hover:text-slate-900">Close</button>
          }>
            <div className="max-w-sm mb-5">
              <label className={label} htmlFor="c-name">Name (only your team sees this)</label>
              <input id="c-name" value={draft.name} maxLength={CAMPAIGN_LIMITS.name} onChange={(e) => set({ name: e.target.value })} className={input} />
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className={label} htmlFor="c-title">Headline</label>
                  <input id="c-title" value={draft.content.title} maxLength={CAMPAIGN_LIMITS.title} onChange={(e) => setContent({ title: e.target.value })} className={input} placeholder="Monsoon escape — 20% off Coorg" />
                  {fieldError('content.title')}
                </div>
                <div>
                  <label className={label} htmlFor="c-body">Message</label>
                  <textarea id="c-body" rows={3} value={draft.content.body} maxLength={CAMPAIGN_LIMITS.body} onChange={(e) => setContent({ body: e.target.value })} className={input} />
                  <p className="text-xs text-slate-500 mt-1 tabular-nums">{draft.content.body.length}/{CAMPAIGN_LIMITS.body} — phones cut long messages off.</p>
                  {fieldError('content.body')}
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className={label} htmlFor="c-button">Button</label>
                    <input id="c-button" value={draft.content.buttonLabel} maxLength={CAMPAIGN_LIMITS.buttonLabel} onChange={(e) => setContent({ buttonLabel: e.target.value })} className={input} placeholder="See the stays" />
                    {fieldError('content.buttonLabel')}
                  </div>
                  <div>
                    <label className={label} htmlFor="c-url">Button goes to</label>
                    <input id="c-url" value={draft.content.buttonUrl} onChange={(e) => setContent({ buttonUrl: e.target.value })} className={`${input} font-mono text-xs`} placeholder="/search?where=Coorg" />
                    {fieldError('content.buttonUrl')}
                  </div>
                </div>
                <ImageField label="Picture (optional)" value={draft.content.imageUrl} onChange={(url) => setContent({ imageUrl: url })} error={fieldError('content.imageUrl')} />
              </div>

              <div className="space-y-5">
                <fieldset>
                  <legend className={label}>How to send it</legend>
                  <div className="space-y-2">
                    {CAMPAIGN_CHANNELS.map((ch) => {
                      const on = draft.channels.includes(ch.value)
                      const blocked = ch.value === 'push' && !push.ready
                      return (
                        <label key={ch.value} className={`flex items-start gap-3 p-3 rounded-2xl border-2 cursor-pointer ${on ? 'border-brand-500 bg-brand-50/60' : 'border-slate-200 hover:border-slate-300'}`}>
                          <input type="checkbox" checked={on} className="mt-1 w-4 h-4 accent-brand-600"
                            onChange={() => set({ channels: toggle(draft.channels, ch.value) as CampaignChannel[] })} />
                          <span>
                            <span className="block text-sm font-bold text-slate-900">{ch.label}</span>
                            <span className="block text-xs text-slate-500">{ch.explain}</span>
                            {blocked && on && <span className="block text-xs text-amber-700 font-semibold mt-1">Create the push keys below before this can go out.</span>}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                  {fieldError('channels')}
                </fieldset>

                <fieldset>
                  <legend className={label}>Who sees it</legend>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {CAMPAIGN_AUDIENCES.map((a) => {
                      const on = draft.audiences.includes(a.value)
                      return (
                        <label key={a.value} title={a.explain} className={`flex items-center gap-2 p-2.5 rounded-xl border-2 cursor-pointer ${on ? 'border-brand-500 bg-brand-50/60' : 'border-slate-200 hover:border-slate-300'}`}>
                          <input type="checkbox" checked={on} className="w-4 h-4 accent-brand-600"
                            onChange={() => set({ audiences: toggle(draft.audiences, a.value) as CampaignAudience[] })} />
                          <i className={`fa-solid fa-${a.icon} text-slate-400 w-4 text-center`} aria-hidden="true"></i>
                          <span className="text-xs font-semibold text-slate-800">{a.label}</span>
                        </label>
                      )
                    })}
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    {draft.audiences.length === 0
                      ? 'Nothing ticked, so everyone sees it.'
                      : `Anyone in any of the ${draft.audiences.length} ticked groups sees it.`}
                  </p>
                </fieldset>

                <div>
                  <label className={label} htmlFor="c-places">Only people looking at these places</label>
                  <input id="c-places" value={draft.places.join(', ')} onChange={(e) => set({ places: e.target.value.split(',').map((p) => p.trim()).filter(Boolean) })}
                    className={input} placeholder="Coorg, Karnataka, Goa" />
                  <p className="text-xs text-slate-500 mt-1">Separate with commas. Leave empty for anywhere. Popups only — a push has no place to match against.</p>
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="When it runs">
            <div className="grid sm:grid-cols-2 gap-4 max-w-2xl">
              <div>
                <label className={label} htmlFor="c-start">Starts</label>
                <input id="c-start" type="datetime-local" value={(draft.startsAt ?? '').slice(0, 16)}
                  onChange={(e) => set({ startsAt: e.target.value ? new Date(e.target.value).toISOString() : null })} className={input} />
                <p className="text-xs text-slate-500 mt-1">Leave empty to start as soon as you publish.</p>
              </div>
              <div>
                <label className={label} htmlFor="c-end">Ends</label>
                <input id="c-end" type="datetime-local" value={(draft.endsAt ?? '').slice(0, 16)}
                  onChange={(e) => set({ endsAt: e.target.value ? new Date(e.target.value).toISOString() : null })} className={input} />
                <p className="text-xs text-slate-500 mt-1">Leave empty to run until you stop it.</p>
                {fieldError('endsAt')}
              </div>
            </div>
          </Panel>

          {draft.channels.includes('popup') && (
            <Panel title="How the popup behaves">
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className={label} htmlFor="c-delay">Appears after</label>
                  <input id="c-delay" type="number" min={0} max={120} value={draft.popup.afterSeconds}
                    onChange={(e) => setPopup({ afterSeconds: Number(e.target.value) })} className={input} />
                  <p className="text-xs text-slate-500 mt-1">Seconds. Give people a moment to read first.</p>
                  {fieldError('popup.afterSeconds')}
                </div>
                <div>
                  <label className={label} htmlFor="c-freq">Show it</label>
                  <select id="c-freq" value={draft.popup.frequency} onChange={(e) => setPopup({ frequency: e.target.value as Draft['popup']['frequency'] })} className={input}>
                    {POPUP_FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={label} htmlFor="c-where">On</label>
                  <select id="c-where" value={draft.popup.where} onChange={(e) => setPopup({ where: e.target.value as Draft['popup']['where'] })} className={input}>
                    {POPUP_PLACES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
              </div>
            </Panel>
          )}

          <div className="sticky bottom-0 -mx-4 sm:-mx-6 px-4 sm:px-6 py-4 bg-white/95 backdrop-blur border-t border-slate-200 flex flex-wrap items-center gap-3">
            <button type="button" onClick={save} disabled={busy} className="bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-bold py-3 px-6 rounded-2xl">
              {busy ? 'Saving…' : 'Save draft'}
            </button>
            {draft.id && (
              <button type="button" disabled={busy} onClick={() => run(() => adminApi.publishCampaign(draft.id!), 'Published.')}
                className="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-bold py-3 px-6 rounded-2xl">
                {draft.startsAt ? 'Schedule it' : 'Publish now'}
              </button>
            )}
            {draft.id && draft.channels.includes('push') && push.ready && (
              <button type="button" disabled={busy} onClick={() => run(async () => {
                const r = await adminApi.pushCampaign(draft.id!)
                setNote(`Pushed to ${r.sent} device${r.sent === 1 ? '' : 's'}${r.failed ? `, ${r.failed} failed` : ''}.`)
              })} className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-bold py-3 px-5 rounded-2xl">
                Send the push now
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <Panel title="Push notifications" subtitle="Needed before a campaign can reach a phone with the site closed.">
            {!push.encryptionReady ? (
              <ErrorNote message="SETTINGS_ENCRYPTION_KEY is missing in Vercel, so the push keys can’t be stored safely." />
            ) : push.ready ? (
              <div className="flex flex-wrap items-center gap-4">
                <p className="text-sm text-slate-600 flex-1 min-w-[200px]">
                  Ready. <strong className="font-bold text-slate-900 tabular-nums">{push.subscribers}</strong> device{push.subscribers === 1 ? '' : 's'} have allowed notifications.
                </p>
                <button type="button" disabled={busy} onClick={() => run(async () => {
                  const r = await adminApi.testPush()
                  setNote(`Test sent to ${r.sentTo} of your own devices.`)
                })} className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold py-2.5 px-5 rounded-xl">Send a test to me</button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-4">
                <p className="text-sm text-slate-600 flex-1 min-w-[200px]">No push keys yet. Create them once; browsers use them to subscribe.</p>
                <button type="button" disabled={busy} onClick={() => run(() => adminApi.createPushKeys(), 'Push keys created.')}
                  className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold py-2.5 px-5 rounded-xl">Create push keys</button>
              </div>
            )}
          </Panel>

          <Panel title="Campaigns">
            {campaigns.length === 0 ? (
              <p className="text-sm text-slate-500">Nothing yet. “New campaign” writes your first offer.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {campaigns.map((c) => (
                  <li key={c.id} className="py-4 flex flex-wrap items-center gap-3">
                    <StatusBadge status={c.status === 'Live' ? 'Confirmed' : c.status === 'Stopped' ? 'Rejected' : c.status === 'Scheduled' ? 'Pending' : 'Draft'} />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm text-slate-900">{c.content.title || c.name}</p>
                      <p className="text-xs text-slate-500">
                        {c.channels.map((ch) => CAMPAIGN_CHANNELS.find((x) => x.value === ch)?.label).join(' · ')}
                        {' · '}
                        {c.audiences.length === 0 ? 'everyone' : c.audiences.map((a) => CAMPAIGN_AUDIENCES.find((x) => x.value === a)?.label).join(', ')}
                        {c.places.length > 0 && ` · ${c.places.join(', ')}`}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
                        Shown {c.stats.shown} · clicked {c.stats.clicked} · dismissed {c.stats.dismissed}
                        {c.stats.pushSent > 0 && ` · pushed to ${c.stats.pushSent}`}
                        {c.startsAt && ` · from ${formatDate(c.startsAt, { day: 'numeric', month: 'short' })}`}
                        {c.endsAt && ` to ${formatDate(c.endsAt, { day: 'numeric', month: 'short' })}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setDraft({ ...c })} className="text-xs font-bold text-brand-700 hover:underline">Edit</button>
                      {(c.status === 'Live' || c.status === 'Scheduled') && (
                        <button type="button" disabled={busy} onClick={() => run(() => adminApi.stopCampaign(c.id), 'Stopped.')} className="text-xs font-bold text-rose-600 hover:underline">Stop</button>
                      )}
                      {c.status === 'Draft' && (
                        <button type="button" disabled={busy} onClick={() => run(() => adminApi.deleteCampaign(c.id), 'Deleted.')} className="text-xs font-bold text-slate-500 hover:underline">Delete</button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <p className="text-xs text-slate-500">
            Popups appear on the <a href={appLink('website', '/')} target="_blank" rel="noreferrer" className="underline font-semibold">website</a> while people browse.
            Scheduled campaigns start and stop on their own, and a scheduled push goes out with the daily run.
          </p>
        </div>
      )}
    </>
  )
}
