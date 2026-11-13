import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages serves the project site at /apex/. Dev stays at / so `npm run dev`
// is unchanged. `vite preview` reports command "serve", so name it separately.
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/apex/' : '/',
  plugins: [react()],
}))
