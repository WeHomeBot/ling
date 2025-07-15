const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const prettier = require('eslint-plugin-prettier');
const prettierConfig = require('eslint-config-prettier');
const jest = require('eslint-plugin-jest');

module.exports = [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  // 通用配置
  {
    files: ['**/*.{js,mjs,ts}'],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: {
        ...require('globals').node,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      prettier: prettier,
    },
    rules: {
      'prettier/prettier': 'error',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
    },
  },
  // Jest 测试文件配置
  {
    files: ['**/*.test.{js,ts}', '**/*.spec.{js,ts}', 'test/**/*.{js,ts}'],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: 2020,
      sourceType: 'module',
      globals: {
        ...require('globals').node,
        ...require('globals').jest,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      prettier: prettier,
      jest: jest,
    },
    rules: {
      'prettier/prettier': 'error',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
      // Jest 特定规则
      'jest/no-disabled-tests': 'warn',
      'jest/no-focused-tests': 'error',
      'jest/no-identical-title': 'error',
      'jest/prefer-to-have-length': 'warn',
      'jest/valid-expect': 'error',
      'jest/valid-describe-callback': 'error',
      'jest/no-conditional-expect': 'warn',
      'jest/no-deprecated-functions': 'warn',
      'jest/prefer-strict-equal': 'warn',
      'jest/prefer-to-be': 'warn',
      'jest/prefer-to-contain': 'warn',
    },
  },
];
