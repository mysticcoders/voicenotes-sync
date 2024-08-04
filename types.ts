export interface VoiceNoteData {
    data: string[] | VoiceNoteEmail | string,
}

export interface VoiceNoteEmail {
    subject: string,
    body: string,
}

export interface VoiceNoteCreation {
    created_at: string,
    updated_at: string,
    type: string,
    id: number,
    recording_ids: number[],
    content: VoiceNoteData,
}
export interface VoiceNoteRecordings {
    data: VoiceNoteEntry[],
    links: VoiceNotesLinks,
    meta: VoiceNotesMeta,
}

export interface VoiceNoteTag {
    id: number,
    name: string,
}

export interface RelatedVoiceNote {
    id: number,
    recording_id: number,
    title: string,
    transcript: string,
    created_at: string,
}

export interface VoiceNoteEntry {
    created_at: string,
    creations: VoiceNoteCreation[],
    attachments: VoiceNoteAttachment[],
    duration: number,
    id: number,
    public_slug?: string,
    recording_id: number,
    tags: VoiceNoteTag[],
    title: string,
    transcript: string,
    updated_at: string,
    related_notes: RelatedVoiceNote[],
}

export interface VoiceNoteAttachment {
    created_at: string,
    description: string,
    id: number,
    recording_id: string,
    type: number,
    url: string,
}

export interface VoiceNotesLinks {
    first?: string,
    next?: string,
    prev?: string
}

export interface VoiceNotesMeta {
    current_page: number,
    from: number,
    path?: string,
    per_page: number,
    to: number,
}

export interface VoiceNoteSignedUrl {
    url: string,
    expiry_time: string,
}

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
}