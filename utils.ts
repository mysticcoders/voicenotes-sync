import { moment } from 'obsidian'
import * as crypto from 'crypto';
import { promises as fs } from 'fs';

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
  return moment(date).isSame(moment(), 'day')
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