import { useEffect } from 'react'

export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · Meridian Stay` : 'Meridian Stay - Farmstays, Rooms, Resorts, Cottages & Villas'
  }, [title])
}

/** Sets the page's meta description (search results and link previews), restoring the default on leave. */
export function useMetaDescription(text: string | null | undefined) {
  useEffect(() => {
    if (!text) return
    const tag = document.querySelector('meta[name="description"]')
    const previous = tag?.getAttribute('content') ?? ''
    tag?.setAttribute('content', text)
    return () => tag?.setAttribute('content', previous)
  }, [text])
}
