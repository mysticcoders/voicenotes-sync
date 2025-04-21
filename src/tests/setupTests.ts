// Add this so TypeScript recognizes this as a module
export {};

// Custom Jest matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toStartWith(prefix: string): R;
      toEndWith(suffix: string): R;
    }
  }
}

// Mock requestAnimationFrame
global.requestAnimationFrame = (callback) => {
  callback(0);
  return 0;
};

expect.extend({
  toStartWith(received: string, expected: string) {
    const pass = received.startsWith(expected);
    return {
      pass,
      message: () => `Expected ${received}${pass ? ' not' : ''} to start with ${expected}`,
    };
  },
  toEndWith(received: string, expected: string) {
    const pass = received.endsWith(expected);
    return {
      pass,
      message: () => `Expected ${received}${pass ? ' not' : ''} to end with ${expected}`,
    };
  },
});

// Setup jest timers
jest.useFakeTimers();
