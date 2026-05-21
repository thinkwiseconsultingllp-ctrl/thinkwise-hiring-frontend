import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: true, // Allow devtunnel hosts
    proxy: {
      '/api': {
        target: 'http://localhost:4002',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        configure: (proxy, _options) => {
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            if (proxyRes.headers.location) {
              const loc = proxyRes.headers.location;
              console.log(`[Vite Proxy] Redirect from ${req.url} to Location: ${loc}`);
              try {
                const urlObj = new URL(loc);
                proxyRes.headers.location = '/api' + urlObj.pathname + urlObj.search + urlObj.hash;
              } catch (e) {
                if (loc.startsWith('/') && !loc.startsWith('/api')) {
                  proxyRes.headers.location = '/api' + loc;
                }
              }
              console.log(`[Vite Proxy] Rewrote Location to: ${proxyRes.headers.location}`);
            }
          });
        }
      }
    }
  }
})
