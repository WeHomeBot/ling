/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
  preset: "ts-jest",
  rootDir: __dirname,
  verbose: true,
  testEnvironment: "node",
  collectCoverage: false,
  moduleFileExtensions: ["ts", "js", "json", "node"],
  collectCoverageFrom: ['src/**/*.ts'],
  coverageDirectory: 'coverage',
  coverageReporters: ['html', 'json', 'lcov'],
  testPathIgnorePatterns: ['/node_modules/', '/lib/'],
  transform: {
    "^.+.tsx?$": ["ts-jest", {}],
  },
  watchPathIgnorePatterns: ['/node_modules/', '/lib/'],
  testMatch: ["<rootDir>/**/?(*.)+(spec|test).[jt]s"],
  testPathIgnorePatterns: ['/node_modules/', '/lib/'],
};