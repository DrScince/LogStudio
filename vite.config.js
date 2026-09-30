import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
export default defineConfig({
    plugins: [react()],
    root: './src/renderer',
    base: './',
    publicDir: '../../public',
    build: {
        outDir: '../../dist/renderer',
        emptyOutDir: true,
        assetsDir: 'assets',
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src/renderer'),
        },
    },
    // Mermaid is large and only needed for Markdown preview; load on demand so a
    // broken/incomplete install cannot block the whole Vite/Electron startup.
    optimizeDeps: {
        exclude: ['mermaid', '@mermaid-js/parser'],
    },
    server: {
        port: 5173,
        strictPort: true,
        host: '127.0.0.1',
    },
});
