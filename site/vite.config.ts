import { defineConfig } from 'vite';

// VITE_BASE is set by CI to "/<repo>/" for GitHub Pages; relative base works everywhere else.
export default defineConfig({
  base: process.env.VITE_BASE ?? './',
  build: { outDir: 'dist', emptyOutDir: true },
});
