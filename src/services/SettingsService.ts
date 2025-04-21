import { Plugin } from 'obsidian';
import { VoiceNotesPluginSettings } from '../types';

export const DEFAULT_SETTINGS: VoiceNotesPluginSettings = {
  automaticSync: true,
  syncTimeout: 60,
  downloadAudio: false,
  syncDirectory: 'voicenotes',
  deleteSynced: false,
  reallyDeleteSynced: false,
  todoTag: '',
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
};

export class SettingsService {
  private plugin: Plugin;
  private settings: VoiceNotesPluginSettings;

  constructor(plugin: Plugin) {
    this.plugin = plugin;
    this.settings = { ...DEFAULT_SETTINGS };
  }

  /**
   * Get the current settings
   */
  getSettings(): VoiceNotesPluginSettings {
    return this.settings;
  }

  /**
   * Update settings with new values
   */
  updateSettings(newSettings: Partial<VoiceNotesPluginSettings>): void {
    this.settings = {
      ...this.settings,
      ...newSettings,
    };
  }

  /**
   * Load settings from storage
   */
  async loadSettings(): Promise<VoiceNotesPluginSettings> {
    const loadedData = await this.plugin.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData || {});
    return this.settings;
  }

  /**
   * Save settings to storage
   */
  async saveSettings(): Promise<void> {
    await this.plugin.saveData(this.settings);
  }

  /**
   * Validate settings
   */
  validateSettings(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate syncTimeout
    if (this.settings.syncTimeout !== undefined && 
        (isNaN(this.settings.syncTimeout) || this.settings.syncTimeout < 1)) {
      errors.push('Sync timeout must be a number greater than or equal to 1');
    }

    // Validate syncDirectory
    if (!this.settings.syncDirectory) {
      errors.push('Sync directory cannot be empty');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Reset settings to defaults
   */
  resetSettings(): void {
    this.settings = { ...DEFAULT_SETTINGS };
  }

  /**
   * Clear sensitive data (token, password)
   */
  clearSensitiveData(): void {
    this.settings.token = undefined;
    this.settings.password = undefined;
  }
}
