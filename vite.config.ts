import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8')) as { version: string }

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react({ jsxRuntime: 'automatic' }),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['moon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Web Attendance - シフト管理システム',
        short_name: 'シフト管理',
        description: 'スタッフのシフトを管理するWebアプリです',
        theme_color: '#6366f1',
        background_color: '#ffffff',
        display: 'standalone',
        lang: 'ja',
        icons: [
          {
            src: 'pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png',
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3MB
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Excel生成は利用時にだけ取得する。初回訪問時のSWインストールで
        // 約1MBのチャンクを先読みし、画面表示と帯域を奪わないようにする。
        globIgnores: ['**/heavy-excel-*.js', '**/exceljs.min-*.js'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-calendar': ['react-big-calendar'],
          'heavy-excel': ['exceljs', 'file-saver'],
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8788',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      thresholds: {
        statements: 26,
        branches: 24,
        functions: 18,
        lines: 27,
      },
      include: ['src/**'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/main.tsx',
        'src/App.tsx',
        'src/types/**',
        'src/setupTests.ts',
      ],
    },
  },
})
