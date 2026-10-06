import { defineConfig } from 'vite'

// Published under the repo Pages site, on a preview path.
export default defineConfig({
  base: '/Offshore/preview/second/',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
