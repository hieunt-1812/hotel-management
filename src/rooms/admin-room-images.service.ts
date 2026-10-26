import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Room } from './entities/room.entity';
import { RoomImage } from './entities/room-image.entity';
import {
  deleteUploadedFile,
  uploadUrl,
} from '../attachments/upload-files.util';

@Injectable()
export class AdminRoomImagesService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Room) private readonly roomsRepository: Repository<Room>,
    @InjectRepository(RoomImage)
    private readonly imagesRepository: Repository<RoomImage>,
    private readonly configService: ConfigService,
  ) {}

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

    await this.dataSource.transaction(async (manager) => {
      const image = await manager.findOne(RoomImage, {
        select: { id: true, url: true },
        where: { id: imageId, room: { id: roomId } },
      });
      if (!image) {
        throw new NotFoundException('Không tìm thấy ảnh của phòng này');
      }

      await manager.delete(RoomImage, image.id);
      try {
        await deleteUploadedFile(image.url, { strict: true });
      } catch {
        throw new InternalServerErrorException(
          'Không xoá được file ảnh, vui lòng thử lại',
        );
      }
    });
    return { message: 'Đã xoá ảnh' };
  }

  private async ensureRoomExists(id: string) {
    if (!(await this.roomsRepository.existsBy({ id }))) {
      throw new NotFoundException('Không tìm thấy phòng');
    }
  }
}
