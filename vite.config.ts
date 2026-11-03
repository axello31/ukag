import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' → GitHub Pages alt yolunda da çalışır
export default defineConfig({ plugins: [react()], base: './' });
