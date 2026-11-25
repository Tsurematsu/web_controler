import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? './',
  server: {
    host: true,
    port: 5173,
    headers: {
      'Permissions-Policy': 'serial=(self), bluetooth=(self)',
    },
  },
  preview: {
    host: true,
    port: 4173,
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
