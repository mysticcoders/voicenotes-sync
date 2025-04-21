/* -------------------------------------------------------------------------- */
/*                                    MAIN                                    */
/* -------------------------------------------------------------------------- */

export interface VoiceNotesPluginSettings {
  token?: string;
  username?: string;
  password?: string;
  automaticSync: boolean;
  syncTimeout?: number;
  downloadAudio?: boolean;
  downloadAttachment?: boolean;
  syncDirectory: string;
  deleteSynced: boolean;
  reallyDeleteSynced: boolean;
  todoTag: string;
  filenameDateFormat: string;
  frontmatterTemplate: string;
  noteTemplate: string;
  filenameTemplate: string;
  excludeTags: string[];
  dateFormat: string;
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

/* -------------------------------------------------------------------------- */
/*                               VOICENOTES API                               */
/* -------------------------------------------------------------------------- */

export interface VoiceNoteSignedUrl {
  url: string;
}

export interface VoiceNoteRecording {
  recording_id: number;
  title: string;
  transcript: string;
  duration: number;
  created_at: string;
  updated_at: string;
  tags: Tag[];
  attachments: Attachment[];
  creations: Creation[];
  subnotes?: VoiceNoteRecording[];
  related_notes?: RelatedNote[];
}

export interface Tag {
  name: string;
}

export interface Attachment {
  type: number;
  url?: string;
  description?: string;
}

export interface Creation {
  type: string;
  content: {
    data: string[];
  };
  markdown_content?: string;
}

export interface RelatedNote {
  title: string;
  created_at: string;
}

export interface VoiceNoteRecordings {
  data: VoiceNoteRecording[];
  links: {
    next?: string;
  };
  json: any;
}

/* -------------------------------------------------------------------------- */
/*                                ERROR TYPES                                 */
/* -------------------------------------------------------------------------- */

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class ApiError extends Error {
  status?: number;
  text?: string;
  json?: any;
  headers?: any;

  constructor(message: string, status?: number, response?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    if (response) {
      this.text = response.text;
      this.json = response.json;
      this.headers = response.headers;
    }
  }
}

export class FileSystemError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileSystemError';
  }
}
