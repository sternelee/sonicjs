import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Resolve SDK from source during local dev (no separate build needed)
      '@sonicjs-cms/sdk': resolve(__dirname, '../../packages/sdk/src/index.ts'),
    },
  },
  server: {
    port: 5199,
  },
})
