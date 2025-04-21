import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import VoiceNotesPlugin from './main';
import { VoiceNotesApiService } from './services';
import { autoResizeTextArea } from './utils';

export class VoiceNotesSettingTab extends PluginSettingTab {
  plugin: VoiceNotesPlugin;
  vnApi: VoiceNotesApiService;
  password: string;

  constructor(app: App, plugin: VoiceNotesPlugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.vnApi = new VoiceNotesApiService();
  }

  async display(): Promise<void> {
    const { containerEl } = this;
    const settings = this.plugin.getSettings();

    containerEl.empty();

    if (!settings.token) {
      this.displayLoginForm();
    } else {
      await this.displayUserInfo();
    }

    this.displaySyncSettings();
    this.displayTemplateSettings();
    this.displayAdvancedSettings();
  }

  private displayLoginForm(): void {
    const settings = this.plugin.getSettings();

    new Setting(this.containerEl).setName('Username').addText((text) =>
      text
        .setPlaceholder('Email address')
        .setValue(settings.username || '')
        .onChange(async (value) => {
          this.plugin.updateSettings({ username: value });
        })
    );

    new Setting(this.containerEl).setName('Password').addText((text) => {
      text
        .setPlaceholder('Password')
        .setValue(this.password || '')
        .onChange(async (value) => {
          this.password = value;
        });
      text.inputEl.type = 'password';
      return text;
    });

    new Setting(this.containerEl).addButton((button) =>
      button.setButtonText('Login').onClick(async () => {
        try {
          const token = await this.vnApi.login({
            username: settings.username,
            password: this.password,
          });

          await this.plugin.updateSettings({
            token,
            password: undefined,
          });

          this.password = '';
          new Notice('Login to voicenotes.com was successful');
          await this.display();
        } catch (error) {
          new Notice(`Login failed: ${error.message || 'Unknown error'}`);
        }
      })
    );

    new Setting(this.containerEl)
      .setName('Auth Token')
      .setDesc('Alternatively, you can enter your API token directly')
      .addText((text) =>
        text
          .setPlaceholder('12345|abcdefghijklmnopqrstuvwxyz')
          .setValue(settings.token || '')
          .onChange(async (value) => {
            this.plugin.updateSettings({ token: value });
          })
      );

    new Setting(this.containerEl).addButton((button) =>
      button.setButtonText('Login with token').onClick(async () => {
        try {
          this.vnApi.setToken(settings.token);
          const response = await this.vnApi.getUserInfo();

          if (response) {
            new Notice('Login to voicenotes.com was successful');
            this.plugin.updateSettings({ password: undefined });
            await this.display();
          } else {
            new Notice('Invalid token');
          }
        } catch (error) {
          new Notice(`Token login failed: ${error.message || 'Unknown error'}`);
        }
      })
    );
  }

  private async displayUserInfo(): Promise<void> {
    try {
      this.vnApi.setToken(this.plugin.getSettings().token);
      const userInfo = await this.vnApi.getUserInfo();

      new Setting(this.containerEl)
        .setName('Name')
        .addText((text) => text.setPlaceholder(userInfo.name).setDisabled(true));

      new Setting(this.containerEl)
        .setName('Email')
        .addText((text) => text.setPlaceholder(userInfo.email).setDisabled(true));

      new Setting(this.containerEl).addButton((button) =>
        button.setButtonText('Logout').onClick(async () => {
          await this.plugin.updateSettings({
            token: undefined,
            password: undefined,
          });

          this.password = '';
          new Notice('Logged out of voicenotes.com');
          await this.display();
        })
      );

      this.displaySyncButtons();
    } catch (error) {
      new Notice(`Error fetching user info: ${error.message}`);
      await this.plugin.updateSettings({ token: undefined });
      await this.display();
    }
  }

  private displaySyncButtons(): void {
    new Setting(this.containerEl)
      .setName('Force Sync')
      .setDesc(
        "Manual synchronization -- Prefer using the quick sync option unless you're having issues with syncing. Full synchronization will sync all notes, not just the last ten but can be much slower."
      )
      .addButton((button) =>
        button.setButtonText('Manual sync (quick)').onClick(async () => {
          new Notice('Performing manual synchronization of the last ten notes.');
          await this.plugin.sync();
          new Notice('Manual quick synchronization has completed.');
        })
      )
      .addButton((button) =>
        button.setButtonText('Manual sync (full)').onClick(async () => {
          new Notice('Performing manual synchronization of all notes.');
          await this.plugin.sync(true);
          new Notice('Manual full synchronization has completed.');
        })
      );
  }

  private displaySyncSettings(): void {
    const settings = this.plugin.getSettings();

    new Setting(this.containerEl)
      .setName('Automatic sync every')
      .setDesc('Number of minutes between syncing with VoiceNotes.com servers (uncheck to sync manually)')
      .addText((text) => {
        text
          .setDisabled(!settings.automaticSync)
          .setPlaceholder('30')
          .setValue(`${settings.syncTimeout}`)
          .onChange(async (value) => {
            const numericValue = Number(value);
            const inputElement = text.inputEl;

            if (isNaN(numericValue) || numericValue < 1) {
              inputElement.style.backgroundColor = 'red';
              new Notice('Please enter a number greater than or equal to 1');
            } else {
              inputElement.style.backgroundColor = '';
              await this.plugin.updateSettings({ syncTimeout: numericValue });
            }
          });
        text.inputEl.type = 'number';
        return text;
      })
      .addToggle((toggle) =>
        toggle.setValue(settings.automaticSync).onChange(async (value) => {
          await this.plugin.updateSettings({ automaticSync: value });

          // If we've turned on automatic sync again, let's re-sync right away
          if (value && settings.token) {
            await this.plugin.sync(false);
          }

          await this.display();
        })
      );

    new Setting(this.containerEl)
      .setName('Sync directory')
      .setDesc('Directory to sync voice notes')
      .addText((text) =>
        text
          .setPlaceholder('voicenotes')
          .setValue(settings.syncDirectory)
          .onChange(async (value) => {
            await this.plugin.updateSettings({ syncDirectory: value });
          })
      );

    new Setting(this.containerEl)
      .setName('Download audio')
      .setDesc('Store and download the audio associated with the transcript')
      .addToggle((toggle) =>
        toggle.setValue(settings.downloadAudio).onChange(async (value) => {
          await this.plugin.updateSettings({ downloadAudio: Boolean(value) });
        })
      );

    new Setting(this.containerEl)
      .setName('Exclude Tags')
      .setDesc('Comma-separated list of tags to exclude from syncing')
      .addText((text) =>
        text
          .setPlaceholder('archive, trash')
          .setValue(settings.excludeTags.join(', '))
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              excludeTags: value.split(',').map((tag) => tag.trim()),
            });
          })
      );
  }

  private displayTemplateSettings(): void {
    const settings = this.plugin.getSettings();

    new Setting(this.containerEl)
      .setName('Add a tag to todos')
      .setDesc('When syncing a note add an optional tag to the todo')
      .addText((text) =>
        text
          .setPlaceholder('TODO')
          .setValue(settings.todoTag)
          .onChange(async (value) => {
            await this.plugin.updateSettings({ todoTag: value });
          })
      );

    new Setting(this.containerEl)
      .setName('Date Format')
      .setDesc('Format of the date used in the templates below (moment.js format)')
      .addText((text) =>
        text
          .setPlaceholder('YYYY-MM-DD')
          .setValue(settings.dateFormat)
          .onChange(async (value) => {
            await this.plugin.updateSettings({ dateFormat: value });
          })
      );

    new Setting(this.containerEl)
      .setName('Filename Date Format')
      .setDesc('Format of the date used to replace {{date}} if in Filename Template below (moment.js format)')
      .addText((text) =>
        text
          .setPlaceholder('YYYY-MM-DD')
          .setValue(settings.filenameDateFormat)
          .onChange(async (value) => {
            await this.plugin.updateSettings({ filenameDateFormat: value });
          })
      );

    new Setting(this.containerEl)
      .setName('Filename Template')
      .setDesc('Template for the filename of synced notes. Available variables: {{date}}, {{title}}')
      .addText((text) =>
        text
          .setPlaceholder('{{date}} {{title}}')
          .setValue(settings.filenameTemplate)
          .onChange(async (value) => {
            await this.plugin.updateSettings({ filenameTemplate: value });
          })
      );

    new Setting(this.containerEl)
      .setName('Frontmatter Template')
      .setDesc(
        'Frontmatter / properties template for notes. recording_id and the three dashes before and after properties automatically added'
      )
      .addTextArea((text) => {
        text
          .setPlaceholder(settings.frontmatterTemplate)
          .setValue(settings.frontmatterTemplate)
          .onChange(async (value) => {
            await this.plugin.updateSettings({ frontmatterTemplate: value });
          });
        // Add autoresize to the textarea
        text.inputEl.classList.add('autoresize');
        autoResizeTextArea(text.inputEl);
        text.inputEl.addEventListener('input', () => autoResizeTextArea(text.inputEl));
        this.containerEl.appendChild(text.inputEl);
      });

    new Setting(this.containerEl)
      .setName('Note Template')
      .setDesc(
        'Template for synced notes. Available variables: {{recording_id}}, {{title}}, {{date}}, {{duration}}, {{created_at}}, {{updated_at}}, {{tags}}, {{transcript}}, {{embedded_audio_link}}, {{audio_filename}}, {{summary}}, {{tidy}}, {{points}}, {{todo}}, {{email}}, {{tweet}}, {{blog}}, {{custom}}, {{parent_note}} and {{related_notes}}'
      )
      .addTextArea((text) => {
        text
          .setPlaceholder(settings.noteTemplate)
          .setValue(settings.noteTemplate)
          .onChange(async (value) => {
            await this.plugin.updateSettings({ noteTemplate: value });
          });
        // Add autoresize to the textarea
        text.inputEl.classList.add('autoresize');
        autoResizeTextArea(text.inputEl);
        text.inputEl.addEventListener('input', () => autoResizeTextArea(text.inputEl));
        this.containerEl.appendChild(text.inputEl);
      });
  }

  private displayAdvancedSettings(): void {
    const settings = this.plugin.getSettings();

    new Setting(this.containerEl)
      .setName('Delete synced recordings')
      .setDesc('DANGER: Delete recordings from VoiceNotes.com after syncing')
      .addToggle((toggle) =>
        toggle.setValue(settings.deleteSynced).onChange(async (value) => {
          await this.plugin.updateSettings({ deleteSynced: value });
          if (!value) {
            await this.plugin.updateSettings({ reallyDeleteSynced: false });
          }
          await this.display();
        })
      );

    if (settings.deleteSynced) {
      new Setting(this.containerEl)
        .setName('Confirm deletion')
        .setDesc('EXTREME DANGER: I understand this will permanently delete my recordings from VoiceNotes.com')
        .addToggle((toggle) =>
          toggle.setValue(settings.reallyDeleteSynced).onChange(async (value) => {
            await this.plugin.updateSettings({ reallyDeleteSynced: value });
          })
        );
    }
  }
}
