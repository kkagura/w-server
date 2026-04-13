export interface PutObjectInput {
  objectKey: string;
  body: Buffer;
  size: number;
  mimeType: string;
}

export interface PutObjectResult {
  bucket: string;
  objectKey: string;
  etag: string | null;
}
