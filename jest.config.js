/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  moduleFileExtensions: ['ts', 'js'],
  transform: {
    '^.+.ts$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
      },
    ],
  },
  testRegex: '(/src/tests/.*.test.ts)$',
  moduleNameMapper: {
    '^obsidian$': '<rootDir>/src/tests/__mocks__/obsidian.ts',
    '^moment$': '<rootDir>/src/tests/__mocks__/moment.ts',
  },
  setupFilesAfterEnv: ['<rootDir>/src/tests/setupTests.ts'],
  verbose: true,
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.ts', '!src/tests/**/*.ts', '!src/**/*.d.ts'],
  coverageDirectory: 'coverage',
  testTimeout: 10000,
};
