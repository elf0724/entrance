import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // https://elf0724.github.io/entrance/1999dis/
  base: '/entrance/1999dis/', 
  plugins: [react()],
})
