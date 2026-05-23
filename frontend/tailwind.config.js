/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Surface hierarchy
        'bg-base':    '#f1f5f9',
        'bg-surface': '#ffffff',
        'bg-raised':  '#f8fafc',
        // Borders
        'border-subtle': '#e2e8f0',
        'border-strong': '#cbd5e1',
        // Accent
        'accent':       '#6366f1',
        'accent-hover': '#4f46e5',
      },
      boxShadow: {
        'card':     '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'elevated': '0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -1px rgba(0,0,0,0.04)',
        'panel':    '2px 0 8px rgba(0,0,0,0.04)',
        'navbar':   '0 1px 4px rgba(0,0,0,0.06)',
      },
      borderRadius: {
        'xl':  '12px',
        '2xl': '16px',
      },
    },
  },
  plugins: [],
}