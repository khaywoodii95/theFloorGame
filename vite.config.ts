import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          const rawName = assetInfo.name ?? '';
          const name = rawName.replace(/\\/g, '/');
          const extMatch = name.match(/\.([^.]+)$/);
          const ext = extMatch ? extMatch[1] : '';

          // Preserve relative paths for categoryImages to avoid name collisions without hashing
          if (name.includes('categoryImages/')) {
            const rel = name.substring(name.indexOf('categoryImages/'));
            return `assets/${rel}`;
          }

          // Keep original names for images/media/fonts
          if (/png|jpe?g|gif|svg|webp|avif|ico|woff|woff2|eot|ttf|otf|mp3|wav|m4a/.test(ext)) {
            return `assets/[name].[ext]`;
          }

          if (ext === 'css') {
            return `assets/[name].[ext]`;
          }

          return `assets/[name]-[hash].[ext]`;
        },
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
})
