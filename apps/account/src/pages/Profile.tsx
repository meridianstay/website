import { PageHeader, Panel } from '@meridian/ui'
import { demoGuest } from '@meridian/shared'

const inputClass = 'w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-sm focus:outline-none focus:border-brand-500'

export function Profile() {
  return (
    <>
      <PageHeader title="Profile" description="Your personal details. Saving comes with the backend." />
      <div className="max-w-2xl">
        <Panel>
          <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            <div>
              <label htmlFor="name" className="block text-xs font-bold uppercase text-slate-500 mb-1">Full name</label>
              <input id="name" className={inputClass} defaultValue={demoGuest.name} />
            </div>
            <div>
              <label htmlFor="email" className="block text-xs font-bold uppercase text-slate-500 mb-1">Email</label>
              <input id="email" type="email" className={inputClass} defaultValue={demoGuest.email} />
            </div>
            <div>
              <label htmlFor="phone" className="block text-xs font-bold uppercase text-slate-500 mb-1">Phone</label>
              <input id="phone" type="tel" className={inputClass} placeholder="+91 98765 43210" />
            </div>
            <button type="submit" disabled className="bg-brand-600 disabled:bg-slate-300 text-white font-bold py-3 px-8 rounded-2xl text-sm">
              Save changes
            </button>
          </form>
        </Panel>
      </div>
    </>
  )
}
