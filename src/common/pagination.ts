import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
}

export interface PaginatedResult<T> {
  list: T[];
  pagination: PaginationMeta;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

export function parsePaginationParams(params: PaginationParams): {
  page: number;
  pageSize: number;
} {
  const page = Math.max(1, Number(params.page) || DEFAULT_PAGE);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(params.pageSize) || DEFAULT_PAGE_SIZE),
  );
  return { page, pageSize };
}

export function paginate<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  params: PaginationParams,
): { queryBuilder: SelectQueryBuilder<T>; meta: PaginationMeta } {
  const { page, pageSize } = parsePaginationParams(params);
  const offset = (page - 1) * pageSize;

  qb.skip(offset).take(pageSize);

  return {
    queryBuilder: qb,
    meta: { page, pageSize, total: 0, pageCount: 0 },
  };
}

export async function getPageAndCount<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  page: number,
  pageSize: number,
): Promise<PaginatedResult<T>> {
  const [list, total] = await qb.getManyAndCount();
  const pageCount = Math.ceil(total / pageSize);
  return {
    list,
    pagination: { page, pageSize, total, pageCount },
  };
}
