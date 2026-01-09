import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: path.resolve(__dirname, 'src/main/main.ts'),
        onstart(options) {
          options.startup()
        },
        vite: {
          build: {
            outDir: path.resolve(__dirname, 'dist-electron'),
            commonjsOptions: {
              ignoreDynamicRequires: true
            },
            rollupOptions: {
              external: ['electron', 'sharp', 'pdf.js-extract', 'openai', /\.node$/],
              output: {
                format: 'cjs'
              }
            }
          }
        }
      },
      {
        entry: path.resolve(__dirname, 'src/main/preload.ts'),
        onstart(options) {
          options.reload()
        },
        vite: {
          build: {
            outDir: path.resolve(__dirname, 'dist-electron'),
            rollupOptions: {
              output: {
                format: 'cjs'
              }
            }
          }
        }
      }
    ]),
    renderer()
  ],
  root: path.resolve(__dirname, 'src/renderer'),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    outDir: path.resolve(__dirname, 'dist')
  },
  publicDir: path.resolve(__dirname, 'public')
})
