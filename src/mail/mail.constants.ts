export const MAIL_QUEUE = 'mail';

export const MAIL_JOBS = {
  ACTIVATION: 'activation',
} as const;

export interface ActivationMailJob {
  to: string;
  fullName: string;
  activationUrl: string;
  expiresInHours: number;
}
