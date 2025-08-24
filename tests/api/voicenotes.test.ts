import { requestUrl, DataAdapter } from 'obsidian';
import VoiceNotesApi from '../../src/api/voicenotes';
import { User, VoiceNoteRecordings, VoiceNoteSignedUrl } from '../../src/types';

// Mock obsidian module
jest.mock('obsidian');

describe('VoiceNotesApi', () => {
  let api: VoiceNotesApi;
  const mockRequestUrl = requestUrl as jest.MockedFunction<typeof requestUrl>;

  beforeEach(() => {
    jest.clearAllMocks();
    api = new VoiceNotesApi();
  });

  describe('constructor and token management', () => {
    it('should initialize without a token', () => {
      const api = new VoiceNotesApi();
      expect(api['token']).toBeUndefined();
    });

    it('should initialize with a token', () => {
      const api = new VoiceNotesApi({ token: 'test-token' });
      expect(api['token']).toBe('test-token');
    });

    it('should set token via setToken method', () => {
      api.setToken('new-token');
      expect(api['token']).toBe('new-token');
    });

    it('should clear token when null is passed', () => {
      api.setToken('token');
      api.setToken(null);
      expect(api['token']).toBeUndefined();
    });

    it('should validate token correctly', () => {
      expect(api['hasValidToken']()).toBe(false);
      
      api.setToken('valid-token');
      expect(api['hasValidToken']()).toBe(true);
      
      api.setToken('   ');
      expect(api['hasValidToken']()).toBe(false);
    });
  });

  describe('buildUrl', () => {
    it('should build correct URL for relative endpoints', () => {
      expect(api['buildUrl']('/recordings')).toBe('https://api.voicenotes.com/api/recordings');
      expect(api['buildUrl']('recordings')).toBe('https://api.voicenotes.com/api/recordings');
    });

    it('should preserve full URLs', () => {
      const fullUrl = 'https://api.voicenotes.com/api/recordings?page=2';
      expect(api['buildUrl'](fullUrl)).toBe(fullUrl);
    });

    it('should handle http URLs', () => {
      const httpUrl = 'http://api.voicenotes.com/api/recordings';
      expect(api['buildUrl'](httpUrl)).toBe(httpUrl);
    });
  });

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      const mockToken = 'auth-token-123';
      mockRequestUrl.mockResolvedValueOnce({
        status: 200,
        json: {
          authorisation: {
            token: mockToken,
          },
        },
        headers: {},
        arrayBuffer: new ArrayBuffer(0),
        text: '',
      });

      const result = await api.login({
        username: 'test@example.com',
        password: 'password123',
      });

      expect(result).toBe(mockToken);
      expect(api['token']).toBe(mockToken);
      expect(mockRequestUrl).toHaveBeenCalledWith({
        url: 'https://api.voicenotes.com/api/auth/login',
        method: 'POST',
        contentType: 'application/json',
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password123',
        }),
      });
    });

    it('should return null with invalid credentials', async () => {
      mockRequestUrl.mockResolvedValueOnce({
        status: 401,
        json: { error: 'Invalid credentials' },
        headers: {},
        arrayBuffer: new ArrayBuffer(0),
        text: '',
      });

      const result = await api.login({
        username: 'test@example.com',
        password: 'wrong-password',
      });

      expect(result).toBeNull();
      expect(api['token']).toBeUndefined();
    });

    it('should return null when missing credentials', async () => {
      const result = await api.login({});
      expect(result).toBeNull();
      expect(mockRequestUrl).not.toHaveBeenCalled();
    });

    it('should handle network errors gracefully', async () => {
      mockRequestUrl.mockRejectedValueOnce(new Error('Network error'));

      const result = await api.login({
        username: 'test@example.com',
        password: 'password123',
      });

      expect(result).toBeNull();
    });
  });

  describe('makeAuthenticatedRequest', () => {
    beforeEach(() => {
      api.setToken('valid-token');
    });

    it('should add authorization header to requests', async () => {
      mockRequestUrl.mockResolvedValueOnce({
        status: 200,
        json: { data: 'test' },
        headers: {},
        arrayBuffer: new ArrayBuffer(0),
        text: '',
      });

      await api['makeAuthenticatedRequest']('/test');

      expect(mockRequestUrl).toHaveBeenCalledWith({
        url: 'https://api.voicenotes.com/api/test',
        headers: {
          Authorization: 'Bearer valid-token',
        },
      });
    });

    it('should throw error when no token is present', async () => {
      api.setToken(null);

      await expect(api['makeAuthenticatedRequest']('/test')).rejects.toThrow(
        'No valid authentication token'
      );
    });

    it('should clear token on 401 response', async () => {
      mockRequestUrl.mockRejectedValueOnce({
        status: 401,
        message: 'Unauthorized',
      });

      await expect(api['makeAuthenticatedRequest']('/test')).rejects.toMatchObject({
        status: 401,
        message: 'Authentication failed - token invalid or expired',
      });

      expect(api['token']).toBeUndefined();
    });

    it('should pass through other errors', async () => {
      const error = new Error('Network error');
      mockRequestUrl.mockRejectedValueOnce(error);

      await expect(api['makeAuthenticatedRequest']('/test')).rejects.toThrow(error);
      expect(api['token']).toBe('valid-token'); // Token should not be cleared
    });
  });

  describe('getRecordings', () => {
    it('should fetch recordings successfully', async () => {
      api.setToken('valid-token');
      const mockRecordings: VoiceNoteRecordings = {
        data: [{ id: 1, title: 'Test Recording' }],
        links: { next: null },
        json: {},
      };

      mockRequestUrl.mockResolvedValueOnce({
        status: 200,
        json: mockRecordings,
        headers: {},
        arrayBuffer: new ArrayBuffer(0),
        text: '',
      });

      const result = await api.getRecordings();

      expect(result).toEqual(mockRecordings);
      expect(mockRequestUrl).toHaveBeenCalledWith({
        url: 'https://api.voicenotes.com/api/recordings',
        headers: {
          Authorization: 'Bearer valid-token',
        },
      });
    });

    it('should return null when no token', async () => {
      const result = await api.getRecordings();
      expect(result).toBeNull();
      expect(mockRequestUrl).not.toHaveBeenCalled();
    });

    it('should handle errors and throw', async () => {
      api.setToken('valid-token');
      mockRequestUrl.mockRejectedValueOnce(new Error('API Error'));

      await expect(api.getRecordings()).rejects.toThrow('API Error');
    });
  });

  describe('getSignedUrl', () => {
    it('should fetch signed URL successfully', async () => {
      api.setToken('valid-token');
      const mockSignedUrl: VoiceNoteSignedUrl = {
        url: 'https://signed-url.example.com',
      };

      mockRequestUrl.mockResolvedValueOnce({
        status: 200,
        json: mockSignedUrl,
        headers: {},
        arrayBuffer: new ArrayBuffer(0),
        text: '',
      });

      const result = await api.getSignedUrl(123);

      expect(result).toEqual(mockSignedUrl);
      expect(mockRequestUrl).toHaveBeenCalledWith({
        url: 'https://api.voicenotes.com/api/recordings/123/signed-url',
        headers: {
          Authorization: 'Bearer valid-token',
        },
      });
    });

    it('should return null when no token', async () => {
      const result = await api.getSignedUrl(123);
      expect(result).toBeNull();
    });
  });

  describe('deleteRecording', () => {
    it('should delete recording successfully', async () => {
      api.setToken('valid-token');
      mockRequestUrl.mockResolvedValueOnce({
        status: 200,
        json: {},
        headers: {},
        arrayBuffer: new ArrayBuffer(0),
        text: '',
      });

      const result = await api.deleteRecording(123);

      expect(result).toBe(true);
      expect(mockRequestUrl).toHaveBeenCalledWith({
        url: 'https://api.voicenotes.com/api/recordings/123',
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer valid-token',
        },
      });
    });

    it('should return false when deletion fails', async () => {
      api.setToken('valid-token');
      mockRequestUrl.mockRejectedValueOnce(new Error('Delete failed'));

      const result = await api.deleteRecording(123);

      expect(result).toBe(false);
    });

    it('should return false when no token', async () => {
      const result = await api.deleteRecording(123);
      expect(result).toBe(false);
    });
  });

  describe('getUserInfo', () => {
    it('should fetch user info successfully', async () => {
      api.setToken('valid-token');
      const mockUser: User = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        photo_url: null,
        is_password_set: true,
        subscription_status: true,
        can_record_more: true,
        subscription_plan: 'premium',
        subscription_gateway: 'stripe',
        subscription_created_at: '2024-01-01',
        latest_updated_at: '2024-01-01',
        latest_attachment_updated_at: '2024-01-01',
        recordings_count: 10,
        public_recordings_count: 5,
        settings: {
          about: null,
          language: 'en',
          remember_words: null,
          fix_punctuation: true,
          theme: 'light',
        },
      };

      mockRequestUrl.mockResolvedValueOnce({
        status: 200,
        json: mockUser,
        headers: {},
        arrayBuffer: new ArrayBuffer(0),
        text: '',
      });

      const result = await api.getUserInfo();

      expect(result).toEqual(mockUser);
      expect(mockRequestUrl).toHaveBeenCalledWith({
        url: 'https://api.voicenotes.com/api/auth/me',
        headers: {
          Authorization: 'Bearer valid-token',
        },
      });
    });

    it('should return null on error (used for token validation)', async () => {
      api.setToken('invalid-token');
      mockRequestUrl.mockRejectedValueOnce({
        status: 401,
        message: 'Unauthorized',
      });

      const result = await api.getUserInfo();

      expect(result).toBeNull();
    });

    it('should return null when no token', async () => {
      const result = await api.getUserInfo();
      expect(result).toBeNull();
    });
  });

  describe('downloadFile', () => {
    it('should download file successfully', async () => {
      const mockFs = {
        writeBinary: jest.fn().mockResolvedValue(undefined),
      } as unknown as DataAdapter;
      const mockArrayBuffer = new ArrayBuffer(8);
      
      mockRequestUrl.mockResolvedValueOnce({
        status: 200,
        json: {},
        headers: {},
        arrayBuffer: mockArrayBuffer,
        text: '',
      });

      await api.downloadFile(mockFs, 'https://example.com/file.mp3', '/path/to/output.mp3');

      expect(mockRequestUrl).toHaveBeenCalledWith({
        url: 'https://example.com/file.mp3',
      });
      expect(mockFs.writeBinary).toHaveBeenCalledWith(
        '/path/to/output.mp3',
        expect.any(Buffer)
      );
    });

    it('should throw error on download failure', async () => {
      const mockFs = {
        writeBinary: jest.fn(),
      } as unknown as DataAdapter;
      mockRequestUrl.mockRejectedValueOnce(new Error('Download failed'));

      await expect(
        api.downloadFile(mockFs, 'https://example.com/file.mp3', '/path/to/output.mp3')
      ).rejects.toThrow('Download failed');
    });
  });

  describe('getRecordingsFromLink', () => {
    it('should fetch recordings from pagination link', async () => {
      api.setToken('valid-token');
      const paginationUrl = 'https://api.voicenotes.com/api/recordings?page=2';
      const mockRecordings: VoiceNoteRecordings = {
        data: [{ id: 2, title: 'Page 2 Recording' }],
        links: { next: null },
        json: {},
      };

      mockRequestUrl.mockResolvedValueOnce({
        status: 200,
        json: mockRecordings,
        headers: {},
        arrayBuffer: new ArrayBuffer(0),
        text: '',
      });

      const result = await api.getRecordingsFromLink(paginationUrl);

      expect(result).toEqual(mockRecordings);
      expect(mockRequestUrl).toHaveBeenCalledWith({
        url: paginationUrl,
        headers: {
          Authorization: 'Bearer valid-token',
        },
      });
    });

    it('should return null when no token', async () => {
      const result = await api.getRecordingsFromLink('https://api.voicenotes.com/api/recordings?page=2');
      expect(result).toBeNull();
    });
  });
});