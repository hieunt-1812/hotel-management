import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { Room } from './entities/room.entity';
import { RoomType } from './entities/room-type.entity';
import { Amenity } from './entities/amenity.entity';
import { Booking } from '../bookings/entities/booking.entity';
import { ROOM_BLOCKING_STATUSES } from '../bookings/booking.constants';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { SearchRoomsQueryDto } from './dto/search-rooms-query.dto';
import { applyRoomFilters, validateRoomSearch } from './room-filters';
import { serializeAdminRoom } from './room.serializer';
import { toPaginatedResult } from '../common/utils/paginate.util';
import { today } from '../common/utils/stay-dates.util';

@Injectable()
export class AdminRoomsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Room) private readonly roomsRepository: Repository<Room>,
  ) {}

  async findAll(query: SearchRoomsQueryDto) {
    validateRoomSearch(query);
    const { page, limit } = query;
    const qb = this.roomsRepository
      .createQueryBuilder('room')
      .leftJoinAndSelect('room.roomType', 'roomType')
      .leftJoinAndSelect('room.amenities', 'amenity')
      .leftJoinAndSelect('room.images', 'image');
    applyRoomFilters(qb, query)
      .skip((page - 1) * limit)
      .take(limit);

    const [rooms, total] = await qb.getManyAndCount();
    return toPaginatedResult(
      [rooms.map(serializeAdminRoom), total],
      page,
      limit,
    );
  }

  async findOne(id: string) {
    return serializeAdminRoom(await this.loadRoom(id));
  }

  /** Room + its amenities are written in one transaction. */
  async create(dto: CreateRoomDto) {
    const { roomTypeId, amenityIds = [], ...fields } = dto;
    const id = await this.dataSource.transaction(async (manager) => {
      const room = manager.create(Room, {
        ...fields,
        roomType: await this.findRoomType(manager, roomTypeId),
        amenities: await this.findAmenities(manager, amenityIds),
      });
      return (await manager.save(room)).id;
    });
    return this.findOne(id);
  }

  async update(id: string, dto: UpdateRoomDto) {
    const { roomTypeId, amenityIds, ...fields } = dto;
    await this.dataSource.transaction(async (manager) => {
      const room = await manager.findOne(Room, {
        where: { id },
        relations: { amenities: true },
      });
      if (!room) throw new NotFoundException('Không tìm thấy phòng');

      // Price changes don't touch existing bookings: they keep their snapshot
      manager.merge(Room, room, fields);
      if (roomTypeId) {
        room.roomType = await this.findRoomType(manager, roomTypeId);
      }
      if (amenityIds) {
        room.amenities = await this.findAmenities(manager, amenityIds);
      }
      await manager.save(room);
    });
    return this.findOne(id);
  }

  /** Soft delete; refused while the room still has upcoming pending/approved bookings. */
  async remove(id: string) {
    await this.dataSource.transaction(async (manager) => {
      // Same row lock as booking creation, so no booking can sneak in meanwhile
      const room = await manager.findOne(Room, {
        select: { id: true },
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!room) throw new NotFoundException('Không tìm thấy phòng');

      const hasActiveBookings = await manager
        .createQueryBuilder(Booking, 'booking')
        .where('booking.room_id = :id', { id })
        .andWhere('booking.status IN (:...statuses)', {
          statuses: ROOM_BLOCKING_STATUSES,
        })
        .andWhere('booking.checkOut > :today', { today: today() })
        .getExists();
      if (hasActiveBookings) {
        throw new ConflictException(
          'Phòng còn booking chưa hoàn tất, không thể xoá',
        );
      }
      await manager.softDelete(Room, id);
    });
    return { message: 'Đã xoá phòng' };
  }

  private async loadRoom(id: string) {
    const room = await this.roomsRepository.findOne({
      where: { id },
      relations: { roomType: true, amenities: true, images: true },
    });
    if (!room) throw new NotFoundException('Không tìm thấy phòng');
    return room;
  }

  private async findRoomType(manager: EntityManager, id: string) {
    const roomType = await manager.findOneBy(RoomType, { id });
    if (!roomType) throw new BadRequestException('roomTypeId không tồn tại');
    return roomType;
  }

  private async findAmenities(manager: EntityManager, ids: string[]) {
    if (!ids.length) return [];
    const amenities = await manager.findBy(Amenity, { id: In(ids) });
    if (amenities.length !== ids.length) {
      const found = new Set(amenities.map((a) => a.id));
      const missing = ids.filter((amenityId) => !found.has(amenityId));
      throw new BadRequestException(
        `amenityIds không tồn tại: ${missing.join(', ')}`,
      );
    }
    return amenities;
  }
}
