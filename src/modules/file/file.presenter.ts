import type { PaginatedResult } from '@/common/pagination';
import type { StoredFile } from './file.entity';

export type PublicStoredFile = Omit<StoredFile, 'bucket' | 'objectKey'> & {
  contentUrl: string;
  previewUrl: string;
  downloadUrl: string;
};

export function toPublicFile(file: StoredFile): PublicStoredFile {
  const { bucket: _bucket, objectKey: _objectKey, ...publicFile } = file;
  const basePath = `/files/${file.id}/content`;

  return {
    ...publicFile,
    contentUrl: basePath,
    previewUrl: `${basePath}?mode=preview`,
    downloadUrl: `${basePath}?mode=download`,
  };
}

export function toPublicFiles(
  result: PaginatedResult<StoredFile>,
): PaginatedResult<PublicStoredFile> {
  return {
    list: result.list.map(toPublicFile),
    pagination: result.pagination,
  };
}
