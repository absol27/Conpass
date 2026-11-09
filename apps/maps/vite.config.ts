import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Static PWA: the schedule and venue graph are bundled, and the floor-plan image is
// precached, so the app keeps working on congested venue Wi-Fi.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['maps/saltpalace.png', 'icon.svg'],
      manifest: {
        name: 'Hallway — KubeCon wayfinding',
        short_name: 'Hallway',
        description: 'How far apart are your talks? Walk times, leave-by alerts and routes for KubeCon at the Salt Palace.',
        theme_color: '#0f6b5c',
        background_color: '#f7f7f4',
        display: 'standalone',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
})
