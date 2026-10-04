import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/auth': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/incidents': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/resources': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/assignments': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/plans': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/replanning': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/notifications': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/share': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/analytics': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/commander': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/demo': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/geo': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://127.0.0.1:8000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
