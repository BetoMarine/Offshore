import { defineConfig } from 'vite'

// Published under the repo Pages site, on a preview path.
export default defineConfig({
  base: '/Offshore/preview/eleventh/',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
