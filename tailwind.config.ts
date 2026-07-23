import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        charcoal: "var(--charcoal)", "charcoal-soft": "var(--charcoal-soft)",
        copper: "var(--copper)", "copper-hover": "var(--copper-hover)", "copper-soft": "var(--copper-soft)",
        paper: "var(--paper)", surface: "var(--surface)", ink: "var(--ink)",
        muted: "var(--muted)", line: "var(--line)",
      },
      fontFamily: { display: ["var(--font-display)"], sans: ["var(--font-sans)"] },
      borderRadius: { xl2: "13px" },
      boxShadow: { card: "0 1px 2px rgba(20,20,25,.04), 0 4px 16px rgba(20,20,25,.05)" },
    },
  },
  plugins: [],
} satisfies Config;
