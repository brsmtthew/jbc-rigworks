import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'test-results', 'playwright-report', 'tmp', '.firebase']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/features/**', '**/useWorkspace'],
              message:
                'Shared UI must receive business data through props; keep feature orchestration in its feature or the application shell.',
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      'src/features/**/*Operations.ts',
      'src/features/builder/buildPlans.ts',
      'src/lib/database.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'react',
                'react-router-dom',
                '**/components/**',
                '**/hooks/**',
                '**/use*',
                '**/preferences',
              ],
              message:
                'Domain operations and database access must not depend on React, UI hooks, or components.',
            },
          ],
        },
      ],
    },
  },
])
