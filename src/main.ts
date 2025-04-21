import { App, DataAdapter, Editor, Notice, Plugin, PluginManifest, TFile, normalizePath } from 'obsidian';
import { VoiceNotesSettingTab } from './settings';
import {
  FileSystemService,
  NoteService,
  SettingsService,
  TemplateService,
  VoiceNotesApiService
} from './services';
import { AuthenticationError, VoiceNotesPluginSettings } from './types';
import { isToday } from './utils';

export default class VoiceNotesPlugin extends Plugin {
  private settingsService: SettingsService;
  private apiService: VoiceNotesApiService;
  private fileSystem: FileSystemService;
  private templateService: TemplateService;
  private noteService: NoteService;
  private syncIntervalId: NodeJS.Timeout | null = null;
  private syncedRecordingIds: number[] = [];

  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);
    
    // Initialize services
    this.settingsService = new SettingsService(this);
    this.apiService = new VoiceNotesApiService();
    this.fileSystem = new FileSystemService(app.vault.adapter, app.vault);
    this.templateService = new TemplateService();
  }

  async onload() {
    // Load settings
    await this.settingsService.loadSettings();
    
    // Initialize API service with token if available
    if (this.getSettings().token) {
      this.apiService.setToken(this.getSettings().token);
    }
    
    // Initialize note service
    this.noteService = new NoteService(
      this.app.vault,
      this.getSettings(),
      this.fileSystem,
      this.templateService,
      this.apiService
    );

    // Add settings tab
    this.addSettingTab(new VoiceNotesSettingTab(this.app, this));

    // Setup auto sync if token is available
    if (this.getSettings().token) {
      this.setupAutoSync();
    }

    // Add commands
    this.addCommands();

    // Register events
    this.registerEvents();

    // Initial sync with timeout to let app load
    setTimeout(async () => {
      this.syncedRecordingIds = await this.getSyncedRecordingIds();
      await this.sync(this.syncedRecordingIds.length === 0);
    }, 1000);
  }

  onunload() {
    this.syncedRecordingIds = [];
    this.clearAutoSync();
  }

  /**
   * Get current settings
   */
  getSettings(): VoiceNotesPluginSettings {
    return this.settingsService.getSettings();
  }

  /**
   * Update and save settings
   */
  async updateSettings(settings: Partial<VoiceNotesPluginSettings>): Promise<void> {
    this.settingsService.updateSettings(settings);
    await this.saveSettings();
  }

  /**
   * Save current settings
   */
  async saveSettings(): Promise<void> {
    await this.settingsService.saveSettings();
    this.setupAutoSync();
  }

  /**
   * Setup automatic synchronization
   */
  setupAutoSync(): void {
    this.clearAutoSync();
    const settings = this.getSettings();
    
    if (settings.automaticSync && settings.token) {
      this.syncIntervalId = setInterval(
        () => this.sync(false),
        settings.syncTimeout * 60 * 1000
      );
    }
  }

  /**
   * Clear automatic synchronization
   */
  clearAutoSync(): void {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
  }

  /**
   * Add plugin commands
   */
  private addCommands(): void {
    // Manual sync command
    this.addCommand({
      id: 'manual-sync-voicenotes',
      name: 'Manual Sync Voicenotes',
      callback: async () => await this.sync(false),
    });

    // Insert today's voicenotes
    this.addCommand({
      id: 'insert-voicenotes-from-today',
      name: "Insert Today's Voicenotes",
      editorCallback: async (editor: Editor) => {
        if (!this.getSettings().token) {
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
  }

  /**
   * Register plugin events
   */
  private registerEvents(): void {
    this.registerEvent(
      this.app.metadataCache.on('deleted', (deletedFile, prevCache) => {
        if (prevCache.frontmatter?.recording_id) {
          this.syncedRecordingIds = this.syncedRecordingIds.filter(
            id => id !== prevCache.frontmatter.recording_id
          );
        }
      })
    );
  }

  /**
   * Get the recording ID from a file
   */
  async getRecordingIdFromFile(file: TFile): Promise<number | undefined> {
    return this.app.metadataCache.getFileCache(file)?.frontmatter?.['recording_id'];
  }

  /**
   * Check if a recording is from today
   */
  async isRecordingFromToday(file: TFile): Promise<boolean> {
    return isToday(await this.app.metadataCache.getFileCache(file)?.frontmatter?.['created_at']);
  }

  /**
   * Get IDs of recordings that have already been synced
   */
  async getSyncedRecordingIds(): Promise<number[]> {
    const { vault } = this.app;
    const settings = this.getSettings();

    const markdownFiles = vault.getMarkdownFiles().filter(
      (file) => file.path.startsWith(settings.syncDirectory)
    );

    return (await Promise.all(
      markdownFiles.map(async (file) => this.getRecordingIdFromFile(file))
    )).filter((recordingId) => recordingId !== undefined) as number[];
  }

  /**
   * Get filenames of recordings that were synced today
   */
  async getTodaysSyncedRecordings(): Promise<string[]> {
    const { vault } = this.app;
    const settings = this.getSettings();

    const markdownFiles = vault.getMarkdownFiles().filter(
      (file) => file.path.startsWith(settings.syncDirectory)
    );

    return (await Promise.all(
      markdownFiles.map(async (file) => 
        ((await this.isRecordingFromToday(file)) ? file.basename : undefined)
      )
    )).filter((filename) => filename !== undefined) as string[];
  }

  /**
   * Synchronize voicenotes
   */
  async sync(fullSync: boolean = false): Promise<void> {
    try {
      console.debug(`Sync running full? ${fullSync}`);
      
      // Get synced recording IDs
      this.syncedRecordingIds = await this.getSyncedRecordingIds();
      
      // Ensure API service has the latest token
      this.apiService.setToken(this.getSettings().token);
      
      // Ensure the sync directory exists
      const voiceNotesDir = normalizePath(this.getSettings().syncDirectory);
      await this.fileSystem.ensureDirectory(voiceNotesDir);
      
      // Get recordings from API
      const recordings = await this.apiService.getRecordings();
      if (!recordings) {
        new Notice('Failed to retrieve recordings. Please check your login credentials.');
        return;
      }
      
      const unsyncedCount = { count: 0 };
      
      // If doing a full sync, fetch all pages
      if (fullSync && recordings.links.next) {
        let nextPage = recordings.links.next;
        
        do {
          console.debug(`Performing a full sync ${nextPage}`);
          const moreRecordings = await this.apiService.getRecordingsFromLink(nextPage);
          recordings.data.push(...moreRecordings.data);
          nextPage = moreRecordings.links.next;
        } while (nextPage);
      }
      
      // Process each recording
      new Notice(`Syncing latest Voicenotes`);
      
      for (const recording of recordings.data) {
        // Skip recordings that have already been synced
        if (this.syncedRecordingIds.includes(recording.recording_id) && !fullSync) {
          continue;
        }
        
        const result = await this.noteService.processRecording(recording);
        
        if (!result.success && result.message) {
          new Notice(result.message);
        } else if (result.skipped && result.message === 'Skipped due to excluded tags') {
          unsyncedCount.count++;
        } else if (!result.skipped) {
          this.syncedRecordingIds.push(recording.recording_id);
        }
      }
      
      new Notice(`Sync complete. ${unsyncedCount.count} recordings were not synced due to excluded tags.`);
    } catch (error) {
      this.handleSyncError(error);
    }
  }
  
  /**
   * Handle sync errors
   */
  private handleSyncError(error: any): void {
    console.error('Sync error:', error);
    
    if (error instanceof AuthenticationError) {
      this.settingsService.updateSettings({ token: undefined });
      this.saveSettings();
      new Notice(`Login token was invalid, please try logging in again.`);
    } else {
      new Notice(`Error occurred syncing notes: ${error.message || 'Unknown error'}`);
    }
  }
}
