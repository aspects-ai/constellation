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
    sourcemap: true,
    rollupOptions: {
      external: ['fs', 'fs/promises', 'path', 'child_process', 'os', 'url', 'ssh2', 'node-fuse-bindings', 'util', 'events'],
      output: {
        exports: 'auto',
        sourcemapExcludeSources: false
      }
    },
    target: 'node18',
    ssr: true
  },
  define: {
    global: 'globalThis'
  }
})