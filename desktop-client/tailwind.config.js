/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        orange: {
          DEFAULT: '#FF6A00',
          dark: '#E05A00',
          light: '#FFE8D6',
        },
      },
    },
  },
  plugins: [],
};
