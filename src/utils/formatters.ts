// Use the default import during build but let jest mock it during tests
import { moment as obsidianMoment } from 'obsidian';
const moment = typeof obsidianMoment === 'function' ? obsidianMoment : require('moment');

/**
 * Capitalize the first letter of a word
 */
export function capitalizeFirstLetter(word: string): string {
  return word[0].toUpperCase() + word.slice(1);
}

/**
 * Extract filename from a URL
 */
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

/**
 * Check if a string contains only alphanumeric characters and underscores
 */
export function isAlphaNumeric(value: string): boolean {
  const regex = /^[a-z0-9_]+$/i;
  return regex.test(value);
}

/**
 * Check if a date is today
 */
export function isToday(date: string): boolean {
  return moment(date).isSame(moment(), 'day');
}

/**
 * Format duration in milliseconds to a human-readable string
 */
export function formatDuration(durationMs: number): string {
  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.floor((durationMs % 60000) / 1000);

  if (minutes > 0) {
    return `${minutes}m${seconds.toString().padStart(2, '0')}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Format a date string using moment.js
 */
export function formatDate(date: string, dateFormat: string): string {
  try {
    return moment(date).format(dateFormat);
  } catch (error) {
    console.error('Error formatting date:', error);
    return date;
  }
}

/**
 * Format tags from a recording into a string
 */
export function formatTags(tags: { name: string }[]): string {
  if (tags && tags.length > 0) {
    return `tags: ${tags.map((tag) => tag.name.replace(/\s+/g, '-')).join(',')}`;
  }
  return '';
}
