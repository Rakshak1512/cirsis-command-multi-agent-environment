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
        command: {
          bg: '#050811',
          surface: '#0b1329',
          card: 'rgba(15, 23, 42, 0.75)',
          border: 'rgba(56, 189, 248, 0.2)',
          accent: '#00f0ff',
          neon: '#38bdf8',
          fire: '#ff334b',
          amber: '#f59e0b',
          emerald: '#10b981',
          purple: '#8b5cf6',
          dark: '#030712',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        display: ['Rajdhani', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 25px rgba(0, 240, 255, 0.25)',
        'glow-red': '0 0 25px rgba(255, 51, 75, 0.35)',
        'glow-amber': '0 0 25px rgba(245, 158, 11, 0.35)',
        'glow-emerald': '0 0 25px rgba(16, 185, 129, 0.35)',
      },
      animation: {
        'pulse-fast': 'pulse 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'radar': 'radarSweep 4s linear infinite',
      },
      keyframes: {
        radarSweep: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        }
      }
    },
  },
  plugins: [],
}
