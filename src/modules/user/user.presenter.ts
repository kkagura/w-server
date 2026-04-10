import type { PaginatedResult } from '@/common/pagination';
import type { User } from './user.entity';

export type PublicUser = Omit<User, 'password' | 'salt'>;

export function toPublicUser(user: User): PublicUser {
  const { password: _password, salt: _salt, ...publicUser } = user;

  return publicUser;
}

export function toPublicUsers(
  result: PaginatedResult<User>,
): PaginatedResult<PublicUser> {
  return {
    list: result.list.map(toPublicUser),
    pagination: result.pagination,
  };
}
