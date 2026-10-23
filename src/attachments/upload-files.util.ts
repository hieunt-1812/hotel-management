import { Logger } from '@nestjs/common';
import { unlink } from 'fs/promises';
import { basename, join } from 'path';
import { UPLOAD_DIR } from './multer.config';

const logger = new Logger('UploadFiles');

/** Public URL of a file saved in UPLOAD_DIR (served as static /uploads). */
export const uploadUrl = (appUrl: string, fileName: string) =>
  `${appUrl}/uploads/${fileName}`;

/**
 * Best-effort delete of an uploaded file. Accepts a file name or a full URL;
 * only the base name is used, so it can never escape UPLOAD_DIR.
 */
export async function deleteUploadedFile(fileNameOrUrl: string) {
  const fileName = basename(fileNameOrUrl);
  try {
    await unlink(join(UPLOAD_DIR, fileName));
  } catch (error) {
    // A missing file is not worth failing the request for
    logger.warn(
      `Could not delete upload ${fileName}: ${(error as Error).message}`,
    );
  }
}
