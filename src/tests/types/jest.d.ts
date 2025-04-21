// Fix for @jest/globals not being found
import * as jest from 'jest';

declare global {
  const jest: typeof jest;
  namespace jest {
    interface Matchers<R, T> {
      toStartWith(expected: string): R;
      toEndWith(expected: string): R;
    }
  }
}

declare module '@jest/globals' {
  export const expect: jest.Expect;
  export const test: jest.It;
  export const describe: jest.Describe;
  export const beforeEach: jest.Lifecycle;
  export const afterEach: jest.Lifecycle;
  export const beforeAll: jest.Lifecycle;
  export const afterAll: jest.Lifecycle;
  export const jest: typeof jest;
}
