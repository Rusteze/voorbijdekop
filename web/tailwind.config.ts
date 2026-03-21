import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Effra-Bold",
          "Roboto",
          "Helvetica",
          "Arial",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "sans-serif"
        ],
        serif: ["Georgia", "Times New Roman", "Times", "serif"]
      }
    },
  },
  plugins: [],
};

export default config;

