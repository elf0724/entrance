import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // 只需要路徑開頭與結尾的斜線
  base: '/entrance/1999dis/', 
  plugins: [react()],
})
