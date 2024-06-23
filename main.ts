import { App, DataAdapter, Editor, moment, normalizePath, Notice, Plugin, PluginManifest, TFile, } from 'obsidian';
import VoiceNotesApi from "./voicenotes-api";
import { capitalizeFirstLetter, isToday } from "./utils";
import { VoiceNoteEmail } from "./types";
import { sanitize } from 'sanitize-filename-ts';
import { VoiceNotesSettingTab } from "./settings";

declare global {
	interface Window {
		moment: typeof moment;
	}
}

interface VoiceNotesPluginSettings {
	token?: string;
	username?: string;
	password?: string;
	automaticSync: boolean;
	syncTimeout?: number;
	downloadAudio?: boolean;
	keepTodos: boolean;
	syncDirectory: string;
	deleteSynced: boolean;
	reallyDeleteSynced: boolean;
	todoTag: string;
	prependDateToTitle: boolean;
	prependDateFormat: string;
}

const DEFAULT_SETTINGS: VoiceNotesPluginSettings = {
	automaticSync: true,
	syncTimeout: 60,
	downloadAudio: false,
	keepTodos: true,
	syncDirectory: "voicenotes",
	deleteSynced: false,
	reallyDeleteSynced: false,
	todoTag: "",
	prependDateToTitle: false,
	prependDateFormat: "YYYY-MM-DD"
}

export default class VoiceNotesPlugin extends Plugin {
	settings: VoiceNotesPluginSettings;
	vnApi: VoiceNotesApi;
	fs: DataAdapter;
	syncInterval: number;
	timeSinceSync: number = 0;

	syncedRecordingIds: number[];

	ONE_SECOND = 1000;

	constructor(app: App, manifest: PluginManifest) {
		super(app, manifest)
		this.fs = app.vault.adapter
	}

	async onload() {
		window.clearInterval(this.syncInterval)

		await this.loadSettings();
		this.addSettingTab(new VoiceNotesSettingTab(this.app, this));


		this.addCommand({
			id: 'manual-sync-voicenotes',
			name: 'Manual Sync Voicenotes',
			callback: async () => await this.sync(false)
		})

		this.addCommand({
			id: 'insert-voicenotes-from-today',
			name: 'Insert Today\'s Voicenotes',
			editorCallback: async (editor: Editor) => {
				if (!this.settings.token) {
					new Notice('No access available, please login in plugin settings')
					return
				}

				const todaysRecordings = await this.getTodaysSyncedRecordings()

				if (todaysRecordings.length === 0) {
					new Notice("No recordings from today found")
					return
				}

				let listOfToday = todaysRecordings.map(filename => `- [[${filename}]]`).join('\n')
				editor.replaceSelection(listOfToday)
			}
		});

		this.registerEvent(this.app.metadataCache.on("deleted", (deletedFile, prevCache) => {
			if (prevCache.frontmatter?.recording_id) {
				this.syncedRecordingIds.remove(prevCache.frontmatter?.recording_id);
			}
		}));

		this.syncedRecordingIds = await this.getSyncedRecordingIds();
		await this.sync(this.syncedRecordingIds.length === 0);
	}

	onunload() {
		this.syncedRecordingIds = []
		window.clearInterval(this.syncInterval)
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async getRecordingIdFromFile(file: TFile): Promise<number | undefined> {
		return this.app.metadataCache.getFileCache(file)?.frontmatter?.['recording_id'];
	}

	async isRecordingFromToday(file: TFile): Promise<boolean> {
		return isToday(await this.app.metadataCache.getFileCache(file)?.frontmatter?.['created_at']);
	}

	sanitizedTitle(title: string, created_at: string): string {
		let generatedTitle = this.settings.prependDateToTitle ? `${moment(created_at).format(this.settings.prependDateFormat)} ${title}` : title
		return sanitize(generatedTitle)
	}

	/**
	 * Return the recording IDs that we've already synced
	 */
	async getSyncedRecordingIds(): Promise<number[]> {
		const { vault } = this.app;

		const markdownFiles = vault.getMarkdownFiles().filter(file => file.path.startsWith(this.settings.syncDirectory));

		return (await Promise.all(
			markdownFiles.map(async (file) => this.getRecordingIdFromFile(file))
		)).filter(recordingId => recordingId !== undefined) as number[];
	}

	async getTodaysSyncedRecordings(): Promise<string[]> {
		const { vault } = this.app;

		const markdownFiles = vault.getMarkdownFiles().filter(file => file.path.startsWith(this.settings.syncDirectory));

		return (await Promise.all(
			markdownFiles.map(async (file) => await this.isRecordingFromToday(file) ? file.basename : undefined)
		)).filter(filename => filename !== undefined) as string[];
	}

	async sync(fullSync: boolean = false) {
		console.debug(`Sync running full? ${fullSync}`)

		this.vnApi = new VoiceNotesApi({});
		this.vnApi.token = this.settings.token

		const voiceNotesDir = normalizePath(this.settings.syncDirectory)
		if (!await this.app.vault.adapter.exists(voiceNotesDir)) {
			new Notice("Creating sync directory for Voice Notes Sync plugin")
			await this.app.vault.createFolder(voiceNotesDir)
		}

		let recordings = await this.vnApi.getRecordings()

		if (fullSync && recordings.links.next) {
			let nextPage = recordings.links.next

			do {
				console.debug(`Performing a full sync ${nextPage}`)

				let moreRecordings = await this.vnApi.getRecordingsFromLink(nextPage)
				recordings.data.push(...moreRecordings.data);
				nextPage = moreRecordings.links.next;
			} while (nextPage)
		}

		// console.dir(recordings)
		if (recordings) {
			new Notice(`Syncing latest Voicenotes`)
			for (const recording of recordings.data) {
				if (!recording.title) {
					new Notice(`Unable to grab voice recording with id: ${recording.id}`)
					continue
				}

				// If we've already synced it locally let's not do it again
				if (this.syncedRecordingIds.includes(recording.recording_id)) {
					continue;
				}

				const title = this.sanitizedTitle(recording.title, recording.created_at)
				const recordingPath = normalizePath(`${voiceNotesDir}/${title}.md`)

				// Read file if it exists
				let existingContent = "";
				if (await this.app.vault.adapter.exists(recordingPath)) {
					existingContent = await this.app.vault.read(this.app.vault.getFileByPath(recordingPath));
				}

				let note = '---\n'
				note += `recording_id: ${recording.recording_id}\n`
				note += `duration: ${recording.duration}\n`
				note += `created_at: ${recording.created_at}\n`
				note += `updated_at: ${recording.updated_at}\n`

				if (recording.tags.length > 0) {
					note += `tags: ${recording.tags.map(tag => tag.name).join(",")}\n`
				}
				note += '---\n'

				if (this.settings.downloadAudio) {
					const audioPath = normalizePath(`${voiceNotesDir}/audio`)

					if (!await this.app.vault.adapter.exists(audioPath)) {
						await this.app.vault.createFolder(audioPath)
					}
					const outputLocationPath = normalizePath(`${audioPath}/${recording.recording_id}.mp3`);

					if (!await this.app.vault.adapter.exists(outputLocationPath)) {
						// Get unique audio download URL and download file to disk
						const signedUrl = await this.vnApi.getSignedUrl(recording.recording_id)
						await this.vnApi.downloadFile(this.fs, signedUrl.url, outputLocationPath);
					}

					note += `![[${recording.recording_id}.mp3]]\n\n`
					note += '# Transcript\n'
				}
				note += recording.transcript
				note += '\n'
				for (const creation of recording.creations) {
					note += `## ${capitalizeFirstLetter(creation.type)}\n`

					if (creation.type === 'email') {
						const creationData = creation.content.data as VoiceNoteEmail
						note += `**Subject:** ${creationData.subject}\n\n`
						note += `${creationData.body}\n`
					} else if (creation.type === 'todo') {
						if (existingContent.includes("## Todo") && this.settings.keepTodos) {
							const todos = existingContent.match(/## Todo\s*([\s\S]*?)(?=\n##|$)/)[1].trim() + '\n';
							note += todos;
						} else {
							const creationData = creation.content.data;
							if (Array.isArray(creationData)) {
								note += creationData.map(data => `- [ ] ${data}${this.settings.todoTag ? ' #' + this.settings.todoTag : ''}`).join('\n');
							}
						}
					} else if (creation.type !== 'tweet' && creation.type !== 'summary') {
						const creationData = creation.content.data as string[]

						if (Array.isArray(creationData)) {
							note += creationData.map(data => `- ${data}`).join('\n')
						}

						note += '\n'
					} else {
						const creationData = creation.content.data as string
						note += creationData
						note += '\n'
					}
				}

				if (recording.related_notes.length > 0) {
					note += '\n## Related Notes\n'
					note += recording.related_notes.map(relatedNote => `- [[${this.sanitizedTitle(relatedNote.title, relatedNote.created_at)}]]`).join('\n')
				}
				console.debug(`Writing ${recording.recording_id} to ${recordingPath}`)

				if (await this.app.vault.adapter.exists(recordingPath)) {
					await this.app.vault.modify(this.app.vault.getFileByPath(recordingPath), note)
				} else {
					await this.app.vault.create(recordingPath, note)
				}

				this.syncedRecordingIds.push(recording.recording_id)

				// DESTRUCTIVE action which will delete all synced recordings from server if turned on
				// We ask twice to make sure user is doubly sure
				if (this.settings.deleteSynced && this.settings.reallyDeleteSynced) {
					await this.vnApi.deleteRecording(recording.recording_id)
				}
			}
		}

		window.clearInterval(this.syncInterval)

		if (this.settings.automaticSync) {
			console.debug(`timeSinceSync ${this.timeSinceSync} - syncTimeout: ${this.settings.syncTimeout}`)
			this.syncInterval = window.setInterval(() => {
				this.timeSinceSync += this.ONE_SECOND

				if (this.timeSinceSync >= this.settings.syncTimeout * 60 * 1000) {
					this.timeSinceSync = 0
					this.sync()
				}
			}, this.ONE_SECOND)
		}

	}
}

