import { ActivationMailJob } from '../mail.constants';
import { escapeHtml } from './escape-html.util';

export function buildActivationMail(job: ActivationMailJob) {
  const name = escapeHtml(job.fullName);
  const url = escapeHtml(job.activationUrl);

  return {
    subject: 'Kích hoạt tài khoản Hotel Management',
    text: `Xin chào ${job.fullName},\n\nVui lòng kích hoạt tài khoản tại: ${job.activationUrl}\nLiên kết hết hạn sau ${job.expiresInHours} giờ.`,
    html: `<p>Xin chào ${name},</p>
<p>Cảm ơn bạn đã đăng ký. Vui lòng bấm vào liên kết dưới đây để kích hoạt tài khoản:</p>
<p><a href="${url}">Kích hoạt tài khoản</a></p>
<p>Liên kết hết hạn sau ${job.expiresInHours} giờ.</p>`,
  };
}
