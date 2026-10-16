export interface PaginatedResult<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

/** Builds the standard paginated response from a findAndCount/getManyAndCount result. */
export function toPaginatedResult<T>(
  [data, total]: [T[], number],
  page: number,
  limit: number,
): PaginatedResult<T> {
  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}
