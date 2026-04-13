import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { Response } from 'express';
import { Repository } from 'typeorm';
import {
  getPageAndCount,
  paginate,
  parsePaginationParams,
  type PaginatedResult,
} from '@/common/pagination';
import type { AppConfig, FileConfig } from '../../config/config.types';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  DEFAULT_FILE_BIZ_TYPE,
  FILE_CONTENT_MODE,
  FILE_STATUS,
} from './file.constants';
import type { QueryFileDto } from './dto/query-file.dto';
import type { UploadFileDto, UploadedFilePayload } from './dto/upload-file.dto';
import { StoredFile } from './file.entity';
import type { PublicStoredFile } from './file.presenter';
import { toPublicFile, toPublicFiles } from './file.presenter';
import { MinioService } from './storage/minio.service';

@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name);

  constructor(
    @InjectRepository(StoredFile)
    private readonly fileRepo: Repository<StoredFile>,
    private readonly configService: ConfigService<AppConfig>,
    private readonly minioService: MinioService,
  ) {}

  async upload(
    file: UploadedFilePayload | undefined,
    dto: UploadFileDto,
    currentUser: AuthenticatedUser,
  ): Promise<PublicStoredFile> {
    const uploadFile = this.assertUploadFile(file);
    const fileConfig = this.getFileConfig();
    const mimeType = this.normalizeMimeType(uploadFile.mimetype);

    if (uploadFile.size > fileConfig.maxSize) {
      throw new BadRequestException(
        `文件大小超过限制，最大允许 ${fileConfig.maxSize} 字节`,
      );
    }

    if (!this.matchesMimeType(mimeType, fileConfig.allowedMimeTypes)) {
      throw new UnsupportedMediaTypeException('当前文件类型不允许上传');
    }

    const originalName = this.normalizeOriginalName(uploadFile.originalname);
    const ext = this.extractExtension(originalName);
    const objectKey = this.generateObjectKey(dto.bizType, ext);
    const sha256 = createHash('sha256').update(uploadFile.buffer).digest('hex');
    const uploaded = await this.minioService.putObject({
      objectKey,
      body: uploadFile.buffer,
      size: uploadFile.size,
      mimeType,
    });

    try {
      const entityPayload: Partial<StoredFile> = {
        bucket: uploaded.bucket,
        objectKey: uploaded.objectKey,
        originalName,
        ext,
        mimeType,
        size: uploadFile.size,
        etag: uploaded.etag ?? undefined,
        sha256,
        status: FILE_STATUS.AVAILABLE,
        isPublic: this.parsePublicFlag(dto.isPublic),
        bizType:
          this.normalizeOptionalValue(dto.bizType) ?? DEFAULT_FILE_BIZ_TYPE,
        bizId: this.normalizeOptionalValue(dto.bizId) ?? undefined,
        createdBy: currentUser.id,
        updateBy: currentUser.id,
      };
      const savedFile = await this.fileRepo.save(
        this.fileRepo.create(entityPayload),
      );

      return toPublicFile(savedFile);
    } catch (error) {
      await this.minioService.removeObject(uploaded.objectKey);
      throw error;
    }
  }

  async findAll(query: QueryFileDto): Promise<PaginatedResult<PublicStoredFile>> {
    const { page, pageSize } = parsePaginationParams(query);
    const qb = this.fileRepo
      .createQueryBuilder('file')
      .where('file.delete_at IS NULL');

    if (query.bizType) {
      qb.andWhere('file.biz_type = :bizType', { bizType: query.bizType.trim() });
    }

    if (query.bizId) {
      qb.andWhere('file.biz_id = :bizId', { bizId: query.bizId.trim() });
    }

    if (query.originalName) {
      qb.andWhere('file.original_name LIKE :originalName', {
        originalName: `%${query.originalName.trim()}%`,
      });
    }

    if (query.status !== undefined) {
      qb.andWhere('file.status = :status', { status: Number(query.status) });
    }

    if (query.createdBy !== undefined) {
      qb.andWhere('file.created_by = :createdBy', {
        createdBy: Number(query.createdBy),
      });
    }

    paginate(qb, query);
    qb.orderBy('file.id', 'DESC');

    return toPublicFiles(await getPageAndCount(qb, page, pageSize));
  }

  async findOne(id: number): Promise<PublicStoredFile> {
    return toPublicFile(await this.findOneEntity(id));
  }

  async delete(id: number, currentUser: AuthenticatedUser): Promise<void> {
    const file = await this.findOneEntity(id);

    await this.fileRepo.update(id, {
      status: FILE_STATUS.DELETED,
      updateBy: currentUser.id,
    });
    await this.fileRepo.softDelete(id);
    await this.minioService.removeObject(file.objectKey);
  }

  async writeContentToResponse(
    id: number,
    mode: string | undefined,
    response: Response,
  ): Promise<void> {
    const file = await this.findOneEntity(id);
    const resolvedMode = this.resolveContentMode(mode);
    const canPreview = this.matchesMimeType(
      file.mimeType,
      this.getFileConfig().previewMimeTypes,
    );
    const dispositionType =
      resolvedMode === FILE_CONTENT_MODE.DOWNLOAD || !canPreview
        ? 'attachment'
        : 'inline';
    const stream = await this.minioService.getObject(file.objectKey);

    response.status(200);
    response.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    response.setHeader('Content-Length', String(file.size));

    if (file.etag) {
      response.setHeader('ETag', file.etag);
    }

    response.setHeader(
      'Content-Disposition',
      this.buildContentDisposition(dispositionType, file.originalName),
    );

    try {
      await pipeline(stream, response);
    } catch (error) {
      this.logger.error(`Failed to stream file #${id}: ${String(error)}`);
      throw new NotFoundException('文件内容不存在或读取失败');
    }
  }

  private getFileConfig(): FileConfig {
    return this.configService.getOrThrow('file', { infer: true });
  }

  private async findOneEntity(id: number): Promise<StoredFile> {
    const file = await this.fileRepo.findOne({
      where: { id },
    });

    if (!file) {
      throw new NotFoundException(`文件 #${id} 不存在`);
    }

    return file;
  }

  private assertUploadFile(
    file: UploadedFilePayload | undefined,
  ): UploadedFilePayload {
    if (!file || !file.buffer || file.size <= 0) {
      throw new BadRequestException('请选择需要上传的文件');
    }

    return file;
  }

  private normalizeMimeType(mimeType: string): string {
    return mimeType?.trim().toLowerCase() || 'application/octet-stream';
  }

  private normalizeOriginalName(originalName: string): string {
    const name = originalName?.trim();

    return name ? name.slice(-255) : 'unnamed-file';
  }

  private normalizeOptionalValue(value: string | undefined): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.trim();

    return normalized || undefined;
  }

  private extractExtension(originalName: string): string {
    return extname(originalName).replace('.', '').toLowerCase();
  }

  private generateObjectKey(bizType: string | undefined, ext: string): string {
    const normalizedBizType =
      this.normalizeOptionalValue(bizType) ?? DEFAULT_FILE_BIZ_TYPE;
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const suffix = ext ? `.${ext}` : '';

    return `${normalizedBizType}/${year}/${month}/${day}/${randomUUID()}${suffix}`;
  }

  private parsePublicFlag(value: number | string | undefined): number {
    if (value === undefined) {
      return 0;
    }

    if (value === 1 || value === '1' || value === 'true') {
      return 1;
    }

    return 0;
  }

  private resolveContentMode(mode: string | undefined): string {
    if (!mode || mode === FILE_CONTENT_MODE.PREVIEW) {
      return FILE_CONTENT_MODE.PREVIEW;
    }

    if (mode === FILE_CONTENT_MODE.DOWNLOAD) {
      return FILE_CONTENT_MODE.DOWNLOAD;
    }

    throw new BadRequestException('mode 参数仅支持 preview 或 download');
  }

  private matchesMimeType(mimeType: string, patterns: string[]): boolean {
    return patterns.some((pattern) => {
      if (pattern.endsWith('/*')) {
        const prefix = pattern.slice(0, pattern.length - 1);

        return mimeType.startsWith(prefix);
      }

      return mimeType === pattern;
    });
  }

  private buildContentDisposition(
    dispositionType: 'inline' | 'attachment',
    originalName: string,
  ): string {
    const fallbackName = originalName
      .replace(/[^\x20-\x7E]/g, '_')
      .replace(/["\\]/g, '_');
    const encodedName = encodeURIComponent(originalName);

    return `${dispositionType}; filename="${fallbackName}"; filename*=UTF-8''${encodedName}`;
  }
}
