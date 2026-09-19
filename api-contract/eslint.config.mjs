import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/consistent-type-imports': 'error'
    }
  },
  {
    // The transport is the API layer's boundary, as app-navigation.ts is the UI's (ADR 0001):
    // it alone parses bodies, classifies outages and decides retries. A direct request call
    // anywhere else would skip all three without any visible symptom.
    files: ['**/*.ts'],
    ignores: ['src/transport.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.object.name='request'][callee.property.name=/^(get|post|put|patch|delete|head|fetch)$/], CallExpression[callee.object.property.name='request'][callee.property.name=/^(get|post|put|patch|delete|head|fetch)$/]",
          message: 'Send API requests through src/transport.ts, which owns parsing, outage classification and retries.'
        }
      ]
    }
  },
  {
    // node:test's `test()` returns a Promise by design; top-level calls are not awaited.
    files: ['tests/unit/**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-floating-promises': 'off'
    }
  },
  {
    ignores: ['node_modules/**', 'results/**']
  }
];
