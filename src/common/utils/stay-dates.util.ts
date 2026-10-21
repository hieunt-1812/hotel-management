import { BadRequestException } from '@nestjs/common';

/** YYYY-MM-DD, used by date-only query/body fields. */
export const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Server-local date as YYYY-MM-DD. */
export const today = () => new Date().toLocaleDateString('sv-SE');

/** checkIn must not be in the past and checkOut must be after checkIn. */
export function assertValidStay(checkIn: string, checkOut: string) {
  if (checkIn < today()) {
    throw new BadRequestException('checkIn không được ở quá khứ');
  }
  if (checkOut <= checkIn) {
    throw new BadRequestException('checkOut phải sau checkIn');
  }
}

/** Number of nights between two YYYY-MM-DD dates (both parsed as UTC, so DST-safe). */
export function countNights(checkIn: string, checkOut: string) {
  return Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / MS_PER_DAY);
}
