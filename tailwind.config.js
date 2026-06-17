/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#4f46e5", // Indigo-600
          50: "#f5f3ff",
          100: "#ede9fe",
          200: "#ddd6fe",
          300: "#c084fc",
          400: "#a855f7",
          500: "#8b5cf6",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81"
        },
        // Semantic tokens used across shared UI (Button/Badge/OfflineNotice/Input)
        success: {
          DEFAULT: "#059669", // Emerald-600
          50: "#ecfdf5",
          600: "#059669",
          700: "#047857"
        },
        warning: {
          DEFAULT: "#f59e0b", // Amber-500
          50: "#fffbeb",
          600: "#d97706",
          700: "#b45309"
        },
        destructive: {
          DEFAULT: "#e11d48", // Rose-600
          50: "#fff1f2",
          600: "#e11d48",
          700: "#be123c"
        },
        slate: {
          50: "#f8fafc",
          100: "#f1f5f9",
          150: "#eef2f6",
          200: "#e2e8f0",
          250: "#d8e0ea",
          300: "#cbd5e1",
          350: "#aab6c6",
          400: "#94a3b8",
          450: "#7e8ca1",
          500: "#64748b",
          550: "#566175",
          600: "#475569",
          650: "#3c485c",
          700: "#334155",
          800: "#1e293b",
          850: "#162132",
          900: "#0f172a",
          950: "#020617"
        },
        amber: {
          250: "#fcdf8a"
        }
      }
    }
  },
  plugins: []
}
