/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        dhanova: {
          ink: "#11120f",
          paper: "#f6f4ee",
          lime: "#dfff4f",
          orange: "#ff6947",
        },
      },
    },
  },
  corePlugins: {
    preflight: false,
  },
  plugins: [],
};
