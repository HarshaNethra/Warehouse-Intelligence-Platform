/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#F5F7FA', // Clean Enterprise Light slate
        surface: '#FFFFFF',    // Pure White card surface
        border: '#E2E8F0',     // Subtle slate border
        primary: {
          DEFAULT: '#2563EB',  // Enterprise Blue
          hover: '#1D4ED8',
          subtle: '#EFF6FF',
        },
        ai: {
          DEFAULT: '#6366F1',  // Indigo AI accent
          subtle: '#EEF2FF',
        },
        secondary: '#64748B',  // Slate 500
        dark: {
          canvas: '#0F172A',   // Slate 900 for live video canvas
          panel: '#1E293B',    // Slate 800 for video controls
        },
        risk: {
          low: '#16A34A',      // Green
          medium: '#F59E0B',   // Amber
          high: '#F97316',     // Orange
          critical: '#DC2626'  // Red
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'enterprise': '0 1px 3px 0 rgb(15 23 42 / 0.06), 0 1px 2px -1px rgb(15 23 42 / 0.04)',
        'enterprise-lg': '0 10px 15px -3px rgb(15 23 42 / 0.08), 0 4px 6px -4px rgb(15 23 42 / 0.04)',
      }
    },
  },
  plugins: [],
}
