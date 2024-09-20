// @ts-check

import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';

export default tseslint.config({
  // @ts-ignore
  files: ['src/**/*.ts'],
  ignores: ['build/**/*', 'locales/**', '**/node_modules/', '**/.*'],

  extends: [...tseslint.configs.recommended],
  plugins: { '@stylistic': stylistic, '@typescript-eslint': tseslint.plugin },

  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { sourceType: 'module' },
    ecmaVersion: 2022,
  },

  rules: {
    yoda: 'error',
    'no-var': 'error',
    'no-console': 'warn',
    complexity: 'warn',
    'dot-notation': 'off',
    'prefer-const': 'error',
    'no-lonely-if': 'error',
    'no-inline-comments': 'off',
    'no-empty-function': 'error',
    'handle-callback-err': 'error',
    'no-useless-computed-key': 'error',
    'no-constant-binary-expression': 'error',
    'max-nested-callbacks': ['error', { max: 4 }],
    curly: ['error', 'multi-line', 'consistent'],

    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-var-requires': 'off',
    '@typescript-eslint/no-shadow': ['error', { allow: ['err', 'resolve', 'reject'] }],

    // 'class-methods-use-this': 'warn', // TODO: Turn this into error soon
    'no-nested-ternary': 'error',

    'object-shorthand': 'error',
    'no-array-constructor': 'error',
    'array-callback-return': 'error',
    'prefer-template': 'error',
    'no-eval': 'error',
    'no-loop-func': 'error',
    'no-param-reassign': 'error',
    'prefer-rest-params': 'error',
    'prefer-spread': 'error',
    'no-useless-constructor': 'error',
    'no-duplicate-imports': 'error',
    'one-var': ['error', 'never'],
    'no-multi-assign': 'error',
    eqeqeq: 'error',
    'no-new-wrappers': 'error',

    'prefer-arrow-callback': ['error', { allowNamedFunctions: true }],
    'arrow-body-style': ['error', 'as-needed'],

    '@stylistic/max-len': [
      'error',
      {
        code: 100,
        tabWidth: 2,
        ignoreStrings: true,
        ignoreComments: true,
        ignoreTrailingComments: true,
        ignoreTemplateLiterals: true,
        ignoreRegExpLiterals: true,
      },
    ],
    '@stylistic/eol-last': ['error', 'always'],
    '@stylistic/nonblock-statement-body-position': ['error', 'beside'],
    // '@stylistic/no-mixed-operators': 'error',
    '@stylistic/object-curly-newline': 'error',
    '@stylistic/template-curly-spacing': ['error', 'never'],
    '@stylistic/arrow-parens': ['error', 'always'],
    '@stylistic/comma-style': 'error',
    '@stylistic/arrow-spacing': 'error',
    '@stylistic/comma-spacing': 'error',
    '@stylistic/keyword-spacing': 'error',
    '@stylistic/space-in-parens': 'error',
    '@stylistic/space-infix-ops': 'error',
    '@stylistic/space-unary-ops': 'error',
    '@stylistic/spaced-comment': 'error',
    '@stylistic/no-multi-spaces': 'error',
    '@stylistic/space-before-blocks': 'error',
    '@stylistic/no-floating-decimal': 'error',
    '@stylistic/indent': ['error', 2],
    '@stylistic/semi': ['error', 'always'],
    '@stylistic/quotes': ['error', 'single'],
    '@stylistic/no-trailing-spaces': ['error'],
    '@stylistic/dot-location': ['error', 'property'],
    '@stylistic/object-curly-spacing': ['error', 'always'],
    '@stylistic/array-bracket-spacing': ['error', 'never'],
    '@stylistic/comma-dangle': ['error', 'always-multiline'],
    '@stylistic/max-statements-per-line': ['error', { max: 2 }],
    '@stylistic/brace-style': ['error', 'stroustrup', { allowSingleLine: true }],
    '@stylistic/no-multiple-empty-lines': ['error', { max: 2, maxEOF: 1, maxBOF: 0 }],
    '@stylistic/space-before-function-paren': [
      'error',
      { anonymous: 'never', named: 'never', asyncArrow: 'always' },
    ],
  },
});
