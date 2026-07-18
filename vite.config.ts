import { defineConfig } from 'vite';

// GitHub Pages のサブパス配信でも動くよう相対パスでビルドする
export default defineConfig({
  base: './',
});
