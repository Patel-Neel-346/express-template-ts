/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    verbose: true,
    roots: ["<rootDir>/src"],
    testRegex: ".*\\.spec\\.ts$",
    collectCoverage: true,
    coverageProvider: "v8",
    collectCoverageFrom: [
        "src/**/*.ts",
        "!src/main.ts",
        "!**/*.spec.ts",
        "!**/node_modules/**",
    ],
    moduleFileExtensions: ["js", "json", "ts"],
    transform: {
        "^.+\\.(t|j)s$": "ts-jest",
    },
};
