import { App, Notice, PluginSettingTab, Setting, TextComponent, ButtonComponent, ToggleComponent, TextAreaComponent } from 'obsidian';
import VoiceNotesApi from './voicenotes-api';
import VoiceNotesPlugin from './main';
import { autoResizeTextArea } from './utils';

export class VoiceNotesSettingTab extends PluginSettingTab {
  plugin: VoiceNotesPlugin;
  vnApi: VoiceNotesApi;
  password: string | null;

  constructor(app: App, plugin: VoiceNotesPlugin) {
    super(app, plugin);
    this.plugin = plugin;
    // this.vnApi = new VoiceNotesApi({}); // DO NOT create a new instance here for credential setting
  }

  async display(): Promise<void> {
    const { containerEl } = this;
    containerEl.empty();

    // Crucial check: Ensure vnApi is initialized
    if (!this.plugin.vnApi) {
      console.error("VoiceNotes Sync: this.plugin.vnApi is not available in settings tab. Plugin may not have loaded fully.");
      new Setting(containerEl)
        .setName("Error")
        .setDesc("VoiceNotes Sync plugin is not fully initialized. Please try reloading Obsidian or checking for console errors.");
      return; // Stop rendering if vnApi is not ready
    }

    if (!this.plugin.settings.token) {
      new Setting(containerEl).setName('Username').addText((text: TextComponent) =>
        text
          .setPlaceholder('Email address')
          .setValue(this.plugin.settings.username)
          .onChange(async (value: string) => {
            this.plugin.settings.username = value;
            await this.plugin.saveSettings();
          })
      );

      new Setting(containerEl).setName('Password').addText((text: TextComponent) => {
        text
          .setPlaceholder('Password')
          .setValue(this.password ?? '')
          .onChange(async (value: string) => {
            this.password = value;
            // Do not save the password in settings directly, it's temporary for login
          });
        text.inputEl.type = 'password';
        return text;
      });

      new Setting(containerEl).addButton((button: ButtonComponent) =>
        button.setButtonText('Login').onClick(async () => {
          if (!this.plugin.settings.username || !this.password) {
            new Notice('Please enter both username and password.');
            return;
          }
          const token = await this.plugin.vnApi.login({
            username: this.plugin.settings.username,
            password: this.password,
          });

          if (token) {
            this.plugin.settings.token = token;
            if (this.plugin.settings.username && this.password) {
              // Use the plugin's shared API instance
              this.plugin.vnApi.setCredentials(this.plugin.settings.username, this.password);
            }
            this.password = null; // Clear temporary password from settings tab memory
            new Notice('Login to voicenotes.com was successful');
            await this.plugin.saveSettings();
            this.plugin.setupAutoSync();
            await this.display();
          } else {
            new Notice('Login to voicenotes.com was unsuccessful');
          }
        })
      );

      new Setting(containerEl).setName('Auth Token').addText((text: TextComponent) =>
        text
          .setPlaceholder('12345|abcdefghijklmnopqrstuvwxyz')
          .setValue(this.plugin.settings.token ?? '')
          .onChange(async (value: string) => {
            this.plugin.settings.token = value;
            await this.plugin.saveSettings();
          })
      );
      new Setting(containerEl).addButton((button: ButtonComponent) =>
        button.setButtonText('Login with token').onClick(async () => {
          if (!this.plugin.settings.token) {
            new Notice('Please enter a token.');
            return;
          }
          // Use the plugin's shared API instance
          this.plugin.vnApi.setToken(this.plugin.settings.token);
          // If logging in with token, credentials (username/password) for re-login won't be available
          // unless they were set previously via username/password login.
          // We should clear any old uname/pwd credentials in vnApi if user explicitly logs in with token only.
          this.plugin.vnApi.setCredentials(undefined, undefined);

          const response = await this.plugin.vnApi.getUserInfo();

          if (response) {
            new Notice('Login to voicenotes.com was successful');
            await this.plugin.saveSettings();
            this.plugin.setupAutoSync();
            await this.display();
          } else {
            new Notice('Login to voicenotes.com was unsuccessful');
          }
        })
      );
    }
    if (this.plugin.settings.token) {
      const userInfo = await this.plugin.vnApi.getUserInfo();

      if (!userInfo) {
        // This can happen if the token is invalid or network error, even if vnApi exists
        new Setting(containerEl)
          .setName('Error')
          .setDesc('Could not fetch user information. Your token might be invalid or there might be network issues. Please try logging out and logging in again.');

        // Offer logout button even in this error state if token exists
        new Setting(containerEl).addButton((button: ButtonComponent) =>
          button.setButtonText('Logout').onClick(async () => {
            new Notice('Logged out of voicenotes.com');
            this.plugin.settings.token = null;
            this.password = null;
            if (this.plugin.vnApi) {
              this.plugin.vnApi.setToken(undefined);
              this.plugin.vnApi.setCredentials(undefined, undefined);
            } else {
              console.warn('VoiceNotesPlugin: vnApi instance not found on plugin during logout.');
            }
            await this.plugin.saveSettings();
            await this.display();
          })
        );
        return; // Stop rendering further settings
      }

      new Setting(containerEl).setName('Name').addText((text: TextComponent) => text.setPlaceholder(userInfo.name).setDisabled(true));
      new Setting(containerEl)
        .setName('Email')
        .addText((text: TextComponent) => text.setPlaceholder(userInfo.email).setDisabled(true));
      new Setting(containerEl).addButton((button: ButtonComponent) =>
        button.setButtonText('Logout').onClick(async () => {
          new Notice('Logged out of voicenotes.com');
          this.plugin.settings.token = null;
          this.password = null; // Clear any temporary password in the input field

          // Also update the active vnApi instance on the plugin
          if (this.plugin && this.plugin.vnApi) {
            this.plugin.vnApi.setToken(undefined); // Clear the token
            this.plugin.vnApi.setCredentials(undefined, undefined); // Clear any in-memory credentials
          } else {
            console.warn('VoiceNotesPlugin: vnApi instance not found on plugin during logout.');
          }

          await this.plugin.saveSettings();
          await this.display(); // Refresh the settings tab UI
        })
      );

      new Setting(containerEl)
        .setName('Force Sync')
        .setDesc(
          "Manual synchronization -- Prefer using the quick sync option unless you're having issues with syncing. Full synchronization will sync all notes, not just the last ten but can be much slower."
        )
        .addButton((button: ButtonComponent) =>
          button.setButtonText('Manual sync (quick)').onClick(async () => {
            new Notice('Performing manual synchronization of the last ten notes.');
            await this.plugin.sync();
            new Notice('Manual quick synchronization has completed.');
          })
        )
        .addButton((button: ButtonComponent) =>
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
      .addText((text: TextComponent) => {
        text
          .setDisabled(!this.plugin.settings.automaticSync)
          .setPlaceholder('30')
          .setValue(`${this.plugin.settings.syncTimeout}`)
          .onChange(async (value: string) => {
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
      .addToggle((toggle: ToggleComponent) =>
        toggle.setValue(this.plugin.settings.automaticSync).onChange(async (value: boolean) => {
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
      .addText((text: TextComponent) =>
        text
          .setPlaceholder('voicenotes')
          .setValue(`${this.plugin.settings.syncDirectory}`)
          .onChange(async (value: string) => {
            this.plugin.settings.syncDirectory = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Add a tag to todos')
      .setDesc('When syncing a note add an optional tag to the todo')
      .addText((text: TextComponent) =>
        text
          .setPlaceholder('TODO')
          .setValue(this.plugin.settings.todoTag)
          .onChange(async (value: string) => {
            this.plugin.settings.todoTag = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Download audio')
      .setDesc('Store and download the audio associated with the transcript')
      .addToggle((toggle: ToggleComponent) =>
        toggle.setValue(this.plugin.settings.downloadAudio).onChange(async (value: boolean) => {
          this.plugin.settings.downloadAudio = Boolean(value);
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName('Show Image Descriptions')
      .setDesc('If enabled, show the description below an image attachment (in italics).')
      .addToggle((toggle: ToggleComponent) =>
        toggle.setValue(this.plugin.settings.showImageDescriptions).onChange(async (value: boolean) => {
          this.plugin.settings.showImageDescriptions = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName('Date Format')
      .setDesc('Format of the date used in the templates below (moment.js format)')
      .addText((text: TextComponent) =>
        text
          .setPlaceholder('YYYY-MM-DD')
          .setValue(this.plugin.settings.dateFormat)
          .onChange(async (value: string) => {
            this.plugin.settings.dateFormat = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Filename Date Format')
      .setDesc('Format of the date used to replace {{date}} if in Filename Template below (moment.js format)')
      .addText((text: TextComponent) =>
        text
          .setPlaceholder('YYYY-MM-DD')
          .setValue(this.plugin.settings.filenameDateFormat)
          .onChange(async (value: string) => {
            this.plugin.settings.filenameDateFormat = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Filename Template')
      .setDesc('Template for the filename of synced notes. Available variables: {{date}}, {{title}}')
      .addText((text: TextComponent) =>
        text
          .setPlaceholder('{{date}} {{title}}')
          .setValue(this.plugin.settings.filenameTemplate)
          .onChange(async (value: string) => {
            this.plugin.settings.filenameTemplate = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Frontmatter Template')
      .setDesc(
        'Frontmatter / properties template for notes. recording_id and the three dashes before and after properties automatically added'
      )
      .addTextArea((text: TextAreaComponent) => {
        text
          .setPlaceholder(this.plugin.settings.frontmatterTemplate)
          .setValue(this.plugin.settings.frontmatterTemplate)
          .onChange(async (value: string) => {
            this.plugin.settings.frontmatterTemplate = value;
            await this.plugin.saveSettings();
          });
        // Add autoresize to the textarea
        text.inputEl.classList.add('autoresize');
        autoResizeTextArea(text.inputEl);
        text.inputEl.addEventListener('input', () => autoResizeTextArea(text.inputEl));
        containerEl.appendChild(text.inputEl);
      })

    new Setting(containerEl)
      .setName('Note Template')
      .setDesc(
        'Template for synced notes. Available variables: {{recording_id}}, {{title}}, {{date}}, {{duration}}, {{created_at}}, {{updated_at}}, {{tags}}, {{transcript}}, {{embedded_audio_link}}, {{audio_filename}}, {{summary}}, {{tidy}}, {{points}}, {{todo}}, {{email}}, {{tweet}}, {{blog}}, {{custom}}, {{parent_note}}, {{related_notes}} and {{entries}}'
      )
      .addTextArea((text: TextAreaComponent) => {
        text
          .setPlaceholder(this.plugin.settings.noteTemplate)
          .setValue(this.plugin.settings.noteTemplate)
          .onChange(async (value: string) => {
            this.plugin.settings.noteTemplate = value;
            await this.plugin.saveSettings();
          });
        // Add autoresize to the textarea
        text.inputEl.classList.add('autoresize');
        autoResizeTextArea(text.inputEl);
        text.inputEl.addEventListener('input', () => autoResizeTextArea(text.inputEl));
        containerEl.appendChild(text.inputEl);
      })

    new Setting(containerEl)
      .setName('Exclude Tags')
      .setDesc('Comma-separated list of tags to exclude from syncing')
      .addText((text: TextComponent) =>
        text
          .setPlaceholder('archive, trash')
          .setValue(this.plugin.settings.excludeTags.join(', '))
          .onChange(async (value: string) => {
            this.plugin.settings.excludeTags = value.split(',').map((folder: string) => folder.trim());
            await this.plugin.saveSettings();
          })
      );
  }
}
