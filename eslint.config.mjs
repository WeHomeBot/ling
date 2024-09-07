import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";


export default [
  {files: ["src/**/*.{js,mjs,cjs,ts}"]},
  {languageOptions: { globals: globals.browser }},
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: ["jest"],
    env: {
      node: true,
      'jest/globals': true,
    },
    rules: {
      'no-constant-condition': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
    },
  }
];