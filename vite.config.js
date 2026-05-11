import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  base: '/4KMovie/', // 必须与您的 GitHub 仓库名称完全一致
})
