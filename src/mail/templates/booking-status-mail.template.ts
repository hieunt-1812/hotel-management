import { BookingStatusMailJob } from '../mail.constants';
import { escapeHtml } from './escape-html.util';

const formatVnd = (amount: number) => `${amount.toLocaleString('vi-VN')} VND`;

export function buildBookingStatusMail(job: BookingStatusMailJob) {
  const approved = job.status === 'approved';
  const result = approved ? 'đã được xác nhận' : 'đã bị từ chối';
  const details = [
    `Phòng: ${job.roomName}`,
    `Nhận phòng: ${job.checkIn}`,
    `Trả phòng: ${job.checkOut}`,
    `Tổng tiền: ${formatVnd(job.totalPrice)}`,
    ...(!approved && job.rejectReason ? [`Lý do: ${job.rejectReason}`] : []),
  ];

  return {
    subject: `Yêu cầu đặt phòng ${job.roomName} ${result}`,
    text: `Xin chào ${job.fullName},\n\nYêu cầu đặt phòng của bạn ${result}.\n\n${details.join('\n')}`,
    html: `<p>Xin chào ${escapeHtml(job.fullName)},</p>
<p>Yêu cầu đặt phòng của bạn <b>${result}</b>.</p>
<ul>${details.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`,
  };
}
