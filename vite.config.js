import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { localStoragePlugin } from './local-storage-plugin.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [localStoragePlugin(), react()],
  server: {
    host: 'localhost',
    port: 4177,
    strictPort: true,
  },
})
