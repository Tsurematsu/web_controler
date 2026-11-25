import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? './',
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    headers: {
      'Permissions-Policy': 'serial=(self), bluetooth=(self)',
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
    headers: {
      'Permissions-Policy': 'serial=(self), bluetooth=(self)',
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: false,
  },
});
