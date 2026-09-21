/** One colour of the palette: a CSS variable holding an "r g b" triple, so `/20` opacities still work. */
const c = (name, fallback) => `rgb(var(--${name}, ${fallback}) / <alpha-value>)`

/**
 * Meridian Stay brand preset, shared by every app.
 * Apps add their own `content` globs and include `sharedContent`.
 * @type {import('tailwindcss').Config}
 */
export default {
  content: [],
  theme: {
    extend: {
      colors: {
        // Every shade reads a CSS variable so the control centre can change the palette at runtime.
        // The fallback is the built-in Meridian emerald and solar yellow, used before settings load.
        brand: {
          50: c('brand-50', '244 251 247'),
          100: c('brand-100', '225 245 236'),
          200: c('brand-200', '167 243 208'),
          300: c('brand-300', '110 231 183'),
          400: c('brand-400', '52 211 153'),
          500: c('brand-500', '16 185 129'), // Emerald green primary
          600: c('brand-600', '5 150 105'),
          700: c('brand-700', '4 120 87'),
          800: c('brand-800', '6 95 70'),
          900: c('brand-900', '6 78 59'),
          yellow: {
            50: c('brand-yellow-50', '254 252 232'),
            100: c('brand-yellow-100', '254 249 195'),
            200: c('brand-yellow-200', '254 240 138'),
            300: c('brand-yellow-300', '253 224 71'),
            400: c('brand-yellow-400', '250 204 21'),
            500: c('brand-yellow-500', '234 179 8'), // Warm solar yellow accent
            600: c('brand-yellow-600', '202 138 4'),
            700: c('brand-yellow-700', '161 98 7'),
            800: c('brand-yellow-800', '133 77 14'),
            900: c('brand-yellow-900', '113 63 18'),
          },
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      // Motion shared by every app. All of it is switched off for visitors who prefer reduced motion.
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-up': { from: { opacity: '0', transform: 'translateY(14px)' }, to: { opacity: '1', transform: 'none' } },
        'scale-in': { from: { opacity: '0', transform: 'scale(0.96)' }, to: { opacity: '1', transform: 'none' } },
        'slide-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'none' } },
        pop: { '0%': { transform: 'scale(1)' }, '40%': { transform: 'scale(1.35)' }, '100%': { transform: 'scale(1)' } },
        draw: { to: { strokeDashoffset: '0' } },
        'ken-burns': { from: { transform: 'scale(1.08)' }, to: { transform: 'scale(1)' } },
      },
      animation: {
        'fade-in': 'fade-in 0.25s ease-out both',
        'fade-up': 'fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        'page-in': 'fade-up 0.35s cubic-bezier(0.22, 1, 0.36, 1) both',
        'scale-in': 'scale-in 0.2s cubic-bezier(0.22, 1, 0.36, 1) both',
        'slide-up': 'slide-up 0.3s cubic-bezier(0.22, 1, 0.36, 1) both',
        pop: 'pop 0.35s ease-out',
        draw: 'draw 0.6s 0.2s ease-out forwards',
        'ken-burns': 'ken-burns 8s ease-out both',
      },
    },
  },
  plugins: [],
}

/** Globs for shared packages whose class names Tailwind must see. */
export const sharedContent = ['../../packages/ui/src/**/*.{ts,tsx}']
