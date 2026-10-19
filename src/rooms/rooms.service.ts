import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from './entities/room.entity';
import { RoomType } from './entities/room-type.entity';
import { Amenity } from './entities/amenity.entity';
import { Review, ReviewStatus } from '../reviews/entities/review.entity';
import { SearchRoomsQueryDto } from './dto/search-rooms-query.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { applyRoomFilters, validateRoomSearch } from './room-filters';
import { serializeReview, serializeRoom } from './room.serializer';
import { toPaginatedResult } from '../common/utils/paginate.util';

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room) private readonly roomsRepository: Repository<Room>,
    @InjectRepository(RoomType)
    private readonly roomTypesRepository: Repository<RoomType>,
    @InjectRepository(Amenity)
    private readonly amenitiesRepository: Repository<Amenity>,
    @InjectRepository(Review)
    private readonly reviewsRepository: Repository<Review>,
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
    return toPaginatedResult([rooms.map(serializeRoom), total], page, limit);
  }

  async findOne(id: string) {
    const room = await this.roomsRepository.findOne({
      where: { id },
      relations: { roomType: true, amenities: true, images: true },
    });
    if (!room) throw new NotFoundException('Không tìm thấy phòng');
    return serializeRoom(room);
  }

  /** Approved reviews of a room, newest first. */
  async findReviews(roomId: string, { page, limit }: PaginationQueryDto) {
    if (!(await this.roomsRepository.existsBy({ id: roomId }))) {
      throw new NotFoundException('Không tìm thấy phòng');
    }

    const result = await this.reviewsRepository
      .createQueryBuilder('review')
      .innerJoin('review.booking', 'booking')
      .innerJoin('booking.user', 'user')
      .addSelect(['booking.id', 'user.id', 'user.fullName'])
      .where('booking.room_id = :roomId', { roomId })
      .andWhere('review.status = :status', { status: ReviewStatus.APPROVED })
      .orderBy('review.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return toPaginatedResult(
      [result[0].map(serializeReview), result[1]],
      page,
      limit,
    );
  }

  findRoomTypes() {
    return this.roomTypesRepository.find({ order: { name: 'ASC' } });
  }

  findAmenities() {
    return this.amenitiesRepository.find({ order: { name: 'ASC' } });
  }
}
