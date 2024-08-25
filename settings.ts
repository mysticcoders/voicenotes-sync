import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import VoiceNotesApi from './voicenotes-api';
import VoiceNotesPlugin from './main';
import { autoResizeTextArea } from './utils';

export class VoiceNotesSettingTab extends PluginSettingTab {
  plugin: VoiceNotesPlugin;
  vnApi: VoiceNotesApi;
  password: string;

  constructor(app: App, plugin: VoiceNotesPlugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.vnApi = new VoiceNotesApi({});
  }

  async display(): Promise<void> {
    const { containerEl } = this;

    containerEl.empty();

    if (!this.plugin.settings.token) {
      new Setting(containerEl).setName('Username').addText((text) =>
        text
          .setPlaceholder('Email address')
          .setValue(this.plugin.settings.username)
          .onChange(async (value) => {
            this.plugin.settings.username = value;
            await this.plugin.saveSettings();
          })
      );

      new Setting(containerEl).setName('Password').addText((text) => {
        text
          .setPlaceholder('Password')
          .setValue(this.plugin.settings.password)
          .onChange(async (value) => {
            this.password = value;
            await this.plugin.saveSettings();
          });
        text.inputEl.type = 'password';
        return text;
      });

      new Setting(containerEl).addButton((button) =>
        button.setButtonText('Login').onClick(async () => {
          this.plugin.settings.token = await this.vnApi.login({
            username: this.plugin.settings.username,
            password: this.password,
          });

          this.plugin.settings.password = null;
          if (this.plugin.settings.token) {
            new Notice('Login to voicenotes.com was successful');
            await this.plugin.saveSettings();
            await this.display();
          } else {
            new Notice('Login to voicenotes.com was unsuccessful');
          }
        })
      );

      new Setting(containerEl).setName('Auth Token').addText((text) =>
        text
          .setPlaceholder('12345|abcdefghijklmnopqrstuvwxyz')
          .setValue(this.plugin.settings.token)
          .onChange(async (value) => {
            this.plugin.settings.token = value;
            await this.plugin.saveSettings();
          })
      );
      new Setting(containerEl).addButton((button) =>
        button.setButtonText('Login with token').onClick(async () => {
          this.vnApi.setToken(this.plugin.settings.token);
          const response = await this.vnApi.getUserInfo();
          this.plugin.settings.password = null;

          if (response) {
            new Notice('Login to voicenotes.com was successful');
            await this.plugin.saveSettings();
            await this.display();
          } else {
            new Notice('Login to voicenotes.com was unsuccessful');
          }
        })
      );
    }
    if (this.plugin.settings.token) {
      this.vnApi.setToken(this.plugin.settings.token);

      const userInfo = await this.vnApi.getUserInfo();

      new Setting(containerEl).setName('Name').addText((text) => text.setPlaceholder(userInfo.name).setDisabled(true));
      new Setting(containerEl)
        .setName('Email')
        .addText((text) => text.setPlaceholder(userInfo.email).setDisabled(true));
      new Setting(containerEl).addButton((button) =>
        button.setButtonText('Logout').onClick(async () => {
          new Notice('Logged out of voicenotes.com');
          this.plugin.settings.token = null;
          this.plugin.settings.password = null;
          this.password = null;
          await this.plugin.saveSettings();
          await this.display();
        })
      );

      new Setting(containerEl)
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
            this.plugin.syncedRecordingIds = [];
            await this.plugin.sync(true);
            new Notice('Manual full synchronization has completed.');
          })
        );
    }

    new Setting(containerEl)
      .setName('Automatic sync every')
      .setDesc('Number of minutes between syncing with VoiceNotes.com servers (uncheck to sync manually)')
      .addText((text) => {
        text
          .setDisabled(!this.plugin.settings.automaticSync)
          .setPlaceholder('30')
          .setValue(`${this.plugin.settings.syncTimeout}`)
          .onChange(async (value) => {
            const numericValue = Number(value);
            const inputElement = text.inputEl;

            if (isNaN(numericValue) || numericValue < 1) {
              inputElement.style.backgroundColor = 'red';
              new Notice('Please enter a number greater than or equal to 1');
            } else {
              inputElement.style.backgroundColor = '';
              this.plugin.settings.syncTimeout = numericValue;
              await this.plugin.saveSettings();
            }
          });
        text.inputEl.type = 'number';
        return text;
      })
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.automaticSync).onChange(async (value) => {
          this.plugin.settings.automaticSync = value;
          // If we've turned on automatic sync again, let's re-sync right away
          if (value) {
            await this.plugin.sync(false);
          }
          await this.plugin.saveSettings();
          await this.display();
        })
      );

    new Setting(containerEl)
      .setName('Sync directory')
      .setDesc('Directory to sync voice notes')
      .addText((text) =>
        text
          .setPlaceholder('voicenotes')
          .setValue(`${this.plugin.settings.syncDirectory}`)
          .onChange(async (value) => {
            this.plugin.settings.syncDirectory = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Add a tag to todos')
      .setDesc('When syncing a note add an optional tag to the todo')
      .addText((text) =>
        text
          .setPlaceholder('TODO')
          .setValue(this.plugin.settings.todoTag)
          .onChange(async (value) => {
            this.plugin.settings.todoTag = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Download audio')
      .setDesc('Store and download the audio associated with the transcript')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.downloadAudio).onChange(async (value) => {
          this.plugin.settings.downloadAudio = Boolean(value);
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName('Date Format')
      .setDesc('Format of the date used in the templates below (moment.js format)')
      .addText((text) =>
        text
          .setPlaceholder('YYYY-MM-DD')
          .setValue(this.plugin.settings.dateFormat)
          .onChange(async (value) => {
            this.plugin.settings.dateFormat = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Filename Template')
      .setDesc('Template for the filename of synced notes. Available variables: {{date}}, {{title}}')
      .addText((text) =>
        text
          .setPlaceholder('{{date}} {{title}}')
          .setValue(this.plugin.settings.filenameTemplate)
          .onChange(async (value) => {
            this.plugin.settings.filenameTemplate = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Custom Note Template')
      .setDesc('Custom template for synced notes. Available variables: {{title}}, {{date}}, {{transcript}}, {{audio_link}}, {{summary}}, {{tidy}}, {{points}}, {{todo}}, {{email}}, {{tweet}}, {{blog}}, {{custom}}, {{parent_note}} and {{related_notes}} (uncheck to add a custom frontmatter)')
      .addTextArea((text) => {
        text
          .setPlaceholder(this.plugin.settings.noteTemplate)
          .setValue(this.plugin.settings.noteTemplate)
          .onChange(async (value) => {
            this.plugin.settings.noteTemplate = value;
            await this.plugin.saveSettings();
          });
        // Add autoresize to the textarea
        text.inputEl.classList.add('autoresize');
        autoResizeTextArea(text.inputEl);
        text.inputEl.addEventListener('input', () => autoResizeTextArea(text.inputEl));
        containerEl.appendChild(text.inputEl);
      })
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.useDefaultFrontmatter)
          .onChange(async (value) => {
            this.plugin.settings.useDefaultFrontmatter = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName('Exclude Tags')
      .setDesc('Comma-separated list of tags to exclude from syncing')
      .addText((text) =>
        text
          .setPlaceholder('archive, trash')
          .setValue(this.plugin.settings.excludeTags.join(', '))
          .onChange(async (value) => {
            this.plugin.settings.excludeTags = value.split(',').map((folder) => folder.trim());
            await this.plugin.saveSettings();
          })
      );
  }
}
