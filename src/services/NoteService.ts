import { TFile, Vault, normalizePath } from 'obsidian';
import { sanitize } from 'sanitize-filename-ts';
import { FileSystemService } from './FileSystemService';
import { TemplateService } from './TemplateService';
import { VoiceNotesApiService } from './VoiceNotesApiService';
import { VoiceNotesPluginSettings, VoiceNoteRecording } from '../types';
import { formatDate, formatDuration } from '../utils';

export class NoteService {
  private vault: Vault;
  private settings: VoiceNotesPluginSettings;
  private fileSystem: FileSystemService;
  private templateService: TemplateService;
  private apiService: VoiceNotesApiService;

  constructor(
    vault: Vault,
    settings: VoiceNotesPluginSettings,
    fileSystem: FileSystemService,
    templateService: TemplateService,
    apiService: VoiceNotesApiService
  ) {
    this.vault = vault;
    this.settings = settings;
    this.fileSystem = fileSystem;
    this.templateService = templateService;
    this.apiService = apiService;
  }

  /**
   * Generate a sanitized title for a note
   */
  sanitizedTitle(title: string, createdAt: string): string {
    const date = formatDate(createdAt, this.settings.filenameDateFormat);
    const generatedTitle = this.settings.filenameTemplate.replace('{{date}}', date).replace('{{title}}', title);
    return sanitize(generatedTitle);
  }

  /**
   * Get the path for a note
   */
  getNotePath(title: string, createdAt: string): string {
    const sanitizedTitle = this.sanitizedTitle(title, createdAt);
    return normalizePath(`${this.settings.syncDirectory}/${sanitizedTitle}.md`);
  }

  /**
   * Process a recording and create or update a note
   */
  async processRecording(
    recording: VoiceNoteRecording,
    isSubnote: boolean = false,
    parentTitle: string = ''
  ): Promise<{
    success: boolean;
    skipped: boolean;
    message?: string;
  }> {
    try {
      if (!recording.title) {
        return {
          success: false,
          skipped: false,
          message: `Unable to grab voice recording with id: ${recording.recording_id}`,
        };
      }

      // Check if the recording contains any excluded tags
      if (recording.tags && recording.tags.some((tag) => this.settings.excludeTags.includes(tag.name))) {
        return { success: true, skipped: true, message: 'Skipped due to excluded tags' };
      }

      // Process sub-notes first, regardless of whether the parent note exists
      if (recording.subnotes && recording.subnotes.length > 0) {
        const title = this.sanitizedTitle(recording.title, recording.created_at);
        for (const subnote of recording.subnotes) {
          await this.processRecording(subnote, true, title);
        }
      }

      const notePath = this.getNotePath(recording.title, recording.created_at);
      const noteExists = await this.fileSystem.exists(notePath);

      // Skip if the note already exists and is not a subnote
      if (noteExists && !isSubnote) {
        return { success: true, skipped: true, message: 'Note already exists' };
      }

      // Prepare the note context
      const context = await this.prepareNoteContext(recording, isSubnote, parentTitle);

      // Generate the note content
      const noteContent = this.templateService.createCompleteNote(
        this.settings.noteTemplate,
        this.settings.frontmatterTemplate,
        context
      );

      // Create or update the note file
      if (noteExists) {
        await this.vault.modify(this.vault.getFileByPath(notePath) as TFile, noteContent);
      } else {
        await this.vault.create(notePath, noteContent);
      }

      // Delete the recording if requested
      if (this.settings.deleteSynced && this.settings.reallyDeleteSynced) {
        await this.apiService.deleteRecording(recording.recording_id);
      }

      return { success: true, skipped: false };
    } catch (error) {
      console.error('Error processing note:', error);
      return {
        success: false,
        skipped: false,
        message: error.message || 'Error processing note',
      };
    }
  }

  /**
   * Prepare the context for rendering templates
   */
  private async prepareNoteContext(
    recording: VoiceNoteRecording,
    isSubnote: boolean = false,
    parentTitle: string = ''
  ): Promise<Record<string, any>> {
    // Setup audio resources if needed
    let embeddedAudioLink = '';
    let audioFilename = '';

    if (this.settings.downloadAudio) {
      const result = await this.downloadAudio(recording);
      embeddedAudioLink = result.embeddedLink;
      audioFilename = result.filename;
    }

    // Process attachments
    const attachments = await this.processAttachments(recording);

    // Extract creations by type
    const creationTypes = ['summary', 'points', 'tidy', 'todo', 'tweet', 'blog', 'email', 'custom'];
    const creations = Object.fromEntries(
      creationTypes.map((type) => [type, recording.creations?.find((creation) => creation.type === type)])
    );

    // Format points and todos
    const formattedPoints = creations.points
      ? creations.points.content.data.map((data: string) => `- ${data}`).join('\n')
      : null;

    const formattedTodos = creations.todo
      ? creations.todo.content.data
          .map((data: string) => `- [ ] ${data}${this.settings.todoTag ? ' #' + this.settings.todoTag : ''}`)
          .join('\n')
      : null;

    // Format tags
    const formattedTags =
      recording.tags && recording.tags.length > 0
        ? recording.tags.map((tag) => `#${tag.name.replace(/\s+/g, '-')}`).join(' ')
        : null;

    // Format related notes
    const relatedNotes =
      recording.related_notes && recording.related_notes.length > 0
        ? recording.related_notes
            .map((relatedNote) => `- [[${this.sanitizedTitle(relatedNote.title, relatedNote.created_at)}]]`)
            .join('\n')
        : null;

    // Format subnotes
    const subnotes =
      recording.subnotes && recording.subnotes.length > 0
        ? recording.subnotes
            .map((subnote) => `- [[${this.sanitizedTitle(subnote.title, subnote.created_at)}]]`)
            .join('\n')
        : null;

    // Build the complete context object
    return {
      recording_id: recording.recording_id,
      title: recording.title,
      date: formatDate(recording.created_at, this.settings.dateFormat),
      duration: formatDuration(recording.duration),
      created_at: formatDate(recording.created_at, this.settings.dateFormat),
      updated_at: formatDate(recording.updated_at, this.settings.dateFormat),
      transcript: recording.transcript,
      embedded_audio_link: embeddedAudioLink,
      audio_filename: audioFilename,
      summary: creations.summary ? creations.summary.markdown_content : null,
      tidy: creations.tidy ? creations.tidy.markdown_content : null,
      points: formattedPoints,
      todo: formattedTodos,
      tweet: creations.tweet ? creations.tweet.markdown_content : null,
      blog: creations.blog ? creations.blog.markdown_content : null,
      email: creations.email ? creations.email.markdown_content : null,
      custom: creations.custom ? creations.custom.markdown_content : null,
      tags: formattedTags,
      related_notes: relatedNotes,
      subnotes: subnotes,
      attachments: attachments,
      parent_note: isSubnote ? `[[${parentTitle}]]` : null,
    };
  }

  /**
   * Download audio for a recording
   */
  private async downloadAudio(recording: VoiceNoteRecording): Promise<{ embeddedLink: string; filename: string }> {
    const audioPath = normalizePath(`${this.settings.syncDirectory}/audio`);
    await this.fileSystem.ensureDirectory(audioPath);

    const outputFile = normalizePath(`${audioPath}/${recording.recording_id}.mp3`);
    if (!(await this.fileSystem.exists(outputFile))) {
      const signedUrl = await this.apiService.getSignedUrl(recording.recording_id);
      await this.apiService.downloadFile(this.fileSystem, signedUrl.url, outputFile);
    }

    return {
      embeddedLink: `![[${recording.recording_id}.mp3]]`,
      filename: `${recording.recording_id}.mp3`,
    };
  }

  /**
   * Process attachments for a recording
   */
  private async processAttachments(recording: VoiceNoteRecording): Promise<string> {
    if (!recording.attachments || recording.attachments.length === 0) {
      return '';
    }

    const attachmentsPath = normalizePath(`${this.settings.syncDirectory}/attachments`);
    await this.fileSystem.ensureDirectory(attachmentsPath);

    const processedAttachments = await Promise.all(
      recording.attachments.map(async (attachment) => {
        if (attachment.type === 1 && attachment.description) {
          return `- ${attachment.description}`;
        } else if (attachment.type === 2 && attachment.url) {
          const filename = await this.downloadAttachment(attachment.url, attachmentsPath);
          return `- ![[${filename}]]`;
        }
        return null;
      })
    );

    return processedAttachments.filter(Boolean).join('\n');
  }

  /**
   * Download an attachment file
   */
  private async downloadAttachment(url: string, attachmentsPath: string): Promise<string> {
    try {
      const { getFilenameFromUrl } = await import('../utils');
      const filename = getFilenameFromUrl(url);
      const attachmentPath = normalizePath(`${attachmentsPath}/${filename}`);

      if (!(await this.fileSystem.exists(attachmentPath))) {
        await this.apiService.downloadFile(this.fileSystem, url, attachmentPath);
      }

      return filename;
    } catch (error) {
      console.error('Error downloading attachment:', error);
      throw error;
    }
  }
}
