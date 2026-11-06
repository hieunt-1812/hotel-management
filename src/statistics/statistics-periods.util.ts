import { MS_PER_DAY } from './statistics.constants';

const toDateOnly = (time: number) => new Date(time).toISOString().slice(0, 10);

const pad = (value: number) => String(value).padStart(2, '0');

export const addDays = (date: string, days: number) =>
  toDateOnly(Date.parse(date) + days * MS_PER_DAY);

export function listDays(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
  return days;
}

export function listMonths(from: string, to: string): string[] {
  const months: string[] = [];
  let [year, month] = from.split('-').map(Number);
  const last = to.slice(0, 7);
  for (let current = `${year}-${pad(month)}`; current <= last;) {
    months.push(current);
    month = (month % 12) + 1;
    if (month === 1) year += 1;
    current = `${year}-${pad(month)}`;
  }
  return months;
}

export function monthRange(month: string) {
  const [year, monthIndex] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${pad(lastDay)}` };
}

export function isLastDayOfMonth(date: Date) {
  const nextDay = new Date(date);
  nextDay.setDate(date.getDate() + 1);
  return nextDay.getDate() === 1;
}

export const toLocalMonth = (date: Date) =>
  date.toLocaleDateString('sv-SE').slice(0, 7);
