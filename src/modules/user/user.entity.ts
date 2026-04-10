import {
  Column,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('sys_user')
export class User {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  username: string;

  @Column({ type: 'varchar', length: 255, select: false })
  password: string;

  @Column({ type: 'char', length: 8, select: false })
  salt: string;

  @Column({ name: 'nickname', type: 'varchar', length: 50, nullable: true })
  nickname: string;

  @Column({ name: 'email', type: 'varchar', length: 100, nullable: true, unique: true })
  email: string;

  @Column({ name: 'mobile', type: 'varchar', length: 20, nullable: true, unique: true })
  mobile: string;

  @Column({ name: 'avatar', type: 'varchar', length: 255, nullable: true })
  avatar: string;

  @Column({ name: 'status', type: 'tinyint', default: 1 })
  status: number;

  @Column({ name: 'login_ip', type: 'varchar', length: 50, nullable: true })
  loginIp: string;

  @Column({ name: 'login_at', type: 'datetime', nullable: true })
  loginAt: Date;

  @Column({ name: 'create_by', type: 'bigint', unsigned: true, nullable: true })
  createBy: number;

  @Column({ name: 'create_at', type: 'datetime' })
  createAt: Date;

  @Column({ name: 'update_by', type: 'bigint', unsigned: true, nullable: true })
  updateBy: number;

  @Column({ name: 'update_at', type: 'datetime' })
  updateAt: Date;

  @DeleteDateColumn({ name: 'delete_at', type: 'datetime', nullable: true })
  deleteAt: Date;
}
