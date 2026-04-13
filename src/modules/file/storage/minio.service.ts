import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import type { AppConfig, MinioConfig } from '../../../config/config.types';
import type { PutObjectInput, PutObjectResult } from './minio.types';

@Injectable()
export class MinioService {
  private readonly logger = new Logger(MinioService.name);
  private readonly client: Client;
  private bucketEnsured = false;

  constructor(private readonly configService: ConfigService<AppConfig>) {
    const config = this.getConfig();

    this.client = new Client({
      endPoint: config.endpoint,
      port: config.port,
      useSSL: config.useSSL,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
    });
  }

  isEnabled(): boolean {
    return this.getConfig().enabled;
  }

  async putObject(input: PutObjectInput): Promise<PutObjectResult> {
    await this.ensureEnabled();
    await this.ensureBucket();

    const bucket = this.getConfig().bucket;
    const etag = await this.client.putObject(
      bucket,
      input.objectKey,
      input.body,
      input.size,
      {
        'Content-Type': input.mimeType,
      },
    );

    return {
      bucket,
      objectKey: input.objectKey,
      etag: etag ? String(etag).replace(/"/g, '') : null,
    };
  }

  async getObject(objectKey: string) {
    await this.ensureEnabled();

    try {
      return await this.client.getObject(this.getConfig().bucket, objectKey);
    } catch {
      throw new NotFoundException('文件对象不存在');
    }
  }

  async removeObject(objectKey: string): Promise<void> {
    await this.ensureEnabled();

    try {
      await this.client.removeObject(this.getConfig().bucket, objectKey);
    } catch (error) {
      this.logger.warn(
        `Failed to remove object "${objectKey}": ${String(error)}`,
      );
    }
  }

  private getConfig(): MinioConfig {
    return this.configService.getOrThrow('minio', { infer: true });
  }

  private async ensureEnabled(): Promise<void> {
    if (!this.isEnabled()) {
      throw new ServiceUnavailableException(
        '当前环境未启用 MinIO，无法使用文件存储能力',
      );
    }
  }

  private async ensureBucket(): Promise<void> {
    if (this.bucketEnsured) {
      return;
    }

    const bucket = this.getConfig().bucket;
    const exists = await this.client.bucketExists(bucket);

    if (!exists) {
      await this.client.makeBucket(bucket);
      this.logger.log(`Created MinIO bucket "${bucket}".`);
    }

    this.bucketEnsured = true;
  }
}
