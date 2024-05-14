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
import { sanitize } from 'sanitize-filename-ts';

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
	syncTimeout: 60
}

export default class VoiceNotesPlugin extends Plugin {
	settings: VoiceNotesPluginSettings;
	vnApi: VoiceNotesApi;
	fs: DataAdapter;
	syncInterval : number;
	timeSinceSync : number = 0;

	ONE_SECOND = 1000;

	constructor(app: App, manifest: PluginManifest) {
		super(app, manifest)
		this.fs = app.vault.adapter
	}

	async onload() {
		console.log('Loading Voice Notes plugin');
		window.clearInterval(this.syncInterval)

		await this.loadSettings();
		this.addSettingTab(new VoiceNotesSettingTab(this.app, this));

		await this.sync();
	}

	onunload() {
		window.clearInterval(this.syncInterval)
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

		if (!await this.fs.exists("voicenotes")) {
			await this.fs.mkdir("voicenotes")
		}

		const recordings = await this.vnApi.getRecordings()

		const voiceNotesDir = 'voicenotes'

		if (recordings) {
			for (const recording of recordings.data) {
				if (!recording.title) {
					new Notice(`Unable to grab voice recording with id: ${recording.id}`)
					continue
				}

				let title = recording.title
				title = sanitize(title)
				const recordingPath = `${voiceNotesDir}/${title}.md`

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

		window.clearInterval(this.syncInterval)
		this.syncInterval = window.setInterval(() => {
			this.timeSinceSync += this.ONE_SECOND

			if (this.timeSinceSync >= this.settings.syncTimeout * 60 * 1000) {
				this.timeSinceSync = 0
				this.sync()
			}
		}, this.ONE_SECOND)

	}
}

class VoiceNotesSettingTab extends PluginSettingTab {
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
						this.password = value;
						await this.plugin.saveSettings();
					}));

			new Setting(containerEl)
				.addButton(button => button
					.setButtonText("Login")
					.onClick(async (evt) => {
						console.log("Login button clicks")

						this.plugin.settings.token = await this.vnApi.login({
							username: this.plugin.settings.username,
							password: this.password
						})
						new Notice("Login to voicenotes.com was successful")
						this.plugin.settings.password = null
						await this.plugin.saveSettings()
						await this.display()
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
