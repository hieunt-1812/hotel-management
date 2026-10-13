import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { Attachment } from './entities/attachment.entity';

@Injectable()
export class AttachmentsService {
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
}
