import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "functions/**",
      "android/**",
      "ios/**",
      "build/**",
      "coverage/**",
      "capacitor-cordova-android-plugins/**",
      "testlab/**",
      "scripts/**",
      "typescript/**",
      "*.cjs",
      "*.mjs",
    ],
  },
  { files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"], plugins: { js }, extends: ["js/recommended"], languageOptions: { globals: globals.browser } },
  tseslint.configs.recommended,
  pluginReact.configs.flat.recommended,
  {
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", {
        "varsIgnorePattern": "^_",
        "argsIgnorePattern": "^_",
        "caughtErrorsIgnorePattern": "^_",
        "destructuredArrayIgnorePattern": "^_"
      }],
      "@typescript-eslint/no-explicit-any": "error",
      "react/no-unescaped-entities": "off", // Disable quote escaping warnings
      "react/prop-types": "off", // TypeScript handles prop validation
      "@typescript-eslint/no-require-imports": "off", // Allow require in scripts
      "no-undef": "off", // Allow globals like process in scripts
      "no-useless-escape": "off", // Disable unnecessary escape warnings
      "prefer-const": "warn", // Warn instead of error
      "no-empty": "warn", // Warn for empty blocks
      "no-self-assign": "warn", // Warn for self-assignments
      "react/jsx-no-comment-textnodes": "warn", // Warn for comments in JSX
    },
  },
  {
    files: ["src/test/**/*.tsx"],
    rules: {
      "react/react-in-jsx-scope": "off", // Test files don't need React import with JSX transform
    },
  },
  // Service, hook, and util files deal with Firebase dynamic types — relax no-explicit-any
  {
    files: [
      "services/**/*.ts",
      "hooks/**/*.ts",
      "utils/**/*.ts",
      "utils/shared/**/*.ts",
      "src/utils/**/*.ts",
      "types/**/*.d.ts",
      "src/types/**/*.d.ts",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  // Test files — relax unused-vars and no-explicit-any (test infrastructure patterns)
  {
    files: [
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.spec.ts",
      "**/*.spec.tsx",
      "src/test/**",
      "tests/**",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
    },
  },
]);
