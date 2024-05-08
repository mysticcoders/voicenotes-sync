import {
	App,
	Editor,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	MarkdownView,
	PluginManifest,
	DataAdapter
} from 'obsidian';
import type moment from "moment"
import numeral from 'numeral'
import VoiceNotesApi from "./voicenotes-api";
import {capitalizeFirstLetter} from "./utils";
import {VoiceNoteData, VoiceNoteEmail} from "./types";

declare global {
	interface Window {
		moment: typeof moment;
	}
}

interface VoiceNotesPluginSettings {
	token?: string;
	username?: string;
	password?: string;
	syncTimeout?: number;
}

const DEFAULT_SETTINGS: VoiceNotesPluginSettings = {
	syncTimeout: 30
}

export default class VoiceNotesPlugin extends Plugin {
	settings: VoiceNotesPluginSettings;
	vnApi: VoiceNotesApi;
	fs: DataAdapter;

	constructor(app: App, manifest: PluginManifest) {
		super(app, manifest)
		this.fs = app.vault.adapter
	}

	async onload() {
		console.log('Loading Voice Notes plugin');

		await this.loadSettings();
		this.addSettingTab(new VoiceNotesSettingTab(this.app, this));

		await this.sync();
	}

	onunload() {
		console.log('unloading Voice Notes plugin');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async sync() {
		this.vnApi = new VoiceNotesApi({});
		this.vnApi.token = this.settings.token

		if (!this.fs.exists("voicenotes")) {
			this.fs.mkdir("voicenotes")
		}

		const recordings = await this.vnApi.getRecordings()

		const voiceNotesDir = 'voicenotes'

		if (recordings) {
			for (const recording of recordings.data) {
				if (!recording.title) {
					new Notice(`Unable to grab voice recording with id: ${recording.id}`)
					continue
				}
				const recordingPath = `${voiceNotesDir}/${recording.title}.md`

				// if (this.fs.exists(recordingPath)) {
				// 	// TODO this should probably check the updated_at and we should save this in metadata too
				// 	console.log(`${recordingPath} already synced, moving on`)
				// }

				console.log(`Recording Path: ${recordingPath}`)

				let note = '---\n'
				note += `duration: ${recording.duration}\n`
        note += `created_at: ${recording.created_at}\n`
        note += `updated_at: ${recording.updated_at}\n`
				note += '---\n'

				note += recording.transcript
				note += '\n'
				for (const creation of recording.creations) {
					note += `## ${capitalizeFirstLetter(creation.type)}\n`

					if (creation.type === 'email') {
						const creationData = creation.content.data as VoiceNoteEmail
						note += `**Subject:** ${creationData.subject}\n\n`
						note += `${creationData.body}\n`
					} else if (creation.type !== 'tweet') {
						const creationData = creation.content.data as string[]

						if (Array.isArray(creationData)) {
							note += "- "
							note += creationData.join("\n- ")
						}
					} else {
						const creationData = creation.content.data as string
						note += creationData
						note += '\n'
					}
				}
				await this.fs.write(recordingPath, note)
			}
		}
	}
}

class VoiceNotesSettingTab extends PluginSettingTab {
	plugin: VoiceNotesPlugin;
	vnApi: VoiceNotesApi;

	constructor(app: App, plugin: VoiceNotesPlugin) {
		super(app, plugin);
		this.plugin = plugin;
		this.vnApi = new VoiceNotesApi({});
	}

	async display(): Promise<void> {
		let { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Voice Notes Settings'});

		if (!this.plugin.settings.token) {
			new Setting(containerEl)
				.setName('Username')
				.addText(text => text
					.setPlaceholder('Email Address')
					.setValue(this.plugin.settings.username)
					.onChange(async (value) => {
						this.plugin.settings.username = value;
						await this.plugin.saveSettings();
					}));
			new Setting(containerEl)
				.setName('Password')
				.addText(text => text
					.setPlaceholder('Password')
					.setValue(this.plugin.settings.password)
					.onChange(async (value) => {
						this.plugin.settings.password = value;
						await this.plugin.saveSettings();
					}));

			new Setting(containerEl)
				.addButton(button => button
					.setButtonText("Login")
					.onClick(async (evt) => {
						console.log("Login button clicks")

						this.plugin.settings.token = await this.vnApi.login({
							username: this.plugin.settings.username,
							password: this.plugin.settings.password
						})
						await this.plugin.saveSettings()
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

						this.plugin.settings.token = null
						await this.plugin.saveSettings()
					})
				)

			new Setting(containerEl)
				.addButton(button => button
					.setButtonText("Manual Sync")
					.onClick(async (evt) => {

						await this.plugin.sync();
					})
				)

		}

		new Setting(containerEl)
			.setName("Sync Every")
			.setDesc("Number of minutes between syncing with VoiceNotes.com servers")
			.addText(text => text
				.setPlaceholder("30")
				.setValue(`${this.plugin.settings.syncTimeout}`)
				.onChange(async (value) => {
					this.plugin.settings.syncTimeout = Number(value);
					await this.plugin.saveSettings();
				})
			)

	}
}
