import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// GitHub Pages 项目页路径：https://<user>.github.io/gb7714-converter/
// 本地 dev 仍走根路径 '/'；CI 构建时由 BASE_PATH 注入子路径
export default defineConfig(({ command }) => ({
  base: command === 'build' ? process.env.BASE_PATH ?? '/gb7714-converter/' : '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
}))
