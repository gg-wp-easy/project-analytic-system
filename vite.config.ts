import { defineConfig, loadEnv, type Plugin } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const appVersion = JSON.parse(readFileSync(path.resolve(rootDir, 'package.json'), 'utf-8')).version as string

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

// API платформы NK-Tech Finance. В разработке Vite проксирует эти пути на шлюз `make dev`
// платформы (../nk-platform, http://127.0.0.1:8000) — запросы идут на тот же адрес, что и
// интерфейс. Сборка для Electron получает адрес сервера в VITE_PLATFORM_URL.
const devPlatform = process.env.PLATFORM_URL ?? 'http://127.0.0.1:8000'
const platformProxy = Object.fromEntries(
  ['/analytics', '/market', '/auth'].map((prefix) => [prefix, { target: devPlatform }]),
)

/** Адрес платформы в CSP (connect-src) — из VITE_PLATFORM_URL сборки. */
function platformCsp(platformUrl: string | undefined): Plugin {
  const origin = platformUrl ? new URL(platformUrl).origin : ''
  return {
    name: 'platform-csp',
    transformIndexHtml: (html) => html.replace('%PLATFORM_ORIGIN%', origin),
  }
}

export default defineConfig(({ mode }) => ({
  base: "./",
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
    platformCsp(loadEnv(mode, rootDir, 'VITE_').VITE_PLATFORM_URL),
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
    proxy: platformProxy,
  },
  preview: {
    proxy: platformProxy,
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
}))
