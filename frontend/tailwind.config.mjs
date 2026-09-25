import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = dirname(fileURLToPath(import.meta.url));

/** @type {import('tailwindcss').Config} */
const config = {
  // Absolute globs: the combined single-host server runs with CWD=backend/,
  // and Tailwind resolves relative globs against CWD — which silently
  // generated zero utilities. Absolute paths fix that in every launch mode.
  content: [join(root, 'app/**/*.{ts,tsx}'), join(root, 'src/**/*.{ts,tsx}')],
  darkMode: 'class',
  theme: { extend: {} },
  plugins: [],
};
export default config;
