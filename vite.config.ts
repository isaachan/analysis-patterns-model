/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      // Force react-konva to use the ESM build so that its import of
      // konva goes through Vite's resolver (the CJS build uses require
      // which resolves to konva's Node entry requiring the native
      // "canvas" package not available in jsdom).
      {
        find: 'react-konva',
        replacement: 'react-konva/es/ReactKonva.js',
      },
      // Only alias bare "konva" imports (e.g., import 'konva' in
      // react-konva/es/ReactKonva.js) to the browser entry.
      // Sub-path imports like "konva/lib/Core.js" must NOT match.
      {
        find: /^konva$/,
        replacement: 'konva/lib/index.js',
      },
    ],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/__tests__/setup.ts',
  },
});
