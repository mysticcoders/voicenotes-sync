/**
 * Auto resize a textarea based on its content
 */
export function autoResizeTextArea(textarea: HTMLTextAreaElement): void {
  requestAnimationFrame(() => {
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  });
}

/**
 * Convert HTML to Markdown format
 */
export function convertHtmlToMarkdown(text: string): string {
  const htmlEntities: { [key: string]: string } = {
    '&lt;': '<',
    '&gt;': '>',
    '&amp;': '&',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' ',
  };

  // Convert HTML entities
  let markdown = text.replace(/&[a-zA-Z0-9#]+;/g, (entity) => htmlEntities[entity] || entity);

  // Convert <br/> tags to newlines
  markdown = markdown.replace(/<br\s*\/?>/gi, '\n');

  // Remove other HTML tags
  markdown = markdown.replace(/<\/?[^>]+(>|$)/g, '');

  return markdown.trim();
}
