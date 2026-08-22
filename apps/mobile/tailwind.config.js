/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        bg: '#0E1116',
        surface: '#151B23',
        'surface-2': '#1C232D',
        line: '#232C37',
        text: '#E7EBF2',
        dim: '#8B94A3',
        accent: '#8B7CF6',
        done: '#4ADE80',
        due: '#F87171',
      },
    },
  },
  plugins: [],
};
