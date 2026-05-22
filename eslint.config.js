import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config({
  ignores: ["dist/**", "drizzle/**", "node_modules/**"],
}, js.configs.recommended, ...tseslint.configs.recommended, {
  files: ["**/*.ts"],
  languageOptions: {
    parserOptions: {
      project: false,
    },
  },
  rules: {
    "no-console": "off",
  },
});
