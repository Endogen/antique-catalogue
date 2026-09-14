import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const withVar = (name: string) => `hsl(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./pages/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}"
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px"
      }
    },
    extend: {
      colors: {
        border: withVar("border"),
        input: withVar("input"),
        ring: withVar("ring"),
        background: withVar("background"),
        foreground: withVar("foreground"),
        primary: {
          DEFAULT: withVar("primary"),
          foreground: withVar("primary-foreground")
        },
        secondary: {
          DEFAULT: withVar("secondary"),
          foreground: withVar("secondary-foreground")
        },
        brand: {
          DEFAULT: withVar("brand"),
          foreground: withVar("brand-foreground"),
          strong: withVar("brand-strong"),
          muted: withVar("brand-muted"),
          border: withVar("brand-border")
        },
        destructive: {
          DEFAULT: withVar("destructive"),
          foreground: withVar("destructive-foreground"),
          muted: withVar("destructive-muted"),
          border: withVar("destructive-border")
        },
        success: {
          DEFAULT: withVar("success"),
          foreground: withVar("success-foreground"),
          muted: withVar("success-muted"),
          border: withVar("success-border")
        },
        muted: {
          DEFAULT: withVar("muted"),
          foreground: withVar("muted-foreground"),
          strong: withVar("muted-strong"),
          subtle: withVar("muted-subtle")
        },
        accent: {
          DEFAULT: withVar("accent"),
          foreground: withVar("accent-foreground")
        },
        popover: {
          DEFAULT: withVar("popover"),
          foreground: withVar("popover-foreground")
        },
        card: {
          DEFAULT: withVar("card"),
          foreground: withVar("card-foreground")
        },
        panel: {
          DEFAULT: withVar("panel"),
          deep: withVar("panel-from"),
          foreground: withVar("panel-foreground"),
          "muted-foreground": withVar("panel-muted-foreground"),
          border: withVar("panel-border")
        }
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)"
      },
      letterSpacing: {
        eyebrow: "0.3em",
        "eyebrow-wide": "0.4em"
      }
    }
  },
  plugins: [tailwindcssAnimate]
};

export default config;
