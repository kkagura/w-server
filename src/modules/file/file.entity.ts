import {
  Column,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('sys_file')
export class StoredFile {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ type: 'varchar', length: 100 })
  bucket: string;

  @Column({ name: 'object_key', type: 'varchar', length: 255, unique: true })
  objectKey: string;

  @Column({ name: 'original_name', type: 'varchar', length: 255 })
  originalName: string;

  @Column({ type: 'varchar', length: 20, default: '' })
  ext: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 150 })
  mimeType: string;

  @Column({ type: 'bigint', unsigned: true })
  size: number;

  @Column({ type: 'varchar', length: 64, nullable: true })
  etag: string;

  @Column({ type: 'char', length: 64 })
  sha256: string;

  @Column({ type: 'tinyint', default: 1 })
  status: number;

  @Column({ name: 'is_public', type: 'tinyint', default: 0 })
  isPublic: number;

  @Column({ name: 'biz_type', type: 'varchar', length: 100, nullable: true })
  bizType: string;

  @Column({ name: 'biz_id', type: 'varchar', length: 100, nullable: true })
  bizId: string;

  @Column({ name: 'created_by', type: 'bigint', unsigned: true, nullable: true })
  createdBy: number;

  @Column({ name: 'create_at', type: 'datetime' })
  createAt: Date;

  @Column({ name: 'update_by', type: 'bigint', unsigned: true, nullable: true })
  updateBy: number;

  @Column({ name: 'update_at', type: 'datetime' })
  updateAt: Date;

  @DeleteDateColumn({ name: 'delete_at', type: 'datetime', nullable: true })
  deleteAt: Date;
}
