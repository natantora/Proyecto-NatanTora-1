import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: "#1B2A4E", deep: "#0F1A30", soft: "#2A3A60" },
        cream: { DEFAULT: "#F7F1E3", light: "#FBF7EB", dark: "#EFE6CF" },
        gold: { DEFAULT: "#B8924A", light: "#D4B576", deep: "#8F6F37" },
        ink: { DEFAULT: "#2C2416", soft: "#5C4F3A", muted: "#8B7B5C" },
        line: { DEFAULT: "#D9CDB0", soft: "#E8DFC7" },
      },
      fontFamily: {
        sans: ["var(--font-montserrat)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
        hebrew: ["var(--font-hebrew)", "serif"],
      },
      letterSpacing: {
        widest: "0.25em",
        ultrawide: "0.35em",
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
        "out-quart": "cubic-bezier(0.25, 1, 0.5, 1)",
        "in-out-cubic": "cubic-bezier(0.65, 0, 0.35, 1)",
      },
      transitionDuration: {
        quick: "180ms",
        base: "280ms",
        slow: "480ms",
      },
    },
  },
  plugins: [],
};
export default config;
