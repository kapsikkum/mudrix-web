import js from '@eslint/js';
import globals from 'globals';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

export default [
  {
    ignores: ['node_modules/**', 'dist/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: {
          allowDefaultProject: ['vite.config.ts'],
        },
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.es2020,
        React: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      'no-undef': 'off', // TypeScript handles undefined references; no-undef causes false positives on TS types
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-deprecated': 'warn',
    },
  },
  // Vanilla Extract guard
  // style(), globalStyle(), keyframes() etc. must ONLY be called inside *.css.ts
  // files. Calling them from *.tsx causes a runtime crash in Vite dev mode because
  // @vanilla-extract/css checks getFileScope() and throws when there is no file
  // scope registered (which only exists during the VE build-time transform).
  {
    files: ['**/*.tsx', '**/*.ts'],
    ignores: ['**/*.css.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@vanilla-extract/css',
              importNames: [
                'style',
                'globalStyle',
                'keyframes',
                'createVar',
                'fallbackVar',
                'assignVars',
                'createTheme',
                'createGlobalTheme',
                'createThemeContract',
                'recipe',
                'styleVariants',
                'composeStyles',
              ],
              message:
                'Vanilla Extract style helpers must only be used inside *.css.ts files. ' +
                'Create a sibling MyComponent.css.ts and import the class names from there.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2020,
        ...globals.node,
      },
    },
  },
];
