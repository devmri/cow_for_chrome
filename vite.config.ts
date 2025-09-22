import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './src/manifest'

// 说明：
// - 使用 Vite + React + TS；
// - 通过 crx 插件从 TS Manifest 生成 MV3 包；
// - 入口（sidepanel、options、blocked、SW、内容脚本）全部在 src/ 中定义。

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  build: {
    target: 'es2020',
  },
})

