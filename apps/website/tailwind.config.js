import preset, { sharedContent } from '@meridian/tailwind-config'

/** @type {import('tailwindcss').Config} */
export default {
  presets: [preset],
  content: ['./index.html', './src/**/*.{ts,tsx}', ...sharedContent],
}
