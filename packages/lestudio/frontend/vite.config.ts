import { defineConfig } from 'vitest/config'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

const isDoctor = process.env.VITE_APP_PROFILE === 'doctor'

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
    {
      // The doctor profile is the same SPA under its own name.
      name: 'app-profile-title',
      transformIndexHtml: (html) => (isDoctor ? html.replace('<title>LeStudio</title>', '<title>lerobot-doctor</title>') : html),
    },
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  build: {
    // The doctor profile builds the hardware-only bundle into the lerobot-doctor package.
    outDir: isDoctor ? '../../lerobot-doctor/src/lerobot_doctor/static' : '../src/lestudio/static',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }

          if (id.includes('/recharts/es6/chart/')) {
            return 'vendor-charts'
          }

          if (
            id.includes('/recharts/es6/component/') ||
            id.includes('/recharts/es6/container/') ||
            id.includes('/recharts/es6/context/') ||
            id.includes('/recharts/es6/cartesian/') ||
            id.includes('/recharts/es6/polar/') ||
            id.includes('/recharts/es6/shape/') ||
            id.includes('/recharts/es6/util/') ||
            id.includes('/recharts/es6/numberAxis/') ||
            id.includes('/recharts/es6/index.js')
          ) {
            return 'vendor-charts-core'
          }

          if (id.includes('/node_modules/d3-')) {
            return 'vendor-d3'
          }

          return undefined
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/app/**/*.{ts,tsx}'],
      exclude: ['src/app/**/*.test.{ts,tsx}', 'src/app/mock-api/**'],
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000',
      '/ws': { target: 'ws://localhost:8000', ws: true },
    },
  },
})
