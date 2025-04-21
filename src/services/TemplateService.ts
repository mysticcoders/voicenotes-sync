// @ts-ignore
import * as jinja from 'jinja-js';
import { convertHtmlToMarkdown } from '../utils';

export class TemplateService {
  /**
   * Render a template using Jinja templating engine
   */
  renderTemplate(template: string, context: Record<string, any>): string {
    return jinja.render(template, context).replace(/\n{3,}/g, '\n\n');
  }

  /**
   * Render the note template
   */
  renderNoteTemplate(template: string, context: Record<string, any>): string {
    let renderedNote = this.renderTemplate(template, context);
    renderedNote = convertHtmlToMarkdown(renderedNote);
    return renderedNote;
  }

  /**
   * Render the frontmatter template
   * Always includes recording_id in the frontmatter
   */
  renderFrontmatterTemplate(template: string, context: Record<string, any>): string {
    // Ensure recording_id is in the frontmatter regardless of template
    const recordingIdTemplate = `recording_id: {{recording_id}}\n`;
    const frontmatterTemplate = recordingIdTemplate + template;
    
    return this.renderTemplate(frontmatterTemplate, context);
  }

  /**
   * Create a complete note with frontmatter and content
   */
  createCompleteNote(noteTemplate: string, frontmatterTemplate: string, context: Record<string, any>): string {
    const renderedNote = this.renderNoteTemplate(noteTemplate, context);
    const renderedFrontmatter = this.renderFrontmatterTemplate(frontmatterTemplate, context);
    
    return `---\n${renderedFrontmatter}\n---\n${renderedNote}`;
  }
}
