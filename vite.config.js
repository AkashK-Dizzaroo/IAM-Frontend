import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/__tests__/setup.js',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html']
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'), // allows '@/components/Button'
    },
  },
  server: {
    port: 5001,
    host: true,
    proxy: {
      // Same-origin /api in dev so HttpOnly cookies attach to localhost:5001 (IAM), not cross-port to :4001
      '/api': {
        target: process.env.VITE_DEV_PROXY_TARGET || 'http://127.0.0.1:4001',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',       // build folder
    sourcemap: false,     // disables .map files (reduces file count)
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) return 'vendor' // bundle all libraries into one file
        }
      }
    },
    assetsInlineLimit: 4096,  // small images/fonts inline instead of separate files
    chunkSizeWarningLimit: 2000
  }
})
