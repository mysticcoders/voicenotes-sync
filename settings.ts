import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import VoiceNotesApi from "./voicenotes-api";
import VoiceNotesPlugin from "./main";

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
    let { containerEl } = this;

    containerEl.empty();

    if (!this.plugin.settings.token) {
      new Setting(containerEl)
        .setName('Username')
        .addText(text => text
          .setPlaceholder('Email address')
          .setValue(this.plugin.settings.username)
          .onChange(async (value) => {
            this.plugin.settings.username = value;
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl)
        .setName('Password')
        .addText(text => {
          text
            .setPlaceholder('Password')
            .setValue(this.plugin.settings.password)
            .onChange(async (value) => {
              this.password = value;
              await this.plugin.saveSettings();
            })
          text.inputEl.type = 'password'
          return text;
        });

      new Setting(containerEl)
        .addButton(button => button
          .setButtonText("Login")
          .onClick(async (evt) => {
            this.plugin.settings.token = await this.vnApi.login({
              username: this.plugin.settings.username,
              password: this.password
            })

            this.plugin.settings.password = null
            if (this.plugin.settings.token) {
              new Notice("Login to voicenotes.com was successful")
              await this.plugin.saveSettings()
              await this.display()
            } else {
              new Notice("Login to voicenotes.com was unsuccessful")
            }
          })
        )

      new Setting(containerEl)
        .setName('Auth Token')
        .addText(text => text
          .setPlaceholder('12345|abcdefghijklmnopqrstuvwxyz')
          .setValue(this.plugin.settings.token)
          .onChange(async (value) => {
            this.plugin.settings.token = value;
            await this.plugin.saveSettings();
          }));
      new Setting(containerEl)
        .addButton(button => button
          .setButtonText("Login with token")
          .onClick(async (evt) => {
            this.vnApi.setToken(this.plugin.settings.token)
            const response = await this.vnApi.getUserInfo()
            this.plugin.settings.password = null

            if (response) {
              new Notice("Login to voicenotes.com was successful")
              await this.plugin.saveSettings()
              await this.display()
            } else {
              new Notice("Login to voicenotes.com was unsuccessful")
            }
          })
        )
    }
    if (this.plugin.settings.token) {
      this.vnApi.setToken(this.plugin.settings.token)

      const userInfo = await this.vnApi.getUserInfo()

      new Setting(containerEl)
        .setName("Name")
        .addText(text => text
          .setPlaceholder(userInfo.name)
          .setDisabled(true)
        )
      new Setting(containerEl)
        .setName("Email")
        .addText(text => text
          .setPlaceholder(userInfo.email)
          .setDisabled(true)
        )
      new Setting(containerEl)
        .addButton(button => button
          .setButtonText("Logout")
          .onClick(async (evt) => {
            new Notice("Logged out of voicenotes.com")
            this.plugin.settings.token = null
            this.plugin.settings.password = null
            this.password = null
            await this.plugin.saveSettings()
            await this.display()
          })
        )

      new Setting(containerEl)
        .setName("Force Sync")
        .setDesc("Manual synchronization -- only use the overwrite manual sync if you're ok with overwriting already synced notes")
        .addButton(button => button
          .setButtonText("Manual sync")
          .onClick(async (evt) => {
            new Notice("Performing manual synchronization without overwriting existing work.")
            await this.plugin.sync();
            new Notice("Manual synchronization has completed.")
          })
        )
        .addButton(button => button
          .setButtonText("Manual sync (overwrite)")
          .onClick(async (evt) => {
            // Upon a manual sync we are going to forget about existing data so we can sync all again
            new Notice("Performing manual synchronization and overwriting all notes.")
            this.plugin.syncedRecordingIds = [];
            await this.plugin.sync(true);
            new Notice("Manual synchronization with overwrite has completed.")
          })
        )

    }

    new Setting(containerEl)
      .setName("Automatic sync every")
      .setDesc("Number of minutes between syncing with VoiceNotes.com servers (uncheck to sync manually)")
      .addText(text => {
        text
          .setDisabled(!this.plugin.settings.automaticSync)
          .setPlaceholder("30")
          .setValue(`${this.plugin.settings.syncTimeout}`)
          .onChange(async (value) => {
            this.plugin.settings.syncTimeout = Number(value);
            await this.plugin.saveSettings();
          })
        text.inputEl.type = 'number'
        return text;
      }
      )
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.automaticSync)
        .onChange(async (value) => {
          this.plugin.settings.automaticSync = value;
          // If we've turned on automatic sync again, let's re-sync right away
          if (value) {
            await this.plugin.sync(false)
          }
          await this.plugin.saveSettings();
          await this.display()
        })
      )

    new Setting(containerEl)
      .setName("Sync directory")
      .setDesc("Directory to sync voice notes")
      .addText(text => text
        .setPlaceholder("voicenotes")
        .setValue(`${this.plugin.settings.syncDirectory}`)
        .onChange(async (value) => {
          this.plugin.settings.syncDirectory = value;
          await this.plugin.saveSettings();
        })
      )

    new Setting(containerEl)
      .setName("Add a tag to todos")
      .setDesc("When syncing a note add an optional tag to the todo")
      .addText(text => text
        .setPlaceholder("TODO")
        .setValue(this.plugin.settings.todoTag)
        .onChange(async (value) => {
          this.plugin.settings.todoTag = value;
          await this.plugin.saveSettings();
        })
      )

    new Setting(containerEl)
      .setName("Download audio")
      .setDesc("Store and download the audio associated with the transcript")
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.downloadAudio)
        .onChange(async (value) => {
          this.plugin.settings.downloadAudio = Boolean(value);
          await this.plugin.saveSettings();
        })
      )

    new Setting(containerEl)
      .setName("Replace transcript with tidy version")
      .setDesc("If a tidy version of the transcript is available, replace the transcript with it")
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.replaceTranscriptWithTidy)
        .onChange(async (value) => {
          this.plugin.settings.replaceTranscriptWithTidy = Boolean(value);
          await this.plugin.saveSettings();
        })
      )

    new Setting(containerEl)
      .setName("Prepend Date to Note Title")
      .setDesc("Adding the dates to the file names of all synced notes")
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.prependDateToTitle)
        .onChange(async (value) => {
          this.plugin.settings.prependDateToTitle = value;
          await this.plugin.saveSettings();
        })
      )

    new Setting(containerEl)
      .setName("Delete synced recordings")
      .setDesc("DESTRUCTIVE action which after syncing the note locally will delete it from the voicenotes.com server.")
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.deleteSynced)
        .onChange(async (value) => {
          this.plugin.settings.deleteSynced = value;

          if (!value) {
            this.plugin.settings.reallyDeleteSynced = false;
          }

          await this.plugin.saveSettings();
          await this.display()
        })
      )

    if (this.plugin.settings.deleteSynced) {
      new Setting(containerEl)
        .setName("REALLY delete synced recordings")
        .setDesc("We want you to be sufficiently clear that this will delete anything on voicenotes.com")
        .addToggle(toggle => toggle
          .setValue(this.plugin.settings.reallyDeleteSynced)
          .onChange(async (value) => {
            this.plugin.settings.reallyDeleteSynced = Boolean(value);
            await this.plugin.saveSettings();
          })
        )
    }
  }
}