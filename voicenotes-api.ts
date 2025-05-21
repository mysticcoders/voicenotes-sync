import { DataAdapter, requestUrl, RequestUrlParam } from 'obsidian';
import { User, VoiceNoteRecordings, VoiceNoteSignedUrl } from './types';

const VOICENOTES_API_URL = 'https://api.voicenotes.com/api';

export default class VoiceNotesApi {
  token?: string;
  username?: string;
  password?: string;

  constructor(options: { token?: string; username?: string; password?: string }) {
    if (options.token) {
      this.token = options.token;
    }
    if (options.username) {
      this.username = options.username;
    }
    if (options.password) {
      this.password = options.password;
    }
  }

  setToken(token?: string): void {
    this.token = token;
  }

  setCredentials(username?: string, password?: string): void {
    this.username = username;
    this.password = password;
  }

  async login(options: { username?: string; password?: string }): Promise<string | null> {
    const username = options.username || this.username;
    const password = options.password || this.password;

    if (username && password) {
      const loginUrl = `${VOICENOTES_API_URL}/auth/login`;
      console.log(`loginUrl: ${loginUrl}`);

      try {
        const response = await requestUrl({
          url: loginUrl,
          method: 'POST',
          contentType: 'application/json',
          body: JSON.stringify({
            email: username,
            password: password,
          }),
        });

        if (response.status === 200) {
          this.token = response.json.authorisation.token;
          // Securely store/update credentials if needed, or ensure they are passed for re-login
          this.username = username;
          // Password should ideally not be stored long-term here directly
          // For re-login, it's passed or retrieved securely
          return this.token;
        }
      } catch (error) {
        console.error('Login failed:', error);
        return null;
      }
    }
    return null;
  }

  private async _requestWithRetry<T>(requestParams: RequestUrlParam, attemptRelogin = true): Promise<T> {
    if (!this.token && attemptRelogin) { // If no token, try to login first
      if (this.username && this.password) {
        console.log('No token found, attempting to login before request.');
        await this.login({}); // Attempt login with stored credentials
        if (!this.token) {
          console.error('Failed to login before request.');
          throw new Error('Authentication required and login failed.');
        }
      } else {
        console.error('Authentication required, but no credentials available for login.');
        throw new Error('Authentication required, credentials not available.');
      }
    }

    const paramsWithAuth = { ...requestParams };
    if (this.token) {
      paramsWithAuth.headers = {
        ...paramsWithAuth.headers,
        Authorization: `Bearer ${this.token}`,
      };
    }

    try {
      const response = await requestUrl(paramsWithAuth);
      return response.json as T;
    } catch (error: any) {
      if (error.status === 401 && attemptRelogin) {
        console.log('Request failed with 401, attempting re-login.');
        if (this.username && this.password) {
          const newToken = await this.login({ username: this.username, password: this.password });
          if (newToken) {
            console.log('Re-login successful, retrying original request.');
            const retriedParamsWithAuth = { ...requestParams };
            retriedParamsWithAuth.headers = {
              ...retriedParamsWithAuth.headers,
              Authorization: `Bearer ${this.token}`,
            };
            const retryResponse = await requestUrl(retriedParamsWithAuth);
            return retryResponse.json as T;
          } else {
            console.error('Re-login failed.');
            this.token = undefined;
            throw error;
          }
        } else {
          console.warn('Cannot attempt re-login: username or password not available.');
          this.token = undefined;
          throw error;
        }
      } else if (error.status === 429) {
        let retryAfterSeconds = 5; // Default value
        if (error.headers) {
          const retryAfterHeader = error.headers['retry-after'] || error.headers['Retry-After'];
          if (retryAfterHeader) {
            retryAfterSeconds = parseInt(retryAfterHeader) || 5;
          }
        }
        console.warn(`Rate limited by Voicenotes API. Retrying request to ${paramsWithAuth.url} in ${retryAfterSeconds} seconds. Headers: ${JSON.stringify(error.headers)}`);
        await new Promise(resolve => setTimeout(resolve, retryAfterSeconds * 1000));
        console.log(`Retrying request to ${paramsWithAuth.url} after rate limit delay.`);
        return this._requestWithRetry<T>(requestParams, false);
      } else {
        throw error;
      }
    }
  }

  async getSignedUrl(recordingId: number): Promise<VoiceNoteSignedUrl | null> {
    return this._requestWithRetry<VoiceNoteSignedUrl>({
      url: `${VOICENOTES_API_URL}/recordings/${recordingId}/signed-url`,
    });
  }

  async downloadFile(fs: DataAdapter, url: string, outputLocationPath: string) {
    // This request doesn't need auth usually, but if it starts to, it would need _requestWithRetry too
    const response = await requestUrl({
      url,
    });
    const buffer = Buffer.from(response.arrayBuffer);
    await fs.writeBinary(outputLocationPath, buffer);
  }

  async deleteRecording(recordingId: number): Promise<boolean> {
    try {
      await this._requestWithRetry<any>({ // The response might not be JSON / can be empty
        url: `${VOICENOTES_API_URL}/recordings/${recordingId}`,
        method: 'DELETE',
      }, true); // attemptRelogin = true
      return true; // If request succeeds (or retries successfully), assume deletion was successful
    } catch (error) {
      console.error(`Failed to delete recording ${recordingId}:`, error);
      return false;
    }
  }

  async getRecordingsFromLink(link: string): Promise<VoiceNoteRecordings | null> {
    return this._requestWithRetry<VoiceNoteRecordings>({
      url: link,
    });
  }

  async getRecordings(): Promise<VoiceNoteRecordings | null> {
    return this._requestWithRetry<VoiceNoteRecordings>({
      url: `${VOICENOTES_API_URL}/recordings`,
    });
  }

  async getUserInfo(): Promise<User | null> {
    return this._requestWithRetry<User>({
      url: `${VOICENOTES_API_URL}/auth/me`,
    });
  }
}
