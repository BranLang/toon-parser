// ESLint 9 flat config. Runs `tsParser` over the package's TypeScript sources
// and applies @typescript-eslint recommended rules. Tests/benches/dist are
// excluded — `npm run lint` at the repo root still type-checks them via tsc.

import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**', '**/*.bench.ts']
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      // The codebase uses `as` and non-null assertions in a handful of
      // narrow, well-justified spots (parser hot paths). Don't fail on them.
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      // Unused vars: allow the `_prefix` convention.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
    }
  },
  // Tests use require() to verify CJS interop and may keep deliberately
  // unused locals to demonstrate APIs.
  {
    files: ['src/**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-var-requires': 'off',
      '@typescript-eslint/no-unused-vars': 'warn'
    }
  }
];
