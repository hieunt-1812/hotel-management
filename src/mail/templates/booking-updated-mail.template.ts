import { BookingMailDetails, BookingUpdatedMailJob } from '../mail.constants';
import { escapeHtml } from './escape-html.util';
import { formatVnd } from './format-vnd.util';

const DETAIL_FIELDS: {
  label: string;
  format: (details: BookingMailDetails) => string;
}[] = [
  { label: 'Phòng', format: (details) => details.roomName },
  { label: 'Nhận phòng', format: (details) => details.checkIn },
  { label: 'Trả phòng', format: (details) => details.checkOut },
  { label: 'Tổng tiền', format: (details) => formatVnd(details.totalPrice) },
  { label: 'Ghi chú', format: (details) => details.note ?? '(không có)' },
];

export function buildBookingUpdatedMail(job: BookingUpdatedMailJob) {
  const details = DETAIL_FIELDS.map(({ label, format }) => {
    const before = format(job.previous);
    const after = format(job.current);
    return before === after
      ? `${label}: ${after}`
      : `${label}: ${before} → ${after}`;
  });

  return {
    subject: `Thông tin đặt phòng ${job.current.roomName} đã được thay đổi`,
    text: `Xin chào ${job.fullName},\n\nThông tin đặt phòng của bạn đã được quản trị viên thay đổi.\n\n${details.join('\n')}`,
    html: `<p>Xin chào ${escapeHtml(job.fullName)},</p>
<p>Thông tin đặt phòng của bạn đã được quản trị viên <b>thay đổi</b>.</p>
<ul>${details.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>`,
  };
}
