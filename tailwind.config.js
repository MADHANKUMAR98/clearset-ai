/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#0B0F17',
        surface: {
          50: '#1e293b',
          100: '#171F2E',
          200: '#111723',
          300: '#0E1420',
          card: '#131B2A',
          hover: '#1B2438',
          border: '#1F2C42',
          borderLight: '#2B3B59',
        },
        brand: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          cyan: '#06B6D4',
          indigo: '#6366F1',
          accent: '#38BDF8',
        },
        risk: {
          critical: '#EF4444',
          criticalBg: 'rgba(239, 68, 68, 0.12)',
          criticalBorder: 'rgba(239, 68, 68, 0.35)',
          high: '#F97316',
          highBg: 'rgba(249, 115, 22, 0.12)',
          medium: '#F59E0B',
          mediumBg: 'rgba(245, 158, 11, 0.12)',
          low: '#10B981',
          lowBg: 'rgba(16, 185, 129, 0.12)',
        },
        snowflake: {
          blue: '#29B5E8',
          glow: 'rgba(41, 181, 232, 0.15)',
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow-spin': 'spin 8s linear infinite',
      }
    },
  },
  plugins: [],
}
