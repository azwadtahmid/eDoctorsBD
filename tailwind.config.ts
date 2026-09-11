import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eefbf3",
          100: "#d6f5e1",
          500: "#0f9d58",
          600: "#0c7f47",
          700: "#0a6338",
        },
      },
    },
  },
  plugins: [],
};
export default config;
