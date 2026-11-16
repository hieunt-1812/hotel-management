import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workbook } from 'exceljs';
import { Room } from './entities/room.entity';
import { RoomFiltersQueryDto } from './dto/room-filters-query.dto';
import { applyRoomFilters, validateRoomSearch } from './room-filters';
import { today } from '../common/utils/stay-dates.util';
import {
  BED_TYPE_LABELS,
  ROOM_VIEW_LABELS,
  ROOMS_EXPORT_COLUMNS,
  ROOMS_EXPORT_SHEET_NAME,
  roomsExportFileName,
} from './rooms-export.constants';

@Injectable()
export class AdminRoomsExportService {
  constructor(
    @InjectRepository(Room) private readonly roomsRepository: Repository<Room>,
  ) {}

  async export(query: RoomFiltersQueryDto) {
    validateRoomSearch(query);
    const qb = this.roomsRepository
      .createQueryBuilder('room')
      .leftJoin('room.roomType', 'roomType')
      .leftJoin('room.amenities', 'amenity')
      .select([
        'room.id',
        'room.name',
        'room.pricePerNight',
        'room.capacity',
        'room.bedType',
        'room.view',
        'room.description',
        'room.createdAt',
        'roomType.id',
        'roomType.name',
        'amenity.id',
        'amenity.name',
      ]);
    const rooms = await applyRoomFilters(qb, query).getMany();

    return {
      fileName: roomsExportFileName(today()),
      content: await this.buildWorkbook(rooms),
    };
  }

  private async buildWorkbook(rooms: Room[]) {
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet(ROOMS_EXPORT_SHEET_NAME, {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    sheet.columns = ROOMS_EXPORT_COLUMNS;
    sheet.getRow(1).font = { bold: true };

    rooms.forEach((room, index) =>
      sheet.addRow({
        index: index + 1,
        name: room.name,
        roomType: room.roomType?.name ?? '',
        pricePerNight: room.pricePerNight,
        capacity: room.capacity,
        bedType: BED_TYPE_LABELS[room.bedType] ?? room.bedType,
        view: ROOM_VIEW_LABELS[room.view] ?? room.view,
        amenities: room.amenities
          .map((amenity) => amenity.name)
          .sort()
          .join(', '),
        description: room.description ?? '',
        createdAt: room.createdAt.toLocaleString('sv-SE').slice(0, 16),
      }),
    );

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
}
