import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_BASE_URL || 'http://127.0.0.1:5000';

  return {
    plugins: [react()],
    resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
    server: {
      port: 5173,
      proxy: {
        // NOTA: NO incluir '/admin' aquí — ese path es una ruta de React,
        // no del backend. Solo registrar los prefijos de la API.
        '/auth':           { target: apiTarget, changeOrigin: true },
        '/productos':      { target: apiTarget, changeOrigin: true },
        '/cliente':        { target: apiTarget, changeOrigin: true },
        '/admin/pedidos':  { target: apiTarget, changeOrigin: true },
        '/admin/usuarios': { target: apiTarget, changeOrigin: true },
        '/admin/clientes': { target: apiTarget, changeOrigin: true },
        '/admin/reportes': { target: apiTarget, changeOrigin: true },
        '/vendedor':       { target: apiTarget, changeOrigin: true },
        '/health':         { target: apiTarget, changeOrigin: true },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: mode === 'development',
      rollupOptions: {
        output: {
          manualChunks: {
            vendor:    ['react', 'react-dom', 'react-router-dom'],
            bootstrap: ['bootstrap'],
          },
        },
      },
    },
  };
});
