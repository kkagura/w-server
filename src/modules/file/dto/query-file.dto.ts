import type { PaginationParams } from '@/common/pagination';

export interface QueryFileDto extends PaginationParams {
  bizType?: string;
  bizId?: string;
  originalName?: string;
  status?: number;
  createdBy?: number;
}
