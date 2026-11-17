/** Design tokens come straight from the official Waste Before Waste identity. */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          green: "#166534",
          emerald: "#10B981",
          dark: "#064E3B",
          paper: "#F8FAF7",
          line: "#D5DED2",
          lime: "#D9F99D",
          ink: "#14261D",
          muted: "#5B6B62",
        },
      },
      fontFamily: {
        display: ["Sora", "system-ui", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      maxWidth: { page: "72rem" },
    },
  },
  plugins: [],
};
