import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import { RoomType } from '../rooms/entities/room-type.entity';
import { BookingStatisticsQueryDto } from './dto/booking-statistics-query.dto';
import {
  BookingStatisticsGroupBy,
  MONTHS_PER_YEAR,
  QUARTERS_PER_YEAR,
} from './statistics.constants';

type BookingCounts = Record<'total' | BookingStatus, number>;

@Injectable()
export class BookingStatisticsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getStatistics({
    groupBy,
    year,
    roomTypeId,
  }: BookingStatisticsQueryDto) {
    const rows = await this.countBookings(groupBy, year, roomTypeId);
    const countsByKey = new Map(
      rows.map(({ key, ...counts }) => [String(key), counts]),
    );
    const countsOf = (key: string) =>
      countsByKey.get(key) ?? this.emptyCounts();

    const data =
      groupBy === BookingStatisticsGroupBy.ROOM_TYPE
        ? (await this.findRoomTypes(roomTypeId)).map((roomType) => ({
            roomType,
            ...countsOf(roomType.id),
          }))
        : Array.from({ length: this.periodCount(groupBy) }, (_, index) => ({
            period: index + 1,
            ...countsOf(String(index + 1)),
          }));

    return {
      year,
      groupBy,
      roomTypeId: roomTypeId ?? null,
      summary: this.sumCounts(data),
      data,
    };
  }

  private countBookings(
    groupBy: BookingStatisticsGroupBy,
    year: number,
    roomTypeId?: string,
  ) {
    const keyExpression =
      groupBy === BookingStatisticsGroupBy.ROOM_TYPE
        ? 'roomType.id'
        : `EXTRACT(${groupBy.toUpperCase()} FROM booking.createdAt)::int`;

    const qb = this.dataSource
      .createQueryBuilder(Booking, 'booking')
      .withDeleted()
      .innerJoin('booking.room', 'room')
      .innerJoin('room.roomType', 'roomType')
      .select(keyExpression, 'key')
      .addSelect('COUNT(*)::int', 'total')
      .where('booking.createdAt >= :start AND booking.createdAt < :end', {
        start: `${year}-01-01`,
        end: `${year + 1}-01-01`,
      })
      .groupBy(keyExpression);

    Object.values(BookingStatus).forEach((status) => {
      qb.addSelect(
        `COUNT(*) FILTER (WHERE booking.status = :${status})::int`,
        status,
      ).setParameter(status, status);
    });

    if (roomTypeId) qb.andWhere('roomType.id = :roomTypeId', { roomTypeId });

    return qb.getRawMany<BookingCounts & { key: string | number }>();
  }

  private emptyCounts(): BookingCounts {
    return Object.fromEntries(
      ['total', ...Object.values(BookingStatus)].map((key) => [key, 0]),
    ) as BookingCounts;
  }

  private sumCounts(rows: BookingCounts[]): BookingCounts {
    const summary = this.emptyCounts();
    rows.forEach((row) => {
      (Object.keys(summary) as (keyof BookingCounts)[]).forEach((key) => {
        summary[key] += row[key];
      });
    });
    return summary;
  }

  private periodCount(groupBy: BookingStatisticsGroupBy) {
    return groupBy === BookingStatisticsGroupBy.QUARTER
      ? QUARTERS_PER_YEAR
      : MONTHS_PER_YEAR;
  }

  private findRoomTypes(roomTypeId?: string) {
    return this.dataSource.getRepository(RoomType).find({
      select: { id: true, name: true },
      where: roomTypeId ? { id: roomTypeId } : {},
      order: { name: 'ASC' },
    });
  }
}
