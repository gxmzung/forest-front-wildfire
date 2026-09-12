/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {}
  },

  // 기존 실기체 UI에 Tailwind reset이 침범하지 않도록 OFF
  corePlugins: {
    preflight: false
  }
}
