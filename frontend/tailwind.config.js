/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#F8FAFC', // Slate 50
        surface: '#FFFFFF',    // White
        primary: '#2563EB',    // Blue 600
        secondary: '#64748B',  // Slate 500
        accent: '#0284C7',     // Sky 600
        risk: {
          low: '#10B981',      // Emerald 500
          medium: '#F59E0B',   // Amber 500
          high: '#EF4444',     // Red 500
          critical: '#991B1B'  // Red 800
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'premium': '0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
      }
    },
  },
  plugins: [],
}

