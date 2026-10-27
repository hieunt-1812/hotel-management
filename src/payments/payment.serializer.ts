import { Payment } from './entities/payment.entity';

export function serializePayment(payment: Payment) {
  return {
    id: payment.id,
    bookingId: payment.booking?.id,
    amount: payment.amount,
    method: payment.method,
    status: payment.status,
    paidAt: payment.paidAt,
    createdAt: payment.createdAt,
  };
}
