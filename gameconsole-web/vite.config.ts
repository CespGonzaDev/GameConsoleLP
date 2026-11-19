import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'node:http';

function handleProxyError(serviceName: string) {
  return (_err: Error, _req: IncomingMessage, res: ServerResponse | unknown) => {
    const httpRes = res as ServerResponse | undefined;
    if (httpRes && typeof httpRes.writeHead === 'function' && !httpRes.headersSent) {
      httpRes.writeHead(503, { 'Content-Type': 'application/json' });
      httpRes.end(
        JSON.stringify({
          error: `${serviceName} offline`,
          status: 'offline',
        })
      );
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api/gamestats': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/gamestats/, ''),
        configure: (proxy) => {
          proxy.on('error', handleProxyError('GameStats (localhost:8080)'));
        },
      },
      '/api/ai': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        // Keep /api/ai/battleship/next-move intact; map /api/ai/health -> /health
        rewrite: (path) => (path === '/api/ai/health' ? '/health' : path),
        configure: (proxy) => {
          proxy.on('error', handleProxyError('Prolog AI (localhost:5000)'));
        },
      },
    },
  },
});
