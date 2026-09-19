import { useEffect } from 'react'

export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · Meridian Stay` : 'Meridian Stay - Farmstays, Rooms, Resorts, Cottages & Villas'
  }, [title])
}
