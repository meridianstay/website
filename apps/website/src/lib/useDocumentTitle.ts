import { useEffect } from 'react'

export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · Book My Get Away` : 'Book My Get Away - Farmstays, Rooms, Resorts, Cottages & Villas'
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

/** Writes or replaces one `<meta>`, whichever way it names itself. */
function setMeta(key: 'name' | 'property', value: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${key}="${value}"]`)
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute(key, value)
    document.head.appendChild(tag)
  }
  tag.setAttribute('content', content)
}

export interface SocialMeta {
  title: string
  description?: string
  /** A full https:// address. A relative one is no use to a crawler on another machine. */
  image?: string
}

/**
 * How this page looks when its address is pasted into a chat or posted somewhere.
 *
 * Google runs the page before reading these, so it sees the right ones. WhatsApp, Facebook and X
 * do not: they read what the HTML file was served with, which is the same for every page here.
 * Per-page previews in a chat need the pages rendered on the server.
 */
export function useSocialMeta({ title, description, image }: SocialMeta) {
  useEffect(() => {
    if (!title) return
    setMeta('property', 'og:title', title)
    setMeta('name', 'twitter:title', title)
    setMeta('property', 'og:url', window.location.href.split('?')[0])
    if (description) {
      setMeta('property', 'og:description', description)
      setMeta('name', 'twitter:description', description)
    }
    if (image) {
      setMeta('property', 'og:image', image)
      setMeta('name', 'twitter:image', image)
    }
  }, [title, description, image])
}

/**
 * Structured data, which is how a search engine knows this page is a place to stay rather than an
 * article: its name, where it is, what a night costs and how guests rated it.
 */
export function useStructuredData(data: object | null) {
  useEffect(() => {
    if (!data) return
    const tag = document.createElement('script')
    tag.type = 'application/ld+json'
    tag.text = JSON.stringify(data)
    document.head.appendChild(tag)
    return () => { tag.remove() }
  }, [data])
}
