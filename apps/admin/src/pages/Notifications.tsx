import { useEffect, useState } from 'react'
import { ErrorNote, PageHeader, Panel, Spinner, StatusBadge } from '@meridian/ui'
import { COMMON_TOKENS, formatDate, type EventDefinition, type MessageTemplate, type NotificationEvent, type NotificationLogEntry } from '@meridian/shared'
import { ApiError, adminApi, type NotificationsView } from '@meridian/shared/client'

// Control centre → Notifications. Firebase only sends sign-in codes, so everything else — booking
// confirmations, requests waiting for a host, refunds — goes out from here. Nothing sends until a
// mail server or SMS gateway is set up; until then every message is logged as skipped.

const input = 'w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:border-brand-500'
const label = 'block text-xs font-bold uppercase text-slate-500 mb-1'

export function Notifications() {
  const [view, setView] = useState<NotificationsView | null>(null)
  const [secrets, setSecrets] = useState({ smtpPass: '', smsKey: '', smsSecret: '' })
  const [log, setLog] = useState<NotificationLogEntry[] | null>(null)
  const [open, setOpen] = useState<NotificationEvent | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fields, setFields] = useState<Record<string, string>>({})
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [testing, setTesting] = useState<'email' | 'sms' | null>(null)
  const [tested, setTested] = useState<string | null>(null)

  const loadLog = () => adminApi.notificationLog().then((r) => setLog(r.entries)).catch(() => setLog([]))
  useEffect(() => {
    adminApi.notifications().then(setView).catch((e) => setError(e.message))
    loadLog()
  }, [])

  if (error && !view) return <ErrorNote message={error} />
  if (!view) return <Spinner />

  const touch = (next: Partial<NotificationsView>) => {
    setView({ ...view, ...next })
    if (state === 'saved') setState('idle')
  }
  const setTemplate = (event: NotificationEvent, patch: Partial<MessageTemplate>) =>
    touch({ templates: { ...view.templates, [event]: { ...view.templates[event], ...patch } } })

  const save = async () => {
    setState('saving')
    setError(null)
    setFields({})
    try {
      await adminApi.saveNotifications(view)
      const fresh = await adminApi.saveMailCredentials({
        smtpHost: view.smtpHost, smtpPort: view.smtpPort, smtpUser: view.smtpUser, smtpSecure: view.smtpSecure,
        smtpPass: secrets.smtpPass || undefined, smsKey: secrets.smsKey || undefined, smsSecret: secrets.smsSecret || undefined,
      })
      setView(fresh)
      setSecrets({ smtpPass: '', smsKey: '', smsSecret: '' })
      setState('saved')
    } catch (err) {
      setFields((err as ApiError).fields ?? {})
      setError((err as Error).message)
      setState('idle')
    }
  }

  const sendTest = async (channel: 'email' | 'sms') => {
    setTesting(channel)
    setError(null)
    setTested(null)
    try {
      const { sentTo } = await adminApi.testNotification(channel)
      setTested(`Sent to ${sentTo}. If it doesn’t arrive in a minute, check the log below.`)
      loadLog()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setTesting(null)
    }
  }

  const fieldError = (key: string) => fields[key] && <p className="text-xs text-rose-600 font-semibold mt-1">{fields[key]}</p>
  const ready = view.email === 'smtp' && view.smtpPassSet && !!view.fromEmail

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Booking confirmations, requests waiting for a host, refunds and reminders — by email and SMS. Nothing goes out until a mail server is set up below."
      />

      {!view.encryptionReady && (
        <div className="mb-6"><ErrorNote message="SETTINGS_ENCRYPTION_KEY is missing in Vercel, so mail and SMS passwords can’t be stored safely. Add it before saving them." /></div>
      )}

      <div className="space-y-6">
        <Panel title="Who messages come from">
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className={label} htmlFor="from-name">Sender name</label>
              <input id="from-name" value={view.fromName} onChange={(e) => touch({ fromName: e.target.value })} className={input} />
              {fieldError('fromName')}
            </div>
            <div>
              <label className={label} htmlFor="from-email">From address</label>
              <input id="from-email" value={view.fromEmail} onChange={(e) => touch({ fromEmail: e.target.value })} className={input} placeholder="bookings@yourdomain.com" />
              {fieldError('fromEmail')}
            </div>
            <div>
              <label className={label} htmlFor="reply-to">Replies go to</label>
              <input id="reply-to" value={view.replyTo} onChange={(e) => touch({ replyTo: e.target.value })} className={input} placeholder="help@yourdomain.com" />
              {fieldError('replyTo')}
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Use an address on your own domain. Guests reply to these emails, so “replies go to” should be an inbox somebody actually watches.
          </p>
        </Panel>

        <Panel title="Mail server" subtitle="Any SMTP mailbox works — Zoho, Google Workspace, or the one that came with your hosting.">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className={label} htmlFor="smtp-host">Server</label>
              <input id="smtp-host" value={view.smtpHost} onChange={(e) => touch({ smtpHost: e.target.value })} className={input} placeholder="smtp.zoho.in" />
            </div>
            <div>
              <label className={label} htmlFor="smtp-port">Port</label>
              <select id="smtp-port" value={view.smtpPort} onChange={(e) => touch({ smtpPort: Number(e.target.value), smtpSecure: Number(e.target.value) === 465 })} className={input}>
                <option value={587}>587 — STARTTLS</option>
                <option value={465}>465 — TLS</option>
                <option value={25}>25 — plain</option>
              </select>
            </div>
            <div>
              <label className={label} htmlFor="smtp-user">Username</label>
              <input id="smtp-user" value={view.smtpUser} onChange={(e) => touch({ smtpUser: e.target.value })} className={input} autoComplete="off" />
            </div>
            <div>
              <label className={label} htmlFor="smtp-pass">Password</label>
              <input id="smtp-pass" type="password" value={secrets.smtpPass} onChange={(e) => setSecrets({ ...secrets, smtpPass: e.target.value })} className={input}
                placeholder={view.smtpPassSet ? 'Saved — leave blank to keep' : 'App password'} autoComplete="new-password" />
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" checked={view.email === 'smtp'} onChange={(e) => touch({ email: e.target.checked ? 'smtp' : 'none' })} className="w-4 h-4 accent-brand-600" />
              Send emails
            </label>
            <button type="button" onClick={() => sendTest('email')} disabled={testing === 'email' || !ready}
              className="bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 text-xs font-bold py-2.5 px-5 rounded-xl">
              {testing === 'email' ? 'Sending…' : 'Send a test to me'}
            </button>
            {!ready && <span className="text-xs text-slate-500">Fill in the server, password and from address, save, then test.</span>}
          </div>
        </Panel>

        <Panel title="SMS gateway" subtitle="Optional, and worth it for the messages hosts must not miss. Indian gateways need a registered sender ID.">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className={label} htmlFor="sms-provider">Gateway</label>
              <select id="sms-provider" value={view.sms} onChange={(e) => touch({ sms: e.target.value as NotificationsView['sms'] })} className={input}>
                <option value="none">Don’t send SMS</option>
                <option value="msg91">MSG91</option>
                <option value="twilio">Twilio</option>
              </select>
            </div>
            <div>
              <label className={label} htmlFor="sms-sender">Sender ID</label>
              <input id="sms-sender" value={view.smsSenderId} onChange={(e) => touch({ smsSenderId: e.target.value.toUpperCase() })} className={input} placeholder="MERIDN" maxLength={11} />
              {fieldError('smsSenderId')}
            </div>
            <div>
              <label className={label} htmlFor="sms-key">{view.sms === 'twilio' ? 'Account SID' : 'Auth key'}</label>
              <input id="sms-key" type="password" value={secrets.smsKey} onChange={(e) => setSecrets({ ...secrets, smsKey: e.target.value })} className={input}
                placeholder={view.smsKeySet ? 'Saved — leave blank to keep' : ''} autoComplete="new-password" />
            </div>
            {view.sms === 'twilio' && (
              <div>
                <label className={label} htmlFor="sms-secret">Auth token</label>
                <input id="sms-secret" type="password" value={secrets.smsSecret} onChange={(e) => setSecrets({ ...secrets, smsSecret: e.target.value })} className={input} autoComplete="new-password" />
              </div>
            )}
          </div>
          <button type="button" onClick={() => sendTest('sms')} disabled={testing === 'sms' || view.sms === 'none' || !view.smsKeySet}
            className="mt-5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 text-xs font-bold py-2.5 px-5 rounded-xl">
            {testing === 'sms' ? 'Sending…' : 'Send a test to me'}
          </button>
        </Panel>

        <Panel title="What we send, and when">
          <ul className="divide-y divide-slate-100">
            {view.events.map((def: EventDefinition) => {
              const template = view.templates[def.event]
              const showing = open === def.event
              return (
                <li key={def.event} className="py-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <input type="checkbox" checked={template.enabled} aria-label={`Send ${def.label}`} className="w-4 h-4 accent-brand-600"
                      onChange={(e) => setTemplate(def.event, { enabled: e.target.checked })} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900">
                        {def.label}
                        <span className={`ml-2 text-[10px] font-bold uppercase rounded-full px-2 py-0.5 ${def.to === 'host' ? 'bg-brand-yellow-50 text-brand-yellow-700' : 'bg-brand-50 text-brand-700'}`}>
                          to the {def.to}
                        </span>
                      </p>
                      <p className="text-xs text-slate-500">{def.when}</p>
                    </div>
                    <label className="flex items-center gap-1.5 text-xs text-slate-600">
                      <input type="checkbox" checked={template.email} className="w-3.5 h-3.5 accent-brand-600" onChange={(e) => setTemplate(def.event, { email: e.target.checked })} />Email
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-slate-600">
                      <input type="checkbox" checked={template.sms} className="w-3.5 h-3.5 accent-brand-600" onChange={(e) => setTemplate(def.event, { sms: e.target.checked })} />SMS
                    </label>
                    <button type="button" onClick={() => setOpen(showing ? null : def.event)} className="text-xs font-bold text-brand-700 hover:underline">
                      {showing ? 'Close' : 'Edit wording'}
                    </button>
                  </div>

                  {showing && (
                    <div className="mt-4 space-y-3 bg-slate-50 rounded-2xl p-4">
                      <Tokens def={def} />
                      <div>
                        <label className={label} htmlFor={`${def.event}-subject`}>Subject</label>
                        <input id={`${def.event}-subject`} value={template.subject} onChange={(e) => setTemplate(def.event, { subject: e.target.value })} className={input} />
                        {fieldError(`${def.event}.subject`)}
                      </div>
                      <div>
                        <label className={label} htmlFor={`${def.event}-body`}>Email</label>
                        <textarea id={`${def.event}-body`} rows={10} value={template.body} onChange={(e) => setTemplate(def.event, { body: e.target.value })} className={`${input} font-mono text-xs`} />
                        {fieldError(`${def.event}.body`)}
                      </div>
                      <div>
                        <label className={label} htmlFor={`${def.event}-sms`}>Text message</label>
                        <textarea id={`${def.event}-sms`} rows={2} value={template.smsText} onChange={(e) => setTemplate(def.event, { smsText: e.target.value })} className={`${input} font-mono text-xs`} />
                        <p className="text-xs text-slate-500 mt-1 tabular-nums">{template.smsText.length} characters — one SMS is 160, and you pay per part.</p>
                        {fieldError(`${def.event}.smsText`)}
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </Panel>

        <Panel title="What went out" action={<button type="button" onClick={loadLog} className="text-xs font-bold text-slate-600 hover:text-slate-900">Refresh</button>}>
          {!log ? <Spinner /> : log.length === 0 ? (
            <p className="text-sm text-slate-500">Nothing sent yet. Messages appear here as bookings happen.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {log.slice(0, 60).map((entry) => (
                <li key={entry.id} className="py-3 flex flex-wrap items-center gap-3 text-sm">
                  <StatusBadge status={entry.status === 'sent' ? 'Confirmed' : entry.status === 'failed' ? 'Rejected' : 'Draft'} />
                  <span className="text-xs font-mono text-slate-500 w-12">{entry.channel}</span>
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold text-slate-800">{entry.subject}</span>
                    <span className="block text-xs text-slate-500">
                      {entry.to} · {formatDate(entry.createdAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                      {entry.bookingCode && <span className="font-mono ml-2">{entry.bookingCode}</span>}
                    </span>
                    {entry.detail && <span className="block text-xs text-amber-700 mt-0.5">{entry.detail}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {tested && <div className="mt-6 text-sm font-semibold text-brand-700"><i className="fa-solid fa-circle-check mr-1.5" aria-hidden="true"></i>{tested}</div>}
      {error && <div className="mt-6"><ErrorNote message={error} /></div>}
      <div className="sticky bottom-0 mt-6 -mx-4 sm:-mx-6 px-4 sm:px-6 py-4 bg-white/95 backdrop-blur border-t border-slate-200 flex items-center gap-4">
        <button type="button" onClick={save} disabled={state === 'saving'} className="bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-bold py-3 px-6 rounded-2xl">
          {state === 'saving' ? 'Saving…' : 'Save notifications'}
        </button>
        {state === 'saved' && <span className="text-sm font-bold text-brand-700"><i className="fa-solid fa-check mr-1.5" aria-hidden="true"></i>Saved</span>}
      </div>
    </>
  )
}

/** The placeholders this message can use, so nobody has to guess the spelling. */
function Tokens({ def }: { def: EventDefinition }) {
  return (
    <div>
      <p className={label}>Placeholders</p>
      <div className="flex flex-wrap gap-1.5">
        {[...COMMON_TOKENS, ...def.tokens].map((token) => (
          <code key={token} className="text-[11px] bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700">{`{${token}}`}</code>
        ))}
      </div>
      <p className="text-xs text-slate-500 mt-2">Anything we don’t know is left out rather than showing empty braces.</p>
    </div>
  )
}
