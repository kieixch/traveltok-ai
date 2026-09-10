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
): {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
} {
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

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export function pageParams(
  query: URLSearchParams,
): { page: number; pageSize: number; order: "asc" | "desc" } {
  const page = Math.max(1, Number(query.get("page") ?? 1) || 1);
  const rawPageSize = Number(query.get("pageSize") ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, rawPageSize));
  const order = query.get("order") === "asc" ? "asc" : "desc";
  return { page, pageSize, order };
}