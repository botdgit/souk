/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}', './features/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        souk: {
          black: '#0F0E0E',
          white: '#FAFAFA',
          gold: '#D4A853',
          'gold-light': '#E8C97A',
          sand: '#F5EDD6',
          charcoal: '#2A2A2A',
          muted: '#8A8A8A',
          'muted-light': '#C4C4C4',
          error: '#E53E3E',
          success: '#38A169',
          info: '#3182CE',
        },
      },
      fontFamily: {
        sans: ['Inter', 'System'],
        display: ['PlayfairDisplay', 'System'],
      },
    },
  },
  plugins: [],
}
