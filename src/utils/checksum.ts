import * as crypto from 'crypto';
import { promises as fs } from 'fs';

/**
 * Generate a checksum for a file using the specified algorithm
 */
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
