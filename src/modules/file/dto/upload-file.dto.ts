export interface UploadFileDto {
  bizType?: string;
  bizId?: string;
  isPublic?: number | string;
}

export interface UploadedFilePayload {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}
