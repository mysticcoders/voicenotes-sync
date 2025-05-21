import { App, DataAdapter, Editor, normalizePath, Notice, Plugin, PluginManifest, TFile } from 'obsidian';
import VoiceNotesApi from './voicenotes-api';
import { getFilenameFromUrl, isToday, formatDuration, formatDate, formatTags, convertHtmlToMarkdown } from './utils';
import { VoiceNotesPluginSettings } from './types';
import { sanitize } from 'sanitize-filename-ts';
import { VoiceNotesSettingTab } from './settings';
// @ts-ignore
import * as jinja from 'jinja-js';

const DEFAULT_SETTINGS: VoiceNotesPluginSettings = {
  automaticSync: true,
  syncTimeout: 60,
  downloadAudio: false,
  syncDirectory: 'voicenotes',
  deleteSynced: false,
  reallyDeleteSynced: false,
  todoTag: '',
  username: '',
  filenameDateFormat: 'YYYY-MM-DD',
  frontmatterTemplate: `duration: {{duration}}
created_at: {{created_at}}
updated_at: {{updated_at}}
{{tags}}`,
  noteTemplate: `# {{ title }}

Date: {{ date }}

{% if summary %}
## Summary

{{ summary }}
{% endif %}

{% if points %}
## Main points

{{ points }}
{% endif %}

{% if attachments %}
## Attachments

{{ attachments }}
{% endif %}

{% if entries %}
## Manual Entries

{{ entries }}
{% endif %}

{% if tidy %}
## Tidy Transcript

{{ tidy }}

{% else %}
## Transcript

{{ transcript }}
{% endif %}

{% if embedded_audio_link %}
{{ embedded_audio_link }}
{% endif %}

{% if audio_filename %}
[[{{ audio_filename }}|Audio]]
{% endif %}

{% if todo %}
## Todos

{{ todo }}
{% endif %}

{% if email %}
## Email

{{ email }}
{% endif %}

{% if blog %}
## Blog

{{ blog }}
{% endif %}

{% if tweet %}
## Tweet

{{ tweet }}
{% endif %}

{% if custom %}
## Others

{{ custom }}
{% endif %}

{% if tags %}
## Tags

{{ tags }}
{% endif %}

{% if related_notes %}
# Related Notes

{{ related_notes }}
{% endif %}

{% if parent_note %}
## Parent Note

- {{ parent_note }}
{% endif %}

{% if subnotes %}
## Subnotes

{{ subnotes }}
{% endif %}`,

  filenameTemplate: `
{{date}} {{title}}
`,
  excludeTags: [],
  dateFormat: 'YYYY-MM-DD',
  showImageDescriptions: true,
};

export default class VoiceNotesPlugin extends Plugin {
  settings: VoiceNotesPluginSettings;
  vnApi: VoiceNotesApi;
  fs: DataAdapter;
  timeSinceSync: number = 0;
  syncedRecordingIds: number[];
  syncIntervalId: NodeJS.Timeout | null = null;

  ONE_SECOND = 1000;

  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);
    this.fs = app.vault.adapter;
  }

  async onload() {
    await this.loadSettings();
    this.vnApi = new VoiceNotesApi({
      token: this.settings.token,
      username: this.settings.username
    });
    this.addSettingTab(new VoiceNotesSettingTab(this.app, this));

    if (this.settings.token) {
      this.setupAutoSync();
    }

    this.addCommand({
      id: 'manual-sync-voicenotes',
      name: 'Manual Sync Voicenotes',
      callback: async () => await this.sync(false),
    });

    this.addCommand({
      id: 'insert-voicenotes-from-today',
      name: "Insert Today's Voicenotes",
      editorCallback: async (editor: Editor) => {
        if (!this.settings.token) {
          new Notice('No access available, please login in plugin settings');
          return;
        }

        const todaysRecordings = await this.getTodaysSyncedRecordings();

        if (todaysRecordings.length === 0) {
          new Notice('No recordings from today found');
          return;
        }

        const listOfToday = todaysRecordings.map((filename) => `- [[${filename}]]`).join('\n');
        editor.replaceSelection(listOfToday);
      },
    });

    this.registerEvent(
      this.app.metadataCache.on('deleted', (deletedFile, prevCache) => {
        if (prevCache.frontmatter?.recording_id) {
          this.syncedRecordingIds.remove(prevCache.frontmatter?.recording_id);
        }
      })
    );

    // Timeout to give the app time to load
    setTimeout(async () => {
      this.syncedRecordingIds = await this.getSyncedRecordingIds();
      await this.sync(this.syncedRecordingIds.length === 0);
    }, 1000);
  }

  onunload() {
    this.syncedRecordingIds = [];
    this.clearAutoSync();
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.setupAutoSync();
  }

  setupAutoSync() {
    this.clearAutoSync();
    if (this.settings.automaticSync) {
      this.syncIntervalId = setInterval(
        () => {
          this.sync(false);
        },
        this.settings.syncTimeout * 60 * 1000
      );
    }
  }

  clearAutoSync() {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
  }

  async getRecordingIdFromFile(file: TFile): Promise<number | undefined> {
    return this.app.metadataCache.getFileCache(file)?.frontmatter?.['recording_id'];
  }

  async isRecordingFromToday(file: TFile): Promise<boolean> {
    return isToday(await this.app.metadataCache.getFileCache(file)?.frontmatter?.['created_at']);
  }

  sanitizedTitle(title: string, created_at: string): string {
    const date = formatDate(created_at, this.settings.filenameDateFormat);
    const generatedTitle = this.settings.filenameTemplate.replace('{{date}}', date).replace('{{title}}', title);
    return sanitize(generatedTitle);
  }

  /**
   * Return the recording IDs that we've already synced
   */
  async getSyncedRecordingIds(): Promise<number[]> {
    const { vault } = this.app;

    const markdownFiles = vault.getMarkdownFiles().filter((file) => file.path.startsWith(this.settings.syncDirectory));

    return (await Promise.all(markdownFiles.map(async (file) => this.getRecordingIdFromFile(file)))).filter(
      (recordingId) => recordingId !== undefined
    ) as number[];
  }

  async getTodaysSyncedRecordings(): Promise<string[]> {
    const { vault } = this.app;

    const markdownFiles = vault.getMarkdownFiles().filter((file) => file.path.startsWith(this.settings.syncDirectory));

    return (
      await Promise.all(
        markdownFiles.map(async (file) => ((await this.isRecordingFromToday(file)) ? file.basename : undefined))
      )
    ).filter((filename) => filename !== undefined) as string[];
  }

  async processNote(
    recording: any,
    voiceNotesDir: string,
    isSubnote: boolean = false,
    parentTitle: string = '',
    unsyncedCount: { count: number }
  ): Promise<void> {
    try {
      if (!recording.title) {
        new Notice(`Unable to grab voice recording with id: ${recording.id}`);
        return;
      }

      const title = this.sanitizedTitle(recording.title, recording.created_at);
      const recordingPath = normalizePath(`${voiceNotesDir}/${title}.md`);

      // Process sub-notes, whether the note already exists or not
      if (recording.subnotes && recording.subnotes.length > 0) {
        for (const subnote of recording.subnotes) {
          await this.processNote(subnote, voiceNotesDir, true, title, unsyncedCount);
        }
      }

      // Check if the recording contains any excluded tags
      if (
        recording.tags &&
        recording.tags.some((tag: { name: string }) => this.settings.excludeTags.includes(tag.name))
      ) {
        unsyncedCount.count++;
        return;
      }

      // Check if the note already exists
      const noteExists = await this.app.vault.adapter.exists(recordingPath);

      // If the note doesn't exist, or if it's a sub-note, it's treated as follows
      if (!noteExists || isSubnote) {
        // Prepare data for the template
        const creationTypes = ['summary', 'points', 'tidy', 'todo', 'tweet', 'blog', 'email', 'custom'];
        const creations = Object.fromEntries(
          creationTypes.map((type) => [
            type,
            recording.creations.find((creation: { type: string }) => creation.type === type),
          ])
        );

        const { transcript } = recording;

        // Destructure creations object to get individual variables if needed
        const { summary, points, tidy, todo, tweet, blog, email, custom } = creations;

        let embeddedAudioLink = '';
        let audioFilename = '';
        if (this.settings.downloadAudio) {
          const audioPath = normalizePath(`${voiceNotesDir}/audio`);
          if (!(await this.app.vault.adapter.exists(audioPath))) {
            await this.app.vault.createFolder(audioPath);
          }
          const outputLocationPath = normalizePath(`${audioPath}/${recording.recording_id}.mp3`);
          if (!(await this.app.vault.adapter.exists(outputLocationPath))) {
            const signedUrl = await this.vnApi.getSignedUrl(recording.recording_id);
            if (signedUrl && signedUrl.url) {
              await this.vnApi.downloadFile(this.fs, signedUrl.url, outputLocationPath);
              embeddedAudioLink = `![[${recording.recording_id}.mp3]]`;
              audioFilename = `${recording.recording_id}.mp3`;
            } else {
              new Notice(`Could not get download URL for audio: ${recording.title}. Skipping audio download.`)
              console.error(`Failed to get signed URL for recording ID: ${recording.recording_id}`);
            }
          }
        }

        // Handle attachments
        let attachmentsMarkdown = '';
        const manualEntries: string[] = []; // Array to store type 3 entry descriptions

        if (recording.attachments && recording.attachments.length > 0) {
          const attachmentsPath = normalizePath(`${voiceNotesDir}/attachments`);
          if (!(await this.app.vault.adapter.exists(attachmentsPath))) {
            await this.app.vault.createFolder(attachmentsPath);
          }
          attachmentsMarkdown = ( // Renamed from 'attachments' to avoid conflict with context key
            await Promise.all(
              recording.attachments.map(async (data: any) => {
                if (data.type === 1) { // Text description attachment
                  return `- ${data.description}`;
                } else if (data.type === 2) { // Image attachment
                  const filename = getFilenameFromUrl(data.url);
                  const attachmentPathLocal = normalizePath(`${attachmentsPath}/${filename}`); // Renamed to avoid conflict
                  if (!(await this.app.vault.adapter.exists(attachmentPathLocal))) {
                    await this.vnApi.downloadFile(this.fs, data.url, attachmentPathLocal);
                  }
                  let imageMarkdown = `- ![[${filename}]]`;
                  if (this.settings.showImageDescriptions && data.description && data.description.trim() !== '') {
                    imageMarkdown += `\n  *${data.description.trim()}*`;
                  }
                  return imageMarkdown;
                } else if (data.type === 3) { // Manual entry/note
                  if (data.description && data.description.trim() !== '') {
                    manualEntries.push(data.description.trim());
                  }
                  return null; // These won't be part of the {{attachments}} variable directly
                }
                return null; // Return null for unhandled types or if no direct markdown output
              })
            )
          ).filter(content => content !== null).join('\n'); // Filter out nulls before joining
        }

        const formattedEntries = manualEntries.length > 0 ? manualEntries.join('\n') : null;

        // Prepare context for Jinja template
        const formattedPoints = points ? points.content.data.map((data: string) => `- ${data}`).join('\n') : null;
        const formattedTodos = todo
          ? todo.content.data
            .map((data: string) => `- [ ] ${data}${this.settings.todoTag ? ' #' + this.settings.todoTag : ''}`)
            .join('\n')
          : null;
        // Format tags, replacing spaces with hyphens for multi-word tags
        const formattedTags =
          recording.tags && recording.tags.length > 0
            ? recording.tags.map((tag: { name: string }) => `#${tag.name.replace(/\s+/g, '-')}`).join(' ')
            : null;
        const context = {
          recording_id: recording.recording_id,
          title: title,
          date: formatDate(recording.created_at, this.settings.dateFormat),
          duration: formatDuration(recording.duration),
          created_at: formatDate(recording.created_at, this.settings.dateFormat),
          updated_at: formatDate(recording.updated_at, this.settings.dateFormat),
          transcript: transcript,
          embedded_audio_link: embeddedAudioLink,
          audio_filename: audioFilename,
          summary: summary ? summary.markdown_content : null,
          tidy: tidy ? tidy.markdown_content : null,
          points: formattedPoints,
          todo: formattedTodos,
          tweet: tweet ? tweet.markdown_content : null,
          blog: blog ? blog.markdown_content : null,
          email: email ? email.markdown_content : null,
          custom: custom ? custom.markdown_content : null,
          tags: formattedTags,
          related_notes:
            recording.related_notes && recording.related_notes.length > 0
              ? recording.related_notes
                .map(
                  (relatedNote: { title: string; created_at: string }) =>
                    `- [[${this.sanitizedTitle(relatedNote.title, relatedNote.created_at)}]]`
                )
                .join('\n')
              : null,
          subnotes:
            recording.subnotes && recording.subnotes.length > 0
              ? recording.subnotes
                .map(
                  (subnote: { title: string; created_at: string }) =>
                    `- [[${this.sanitizedTitle(subnote.title, subnote.created_at)}]]`
                )
                .join('\n')
              : null,
          attachments: attachmentsMarkdown ? attachmentsMarkdown : null, // Use the processed markdown string for attachments
          parent_note: isSubnote ? `[[${parentTitle}]]` : null,
          entries: formattedEntries, // Add the new entries variable
        };

        // Render the template using Jinja
        let note = jinja.render(this.settings.noteTemplate, context).replace(/\n{3,}/g, '\n\n');
        note = convertHtmlToMarkdown(note);

        // Recording ID is required so we force it
        let recordingIdTemplate = `recording_id: {{recording_id}}\n`;
        let renderedFrontmatter = jinja.render(recordingIdTemplate + this.settings.frontmatterTemplate, context).replace(/\n{3,}/g, '\n\n');

        const metadata = `---\n${renderedFrontmatter}\n---\n`

        note = metadata + note;

        // Create or update note
        if (noteExists) {
          await this.app.vault.modify(this.app.vault.getFileByPath(recordingPath) as TFile, note);
        } else {
          await this.app.vault.create(recordingPath, note);
        }

        if (!this.syncedRecordingIds.includes(recording.recording_id)) {
          this.syncedRecordingIds.push(recording.recording_id);
        }

        if (this.settings.deleteSynced && this.settings.reallyDeleteSynced) {
          const deleted = await this.vnApi.deleteRecording(recording.recording_id);
          if (!deleted) {
            new Notice(`Failed to delete recording from server: ${recording.title}`);
          }
        }
      }
    } catch (error) {
      console.error(error);
      if (error.hasOwnProperty('status') !== 'undefined') {
        console.error(error.status);
        if (error.hasOwnProperty('text') !== 'undefined') {
          console.error(error.text);
        }
        if (error.hasOwnProperty('json') !== 'undefined') {
          console.error(error.json);
        }
        if (error.hasOwnProperty('headers') !== 'undefined') {
          console.error(error.headers);
        }

        this.settings.token = undefined;
        await this.saveSettings();
        new Notice(`Login token was invalid, please try logging in again.`);
      } else {
        new Notice(`Error occurred syncing some notes to this vault.`)
      }
    }
  }

  async sync(fullSync: boolean = false) {
    try {
      console.debug(`Sync running full? ${fullSync}`);

      this.syncedRecordingIds = await this.getSyncedRecordingIds();

      const voiceNotesDir = normalizePath(this.settings.syncDirectory);
      if (!(await this.app.vault.adapter.exists(voiceNotesDir))) {
        new Notice('Creating sync directory for Voice Notes Sync plugin');
        await this.app.vault.createFolder(voiceNotesDir);
      }

      const recordings = await this.vnApi.getRecordings();
      // This only happens if we aren't actually logged in, fail immediately.
      if (recordings === null) {
        this.settings.token = undefined;
        return;
      }
      const unsyncedCount = { count: 0 };

      if (fullSync && recordings.links.next) {
        let nextPage = recordings.links.next;
        let pageNum = 1;
        const initialTotal = recordings.data.length;
        console.log(`Full Sync: Starting. Initial page loaded with ${initialTotal} recordings.`);

        do {
          pageNum++;
          console.log(`Full Sync: Fetching page ${pageNum} from URL: ${nextPage}`);

          const moreRecordings = await this.vnApi.getRecordingsFromLink(nextPage);
          if (!moreRecordings || !moreRecordings.data) {
            new Notice('Failed to fetch further recordings during full sync. Please check login status.');
            // Token might be invalid, clear it to force re-login on next attempt or settings visit
            this.settings.token = undefined;
            await this.saveSettings();
            // Consider stopping the sync or further pagination here
            return;
          }
          recordings.data.push(...moreRecordings.data);
          nextPage = moreRecordings.links.next;
          console.log(`Full Sync: Page ${pageNum} fetched. Total recordings so far: ${recordings.data.length}. Next page: ${nextPage ? 'Yes' : 'No'}`);
        } while (nextPage);
        console.log(`Full Sync: All pages fetched. Total recordings: ${recordings.data.length}`);
      }

      if (recordings && recordings.data) {
        new Notice(`Syncing latest Voicenotes`);
        let processedCount = 0;
        const totalToProcess = recordings.data.length;
        console.log(`Processing ${totalToProcess} recordings...`);

        for (const recording of recordings.data) {
          await this.processNote(recording, voiceNotesDir, false, '', unsyncedCount);
          processedCount++;
          if (processedCount % 10 === 0 || processedCount === totalToProcess) { // Log every 10 or at the end
            console.log(`Processed ${processedCount}/${totalToProcess} recordings.`);
          }
        }
      }

      new Notice(`Sync complete. ${unsyncedCount.count} recordings were not synced due to excluded tags.`);
    } catch (error: any) {
      console.error('Error during sync:', error);
      if (error && (error.status === 401 || error.status === 403)) {
        // Authentication or Authorization error
        this.settings.token = undefined; // Clear token as it's invalid or insufficient
        await this.saveSettings();
        new Notice('Authentication failed. Please log in again via VoiceNotes Sync settings.');
      } else if (error && error.status === 429) {
        // Rate limit error specifically
        new Notice('Sync interrupted due to server rate limits. Please try again later.');
      } else if (error && error.message && error.message.includes('credentials not available')) {
        // Specific error from our API client if login is needed but no creds
        new Notice('Login credentials not available for VoiceNotes Sync. Please log in via settings.');
      } else {
        // Other types of errors (network, unexpected server issues, etc.)
        new Notice('Error occurred syncing some notes. Check console for details.');
      }
    }
  }
}
