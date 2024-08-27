import jsLint from '@eslint/js';
import tsLint from 'typescript-eslint';
import prettier from 'eslint-plugin-prettier/recommended';

/** @type {import('eslint').Linter.Config} */
export default [
    jsLint.configs.recommended,
    ...tsLint.configs.recommended,
    prettier,
    {
        files: ['**/*.ts'],
        ignores: ['node_modules/*'],
        rules: {
            'arrow-body-style': [2, 'as-needed'],
            'comma-dangle': [2, 'always-multiline'],
            curly: [2, 'all'],
            'no-underscore-dangle': 0,
            'no-warning-comments': [1, { terms: ['todo', 'fixme'], location: 'anywhere' }],
            'class-methods-use-this': 0,
            'max-classes-per-file': 0,
            'no-restricted-syntax': 0,
            'no-await-in-loop': 0,
            'no-console': 0,
            'padding-line-between-statements': [
                'error',
                { blankLine: 'always', prev: '*', next: 'return' },
                { blankLine: 'always', prev: '*', next: 'export' },
            ],
            '@typescript-eslint/no-unused-vars': ['error'],
            '@typescript-eslint/explicit-function-return-type': [
                'warn',
                {
                    allowExpressions: true,
                    allowConciseArrowFunctionExpressionsStartingWithVoid: true,
                },
            ],
        },
    },
];
