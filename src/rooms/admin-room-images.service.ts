import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from './entities/room.entity';
import { RoomImage } from './entities/room-image.entity';
import {
  deleteUploadedFile,
  uploadUrl,
} from '../attachments/upload-files.util';

@Injectable()
export class AdminRoomImagesService {
  constructor(
    @InjectRepository(Room) private readonly roomsRepository: Repository<Room>,
    @InjectRepository(RoomImage)
    private readonly imagesRepository: Repository<RoomImage>,
    private readonly configService: ConfigService,
  ) {}

  /** Files are already on disk (multer); on any error the upload interceptor removes them. */
  async add(roomId: string, files: Express.Multer.File[] = []) {
    if (!files.length) {
      throw new BadRequestException('Cần chọn ít nhất 1 ảnh (field "images")');
    }
    await this.ensureRoomExists(roomId);

    const appUrl =
      this.configService.get<string>('APP_URL') || 'http://localhost:3000';
    const images = await this.imagesRepository.save(
      files.map((file) =>
        this.imagesRepository.create({
          url: uploadUrl(appUrl, file.filename),
          room: { id: roomId },
        }),
      ),
    );
    return images.map(({ id, url }) => ({ id, url }));
  }

  async remove(roomId: string, imageId: string) {
    await this.ensureRoomExists(roomId);
    const image = await this.imagesRepository.findOne({
      select: { id: true, url: true },
      where: { id: imageId, room: { id: roomId } },
    });
    if (!image) throw new NotFoundException('Không tìm thấy ảnh của phòng này');

    await this.imagesRepository.delete(image.id);
    await deleteUploadedFile(image.url);
    return { message: 'Đã xoá ảnh' };
  }

  private async ensureRoomExists(id: string) {
    if (!(await this.roomsRepository.existsBy({ id }))) {
      throw new NotFoundException('Không tìm thấy phòng');
    }
  }
}
