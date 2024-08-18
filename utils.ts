import { moment } from 'obsidian';
import * as crypto from 'crypto';
import { promises as fs } from 'fs';
import { htmlToText } from 'html-to-text';

export function capitalizeFirstLetter(word: string): string {
  return word[0].toUpperCase() + word.slice(1);
}

export function getFilenameFromUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    const pathname = parsedUrl.pathname;
    const filename = pathname.split('/').pop();

    return filename || '';
  } catch (error) {
    console.error('Invalid URL:', error);
    return '';
  }
}

export function isAlphaNumeric(value: string): boolean {
  const regex = /^[a-z0-9_]+$/i;
  return regex.test(value);
}

export function isToday(date: string): boolean {
  return moment(date).isSame(moment(), 'day');
}

export async function generateChecksum(filePath: string, algorithm: string = 'sha256'): Promise<string> {
  const hash = crypto.createHash(algorithm);
  const fileHandle = await fs.open(filePath, 'r');
  const buffer = Buffer.alloc(8192);

  let bytesRead: number;
  do {
    const { bytesRead: readBytes } = await fileHandle.read(buffer, 0, buffer.length, null);
    bytesRead = readBytes;
    if (bytesRead > 0) {
      hash.update(buffer.slice(0, bytesRead));
    }
  } while (bytesRead > 0);

  await fileHandle.close();
  return hash.digest('hex');
}

export function formatDuration(durationMs: number): string {
  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.floor((durationMs % 60000) / 1000);

  if (minutes > 0) {
    return `${minutes}m${seconds.toString().padStart(2, '0')}s`;
  } else {
    return `${seconds}s`;
  }
}

export function formatDate(date: string, dateFormat: string): string {
  try {
    return moment(date).format(dateFormat);
  } catch (error) {
    console.error('Error formatting date:', error);
    return date;
  }
}

export function formatTags(recording: any): string {
  if (recording.tags && recording.tags.length > 0) {
    return `tags: ${recording.tags.map((tag: { name: string }) => tag.name).join(',')}`;
  }
  return '';
}

export function autoResizeTextArea(textarea: HTMLTextAreaElement): void {
  requestAnimationFrame(() => {
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  });
}

export function convertHtmlToText(html: string): string {
  // Convert HTML to text
  let text = htmlToText(html, {
    wordwrap: false,
    preserveNewlines: true,
  });

  // Replace common HTML entities
  const entities: { [key: string]: string } = {
    '&quot;': '"',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&nbsp;': ' ',
    '&#39;': "'",
  };

  for (const [entity, replacement] of Object.entries(entities)) {
    text = text.replace(new RegExp(entity, 'g'), replacement);
  }

  return text;
}