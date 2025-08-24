import { DataAdapter, requestUrl, RequestUrlParam, RequestUrlResponse } from 'obsidian';
import { User, VoiceNoteRecordings, VoiceNoteSignedUrl } from '../types';

const VOICENOTES_API_URL = 'https://api.voicenotes.com/api';

export default class VoiceNotesApi {
  private token?: string;

  constructor(options: { token?: string } = {}) {
    if (options.token) {
      this.token = options.token;
    }
  }

  setToken(token: string | undefined | null): void {
    this.token = token || undefined;
  }

  /**
   * Validates if a token exists and is non-empty
   */
  private hasValidToken(): boolean {
    return !!(this.token && this.token.trim().length > 0);
  }

  /**
   * Builds the full API URL from an endpoint
   */
  private buildUrl(endpoint: string): string {
    // Handle full URLs (for pagination links that come back from API)
    if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
      return endpoint;
    }
    // Ensure endpoint starts with /
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${VOICENOTES_API_URL}${cleanEndpoint}`;
  }

  /**
   * Makes an authenticated request with consistent error handling
   */
  private async makeAuthenticatedRequest(
    endpoint: string,
    options: Partial<RequestUrlParam> = {}
  ): Promise<RequestUrlResponse> {
    if (!this.hasValidToken()) {
      throw new Error('No valid authentication token');
    }

    const url = this.buildUrl(endpoint);

    try {
      return await requestUrl({
        url,
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${this.token}`,
        },
      });
    } catch (error: any) {
      if (error.status === 401) {
        this.token = undefined;
        throw {
          ...error,
          message: 'Authentication failed - token invalid or expired',
        };
      }
      throw error;
    }
  }

  async login(options: { username?: string; password?: string }): Promise<string | null> {
    if (!options.username || !options.password) {
      return null;
    }

    console.log(`Logging in to VoiceNotes API`);

    try {
      const response = await requestUrl({
        url: this.buildUrl('/auth/login'),
        method: 'POST',
        contentType: 'application/json',
        body: JSON.stringify({
          email: options.username,
          password: options.password,
        }),
      });

      if (response.status === 200 && response.json?.authorisation?.token) {
        this.token = response.json.authorisation.token;
        return this.token;
      }
    } catch (error) {
      console.error('Login failed:', error);
    }

    return null;
  }

  async getSignedUrl(recordingId: number): Promise<VoiceNoteSignedUrl | null> {
    if (!this.hasValidToken()) {
      return null;
    }

    try {
      const data = await this.makeAuthenticatedRequest(`/recordings/${recordingId}/signed-url`);
      return data.json as VoiceNoteSignedUrl;
    } catch (error) {
      console.error('Failed to get signed URL:', error);
      throw error;
    }
  }

  async downloadFile(fs: DataAdapter, url: string, outputLocationPath: string): Promise<void> {
    try {
      const response = await requestUrl({ url });
      const buffer = Buffer.from(response.arrayBuffer);
      await fs.writeBinary(outputLocationPath, buffer);
    } catch (error) {
      console.error('Failed to download file:', error);
      throw error;
    }
  }

  async deleteRecording(recordingId: number): Promise<boolean> {
    if (!this.hasValidToken()) {
      return false;
    }

    try {
      const data = await this.makeAuthenticatedRequest(`/recordings/${recordingId}`, {
        method: 'DELETE',
      });
      return data.status === 200;
    } catch (error) {
      console.error('Failed to delete recording:', error);
      return false;
    }
  }

  async getRecordingsFromLink(link: string): Promise<VoiceNoteRecordings | null> {
    if (!this.hasValidToken()) {
      return null;
    }

    try {
      // This uses the full link URL (for pagination)
      const data = await this.makeAuthenticatedRequest(link);
      return data.json as VoiceNoteRecordings;
    } catch (error) {
      console.error('Failed to get recordings from link:', error);
      throw error;
    }
  }

  async getRecordings(): Promise<VoiceNoteRecordings | null> {
    if (!this.hasValidToken()) {
      return null;
    }

    try {
      const data = await this.makeAuthenticatedRequest('/recordings');
      return data.json as VoiceNoteRecordings;
    } catch (error) {
      console.error('Failed to get recordings:', error);
      throw error;
    }
  }

  async getUserInfo(): Promise<User | null> {
    if (!this.hasValidToken()) {
      return null;
    }

    try {
      const data = await this.makeAuthenticatedRequest('/auth/me');
      return data.json as User;
    } catch (error) {
      console.error('Failed to get user info:', error);
      // Don't throw here as this is used to check if token is valid
      return null;
    }
  }
}
