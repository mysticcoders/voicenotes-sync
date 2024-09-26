import { DataAdapter, requestUrl } from 'obsidian';
import { User, VoiceNoteRecordings, VoiceNoteSignedUrl } from './types';

const VOICENOTES_API_URL = 'https://api.voicenotes.com/api';

export default class VoiceNotesApi {
  token!: string;

  constructor(options: { token?: string }) {
    if (options.token) {
      this.token = options.token;
    }
  }

  setToken(token: string): void {
    this.token = token;
  }

  async login(options: { username?: string; password?: string }): Promise<string> {
    if (options.username && options.password) {
      const loginUrl = `${VOICENOTES_API_URL}/auth/login`;
      console.log(`loginUrl: ${loginUrl}`);

      const response = await requestUrl({
        url: loginUrl,
        method: 'POST',
        contentType: 'application/json',
        body: JSON.stringify({
          email: options.username,
          password: options.password,
        }),
      });

      if (response.status === 200) {
        this.token = response.json.authorisation.token;
        return this.token;
      }
      return null;
    }
    return null;
  }

  async getSignedUrl(recordingId: number): Promise<VoiceNoteSignedUrl> {
    if (this.token) {
      const data = await requestUrl({
        url: `${VOICENOTES_API_URL}/recordings/${recordingId}/signed-url`,
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });
      return data.json as VoiceNoteSignedUrl;
    }
    return null;
  }

  async downloadFile(fs: DataAdapter, url: string, outputLocationPath: string) {
    const response = await requestUrl({
      url,
    });
    const buffer = Buffer.from(response.arrayBuffer);

    await fs.writeBinary(outputLocationPath, buffer);
  }

  async deleteRecording(recordingId: number): Promise<boolean> {
    if (this.token) {
      const data = await requestUrl({
        url: `${VOICENOTES_API_URL}/recordings/${recordingId}`,
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
        method: 'DELETE',
      });

      return data.status === 200;
    }

    return false;
  }

  async getRecordingsFromLink(link: string): Promise<VoiceNoteRecordings> {
    if (this.token) {
      const data = await requestUrl({
        url: link,
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      return data.json as VoiceNoteRecordings;
    }
    return null;
  }

  async getRecordings(): Promise<VoiceNoteRecordings> {
    if (this.token) {
      try {
        const data = await requestUrl({
          url: `${VOICENOTES_API_URL}/recordings`,
          headers: {
            Authorization: `Bearer ${this.token}`,
          },
        });
        return data.json as VoiceNoteRecordings;
      } catch (error) {
        if (error.status === 401) {
          this.token = undefined;
          throw error; // rethrow so we can catch in caller
        }
      }
    }
    return null;
  }

  async getUserInfo(): Promise<User> {
    if (this.token) {
      try {
        const data = await requestUrl({
          url: `${VOICENOTES_API_URL}/auth/me`,
          headers: {
            Authorization: `Bearer ${this.token}`,
          },
        });
        return data.json;
      } catch (error) {
        console.error(error);
      }
    }
    return null;
  }
}
