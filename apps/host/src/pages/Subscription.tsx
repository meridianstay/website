import { useEffect, useState } from 'react'
import { CheckoutDismissed, ErrorNote, PageHeader, Panel, Spinner, payWithRazorpay, useAuth } from '@meridian/ui'
import { FREE_PLAN_ID, formatPrice, type ClientPlan, type PlanId, type Subscription as Sub } from '@meridian/shared'
import { hostApi } from '@meridian/shared/client'

// What the client pays Meridian for. One year at a time, through the same Razorpay account that
// takes their guests' bookings. Nothing changes on the account until a payment is confirmed.

interface View {
  subscription: Sub
  plans: ClientPlan[]
  required: boolean
  active: boolean
  daysLeft: number | null
  renewSoon: boolean
  /** The plan in force — the one they bought, or Free. */
  currentPlanId: PlanId | null
}

const when = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { dateStyle: 'medium' })

export function Subscription() {
  const { user } = useAuth()
  const [view, setView] = useState<View | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<PlanId | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = () => {
    setError(null)
    hostApi.subscription().then((r) => setView(r as View)).catch((e) => setError(e.message))
  }
  useEffect(load, [])

  if (error && !view) return <ErrorNote message={error} onRetry={load} />
  if (!view) return <Spinner />

  const { subscription: sub, plans, active } = view

  const choose = async (plan: ClientPlan) => {
    setBusy(plan.id)
    setError(null)
    setMessage(null)
    try {
      const started = await hostApi.startSubscription(plan.id)
      if (started.testMode) {
        setMessage('Online payments are switched off, so your plan has been started without a charge.')
        load()
        return
      }
      const result = await payWithRazorpay(
        { provider: 'razorpay', keyId: started.keyId!, orderId: started.orderId!, amount: Math.round((started.amount ?? 0) * 100), currency: 'INR', captureNow: true },
        { title: `${started.planName} — one year`, user },
      )
      await hostApi.confirmSubscription({
        orderId: result.razorpay_order_id,
        paymentId: result.razorpay_payment_id,
        signature: result.razorpay_signature,
        planId: plan.id,
      })
      setMessage(`You're on ${plan.name}. Thank you.`)
      load()
    } catch (e) {
      // Closing the payment window is not an error worth shouting about.
      if (!(e instanceof CheckoutDismissed)) setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <PageHeader
        title="Your plan"
        description="What you pay Meridian to be here, once a year. Your guests' bookings and your payouts are separate — this is only your own subscription."
      />

      {active && sub.expiresAt && (
        <div className={`rounded-2xl p-4 mb-8 text-sm ${view.renewSoon ? 'bg-amber-50 text-amber-800' : 'bg-brand-50 text-brand-800'}`}>
          <p className="font-semibold">
            <i className={`fa-solid ${view.renewSoon ? 'fa-hourglass-half' : 'fa-circle-check'} mr-2`} aria-hidden="true"></i>
            You&rsquo;re on {plans.find((p) => p.id === sub.planId)?.name ?? sub.planId}, paid until {when(sub.expiresAt)}
            {view.daysLeft !== null && <> — {view.daysLeft} {view.daysLeft === 1 ? 'day' : 'days'} left</>}.
          </p>
          {view.renewSoon && <p className="mt-1">Renewing adds a year onto what you have left, so nothing is wasted.</p>}
        </div>
      )}
      {!active && (
        <div className="rounded-2xl p-4 mb-8 text-sm bg-brand-50 text-brand-800">
          <p className="font-semibold">
            <i className="fa-solid fa-circle-check mr-2" aria-hidden="true"></i>
            {sub.terms.length ? 'Your paid plan has run out, so you are back on Free.' : 'You are on Free.'}
          </p>
          <p className="mt-1">
            Your website is live at your Meridian address and your listings, bookings and payouts all keep working.
            A paid plan adds your own domain, and more than one stay on the site.
          </p>
        </div>
      )}
      {message && <p role="status" className="rounded-2xl p-4 mb-8 text-sm bg-brand-50 text-brand-800 font-semibold">{message}</p>}
      {error && <p role="alert" className="rounded-2xl p-4 mb-8 text-sm bg-rose-50 text-rose-700 font-semibold">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        {plans.map((plan) => {
          const free = plan.id === FREE_PLAN_ID
          const current = free ? !active : active && sub.planId === plan.id
          return (
            <article key={plan.id} className={`bg-white rounded-3xl p-7 border-2 flex flex-col ${current ? 'border-brand-500' : 'border-slate-100'}`}>
              {current && <span className="self-start text-[10px] font-bold uppercase bg-brand-100 text-brand-700 px-2.5 py-1 rounded-full mb-3">Your plan</span>}
              {free && !current && <span className="self-start text-[10px] font-bold uppercase bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full mb-3">Always included</span>}
              <h2 className="text-lg font-extrabold text-slate-900">{plan.name}</h2>
              <p className="text-sm text-slate-500 mt-1">{plan.tagline}</p>
              <p className="mt-5">
                <span className="text-3xl font-extrabold text-slate-900">{free ? 'Free' : formatPrice(plan.pricePerYear)}</span>
                {!free && <span className="text-sm text-slate-400 font-semibold"> / year</span>}
              </p>
              <ul className="mt-5 space-y-2.5 text-sm text-slate-600 flex-1">
                {plan.perks.map((perk) => (
                  <li key={perk} className="flex gap-2.5">
                    <i className="fa-solid fa-check text-brand-600 mt-1 shrink-0" aria-hidden="true"></i><span>{perk}</span>
                  </li>
                ))}
              </ul>
              {free ? (
                <p className="mt-6 text-xs text-slate-500 text-center py-3">
                  {current ? 'This is what you are on. Nothing to pay.' : 'Still yours underneath — a paid plan never takes it away.'}
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => choose(plan)}
                  disabled={!!busy}
                  className={`mt-6 font-bold py-3 px-6 rounded-2xl text-sm disabled:opacity-50 ${
                    current ? 'bg-slate-100 hover:bg-slate-200 text-slate-800' : 'bg-brand-600 hover:bg-brand-700 text-white'
                  }`}
                >
                  {busy === plan.id ? 'Opening payment…' : current ? 'Renew for a year' : active ? 'Switch to this plan' : 'Choose this plan'}
                </button>
              )}
            </article>
          )
        })}
      </div>

      {sub.terms.length > 0 && (
        <Panel title="What you have paid">
          <ul className="divide-y divide-slate-100 text-sm">
            {[...sub.terms].reverse().map((term) => (
              <li key={term.paymentId + term.at} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <span>
                  <span className="font-bold text-slate-900">{plans.find((p) => p.id === term.planId)?.name ?? term.planId}</span>
                  <span className="text-slate-500"> · {when(term.startedAt)} to {when(term.expiresAt)}</span>
                </span>
                <span className="flex items-center gap-4">
                  <span className="font-bold text-slate-900">{formatPrice(term.amount)}</span>
                  <span className="text-xs text-slate-400 font-mono">{term.via === 'manual' ? 'recorded by Meridian' : term.paymentId}</span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  )
}
