import { buildBookingStatusMail } from './booking-status-mail.template';
import { BookingStatusMailJob } from '../mail.constants';

describe('buildBookingStatusMail', () => {
  const job: BookingStatusMailJob = {
    to: 'guest@example.com',
    fullName: 'Nguyen <b>A</b>',
    roomName: 'Room 101',
    checkIn: '2026-11-01',
    checkOut: '2026-11-03',
    totalPrice: 1600000,
    status: 'approved',
  };

  it('builds an approval mail with booking details', () => {
    const mail = buildBookingStatusMail(job);

    expect(mail.subject).toBe('Yêu cầu đặt phòng Room 101 đã được xác nhận');
    expect(mail.text).toContain('Nhận phòng: 2026-11-01');
    expect(mail.text).toContain('Tổng tiền: 1.600.000 VND');
    expect(mail.text).not.toContain('Lý do');
  });

  it('includes the reason on rejection and escapes HTML', () => {
    const mail = buildBookingStatusMail({
      ...job,
      status: 'rejected',
      rejectReason: '<script>x</script>',
    });

    expect(mail.subject).toContain('đã bị từ chối');
    expect(mail.text).toContain('Lý do: <script>x</script>');
    expect(mail.html).toContain('&lt;script&gt;');
    expect(mail.html).toContain('Nguyen &lt;b&gt;A&lt;/b&gt;');
    expect(mail.html).not.toContain('<script>');
  });
});
