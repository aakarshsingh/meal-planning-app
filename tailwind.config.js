/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#EBEBD3',
        accent: {
          DEFAULT: '#DA4167',
          light: '#FDF0F3',
        },
        primary: {
          DEFAULT: '#00635D',
          light: '#E6F2F1',
          dark: '#004A45',
        },
        gold: {
          DEFAULT: '#F4D35E',
          light: '#FEF9E7',
        },
        ink: '#0C1B33',
      },
      fontFamily: {
        sans: ['Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
