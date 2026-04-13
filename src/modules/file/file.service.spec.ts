import type { ConfigService } from '@nestjs/config';
import type { Repository } from 'typeorm';
import type { AppConfig, FileConfig } from '../../config/config.types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { FILE_STATUS } from './file.constants';
import { StoredFile } from './file.entity';
import { FileService } from './file.service';
import type { UploadedFilePayload } from './dto/upload-file.dto';
import { MinioService } from './storage/minio.service';

describe('FileService', () => {
  const fileConfig: FileConfig = {
    maxSize: 10 * 1024 * 1024,
    previewMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
    allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
  };
  const currentUser = {
    id: 1,
    username: 'admin',
    sessionId: 'session-id',
  } as AuthenticatedUser;

  let service: FileService;
  let fileRepo: jest.Mocked<Repository<StoredFile>>;
  let configService: jest.Mocked<ConfigService<AppConfig>>;
  let minioService: jest.Mocked<MinioService>;

  beforeEach(() => {
    fileRepo = {
      create: jest.fn((value) => value as StoredFile),
      save: jest.fn(async (value) => ({
        id: 1,
        createAt: new Date(),
        updateAt: new Date(),
        deleteAt: null,
        ...value,
      })),
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
      softDelete: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn(),
    } as unknown as jest.Mocked<Repository<StoredFile>>;
    configService = {
      getOrThrow: jest.fn().mockImplementation((key: keyof AppConfig) => {
        if (key === 'file') {
          return fileConfig;
        }

        throw new Error(`Unexpected config key: ${String(key)}`);
      }),
    } as unknown as jest.Mocked<ConfigService<AppConfig>>;
    minioService = {
      putObject: jest.fn().mockResolvedValue({
        bucket: 'w-server',
        objectKey: 'general/2026/04/13/test.png',
        etag: 'etag-1',
      }),
      removeObject: jest.fn().mockResolvedValue(undefined),
      getObject: jest.fn(),
      isEnabled: jest.fn().mockReturnValue(true),
    } as unknown as jest.Mocked<MinioService>;

    service = new FileService(fileRepo, configService, minioService);
  });

  it('should upload file and persist metadata', async () => {
    const file: UploadedFilePayload = {
      originalname: 'avatar.png',
      mimetype: 'image/png',
      size: 1024,
      buffer: Buffer.from('test'),
    };

    const result = await service.upload(
      file,
      { bizType: 'user-avatar', bizId: '1' },
      currentUser,
    );

    expect(minioService.putObject).toHaveBeenCalledTimes(1);
    expect(fileRepo.save).toHaveBeenCalledTimes(1);
    expect(result.id).toBe(1);
    expect(result.originalName).toBe('avatar.png');
    expect(result.previewUrl).toContain('/files/1/content?mode=preview');
  });

  it('should reject upload when mime type is not allowed', async () => {
    const file: UploadedFilePayload = {
      originalname: 'script.js',
      mimetype: 'application/javascript',
      size: 1024,
      buffer: Buffer.from('console.log(1)'),
    };

    await expect(service.upload(file, {}, currentUser)).rejects.toThrow(
      '当前文件类型不允许上传',
    );
    expect(minioService.putObject).not.toHaveBeenCalled();
  });

  it('should delete metadata and object', async () => {
    fileRepo.findOne.mockResolvedValue({
      id: 1,
      bucket: 'w-server',
      objectKey: 'general/test.pdf',
      originalName: 'test.pdf',
      ext: 'pdf',
      mimeType: 'application/pdf',
      size: 2048,
      etag: 'etag-2',
      sha256: 'a'.repeat(64),
      status: FILE_STATUS.AVAILABLE,
      isPublic: 0,
      bizType: 'general',
      bizId: undefined,
      createdBy: 1,
      createAt: new Date(),
      updateBy: 1,
      updateAt: new Date(),
      deleteAt: null,
    } as unknown as StoredFile);

    await service.delete(1, currentUser);

    expect(fileRepo.update).toHaveBeenCalledWith(1, {
      status: FILE_STATUS.DELETED,
      updateBy: 1,
    });
    expect(fileRepo.softDelete).toHaveBeenCalledWith(1);
    expect(minioService.removeObject).toHaveBeenCalledWith('general/test.pdf');
  });
});
