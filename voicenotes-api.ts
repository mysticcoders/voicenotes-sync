import {requestUrl} from "obsidian";
import {OuraActivityEntries, OuraReadinessEntries, OuraSleepEntries, OuraUserInfo, VoiceNoteRecordings} from "./types";

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
    // async getSleepData(theDate: string): Promise<OuraSleepEntries> {
    //     if (this.token) {
    //         const params = new URLSearchParams()
    //         const start = window.moment(theDate).subtract(1, 'days').format('YYYY-MM-DD')
    //         params.set('start_date', start)
    //         params.set('end_date', theDate)
    //         const data = await request({
    //             url: `${OURA_API_URL}/daily_sleep?${params.toString()}`, headers: {
    //                 'Authorization': `Bearer ${this.token}`
    //             }
    //         })
    //
    //         return JSON.parse(data) as OuraSleepEntries
    //     }
    //     return null
    // }
    //
    // async getRecordings(): Promise<String> {
    //
    // }
    //
    // async getActivityData(theDate: string): Promise<OuraActivityEntries> {
    //     if (this.token) {
    //         const params = new URLSearchParams()
    //         const start = window.moment(theDate).subtract(1, 'days').format('YYYY-MM-DD')
    //         params.set('start_date', start)
    //         params.set('end_date', theDate)
    //         const data = await request({
    //             url: `${OURA_API_URL}/daily_activity?${params.toString()}`, headers: {
    //                 'Authorization': `Bearer ${this.token}`
    //             }
    //         })
    //
    //         return JSON.parse(data) as OuraActivityEntries
    //     }
    //     return null
    // }
    //
    // async getReadinessData(theDate: string): Promise<OuraReadinessEntries> {
    //     if (this.token) {
    //         const params = new URLSearchParams()
    //         const start = window.moment(theDate).subtract(1, 'days').format('YYYY-MM-DD')
    //         params.set('start_date', start)
    //         params.set('end_date', theDate)
    //         const data = await request({
    //             url: `${OURA_API_URL}/daily_readiness?${params.toString()}`, headers: {
    //                 'Authorization': `Bearer ${this.token}`
    //             }
    //         })
    //
    //         return JSON.parse(data) as OuraReadinessEntries
    //     }
    //     return null
    // }
    //

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