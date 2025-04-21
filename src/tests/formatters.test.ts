// Simple tests for functions that don't depend on external modules
import { formatDuration, formatTags } from '../utils/formatters';

describe('formatDuration', () => {
  test('formats milliseconds to minutes and seconds for durations less than a minute', () => {
    expect(formatDuration(5000)).toBe('5s');
    expect(formatDuration(45000)).toBe('45s');
  });

  test('formats milliseconds to minutes and seconds for durations more than a minute', () => {
    expect(formatDuration(65000)).toBe('1m05s');
    expect(formatDuration(120000)).toBe('2m00s');
    expect(formatDuration(185000)).toBe('3m05s');
  });
});

describe('formatTags', () => {
  test('formats tags array into a string with hyphens for spaces', () => {
    const tags = [{ name: 'work' }, { name: 'project ideas' }, { name: 'follow up' }];

    expect(formatTags(tags)).toBe('tags: work,project-ideas,follow-up');
  });

  test('returns empty string for empty tags array', () => {
    expect(formatTags([])).toBe('');
  });

  test('returns empty string for undefined tags', () => {
    expect(formatTags(undefined)).toBe('');
  });
});
