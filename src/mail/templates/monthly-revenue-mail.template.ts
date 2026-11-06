import { MonthlyRevenueMailJob } from '../mail.constants';
import { escapeHtml } from './escape-html.util';
import { formatVnd } from './format-vnd.util';

export function buildMonthlyRevenueMail(job: MonthlyRevenueMailJob) {
  const [year, month] = job.month.split('-');
  const period = `${month}/${year}`;
  const summary = [
    `Tổng doanh thu: ${formatVnd(job.totalRevenue)}`,
    `Số giao dịch đã thanh toán: ${job.totalPayments}`,
  ];
  const byRoomType = job.byRoomType.map(
    (item) =>
      `${item.name}: ${formatVnd(item.revenue)} (${item.payments} giao dịch)`,
  );

  return {
    subject: `Báo cáo doanh thu tháng ${period}`,
    text: `Xin chào ${job.fullName},\n\nBáo cáo doanh thu tháng ${period}:\n\n${summary.join('\n')}\n\nTheo loại phòng:\n${byRoomType.join('\n')}`,
    html: `<p>Xin chào ${escapeHtml(job.fullName)},</p>
<p>Báo cáo doanh thu tháng <b>${period}</b>:</p>
<ul>${summary.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>
<p>Theo loại phòng:</p>
<ul>${byRoomType.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`,
  };
}
