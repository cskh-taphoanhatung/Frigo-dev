/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/web/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        takosan: {
          coral: "#FF7B6B",
          green: "#2E7D5B",
          navy: "#1F2937",
          cream: "#FFF8F3",
          mint: "#DFF4E6",
          yellow: "#FFC857",
        },
        frigo: {
          green: {
            DEFAULT: "#059669",
            50: "#ECFDF5",
            100: "#D1FAE5",
            200: "#A7F3D0",
            300: "#6EE7B7",
            400: "#34D399",
            500: "#10B981",
            600: "#059669",
            700: "#047857",
            800: "#065F46",
            900: "#064E3B",
          },
          deep: {
            DEFAULT: "#0F3D2E",
            light: "#164E3D",
            dark: "#0A281E",
          },
          forest: {
            DEFAULT: "#0F3D2E",
            light: "#164E3D",
            dark: "#0A281E",
          },
          mint: {
            DEFAULT: "#E6F4EA",
            light: "#F0FDF4",
            dark: "#C7E8D2",
          },
          cream: {
            DEFAULT: "#F8FAF9",
            warm: "#F5F5F4",
          },
          surface: "#FFFFFF",
          border: "#E2E8F0",
          tomato: {
            DEFAULT: "#E11D48",
            light: "#FFE4E6",
          },
          yellow: {
            DEFAULT: "#D97706",
            light: "#FEF3C7",
          },
        },
      },
      fontFamily: {
        heading: ["Nunito", "system-ui", "sans-serif"],
        body: ["Nunito", "system-ui", "sans-serif"],
        sans: ["Nunito", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "lg": "10px",
        "xl": "12px",
        "2xl": "16px",
        "3xl": "20px",
      },
      // Fractional spacing used across the UI (w-4.5, w-12.5...) — without these
      // Tailwind silently drops the class and icons render at default size.
      spacing: {
        "4.5": "1.125rem",
        "5.5": "1.375rem",
        "12.5": "3.125rem",
        "13": "3.25rem",
        "15": "3.75rem",
        "17": "4.25rem",
        "18": "4.5rem",
      },
      boxShadow: {
        "xs": "0 1px 2px 0 rgba(15, 23, 42, 0.04)",
        "soft": "0 2px 10px -1px rgba(15, 23, 42, 0.05)",
        "card": "0 1px 3px rgba(15, 23, 42, 0.04), 0 4px 12px -2px rgba(15, 23, 42, 0.05)",
        "elevated": "0 10px 25px -4px rgba(15, 23, 42, 0.08), 0 4px 10px -4px rgba(15, 23, 42, 0.04)",
        "float": "0 8px 20px -3px rgba(5, 150, 105, 0.22), 0 3px 6px -2px rgba(5, 150, 105, 0.12)",
        "glow": "0 0 0 4px rgba(16, 185, 129, 0.15), 0 8px 20px -3px rgba(5, 150, 105, 0.35)",
      }
    },
  },
  plugins: [],
}
