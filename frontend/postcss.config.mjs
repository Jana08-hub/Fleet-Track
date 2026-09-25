import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = dirname(fileURLToPath(import.meta.url));

// Absolute config path: the single-host server runs with CWD=backend/,
// and the tailwindcss PostCSS plugin resolves a relative config path
// against CWD — silently falling back to defaults (zero utilities).
export default {
  plugins: {
    tailwindcss: { config: join(root, 'tailwind.config.mjs') },
    autoprefixer: {},
  },
};
