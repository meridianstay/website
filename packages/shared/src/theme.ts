// The site's colours, set in the control centre. One brand colour and one accent colour are enough:
// every shade from 50 to 900 is mixed from them, the way the built-in emerald and yellow were.
// Apps write the results as CSS variables, which Tailwind's `brand-*` classes read.

export interface ThemeSettings {
  /** The main colour: buttons, links, the logo mark. */
  brand: string
  /** The second colour: the accent word in the logo, highlights and badges. */
  accent: string
}

export const defaultTheme: ThemeSettings = { brand: '#10b981', accent: '#eab308' }

export const THEME_PRESETS: { name: string; blurb: string; theme: ThemeSettings }[] = [
  { name: 'Emerald & Solar', blurb: 'The Meridian look: forest green with warm sunlight', theme: { brand: '#10b981', accent: '#eab308' } },
  { name: 'Teak & Amber', blurb: 'Warm wood and lamplight, for heritage stays', theme: { brand: '#b45309', accent: '#f59e0b' } },
  { name: 'Deep Teal & Coral', blurb: 'Backwaters and beach houses', theme: { brand: '#0d9488', accent: '#fb7185' } },
  { name: 'Indigo & Gold', blurb: 'Evening blue with a royal accent', theme: { brand: '#4f46e5', accent: '#f59e0b' } },
  { name: 'Terracotta & Sand', blurb: 'Desert camps and mud-brick farmhouses', theme: { brand: '#c2410c', accent: '#d97706' } },
  { name: 'Pine & Sky', blurb: 'Himalayan cottages under a clear sky', theme: { brand: '#15803d', accent: '#0ea5e9' } },
]

export const isHexColor = (v: string) => /^#[0-9a-f]{6}$/i.test(v.trim())

type Rgb = [number, number, number]

export function hexToRgb(hex: string): Rgb {
  const h = hex.trim().replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

/** Mixes towards white (positive) or black (negative) by `amount`, 0 to 1. */
function shade([r, g, b]: Rgb, amount: number): Rgb {
  const target = amount > 0 ? 255 : 0
  const t = Math.abs(amount)
  return [r, g, b].map((v) => Math.round(v + (target - v) * t)) as Rgb
}

/** How far each step of the scale sits from the chosen colour, which is 500. */
const STEPS: [step: number, mix: number][] = [
  [50, 0.95], [100, 0.88], [200, 0.72], [300, 0.52], [400, 0.28],
  [500, 0], [600, -0.12], [700, -0.26], [800, -0.4], [900, -0.52],
]

/** Tailwind reads these as `rgb(var(--brand-500) / <alpha>)`, so the value is a bare "r g b" triple. */
export function themeVariables(theme: ThemeSettings): Record<string, string> {
  const vars: Record<string, string> = {}
  const base = hexToRgb(isHexColor(theme.brand) ? theme.brand : defaultTheme.brand)
  const accent = hexToRgb(isHexColor(theme.accent) ? theme.accent : defaultTheme.accent)
  for (const [step, mix] of STEPS) {
    vars[`--brand-${step}`] = shade(base, mix).join(' ')
    vars[`--brand-yellow-${step}`] = shade(accent, mix).join(' ')
  }
  return vars
}
