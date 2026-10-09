import { defineConfig } from 'vite'

// Published under the repo Pages site, on a preview path.
export default defineConfig({
  base: '/Offshore/preview/sixth/',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
