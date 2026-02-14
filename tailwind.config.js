/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/renderer/index.html",
    "./src/renderer/src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Agent Forge 专属工业风配色
        forge: {
          bg: '#0a0a0a',       // 极深黑
          panel: '#111111',    // 面板黑
          border: '#333333',   // 边框灰
          accent: '#f97316',   // 熔炉橙
        }
      }
    },
  },
  plugins: [],
}