/** @type {import('tailwindcss').Config} */
// Palette taken from the app logo: deep teal card, black ground, gold page edges.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef6f4',
          100: '#d7ebe7',
          200: '#acd5cd',
          300: '#7bb9ae',
          400: '#4a988b',
          500: '#2b7a6f',
          600: '#1f6158',
          700: '#184c46',
          800: '#123835',
          900: '#0b2421',
          950: '#06120f',
        },
        gold: {
          100: '#f7eed6',
          300: '#e4c77f',
          400: '#d6b05a',
          500: '#c39a3f',
          600: '#9c7a2e',
        },
        paper: '#f6f5f1',
        ink: '#17201e',
      },
      fontFamily: {
        tamil: ['"Noto Sans Tamil"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,22,.06), 0 1px 1px rgba(16,24,22,.04)',
        lift: '0 8px 24px -8px rgba(11,36,33,.25)',
      },
    },
  },
  plugins: [],
};
