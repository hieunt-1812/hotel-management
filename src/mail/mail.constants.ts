export const MAIL_QUEUE = 'mail';

export const MAIL_JOBS = {
  ACTIVATION: 'activation',
  BOOKING_STATUS: 'booking-status',
} as const;

/** Retry failed sends 3 times (5s, 10s, 20s) and drop the job once delivered. */
export const MAIL_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: true,
};

export interface ActivationMailJob {
  to: string;
  fullName: string;
  activationUrl: string;
  expiresInHours: number;
}

export interface BookingStatusMailJob {
  to: string;
  fullName: string;
  roomName: string;
  checkIn: string;
  checkOut: string;
  totalPrice: number;
  status: 'approved' | 'rejected';
  rejectReason?: string | null;
}
