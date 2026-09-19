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
        brand: {
          50: '#f4fbf7',
          100: '#e1f5ec',
          500: '#10b981', // Emerald green primary
          600: '#059669',
          700: '#047857',
          yellow: {
            400: '#facc15',
            500: '#eab308', // Warm solar yellow accent
            600: '#ca8a04',
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
