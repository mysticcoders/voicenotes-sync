import { DataAdapter, Vault, normalizePath } from 'obsidian';
import { FileSystemError } from '../types';

export class FileSystemService {
  private adapter: DataAdapter;
  private vault: Vault;

  constructor(adapter: DataAdapter, vault: Vault) {
    this.adapter = adapter;
    this.vault = vault;
  }

  /**
   * Check if a file or directory exists
   */
  async exists(path: string): Promise<boolean> {
    return this.adapter.exists(normalizePath(path));
  }

  /**
   * Create a directory if it doesn't exist
   */
  async ensureDirectory(path: string): Promise<void> {
    const normalizedPath = normalizePath(path);
    if (!(await this.exists(normalizedPath))) {
      try {
        await this.vault.createFolder(normalizedPath);
      } catch (error) {
        throw new FileSystemError(`Failed to create directory: ${normalizedPath}`);
      }
    }
  }

  /**
   * Write a binary file
   */
  async writeBinary(path: string, data: ArrayBuffer): Promise<void> {
    try {
      await this.adapter.writeBinary(normalizePath(path), data);
    } catch (error) {
      throw new FileSystemError(`Failed to write binary file: ${path}`);
    }
  }

  /**
   * Read a binary file
   */
  async readBinary(path: string): Promise<ArrayBuffer> {
    try {
      return await this.adapter.readBinary(normalizePath(path));
    } catch (error) {
      throw new FileSystemError(`Failed to read binary file: ${path}`);
    }
  }

  /**
   * Write a text file
   */
  async writeText(path: string, data: string): Promise<void> {
    try {
      await this.adapter.write(normalizePath(path), data);
    } catch (error) {
      throw new FileSystemError(`Failed to write text file: ${path}`);
    }
  }

  /**
   * Read a text file
   */
  async readText(path: string): Promise<string> {
    try {
      return await this.adapter.read(normalizePath(path));
    } catch (error) {
      throw new FileSystemError(`Failed to read text file: ${path}`);
    }
  }
}
