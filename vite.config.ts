import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'
import path from 'path'

export default defineConfig({
  plugins: [
    dts({
      include: ['src/**/*'],
      exclude: ['**/*.test.ts', 'tests/**/*']
    })
  ],
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'ConstellationFS',
      fileName: 'index',
      formats: ['es', 'cjs']
    },
    rollupOptions: {
      external: ['fs', 'fs/promises', 'path', 'child_process', 'os', 'url'],
      output: {
        exports: 'auto'
      }
    },
    target: 'node18',
    ssr: true
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  define: {
    global: 'globalThis'
  }
})