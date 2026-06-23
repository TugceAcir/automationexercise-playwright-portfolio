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
    files: ['pages/**/*.ts', 'tests/support/**/*.ts'],
    ignores: ['pages/app-navigation.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name='goto'][callee.object.name='page'], CallExpression[callee.property.name='goto'][callee.object.property.name='page']",
          message: 'Use pages/app-navigation.ts helpers for demo-site navigation and recovery.'
        },
        {
          selector: "CallExpression[callee.property.name='reload'][callee.object.name='page'], CallExpression[callee.property.name='reload'][callee.object.property.name='page']",
          message: 'Use reloadDemoPage from pages/app-navigation.ts for demo-site reload recovery.'
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
    ignores: ['node_modules/**', 'playwright-report/**', 'test-results/**', 'business-report/**']
  }
];
