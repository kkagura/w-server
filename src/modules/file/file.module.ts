import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoredFile } from './file.entity';
import { FileController } from './file.controller';
import { FileService } from './file.service';
import { MinioService } from './storage/minio.service';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([StoredFile])],
  controllers: [FileController],
  providers: [FileService, MinioService],
  exports: [FileService],
})
export class FileModule {}
