import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import {
  paginate,
  getPageAndCount,
  parsePaginationParams,
  type PaginatedResult,
  type PaginationParams,
} from '@/common/pagination';
import { generatePasswordSalt, hashPassword } from '../auth/password.util';

export interface CreateUserDto {
  username: string;
  password: string;
  nickname?: string;
  email?: string;
  mobile?: string;
  avatar?: string;
}

export interface UpdateUserDto {
  nickname?: string;
  email?: string;
  mobile?: string;
  avatar?: string;
  status?: number;
}

export interface UserQueryDto extends PaginationParams {
  username?: string;
  nickname?: string;
  status?: number;
}

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const salt = generatePasswordSalt();
    const password = await hashPassword(dto.password, salt);
    const user = this.userRepo.create({
      ...dto,
      password,
      salt,
    });

    return this.userRepo.save(user);
  }

  async findAll(query: UserQueryDto): Promise<PaginatedResult<User>> {
    const { page, pageSize } = parsePaginationParams(query);
    const qb = this.userRepo
      .createQueryBuilder('user')
      .where('user.delete_at IS NULL');

    if (query.username) {
      qb.andWhere('user.username LIKE :username', { username: `%${query.username}%` });
    }
    if (query.nickname) {
      qb.andWhere('user.nickname LIKE :nickname', { nickname: `%${query.nickname}%` });
    }
    if (query.status !== undefined) {
      qb.andWhere('user.status = :status', { status: query.status });
    }

    paginate(qb, query);
    qb.orderBy('user.id', 'DESC');

    return getPageAndCount(qb, page, pageSize);
  }

  async findOne(id: number): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User #${id} not found`);
    }
    return user;
  }

  async update(id: number, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    Object.assign(user, dto);
    return this.userRepo.save(user);
  }

  async remove(id: number): Promise<void> {
    const user = await this.findOne(id);
    await this.userRepo.softRemove(user);
  }

  async findForAuthByUsername(username: string): Promise<User | null> {
    return this.userRepo
      .createQueryBuilder('user')
      .addSelect(['user.password', 'user.salt'])
      .where('user.username = :username', { username })
      .andWhere('user.delete_at IS NULL')
      .getOne();
  }

  async findActiveById(id: number): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  async updateLoginInfo(id: number, loginIp: string | null): Promise<void> {
    await this.userRepo.update(id, {
      loginIp: loginIp ?? undefined,
      loginAt: new Date(),
    });
  }

  async updatePasswordHash(id: number, password: string): Promise<void> {
    await this.userRepo.update(id, {
      password,
    });
  }
}
