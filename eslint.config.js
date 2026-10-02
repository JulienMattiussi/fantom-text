import js from "@eslint/js";
import tseslint from "typescript-eslint";
import vue from "eslint-plugin-vue";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  { ignores: ["dist", "coverage", "node_modules", "public/fantom-text.js"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs["flat/recommended"],
  {
    files: ["**/*.vue"],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
    },
    rules: {
      // The demo root component is legitimately named "App".
      "vue/multi-word-component-names": "off",
    },
  },
  {
    languageOptions: {
      globals: { ...globals.browser },
    },
  },
  {
    files: [
      "tests/**/*.ts",
      "scripts/**/*.ts",
      "vite.config.ts",
      "vitest.config.ts",
    ],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  prettier,
);
