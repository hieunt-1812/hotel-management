import { Logger } from '@nestjs/common';
import { unlink } from 'fs/promises';
import { basename, join } from 'path';
import { UPLOAD_DIR } from './multer.config';

const logger = new Logger('UploadFiles');

export const uploadUrl = (appUrl: string, fileName: string) =>
  `${appUrl}/uploads/${fileName}`;

export async function deleteUploadedFile(
  fileNameOrUrl: string,
  { strict = false }: { strict?: boolean } = {},
) {
  const fileName = basename(fileNameOrUrl);
  try {
    await unlink(join(UPLOAD_DIR, fileName));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    logger.warn(
      `Could not delete upload ${fileName}: ${(error as Error).message}`,
    );
    if (strict) throw error;
  }
}
