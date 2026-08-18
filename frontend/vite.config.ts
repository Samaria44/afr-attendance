import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  define: {
    // Expose VITE_API_URL to the frontend bundle
    // In Railway set VITE_API_URL=https://your-backend.railway.app
    // Falls back to relative /api (works behind nginx proxy)
    __API_BASE__: JSON.stringify(process.env.VITE_API_URL ?? ''),
  },
})
