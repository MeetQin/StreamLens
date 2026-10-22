import { crx } from '@crxjs/vite-plugin'
import vue from '@vitejs/plugin-vue'
import { build as esbuildBuild } from 'esbuild'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import manifest from './manifest.json'

const e2e = process.env.STREAMLENS_E2E === '1'

// The page script runs in the MAIN world as a classic <script>, so it must be a
// self-contained IIFE instead of an ES module with shared chunk imports.
function injectedIife(): Plugin {
  return {
    name: 'streamlens-injected-iife',
    apply: 'build',
    async closeBundle() {
      await esbuildBuild({
        entryPoints: [resolve(__dirname, 'src/injected/main.ts')],
        bundle: true,
        format: 'iife',
        target: 'chrome108',
        minify: true,
        legalComments: 'none',
        outfile: resolve(__dirname, 'dist/assets/injected.js'),
        logLevel: 'silent',
      })
    },
  }
}

export default defineConfig({
  define: {
    __STREAMLENS_E2E__: JSON.stringify(e2e),
  },
  plugins: [vue(), crx({ manifest }), injectedIife()],
  build: {
    rollupOptions: {
      input: {
        panel: resolve(__dirname, 'src/panel/panel.html'),
        injected: resolve(__dirname, 'src/injected/main.ts'),
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === 'injected') return 'assets/injected.js'
          return 'assets/[name]-[hash].js'
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
})
