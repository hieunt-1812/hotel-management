import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Payment, PaymentStatus } from '../payments/entities/payment.entity';
import { RoomType } from '../rooms/entities/room-type.entity';
import { countNights, today } from '../common/utils/stay-dates.util';
import { RevenueStatisticsQueryDto } from './dto/revenue-statistics-query.dto';
import {
  MAX_DAILY_REVENUE_RANGE_DAYS,
  RevenueGroupBy,
} from './statistics.constants';
import { addDays, listDays, listMonths } from './statistics-periods.util';

interface RevenueRow {
  key: string;
  revenue: string;
  payments: number;
}

interface RevenueRange {
  from: string;
  to: string;
  roomTypeId?: string;
}

@Injectable()
export class RevenueStatisticsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getRevenue(query: RevenueStatisticsQueryDto) {
    const to = query.to ?? today();
    const from = query.from ?? `${to.slice(0, 7)}-01`;
    const range = { from, to, roomTypeId: query.roomTypeId };
    this.assertValidRange(range, query.groupBy);

    const report =
      query.groupBy === RevenueGroupBy.ROOM_TYPE
        ? await this.getRevenueByRoomType(range)
        : await this.getRevenueByPeriod(range, query.groupBy);

    return {
      from,
      to,
      groupBy: query.groupBy,
      roomTypeId: query.roomTypeId ?? null,
      ...report,
    };
  }

  async getRevenueByRoomType(range: RevenueRange) {
    const rows = await this.sumPaidPayments(range, 'roomType.id');
    const roomTypes = await this.dataSource.getRepository(RoomType).find({
      select: { id: true, name: true },
      where: range.roomTypeId ? { id: range.roomTypeId } : {},
      order: { name: 'ASC' },
    });
    return this.withTotals(
      roomTypes.map((roomType) => ({
        roomType,
        ...this.amountsOf(rows, roomType.id),
      })),
    );
  }

  private async getRevenueByPeriod(
    range: RevenueRange,
    groupBy: RevenueGroupBy.DAY | RevenueGroupBy.MONTH,
  ) {
    const isDaily = groupBy === RevenueGroupBy.DAY;
    const format = isDaily ? 'YYYY-MM-DD' : 'YYYY-MM';
    const rows = await this.sumPaidPayments(
      range,
      `TO_CHAR(payment.paidAt, '${format}')`,
    );
    const periods = isDaily
      ? listDays(range.from, range.to)
      : listMonths(range.from, range.to);
    return this.withTotals(
      periods.map((period) => ({ period, ...this.amountsOf(rows, period) })),
    );
  }

  private sumPaidPayments(
    { from, to, roomTypeId }: RevenueRange,
    keyExpression: string,
  ) {
    const qb = this.dataSource
      .createQueryBuilder(Payment, 'payment')
      .withDeleted()
      .innerJoin('payment.booking', 'booking')
      .innerJoin('booking.room', 'room')
      .innerJoin('room.roomType', 'roomType')
      .select(keyExpression, 'key')
      .addSelect('SUM(payment.amount)', 'revenue')
      .addSelect('COUNT(*)::int', 'payments')
      .where('payment.status = :paid', { paid: PaymentStatus.PAID })
      .andWhere('payment.paidAt >= :from AND payment.paidAt < :toExclusive', {
        from,
        toExclusive: addDays(to, 1),
      })
      .groupBy(keyExpression);

    if (roomTypeId) qb.andWhere('roomType.id = :roomTypeId', { roomTypeId });

    return qb.getRawMany<RevenueRow>();
  }

  private amountsOf(rows: RevenueRow[], key: string) {
    const row = rows.find((candidate) => candidate.key === key);
    return {
      revenue: row ? Number(row.revenue) : 0,
      payments: row?.payments ?? 0,
    };
  }

  private withTotals<T extends { revenue: number; payments: number }>(
    data: T[],
  ) {
    return {
      totalRevenue: data.reduce((sum, item) => sum + item.revenue, 0),
      totalPayments: data.reduce((sum, item) => sum + item.payments, 0),
      data,
    };
  }

  private assertValidRange(
    { from, to }: RevenueRange,
    groupBy: RevenueGroupBy,
  ) {
    if (from > to) {
      throw new BadRequestException('from không được sau to');
    }
    if (
      groupBy === RevenueGroupBy.DAY &&
      countNights(from, to) >= MAX_DAILY_REVENUE_RANGE_DAYS
    ) {
      throw new BadRequestException(
        `Thống kê theo ngày tối đa ${MAX_DAILY_REVENUE_RANGE_DAYS} ngày`,
      );
    }
  }
}
