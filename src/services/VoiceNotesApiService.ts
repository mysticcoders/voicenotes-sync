import { requestUrl } from 'obsidian';
import { ApiError, AuthenticationError, User, VoiceNoteRecordings, VoiceNoteSignedUrl } from '../types';
import { FileSystemService } from './FileSystemService';

const VOICENOTES_API_URL = 'https://api.voicenotes.com/api';

export class VoiceNotesApiService {
  private token?: string;

  constructor(token?: string) {
    this.token = token;
  }

  setToken(token: string): void {
    this.token = token;
  }

  getToken(): string | undefined {
    return this.token;
  }

  /**
   * Login to VoiceNotes API using username and password
   */
  async login(options: { username?: string; password?: string }): Promise<string> {
    if (!options.username || !options.password) {
      throw new AuthenticationError('Username and password are required');
    }

    try {
      const loginUrl = `${VOICENOTES_API_URL}/auth/login`;
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

      throw new ApiError('Login failed', response.status, response);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(error.message || 'Login failed', error.status, {
        text: error.message,
        json: error.json,
        headers: error.headers,
      });
    }
  }

  /**
   * Get a signed URL for a recording
   */
  async getSignedUrl(recordingId: number): Promise<VoiceNoteSignedUrl> {
    if (!this.token) {
      throw new AuthenticationError('No authentication token available');
    }

    try {
      const data = await requestUrl({
        url: `${VOICENOTES_API_URL}/recordings/${recordingId}/signed-url`,
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      return data.json as VoiceNoteSignedUrl;
    } catch (error) {
      this.handleApiError(error);
    }
  }

  /**
   * Download a file from a URL to a local path
   */
  async downloadFile(fileSystem: FileSystemService, url: string, outputPath: string): Promise<void> {
    try {
      const response = await requestUrl({ url });
      const buffer = Buffer.from(response.arrayBuffer);
      await fileSystem.writeBinary(outputPath, buffer);
    } catch (error) {
      throw new ApiError(`Failed to download file: ${error.message}`, error.status, error);
    }
  }

  /**
   * Delete a recording
   */
  async deleteRecording(recordingId: number): Promise<boolean> {
    if (!this.token) {
      throw new AuthenticationError('No authentication token available');
    }

    try {
      const data = await requestUrl({
        url: `${VOICENOTES_API_URL}/recordings/${recordingId}`,
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
        method: 'DELETE',
      });

      return data.status === 200;
    } catch (error) {
      this.handleApiError(error);
      return false;
    }
  }

  /**
   * Get recordings from a specific link (for pagination)
   */
  async getRecordingsFromLink(link: string): Promise<VoiceNoteRecordings> {
    if (!this.token) {
      throw new AuthenticationError('No authentication token available');
    }

    try {
      const data = await requestUrl({
        url: link,
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      return data.json as VoiceNoteRecordings;
    } catch (error) {
      this.handleApiError(error);
    }
  }

  /**
   * Get all recordings
   */
  async getRecordings(): Promise<VoiceNoteRecordings> {
    if (!this.token) {
      throw new AuthenticationError('No authentication token available');
    }

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
        throw new AuthenticationError('Invalid authentication token');
      }
      this.handleApiError(error);
    }
  }

  /**
   * Get user information
   */
  async getUserInfo(): Promise<User> {
    if (!this.token) {
      throw new AuthenticationError('No authentication token available');
    }

    try {
      const data = await requestUrl({
        url: `${VOICENOTES_API_URL}/auth/me`,
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });

      return data.json as User;
    } catch (error) {
      this.handleApiError(error);
    }
  }

  /**
   * Handle API errors
   */
  private handleApiError(error: any): never {
    if (error.status === 401) {
      this.token = undefined;
      throw new AuthenticationError('Invalid authentication token');
    }

    throw new ApiError(error.message || 'API request failed', error.status, {
      text: error.text,
      json: error.json,
      headers: error.headers,
    });
  }
}
