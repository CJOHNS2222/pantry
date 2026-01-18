/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./hooks/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}",
    "./utils/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'playfair': ['Playfair Display', 'serif'],
        'inter': ['Inter', 'sans-serif'],
      },
      colors: {
        'burgundy': {
          900: '#2A0A10',
          800: '#3F1016',
          700: '#52151C',
        },
        'rose': {
          50: '#FFF1F2',
          100: '#FFE4E6',
          800: '#9F1239',
          900: '#881337',
        }
      }
    },
  },
  plugins: [],
}