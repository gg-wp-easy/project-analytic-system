import { defineConfig } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

const VENDOR_CHUNKS: ReadonlyArray<[string, ReadonlyArray<string>]> = [
  ['react', ['/react/', '/react-dom/', '/scheduler/', '/react-router/']],
  ['mui', ['/@mui/', '/@emotion/', '/@popperjs/']],
  ['radix', ['/@radix-ui/', '/cmdk/', '/vaul/']],
  ['spreadsheet', ['/xlsx/']],
  ['pdf', ['/jspdf/', '/jspdf-autotable/']],
  ['pdf-canvas', ['/html2canvas/']],
]

function vendorChunk(id: string): string | undefined {
  const normalizedId = id.replaceAll('\\', '/')

  if (!normalizedId.includes('/node_modules/')) {
    return undefined
  }

  return VENDOR_CHUNKS.find(([, modules]) =>
    modules.some((modulePath) => normalizedId.includes(modulePath)),
  )?.[0]
}

export default defineConfig({
  base: "./",
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(rootDir, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: vendorChunk,
      },
    },
  },
  server: {
    port: 5173,
    watch: {
      ignored: [
        '**/.git/**',
        '**/build/**',
        '**/dist/**',
        '**/electron/**',
        '**/release/**',
        '**/server-analytic-system/**',
        '**/.venv/**',
        '**/.build/**',
        '**/__pycache__/**',
        '**/*.log',
      ],
    },
    fs: {
      deny: [
        '.git',
        'build',
        'dist',
        'release',
        'server-analytic-system',
      ],
    },
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api')
      }
    }
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
