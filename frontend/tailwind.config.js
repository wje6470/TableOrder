/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        soft: "0 1px 2px 0 rgba(15, 23, 42, 0.04), 0 4px 16px -4px rgba(15, 23, 42, 0.08)",
        "soft-md": "0 2px 4px 0 rgba(15, 23, 42, 0.04), 0 12px 28px -8px rgba(15, 23, 42, 0.12)",
      },
    },
  },
  plugins: [],
};
