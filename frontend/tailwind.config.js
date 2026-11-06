/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        tv: {
          bg: "#131722",
          surface: "#1e222d",
          "surface-hover": "#262b3d",
          border: "#2a2e39",
          text: "#d1d4dc",
          "text-muted": "#787b86",
          accent: "#2962ff",
          "accent-hover": "#1e53e5",
          profit: "#26a69a",
          loss: "#ef5350",
        },
      },
    },
  },
  plugins: [],
};
