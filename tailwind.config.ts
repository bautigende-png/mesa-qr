import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        sand: "#f8f5ef",
        ember: "#b45309",
        moss: "#1f4d3c",
        mist: "#e7ecef",
        blush: "#f8dfd7"
      },
      boxShadow: {
        soft: "0 20px 60px rgba(15, 23, 42, 0.12)"
      },
      backgroundImage: {
        "paper-grid":
          "linear-gradient(rgba(15,23,42,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.04) 1px, transparent 1px)"
      }
    }
  },
  plugins: []
};

export default config;
