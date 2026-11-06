import {
  addDays,
  isLastDayOfMonth,
  listDays,
  listMonths,
  monthRange,
} from './statistics-periods.util';

describe('statistics periods', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('lists every day of an inclusive range', () => {
    expect(listDays('2026-02-27', '2026-03-02')).toEqual([
      '2026-02-27',
      '2026-02-28',
      '2026-03-01',
      '2026-03-02',
    ]);
    expect(listDays('2026-03-02', '2026-03-01')).toEqual([]);
  });

  it('lists months across a year boundary', () => {
    expect(listMonths('2026-11-15', '2027-02-01')).toEqual([
      '2026-11',
      '2026-12',
      '2027-01',
      '2027-02',
    ]);
    expect(listMonths('2026-11-01', '2026-11-30')).toEqual(['2026-11']);
  });

  it('returns the first and last day of a month, leap years included', () => {
    expect(monthRange('2026-11')).toEqual({
      from: '2026-11-01',
      to: '2026-11-30',
    });
    expect(monthRange('2028-02')).toEqual({
      from: '2028-02-01',
      to: '2028-02-29',
    });
    expect(monthRange('2026-12').to).toBe('2026-12-31');
  });

  it('detects the last day of a month', () => {
    expect(isLastDayOfMonth(new Date(2026, 10, 30, 23))).toBe(true);
    expect(isLastDayOfMonth(new Date(2026, 11, 31, 23))).toBe(true);
    expect(isLastDayOfMonth(new Date(2027, 1, 28, 23))).toBe(true);
    expect(isLastDayOfMonth(new Date(2028, 1, 28, 23))).toBe(false);
    expect(isLastDayOfMonth(new Date(2026, 10, 29, 23))).toBe(false);
  });
});
