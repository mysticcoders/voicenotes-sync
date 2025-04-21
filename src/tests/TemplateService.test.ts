// Import jest from jest library instead of @jest/globals
import { TemplateService } from '../services/TemplateService';

describe('TemplateService', () => {
  let templateService: TemplateService;

  beforeEach(() => {
    templateService = new TemplateService();
  });

  describe('renderTemplate', () => {
    test('renders a basic template with context data', () => {
      const template = 'Hello, {{ name }}!';
      const context = { name: 'World' };

      expect(templateService.renderTemplate(template, context)).toBe('Hello, World!');
    });

    test('handles conditional blocks in templates', () => {
      const template = `
        Hello, {{ name }}!
        {% if showDetails %}
        Your details: {{ details }}
        {% endif %}
      `;

      const context1 = { name: 'Alice', showDetails: true, details: 'Admin user' };
      const context2 = { name: 'Bob', showDetails: false };

      expect(templateService.renderTemplate(template, context1)).toContain('Your details: Admin user');
      expect(templateService.renderTemplate(template, context2)).not.toContain('Your details');
    });

    test('removes multiple consecutive newlines', () => {
      const template = `Line 1



Line 2`;

      expect(templateService.renderTemplate(template, {})).toBe('Line 1\n\nLine 2');
    });
  });

  describe('renderNoteTemplate', () => {
    test('renders a note template and converts HTML to markdown', () => {
      const template = 'Hello, {{ name }}! <br/>This is a test.';
      const context = { name: 'World' };

      expect(templateService.renderNoteTemplate(template, context)).toBe('Hello, World! \nThis is a test.');
    });
  });

  describe('renderFrontmatterTemplate', () => {
    test('adds recording_id to frontmatter template', () => {
      const template = 'title: {{ title }}\ndate: {{ date }}';
      const context = { recording_id: 123, title: 'Test Note', date: '2023-01-01' };

      const result = templateService.renderFrontmatterTemplate(template, context);

      expect(result).toContain('recording_id: 123');
      expect(result).toContain('title: Test Note');
      expect(result).toContain('date: 2023-01-01');
    });
  });

  describe('createCompleteNote', () => {
    test('creates a complete note with frontmatter and content', () => {
      const noteTemplate = '# {{ title }}\n\n{{ content }}';
      const frontmatterTemplate = 'title: {{ title }}\ndate: {{ date }}';
      const context = { recording_id: 123, title: 'Test Note', date: '2023-01-01', content: 'This is the content.' };

      const result = templateService.createCompleteNote(noteTemplate, frontmatterTemplate, context);

      expect(result).toStartWith('---');
      expect(result).toContain('recording_id: 123');
      expect(result).toContain('# Test Note');
      expect(result).toContain('This is the content.');
      expect(result).toEndWith('This is the content.');
    });
  });
});
