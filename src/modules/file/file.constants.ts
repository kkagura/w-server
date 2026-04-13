export const FILE_STATUS = {
  UPLOADING: 0,
  AVAILABLE: 1,
  DELETED: 2,
  ERROR: 3,
} as const;

export const FILE_CONTENT_MODE = {
  PREVIEW: 'preview',
  DOWNLOAD: 'download',
} as const;

export const DEFAULT_FILE_BIZ_TYPE = 'general';
