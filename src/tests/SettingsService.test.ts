// Import jest from jest library instead of @jest/globals
import { SettingsService, DEFAULT_SETTINGS } from '../services/SettingsService';

describe('SettingsService', () => {
  let settingsService: SettingsService;
  let mockPlugin: any;

  beforeEach(() => {
    mockPlugin = {
      loadData: jest.fn().mockResolvedValue(null),
      saveData: jest.fn().mockResolvedValue(undefined),
    };
    settingsService = new SettingsService(mockPlugin);
  });

  describe('loadSettings', () => {
    test('loads default settings when no saved data exists', async () => {
      const settings = await settingsService.loadSettings();
      
      expect(settings).toEqual(DEFAULT_SETTINGS);
      expect(mockPlugin.loadData).toHaveBeenCalled();
    });

    test('merges saved data with default settings', async () => {
      const savedData = {
        syncTimeout: 30,
        syncDirectory: 'custom-dir',
      };
      mockPlugin.loadData.mockResolvedValue(savedData);
      
      const settings = await settingsService.loadSettings();
      
      expect(settings.syncTimeout).toBe(30);
      expect(settings.syncDirectory).toBe('custom-dir');
      expect(settings.automaticSync).toBe(DEFAULT_SETTINGS.automaticSync);
    });
  });

  describe('saveSettings', () => {
    test('saves settings to plugin storage', async () => {
      await settingsService.loadSettings();
      await settingsService.saveSettings();
      
      expect(mockPlugin.saveData).toHaveBeenCalledWith(expect.objectContaining({
        automaticSync: DEFAULT_SETTINGS.automaticSync,
        syncDirectory: DEFAULT_SETTINGS.syncDirectory,
      }));
    });
  });

  describe('updateSettings', () => {
    test('updates settings with new values', async () => {
      await settingsService.loadSettings();
      
      settingsService.updateSettings({
        automaticSync: false,
        syncTimeout: 120,
      });
      
      const settings = settingsService.getSettings();
      expect(settings.automaticSync).toBe(false);
      expect(settings.syncTimeout).toBe(120);
      expect(settings.syncDirectory).toBe(DEFAULT_SETTINGS.syncDirectory);
    });
  });

  describe('validateSettings', () => {
    test('validates settings correctly', async () => {
      await settingsService.loadSettings();
      
      // Valid settings
      let result = settingsService.validateSettings();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      
      // Invalid syncTimeout
      settingsService.updateSettings({ syncTimeout: -1 });
      result = settingsService.validateSettings();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Sync timeout must be a number greater than or equal to 1');
      
      // Invalid syncDirectory
      settingsService.updateSettings({ syncTimeout: 60, syncDirectory: '' });
      result = settingsService.validateSettings();
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Sync directory cannot be empty');
    });
  });

  describe('resetSettings', () => {
    test('resets settings to defaults', async () => {
      await settingsService.loadSettings();
      
      settingsService.updateSettings({
        automaticSync: false,
        syncTimeout: 120,
        syncDirectory: 'custom-dir',
      });
      
      settingsService.resetSettings();
      
      const settings = settingsService.getSettings();
      expect(settings).toEqual(DEFAULT_SETTINGS);
    });
  });

  describe('clearSensitiveData', () => {
    test('clears token and password', async () => {
      await settingsService.loadSettings();
      
      settingsService.updateSettings({
        token: 'test-token',
        password: 'test-password',
      });
      
      settingsService.clearSensitiveData();
      
      const settings = settingsService.getSettings();
      expect(settings.token).toBeUndefined();
      expect(settings.password).toBeUndefined();
      expect(settings.syncDirectory).toBe(DEFAULT_SETTINGS.syncDirectory);
    });
  });
});
