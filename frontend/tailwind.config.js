/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cosmos: {
          dark: '#050714',
          panel: 'rgba(13, 17, 38, 0.75)',
          border: 'rgba(56, 189, 248, 0.15)',
          accent: '#38bdf8',
          purple: '#a855f7',
          pink: '#ec4899',
          cyan: '#06b6d4',
          gold: '#f59e0b',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'neon-cyan': '0 0 15px rgba(6, 182, 212, 0.5)',
        'neon-purple': '0 0 15px rgba(168, 85, 247, 0.5)',
        'neon-gold': '0 0 15px rgba(245, 158, 11, 0.5)',
      },
      animation: {
        'pulse-glow': 'pulseGlow 3s ease-in-out infinite',
        'orbit': 'orbit 20s linear infinite',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: 0.8, filter: 'drop-shadow(0 0 10px rgba(56, 189, 248, 0.6))' },
          '50%': { opacity: 1, filter: 'drop-shadow(0 0 25px rgba(168, 85, 247, 0.9))' },
        }
      }
    },
  },
  plugins: [],
}
