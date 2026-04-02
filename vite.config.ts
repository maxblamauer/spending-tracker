import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
/** Must match how the app is served (e.g. GitHub Pages project site path). */
const BASE = '/stevies-college-fund/';

export default defineConfig({
  base: BASE,
  server: {
    open: BASE,
  },
  plugins: [react()],
})
