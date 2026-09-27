import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
const replacements = {
  'lib/auth': 'auth.tsx',
  'lib/database': 'database.ts',
  'hooks/useLiveData': 'database.ts',
  'lib/firebase': 'firebase.ts',
  'lib/preferences': 'preferences.ts',
}
export default defineConfig({
  root,
  plugins: [
    {
      name: 'isolated-ui-fixtures',
      enforce: 'pre',
      resolveId(source, importer) {
        if (!importer || !source.startsWith('.')) return
        const resolved = path
          .resolve(path.dirname(importer), source)
          .replaceAll('\\', '/')
          .replace(/\.(tsx?|js)$/, '')
        const name = Object.keys(replacements).find(
          (name) => resolved === path.resolve(root, 'src', name).replaceAll('\\', '/'),
        )
        if (name) return path.resolve(root, 'tests/ui/fixtures', replacements[name])
      },
    },
    react(),
    tailwindcss(),
  ],
  server: { host: '127.0.0.1', port: 5187, strictPort: true },
})
