/** @type {import('tailwindcss').Config} */
module.exports = {
  // Was scoped to ./app only — components/ and lib/ (LanguageProvider.tsx,
  // Header.tsx) also use Tailwind classes but weren't scanned, meaning any
  // class used ONLY in those files (not duplicated elsewhere under app/)
  // could silently be missing from the generated CSS.
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // One font everywhere (IBM Plex Sans Hebrew, loaded in app/layout.tsx).
        sans: ["var(--font-plex)", "system-ui", "sans-serif"],
      },
      colors: {
        // "Control room" palette (design option B): a warm dark theme with a
        // single amber accent. `ctl` = control room.
        ctl: {
          night: "#14100D",
          panel: "#1D1712",
          panel2: "#261E17",
          line: "#3A2E24",
          text: "#F1E6D8",
          muted: "#A08B76",
          amber: "#FFB04A",
          ok: "#8FD694",
          bad: "#FF7A66",
        },
        // Previous desert/clay palette — kept so nothing that still
        // references it breaks.
        desert: {
          50: "#faf3f0",
          100: "#f4e8e1",
          200: "#ead1c3",
          300: "#dcb49d",
          400: "#cc9170",
          500: "#bf754b",
          600: "#9f5d38",
          700: "#79472b",
          800: "#5b3620",
          900: "#442818",
        },
      },
    },
  },
  plugins: [],
};
