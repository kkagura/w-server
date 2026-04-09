import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'node:crypto';
import { User } from './user.entity';
import {
  paginate,
  getPageAndCount,
  parsePaginationParams,
  type PaginatedResult,
  type PaginationParams,
} from '@/common/pagination';

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
    const salt = randomBytes(4).toString('hex'); // 8 char hex
    // Note: password hashing should be done with bcrypt in production
    // hash = await bcrypt(password + salt)
    const user = this.userRepo.create({
      ...dto,
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
}
