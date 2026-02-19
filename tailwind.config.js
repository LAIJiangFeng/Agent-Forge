/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Agent Forge industrial palette
        forge: {
          bg: '#0a0a0a',
          panel: '#111111',
          border: '#333333',
          accent: '#f97316'
        }
      }
    }
  },
  plugins: []
}
