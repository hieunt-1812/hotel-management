export enum BookingStatisticsGroupBy {
  MONTH = 'month',
  QUARTER = 'quarter',
  ROOM_TYPE = 'roomType',
}

export enum RevenueGroupBy {
  DAY = 'day',
  MONTH = 'month',
  ROOM_TYPE = 'roomType',
}

export const MONTHS_PER_YEAR = 12;

export const QUARTERS_PER_YEAR = 4;

export const MIN_STATISTICS_YEAR = 2000;

export const MAX_STATISTICS_YEAR = 2100;

export const MAX_DAILY_REVENUE_RANGE_DAYS = 366;

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export const MONTHLY_REVENUE_REPORT_JOB = 'send-monthly-revenue-report';

export const MONTHLY_REVENUE_REPORT_DEFAULT_CRON = '0 23 * * *';
