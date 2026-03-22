import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: 'class',
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        /* Semantic tokens */
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",

        /* M3 Surface system */
        "surface": "var(--surface)",
        "surface-dim": "var(--surface-dim)",
        "surface-bright": "var(--surface-bright)",
        "surface-container-lowest": "var(--surface-container-lowest)",
        "surface-container-low": "var(--surface-container-low)",
        "surface-container": "var(--surface-container)",
        "surface-container-high": "var(--surface-container-high)",
        "surface-container-highest": "var(--surface-container-highest)",
        "on-surface": "var(--on-surface)",
        "on-surface-variant": "var(--on-surface-variant)",

        /* M3 Primary */
        "m3-primary": "var(--m3-primary)",
        "on-primary": "var(--m3-on-primary)",
        "primary-container": "var(--m3-primary-container)",
        "on-primary-container": "var(--m3-on-primary-container)",
        "primary-dim": "var(--m3-primary-dim)",

        /* M3 Secondary */
        "m3-secondary": "var(--m3-secondary)",
        "secondary-container": "var(--m3-secondary-container)",

        /* M3 Tertiary */
        "m3-tertiary": "var(--m3-tertiary)",
        "tertiary-container": "var(--m3-tertiary-container)",
        "on-tertiary-container": "var(--m3-on-tertiary-container)",

        /* M3 Error */
        "error": "var(--m3-error)",
        "on-error": "var(--m3-on-error)",
        "error-container": "var(--m3-error-container)",
        "on-error-container": "var(--m3-on-error-container)",

        /* M3 Other */
        "outline": "var(--m3-outline)",
        "outline-variant": "var(--m3-outline-variant)",
        "surface-tint": "var(--m3-surface-tint)",
        "inverse-surface": "var(--m3-inverse-surface)",
        "inverse-primary": "var(--m3-inverse-primary)",

        /* Chart */
        chart: {
          "1": "var(--chart-1)",
          "2": "var(--chart-2)",
          "3": "var(--chart-3)",
          "4": "var(--chart-4)",
          "5": "var(--chart-5)",
        },

        /* Sidebar */
        sidebar: {
          DEFAULT: "var(--sidebar)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)",
        },
      },
      fontFamily: {
        headline: ["var(--font-headline)", "Manrope", "sans-serif"],
        body: ["var(--font-body)", "Inter", "sans-serif"],
        sans: ["var(--font-body)", "Inter", "sans-serif"],
      },
      borderRadius: {
        "4xl": "1.5rem",
        "3xl": "1.25rem",
        "2xl": "1rem",
        xl: "0.75rem",
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};
export default config;
