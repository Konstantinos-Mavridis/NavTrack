import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://backend:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Raise the warning threshold to 600 kB (default is 500 kB).
    // The remaining large chunk after splitting is recharts + d3 deps which
    // cannot be split further without dynamic imports.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // React runtime — changes least often, best for long-term caching
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Charting library — large but infrequently updated
          'vendor-recharts': ['recharts'],
        },
      },
    },
  },
});
