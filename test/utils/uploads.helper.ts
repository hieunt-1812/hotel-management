import { existsSync, readdirSync, unlinkSync } from 'fs';
import { basename, join } from 'path';
import { UPLOAD_DIR } from '../../src/attachments/multer.config';

export const PNG = { filename: 'image.png', contentType: 'image/png' };
export const smallImage = Buffer.from('fake-png-bytes');

const listUploads = () =>
  readdirSync(UPLOAD_DIR).filter((f) => !f.startsWith('.'));

/** True if the file behind an upload URL (or file name) exists on disk. */
export const uploadExists = (urlOrName: string) =>
  existsSync(join(UPLOAD_DIR, basename(urlOrName)));

/** Tracks files a test suite writes to UPLOAD_DIR so they can be counted and cleaned up. */
export function trackUploads() {
  const before = new Set(listUploads());
  return {
    newFiles: () => listUploads().filter((f) => !before.has(f)),
    cleanup: () =>
      listUploads()
        .filter((f) => !before.has(f))
        .forEach((f) => unlinkSync(join(UPLOAD_DIR, f))),
  };
}

/** The upload interceptor deletes files asynchronously (best effort). */
export const waitForCleanup = () => new Promise((r) => setTimeout(r, 100));
