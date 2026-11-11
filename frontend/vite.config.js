import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      // Explicitly enable React Fast Refresh
      fastRefresh: true,
    }),
    tailwindcss()
  ],
  server: {
    port: 5173,
    host: true,
    strictPort: false,
    watch: {
      // Polling is required on Windows/OneDrive directories to reliably detect file changes
      usePolling: true,
      interval: 100,
    },
    hmr: {
      overlay: true,
    },
  },
})
