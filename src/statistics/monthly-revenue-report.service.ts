import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, IsNull, Not } from 'typeorm';
import { User, UserRole } from '../users/entities/user.entity';
import { MailService } from '../mail/mail.service';
import { RevenueStatisticsService } from './revenue-statistics.service';
import { monthRange } from './statistics-periods.util';

@Injectable()
export class MonthlyRevenueReportService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly revenueStatisticsService: RevenueStatisticsService,
    private readonly mailService: MailService,
  ) {}

  async sendReport(month: string) {
    const revenue = await this.revenueStatisticsService.getRevenueByRoomType(
      monthRange(month),
    );
    const admins = await this.dataSource.getRepository(User).find({
      select: { email: true, fullName: true },
      where: {
        role: UserRole.ADMIN,
        isActive: true,
        activatedAt: Not(IsNull()),
      },
    });

    await Promise.all(
      admins.map((admin) =>
        this.mailService.sendMonthlyRevenueMail({
          to: admin.email,
          fullName: admin.fullName,
          month,
          totalRevenue: revenue.totalRevenue,
          totalPayments: revenue.totalPayments,
          byRoomType: revenue.data.map(({ roomType, ...amounts }) => ({
            name: roomType.name,
            ...amounts,
          })),
        }),
      ),
    );

    return { month, recipients: admins.length };
  }
}
