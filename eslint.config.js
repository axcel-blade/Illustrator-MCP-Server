import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "illustrator-scripts/**", "release/**", "logs/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-console": ["error", { allow: ["error"] }],
    },
  },
  {
    files: ["scripts/**/*.{js,mjs}", "tests/**"],
    languageOptions: { globals: { console: "readonly", process: "readonly" } },
    rules: { "no-console": "off", "@typescript-eslint/no-explicit-any": "off" },
  },
);
