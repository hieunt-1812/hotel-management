import { ValueTransformer } from 'typeorm';

/** Postgres returns `decimal` as string to avoid precision loss; convert to number for app code. */
export const decimalTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) =>
    value === null || value === undefined ? value : Number(value),
};
