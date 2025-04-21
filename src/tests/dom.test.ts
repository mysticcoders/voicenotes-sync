// Import jest from jest library instead of @jest/globals
import { autoResizeTextArea, convertHtmlToMarkdown } from '../utils/dom';

describe('convertHtmlToMarkdown', () => {
  test('converts <br> tags to newlines', () => {
    expect(convertHtmlToMarkdown('line 1<br>line 2')).toBe('line 1\nline 2');
    expect(convertHtmlToMarkdown('line 1<br/>line 2')).toBe('line 1\nline 2');
    expect(convertHtmlToMarkdown('line 1<br />line 2')).toBe('line 1\nline 2');
  });

  test('removes HTML tags', () => {
    expect(convertHtmlToMarkdown('<p>paragraph</p>')).toBe('paragraph');
    expect(convertHtmlToMarkdown('<strong>bold</strong> and <em>italic</em>')).toBe('bold and italic');
    expect(convertHtmlToMarkdown('<div><p>nested <span>tags</span></p></div>')).toBe('nested tags');
  });

  test('handles complex mixed HTML', () => {
    const html = '<p>This is a &quot;test&quot; with <br/>multiple lines and <strong>formatting</strong>.</p>';
    expect(convertHtmlToMarkdown(html)).toBe('This is a "test" with \nmultiple lines and formatting.');
  });

  test('trims whitespace from result', () => {
    expect(convertHtmlToMarkdown('  <p>text</p>  ')).toBe('text');
    expect(convertHtmlToMarkdown('<p>\n  text  \n</p>')).toBe('text');
  });
});

describe('autoResizeTextArea', () => {
  test('adjusts textarea height to match content', () => {
    // Setup
    document.body.innerHTML = '<textarea></textarea>';
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    Object.defineProperty(textarea, 'scrollHeight', { value: 100 });

    // Execute
    autoResizeTextArea(textarea);

    // Allow requestAnimationFrame to execute
    jest.runAllTimers();

    // Assert
    expect(textarea.style.height).toBe('100px');
  });
});
