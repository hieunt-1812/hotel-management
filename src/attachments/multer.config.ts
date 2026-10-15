import { randomUUID } from 'crypto';
import { extname } from 'path';
import { diskStorage } from 'multer';
import { BadRequestException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

export const UPLOAD_DIR = './public/uploads';

const ALLOWED_IMAGE_MIME = /^image\/(jpg|jpeg|png|gif|webp)$/;
const MAX_FILE_SIZE = 2 * 1024 * 1024;

export const avatarMulterOptions: MulterOptions = {
  storage: diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => {
      const uniqueName = `${randomUUID()}${extname(file.originalname)}`;
      cb(null, uniqueName);
    },
  }),
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_MIME.test(file.mimetype)) {
      return cb(
        new BadRequestException(
          'Chỉ chấp nhận file ảnh (jpg, jpeg, png, gif, webp)',
        ),
        false,
      );
    }
    cb(null, true);
  },
  limits: { fileSize: MAX_FILE_SIZE },
};
