import {requestUrl} from "obsidian";
import {VoiceNoteRecordings} from "./types";

const VOICENOTES_API_URL = 'https://api.voicenotes.com/api'

export default class VoiceNotesApi {
    token!: string

    constructor(options: {token?: string}) {
        if (options.token) {
            this.token = options.token
        }
    }

    setToken(token: string): void {
        this.token = token
    }

    async login(options: { username?: string, password?: string }): Promise<string> {
        if (options.username && options.password) {
            const loginUrl = `${VOICENOTES_API_URL}/auth/login`
            console.log(`loginUrl: ${loginUrl}`)

            const response = await requestUrl({
                url: loginUrl,
                method: 'POST',
                contentType: 'application/json',
                body: JSON.stringify({
                    email: options.username,
                    password: options.password
                })
            })

            if (response.status === 200) {
                this.token = response.json.authorisation.token
                return this.token
            }
            return null
        }
        return null
    }

    async getRecordings(): Promise<VoiceNoteRecordings> {
        if (this.token) {
            const data = await requestUrl({
                url: `${VOICENOTES_API_URL}/recordings?page=1`, headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            })
            return data.json as VoiceNoteRecordings
        }
        return null
    }


    async getUserInfo(): Promise<any> {
        if (this.token) {
            const data = await requestUrl({
                url: `${VOICENOTES_API_URL}/auth/me`, headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            })
            return data.json
        }
        return null
    }
}