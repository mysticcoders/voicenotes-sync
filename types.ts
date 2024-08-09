export interface VoiceNotesPluginSettings {
  token?: string;
  username?: string;
  password?: string;
  automaticSync: boolean;
  syncTimeout?: number;
  downloadAudio?: boolean;
  replaceTranscriptWithTidy?: boolean;
  downloadAttachment?: boolean;
  syncDirectory: string;
  deleteSynced: boolean;
  reallyDeleteSynced: boolean;
  todoTag: string;
  prependDateToTitle: boolean;
  prependDateFormat: string;
  noteTemplate: string;
  filenameTemplate: string;
  debugMode: boolean;
  syncInterval: number;
  excludeFolders: string[];
  dateFormat: string;
  prependDate: boolean;
}

export interface UserSettings {
  about: string | null;
  language: string | null;
  remember_words: string | null;
  fix_punctuation: boolean;
  theme: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  photo_url: string | null;
  is_password_set: boolean;
  subscription_status: boolean;
  can_record_more: boolean;
  subscription_plan: string;
  subscription_gateway: string;
  subscription_created_at: string;
  latest_updated_at: string;
  latest_attachment_updated_at: string;
  recordings_count: number;
  public_recordings_count: number;
  settings: UserSettings;
}