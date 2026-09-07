import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'
import designSystem from './eslint-rules/design-system.mjs'

export default tseslint.config(
  {
    ignores: ['dist/**', '../src/lestudio/static/**'],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.ts', 'vite.config.ts', 'playwright.config.ts'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },

  // ── Design system ─────────────────────────────────────────────────────────
  // Enforced everywhere: these have no violations left, so any new one is a
  // regression rather than a migration backlog item.
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { design: designSystem },
    rules: {
      'design/no-arbitrary-text-size': 'error',
      'design/no-arbitrary-color': 'error',
      'design/no-unapproved-palette': 'error',
    },
  },

  // Raw palette shades are still spread across the page components. They are
  // held flat by `npm run design:audit` (a ratchet) rather than by lint, but
  // the shared component layer is fully migrated and must stay that way — every
  // page composes from it, so a raw shade here leaks everywhere.
  {
    // Every file under src/app is migrated to tokens; new raw palette shades
    // are a regression, not a backlog item.
    files: ['src/app/**/*.{ts,tsx}'],
    plugins: { design: designSystem },
    rules: {
      'design/prefer-design-token': 'error',
    },
  },
)
