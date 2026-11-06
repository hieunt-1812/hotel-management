import { buildMonthlyRevenueMail } from './monthly-revenue-mail.template';
import { MonthlyRevenueMailJob } from '../mail.constants';

describe('buildMonthlyRevenueMail', () => {
  const job: MonthlyRevenueMailJob = {
    to: 'admin@example.com',
    fullName: 'Admin <i>Hotel</i>',
    month: '2026-11',
    totalRevenue: 3200000,
    totalPayments: 3,
    byRoomType: [
      { name: 'Deluxe', revenue: 2000000, payments: 1 },
      { name: 'Standard <b>', revenue: 1200000, payments: 2 },
    ],
  };

  it('builds the monthly report with totals and room type breakdown', () => {
    const mail = buildMonthlyRevenueMail(job);

    expect(mail.subject).toBe('Báo cáo doanh thu tháng 11/2026');
    expect(mail.text).toContain('Tổng doanh thu: 3.200.000 VND');
    expect(mail.text).toContain('Số giao dịch đã thanh toán: 3');
    expect(mail.text).toContain('Deluxe: 2.000.000 VND (1 giao dịch)');
  });

  it('escapes names in the HTML version', () => {
    const mail = buildMonthlyRevenueMail(job);

    expect(mail.html).toContain('Admin &lt;i&gt;Hotel&lt;/i&gt;');
    expect(mail.html).toContain('Standard &lt;b&gt;');
    expect(mail.html).not.toContain('<i>Hotel');
  });
});
