import js from "@eslint/js";
import importPlugin from "eslint-plugin-import";
import prettierConfig from "eslint-config-prettier";
import tseslint from "typescript-eslint";

export default tseslint.config(
    js.configs.recommended,
    ...tseslint.configs.strictTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,
    {
        languageOptions: {
            parserOptions: {
                project: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        plugins: { import: importPlugin },
        rules: {
            "@typescript-eslint/no-floating-promises": "error",
            "@typescript-eslint/no-misused-promises": "error",
            "@typescript-eslint/no-explicit-any": "error",
            "@typescript-eslint/no-unsafe-assignment": "error",
            "@typescript-eslint/no-unsafe-member-access": "error",
            "@typescript-eslint/no-unsafe-call": "error",
            "@typescript-eslint/no-unused-vars": [
                "error",
                { argsIgnorePattern: "^_" },
            ],
            "@typescript-eslint/require-await": "error",
            "import/no-duplicates": "error",
            "import/order": [
                "warn",
                {
                    groups: [
                        "builtin",
                        "external",
                        "internal",
                        "parent",
                        "sibling",
                        "index",
                    ],
                    "newlines-between": "always",
                    alphabetize: { order: "asc" },
                },
            ],
            "@typescript-eslint/no-extraneous-class": "off",
            "@typescript-eslint/consistent-type-imports": "error",
        },
    },
    {
        files: ["**/*.spec.ts", "test/**/*.ts"],
        rules: {
            // Jest mock method references are intentionally detached from their object.
            "@typescript-eslint/unbound-method": "off",
        },
    },
    prettierConfig,
    {
        ignores: [
            "dist/**",
            "node_modules/**",
            "coverage/**",
            "*.config.js",
            "*.config.mjs",
            "drizzle.config.ts",
        ],
    },
);
