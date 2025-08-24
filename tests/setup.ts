// Global test setup file
import '@testing-library/jest-dom';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
};

// Setup any global test utilities
beforeEach(() => {
  jest.clearAllMocks();
});