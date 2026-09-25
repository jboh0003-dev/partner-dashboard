import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          50: "#f8f5ef", 100: "#f0ebe2", 200: "#dfd5c6", 300: "#c7b9a7",
          400: "#988977", 500: "#786b5e", 600: "#64564d", 700: "#51433c",
          800: "#3d302e", 900: "#2d2225", 950: "#21191d"
        },
        okestro: {
          50: "#f9f1ed",
          100: "#f1e1da",
          200: "#dfc1b8",
          500: "#98535f",
          600: "#81424e",
          700: "#723841",
          800: "#5c2d37",
          900: "#39242a"
        }
      },
      borderRadius: {
        xl: "0.35rem",
        "2xl": "0.45rem"
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)",
        elevated:
          "0 4px 6px -1px rgb(15 23 42 / 0.06), 0 2px 4px -2px rgb(15 23 42 / 0.04)"
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }]
      }
    }
  },
  plugins: []
};

export default config;
