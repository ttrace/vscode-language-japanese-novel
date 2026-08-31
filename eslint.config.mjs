import eslint from "@eslint/js";
import typescriptEslint from "@typescript-eslint/eslint-plugin";

export default [
  {
    ignores: ["dist/**", "node_modules/**", "htdocs/**"],
  },
  {
    ...eslint.configs.recommended,
    files: ["src/**/*.ts"],
  },
  ...typescriptEslint.configs["flat/recommended"].map((config) => ({
    ...config,
    files: ["src/**/*.ts"],
  })),
];
