import { Paginated } from "@traveltok/types";

export interface PaginationParams {
  skip: number;
  take: number;
}

export function paginationParams(page: number, pageSize: number): PaginationParams {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function buildPagination<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
): Paginated<T> {
  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Restricts an arbitrary sort field to a whitelist; falls back to a default. */
export function allowedSort(
  sort: string | undefined,
  whitelist: readonly string[],
  fallback: string,
): string {
  if (sort && whitelist.includes(sort)) return sort;
  return fallback;
}
