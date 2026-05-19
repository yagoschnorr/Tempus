/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      colors: {
        ink: {
          950: "#0F0F11",
          900: "#131318",
          800: "#17171D",
          700: "#23232C",
          600: "#2B2B36",
          500: "#5A5A66",
          400: "#8D8D99",
          300: "#B8B8C2",
          200: "#E1E1E6",
          100: "#F4F4F7",
          50: "#FFFFFF",
        },
        brand: {
          50: "#F1ECFE",
          100: "#E2D9FD",
          200: "#C7B4FA",
          300: "#AE8EF2",
          400: "#9670EC",
          500: "#8257E6",
          600: "#6C3FD6",
          700: "#5828BC",
          800: "#3E2486",
          900: "#2A1860",
        },
        success: { 400: "#34D399", 500: "#22C55E" },
        warning: { 500: "#F59E0B" },
        danger: { 500: "#EF4444" },
        info: { 500: "#06B6D4" },
        accent: { pink: "#EC4899", rose: "#FB7185", orange: "#F97316", magenta: "#A855F7" },
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(130, 87, 230, 0.3), 0 8px 24px -8px rgba(130, 87, 230, 0.4)",
      },
    },
  },
  plugins: [],
};
