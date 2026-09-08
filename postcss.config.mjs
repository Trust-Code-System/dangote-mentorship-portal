/** @type {import('postcss-load-config').Config} */
// Tailwind v4: a single PostCSS plugin replaces the v3 `tailwindcss` +
// `autoprefixer` pair (vendor prefixing is now built in). All theme tokens live
// in src/app/globals.css via `@theme` — there is no tailwind.config.ts anymore.
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
