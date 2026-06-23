import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        gsu: {
          blue: "#003366",
          red: "#CC0000",
          ink: "#05070B",
          panel: "#0A101B"
        }
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(0, 51, 102, 0.45), 0 18px 50px rgba(0, 0, 0, 0.35)"
      }
    }
  },
  plugins: []
};

export default config;
