import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/vidAI3D/',
  build: { rollupOptions: { output: { manualChunks: { rapier: ['@dimforge/rapier3d-compat'] } } } },
});
