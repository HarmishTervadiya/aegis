export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Base
        bg:        "#0a0a0f",
        surface:   "#111118",
        border:    "#1e1e2a",
        // Text
        primary:   "#e8e8f0",
        secondary: "#6b6b80",
        muted:     "#3a3a4a",
        // Accents
        green:     "#22c55e",
        amber:     "#f59e0b",
        red:       "#ef4444",
        purple:    "#a78bfa",
        // Protocol colors
        marginfi:  "#699BF7",
        kamino:    "#9FE2BF",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
    },
  },
};
