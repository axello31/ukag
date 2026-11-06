import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' → GitHub Pages alt yolunda da çalışır
// onnxruntime-web → yalnızca wasm sürümü (WebGPU/JSEP'li 30 MB'lık sürüm gerekmiyor; wasm CDN'den yüklenir)
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: { alias: [{ find: /^onnxruntime-web$/, replacement: 'onnxruntime-web/wasm' }] },
});
