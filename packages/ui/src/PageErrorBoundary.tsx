import { Component, type ReactNode } from 'react'

interface State { error: Error | null }

/**
 * Keeps a crash in one page from blanking the whole app: shows what went wrong (so it can be reported)
 * and a way to retry. The app shell remounts it on every navigation.
 */
export class PageErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('[page error]', error)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div role="alert" className="max-w-xl mx-auto mt-10 bg-white border border-rose-200 rounded-3xl p-6 space-y-3 text-sm">
        <p className="font-bold text-slate-900"><i className="fa-solid fa-triangle-exclamation text-rose-500 mr-2" aria-hidden="true"></i>This page couldn’t be shown</p>
        <p className="text-slate-600">Something in the data on this page caused an error. The rest of the panel still works. Please send us the message below.</p>
        <pre className="text-xs bg-slate-50 rounded-xl p-3 whitespace-pre-wrap break-words text-rose-700">{error.message}</pre>
        <button type="button" onClick={() => this.setState({ error: null })} className="bg-slate-900 text-white font-bold py-2.5 px-5 rounded-2xl text-xs">Try again</button>
      </div>
    )
  }
}
