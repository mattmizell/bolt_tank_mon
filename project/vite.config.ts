import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    // Optimize build for better performance
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor libraries into separate chunks
          vendor: ['react', 'react-dom'],
          charts: ['chart.js', 'react-chartjs-2'],
          utils: ['date-fns', 'lucide-react'],
        },
      },
    },
    // Enable compression
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.logs in production
        drop_debugger: true,
      },
    },
  },
  server: {
    // Optimize dev server
    hmr: {
      overlay: false, // Disable error overlay for better performance
    },
    // Add proxy configuration to handle CORS issues with TextBelt API
    proxy: {
      '/textbelt': {
        target: 'https://textbelt.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/textbelt/, ''),
        secure: true,
      },
    },
  },
});