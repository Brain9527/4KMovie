import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  base: '/4KMovie/', // 设置为仓库名，这是解决 GitHub Pages 404 的标准做法
})
