import { buildBookingUpdatedMail } from './booking-updated-mail.template';
import { BookingUpdatedMailJob } from '../mail.constants';

describe('buildBookingUpdatedMail', () => {
  const previous = {
    roomName: 'Room 101',
    checkIn: '2026-12-01',
    checkOut: '2026-12-03',
    totalPrice: 1000000,
    note: null,
  };
  const job: BookingUpdatedMailJob = {
    to: 'guest@example.com',
    fullName: 'Nguyen <b>A</b>',
    previous,
    current: {
      ...previous,
      roomName: 'Room 201',
      checkOut: '2026-12-04',
      totalPrice: 3600000,
    },
  };

  it('shows old → new values for changed fields only', () => {
    const mail = buildBookingUpdatedMail(job);

    expect(mail.subject).toBe('Thông tin đặt phòng Room 201 đã được thay đổi');
    expect(mail.text).toContain('Phòng: Room 101 → Room 201');
    expect(mail.text).toContain('Nhận phòng: 2026-12-01\n');
    expect(mail.text).toContain('Trả phòng: 2026-12-03 → 2026-12-04');
    expect(mail.text).toContain('Tổng tiền: 1.000.000 VND → 3.600.000 VND');
    expect(mail.text).toContain('Ghi chú: (không có)');
  });

  it('escapes HTML in the name and the note', () => {
    const mail = buildBookingUpdatedMail({
      ...job,
      current: { ...job.current, note: '<script>x</script>' },
    });

    expect(mail.html).toContain('Nguyen &lt;b&gt;A&lt;/b&gt;');
    expect(mail.html).toContain('&lt;script&gt;x&lt;/script&gt;');
    expect(mail.html).not.toContain('<script>');
  });
});
