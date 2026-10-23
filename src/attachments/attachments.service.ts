import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { Attachment } from './entities/attachment.entity';
import { UPLOAD_DIR } from './multer.config';

@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);

  constructor(
    @InjectRepository(Attachment)
    private readonly attachmentsRepository: Repository<Attachment>,
    private readonly configService: ConfigService,
  ) {}

  async createForEntity(
    entityType: string,
    entityId: string,
    file: Express.Multer.File,
  ): Promise<Attachment> {
    const appUrl =
      this.configService.get<string>('APP_URL') || 'http://localhost:3000';
    const url = `${appUrl}/uploads/${file.filename}`;

    const attachment = this.attachmentsRepository.create({
      entityType,
      entityId,
      url,
      fileName: file.filename,
      fileType: file.mimetype,
      fileSize: file.size,
    });

    return this.attachmentsRepository.save(attachment);
  }

  /** For single-file owners (e.g. avatar): saves the new file and removes the previous ones. */
  async replaceForEntity(
    entityType: string,
    entityId: string,
    file: Express.Multer.File,
  ): Promise<Attachment> {
    const previous = await this.attachmentsRepository.find({
      select: { id: true, fileName: true },
      where: { entityType, entityId },
    });
    const attachment = await this.createForEntity(entityType, entityId, file);

    if (previous.length) {
      await this.attachmentsRepository.delete(previous.map((a) => a.id));
      await Promise.all(previous.map((a) => this.deleteFile(a.fileName)));
    }
    return attachment;
  }

  private async deleteFile(fileName: string) {
    try {
      await unlink(join(UPLOAD_DIR, fileName));
    } catch (error) {
      // Missing file is not worth failing the request for
      this.logger.warn(
        `Could not delete upload ${fileName}: ${(error as Error).message}`,
      );
    }
  }
}
