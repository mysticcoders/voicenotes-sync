import { App, Notice, PluginSettingTab, Setting, TextAreaComponent, TextComponent } from 'obsidian';
import VoiceNotesPlugin from './main';
import { autoResizeTextArea } from './utils';
import VoiceNotesApi from './api/voicenotes';
import { User, VoiceNotesPluginSettings } from './types';

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
      await this.renderLoginSection(containerEl);
    } else {
      this.vnApi.setToken(this.plugin.settings.token);
      const userInfo = await this.vnApi.getUserInfo();
      await this.renderUserSection(containerEl, userInfo);
    }

    await this.renderSyncSettings(containerEl);
    await this.renderContentSettings(containerEl);
    await this.renderTemplateSettings(containerEl);
    await this.renderAdvancedSettings(containerEl);
  }

  private async renderLoginSection(containerEl: HTMLElement): Promise<void> {
    new Setting(containerEl).setName('Username').addText((text) =>
      text
        .setPlaceholder('Email address')
        .setValue(this.plugin.settings.username || '')
        .onChange(this.createTextInputHandler('username'))
    );

    new Setting(containerEl).setName('Password').addText((text) => {
      text
        .setPlaceholder('Password')
        .setValue(this.plugin.settings.password || '')
        .onChange(async (value) => {
          this.password = value;
          await this.plugin.saveSettings();
        });
      text.inputEl.type = 'password';
      return text;
    });

    new Setting(containerEl).addButton((button) => button.setButtonText('Login').onClick(() => this.handleLogin()));

    new Setting(containerEl).setName('Auth Token').addText((text) =>
      text
        .setPlaceholder('12345|abcdefghijklmnopqrstuvwxyz')
        .setValue(this.plugin.settings.token || '')
        .onChange(this.createTextInputHandler('token'))
    );

    new Setting(containerEl).addButton((button) =>
      button.setButtonText('Login with token').onClick(() => this.handleTokenLogin())
    );
  }

  private async renderUserSection(containerEl: HTMLElement, userInfo: User): Promise<void> {
    new Setting(containerEl).setName('Name').addText((text) => text.setPlaceholder(userInfo.name).setDisabled(true));

    new Setting(containerEl).setName('Email').addText((text) => text.setPlaceholder(userInfo.email).setDisabled(true));

    new Setting(containerEl).addButton((button) => button.setButtonText('Logout').onClick(() => this.handleLogout()));

    new Setting(containerEl)
      .setName('Force Sync')
      .setDesc(
        "Manual synchronization -- Prefer using the quick sync option unless you're having issues with syncing. Full synchronization will sync all notes, not just the last ten but can be much slower."
      )
      .addButton((button) => button.setButtonText('Manual sync (quick)').onClick(() => this.handleQuickSync()))
      .addButton((button) => button.setButtonText('Manual sync (full)').onClick(() => this.handleFullSync()));
  }

  private async renderSyncSettings(containerEl: HTMLElement): Promise<void> {
    new Setting(containerEl)
      .setName('Automatic sync every')
      .setDesc('Number of minutes between syncing with VoiceNotes.com servers (uncheck to sync manually)')
      .addText((text) => {
        text
          .setDisabled(!this.plugin.settings.automaticSync)
          .setPlaceholder('30')
          .setValue(`${this.plugin.settings.syncTimeout}`)
          .onChange(this.createValidatedNumberInput('syncTimeout', 1));
        text.inputEl.type = 'number';
        return text;
      })
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.automaticSync).onChange(
          this.createToggleHandler('automaticSync', async () => {
            if (this.plugin.settings.automaticSync) {
              await this.plugin.sync(false);
            }
            await this.display();
          })
        )
      );

    new Setting(containerEl)
      .setName('Sync directory')
      .setDesc('Directory to sync voice notes')
      .addText((text) =>
        text
          .setPlaceholder('voicenotes')
          .setValue(this.plugin.settings.syncDirectory)
          .onChange(this.createTextInputHandler('syncDirectory'))
      );

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

  private async renderContentSettings(containerEl: HTMLElement): Promise<void> {
    new Setting(containerEl)
      .setName('Add a tag to todos')
      .setDesc('When syncing a note add an optional tag to the todo')
      .addText((text) =>
        text
          .setPlaceholder('TODO')
          .setValue(this.plugin.settings.todoTag)
          .onChange(this.createTextInputHandler('todoTag'))
      );

    new Setting(containerEl)
      .setName('Download audio')
      .setDesc('Store and download the audio associated with the transcript')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.downloadAudio || false).onChange(this.createToggleHandler('downloadAudio'))
      );

    new Setting(containerEl)
      .setName('Date Format')
      .setDesc('Format of the date used in the templates below (moment.js format)')
      .addText((text) =>
        text
          .setPlaceholder('YYYY-MM-DD')
          .setValue(this.plugin.settings.dateFormat || '')
          .onChange(this.createTextInputHandler('dateFormat'))
      );

    new Setting(containerEl)
      .setName('Filename Date Format')
      .setDesc('Format of the date used to replace {{date}} if in Filename Template below (moment.js format)')
      .addText((text) =>
        text
          .setPlaceholder('YYYY-MM-DD')
          .setValue(this.plugin.settings.filenameDateFormat)
          .onChange(this.createTextInputHandler('filenameDateFormat'))
      );

    new Setting(containerEl)
      .setName('Filename Template')
      .setDesc('Template for the filename of synced notes. Available variables: {{date}}, {{title}}')
      .addText((text) =>
        text
          .setPlaceholder('{{date}} {{title}}')
          .setValue(this.plugin.settings.filenameTemplate || '')
          .onChange(this.createTextInputHandler('filenameTemplate'))
      );
  }

  private async renderTemplateSettings(containerEl: HTMLElement): Promise<void> {
    new Setting(containerEl)
      .setName('Frontmatter Template')
      .setDesc(
        'Frontmatter / properties template for notes. recording_id and the three dashes before and after properties automatically added'
      )
      .addTextArea((text) => this.createTextAreaWithAutoresize(text, 'frontmatterTemplate', containerEl));

    new Setting(containerEl)
      .setName('Note Template')
      .setDesc(
        'Template for synced notes. Available variables: {{recording_id}}, {{title}}, {{date}}, {{duration}}, {{created_at}}, {{updated_at}}, {{tags}}, {{transcript}}, {{embedded_audio_link}}, {{audio_filename}}, {{summary}}, {{tidy}}, {{points}}, {{todo}}, {{email}}, {{tweet}}, {{blog}}, {{custom}}, {{parent_note}} and {{related_notes}}'
      )
      .addTextArea((text) => this.createTextAreaWithAutoresize(text, 'noteTemplate', containerEl));
  }

  private async renderAdvancedSettings(containerEl: HTMLElement): Promise<void> {
    new Setting(containerEl)
      .setName('Use custom frontmatter property for date sorting')
      .setDesc(
        'If you have changed the frontmatter template above, you can specify here which property should be used, e.g. to include todays notes.'
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.useCustomChangedAtProperty || false).onChange(
          this.createToggleHandler('useCustomChangedAtProperty', async () => {
            await this.display();
          })
        )
      )
      .addText((text) => {
        text
          .setPlaceholder('Custom setting value')
          .setValue(this.plugin.settings.customChangedAtProperty || '')
          .setDisabled(!this.plugin.settings.useCustomChangedAtProperty)
          .onChange(this.createTextInputHandler('customChangedAtProperty'));
        return text;
      });
  }

  private createTextInputHandler(settingKey: keyof VoiceNotesPluginSettings) {
    return async (value: string) => {
      (this.plugin.settings as any)[settingKey] = value;
      await this.plugin.saveSettings();
    };
  }

  private createValidatedNumberInput(settingKey: keyof VoiceNotesPluginSettings, min: number) {
    return async (value: string) => {
      const numericValue = Number(value);
      const inputElement = document.activeElement as HTMLInputElement;

      if (isNaN(numericValue) || numericValue < min) {
        inputElement.style.backgroundColor = 'red';
        new Notice(`Please enter a number greater than or equal to ${min}`);
      } else {
        inputElement.style.backgroundColor = '';
        (this.plugin.settings as any)[settingKey] = numericValue;
        await this.plugin.saveSettings();
      }
    };
  }

  private createToggleHandler(settingKey: keyof VoiceNotesPluginSettings, afterChange?: () => Promise<void>) {
    return async (value: boolean) => {
      (this.plugin.settings as any)[settingKey] = value;
      await this.plugin.saveSettings();
      if (afterChange) {
        await afterChange();
      }
    };
  }

  /**
   * Creates a textarea with autoresize functionality
   */
  private createTextAreaWithAutoresize(
    text: TextAreaComponent,
    settingKey: keyof VoiceNotesPluginSettings,
    containerEl: HTMLElement
  ): TextAreaComponent {
    text
      .setPlaceholder((this.plugin.settings as any)[settingKey])
      .setValue((this.plugin.settings as any)[settingKey])
      .onChange(this.createTextInputHandler(settingKey));

    text.inputEl.classList.add('autoresize');
    autoResizeTextArea(text.inputEl);
    text.inputEl.addEventListener('input', () => autoResizeTextArea(text.inputEl));
    containerEl.appendChild(text.inputEl);

    return text;
  }

  private async handleLogin(): Promise<void> {
    this.plugin.settings.token = await this.vnApi.login({
      username: this.plugin.settings.username,
      password: this.password,
    });

    this.plugin.settings.password = null;
    if (this.plugin.settings.token) {
      new Notice('Login to voicenotes.com was successful');
      await this.plugin.saveSettings();
      this.plugin.setupAutoSync();
      await this.display();
    } else {
      new Notice('Login to voicenotes.com was unsuccessful');
    }
  }

  private async handleTokenLogin(): Promise<void> {
    this.vnApi.setToken(this.plugin.settings.token);
    const response = await this.vnApi.getUserInfo();
    this.plugin.settings.password = null;

    if (response) {
      new Notice('Login to voicenotes.com was successful');
      await this.plugin.saveSettings();
      this.plugin.setupAutoSync();
      await this.display();
    } else {
      new Notice('Login to voicenotes.com was unsuccessful');
    }
  }

  private async handleLogout(): Promise<void> {
    new Notice('Logged out of voicenotes.com');
    this.plugin.settings.token = null;
    this.plugin.settings.password = null;
    this.password = null;
    await this.plugin.saveSettings();
    await this.display();
  }

  private async handleQuickSync(): Promise<void> {
    new Notice('Performing manual synchronization of the last ten notes.');
    await this.plugin.sync();
    new Notice('Manual quick synchronization has completed.');
  }

  private async handleFullSync(): Promise<void> {
    new Notice('Performing manual synchronization of all notes.');
    this.plugin.syncedRecordingIds = [];
    await this.plugin.sync(true);
    new Notice('Manual full synchronization has completed.');
  }
}
