import { useState } from 'react'
import { isInAppBrowser, isIOS, useInstall } from '../lib/install'
import { Modal } from './Modal'

/** Header button that installs Meridian Stay as an app on the phone (or computer). */
export function InstallAppButton() {
  const { available, install } = useInstall()
  const [help, setHelp] = useState(false)
  const [done, setDone] = useState(false)
  if (!available && !done) return null

  const onClick = async () => {
    const result = await install()
    if (result === 'installed') setDone(true)
    else if (result === 'instructions') setHelp(true)
  }

  return (
    <>
      <button type="button" onClick={onClick} aria-label="Download the Meridian Stay app"
        className="flex items-center gap-2 whitespace-nowrap text-[13px] font-semibold text-slate-800 hover:bg-slate-100 h-10 px-2.5 lg:px-4 rounded-full transition">
        <i className={`fa-solid ${done ? 'fa-circle-check text-brand-600' : 'fa-mobile-screen-button text-brand-500'}`} aria-hidden="true"></i>
        <span className="hidden lg:inline">{done ? 'App installed' : 'Download app'}</span>
      </button>
      <Modal open={help} onClose={() => setHelp(false)} title="Get the Meridian Stay app">
        <InstallHelp />
      </Modal>
    </>
  )
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="shrink-0 w-7 h-7 rounded-full bg-brand-100 text-brand-700 font-extrabold text-xs flex items-center justify-center">{n}</span>
      <span className="pt-1">{children}</span>
    </li>
  )
}

function InstallHelp() {
  const ios = isIOS()
  return (
    <div className="space-y-5 text-sm text-slate-700">
      <div className="flex items-center gap-4">
        <img src="/icons/icon-192.png" alt="" className="w-16 h-16 rounded-2xl shadow-lg shadow-brand-500/30" />
        <div>
          <p className="font-extrabold text-slate-900">Meridian Stay</p>
          <p className="text-xs text-slate-500">Adds an app icon to your home screen. Opens full screen, no app store needed.</p>
        </div>
      </div>
      {isInAppBrowser() ? (
        <ol className="space-y-3">
          <Step n={1}>Tap the <span className="font-bold">⋯</span> menu in this app and choose <span className="font-bold">Open in browser</span> ({ios ? 'Safari' : 'Chrome'}).</Step>
          <Step n={2}>Then tap <span className="font-bold">Download app</span> again.</Step>
        </ol>
      ) : ios ? (
        <ol className="space-y-3">
          <Step n={1}>In <span className="font-bold">Safari</span>, tap the <span className="font-bold">Share</span> button <i className="fa-solid fa-arrow-up-from-bracket text-sky-600 mx-0.5" aria-hidden="true"></i> at the bottom (top on iPad).</Step>
          <Step n={2}>Scroll down and tap <span className="font-bold">Add to Home Screen</span> <i className="fa-solid fa-square-plus mx-0.5" aria-hidden="true"></i>.</Step>
          <Step n={3}>Tap <span className="font-bold">Add</span>. Meridian Stay appears on your home screen.</Step>
        </ol>
      ) : (
        <ol className="space-y-3">
          <Step n={1}>Open your browser’s menu <span className="font-bold">⋮</span> (Chrome, Edge or Samsung Internet).</Step>
          <Step n={2}>Tap <span className="font-bold">Install app</span> or <span className="font-bold">Add to Home screen</span>.</Step>
          <Step n={3}>Confirm with <span className="font-bold">Install</span>. Meridian Stay appears with your other apps.</Step>
        </ol>
      )}
    </div>
  )
}
