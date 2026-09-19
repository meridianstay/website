/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
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
    },
  },
  plugins: [],
}
