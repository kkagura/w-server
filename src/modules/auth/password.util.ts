import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const PASSWORD_KEY_LENGTH = 64;

export function generatePasswordSalt(): string {
  return randomBytes(4).toString('hex');
}

export async function hashPassword(
  password: string,
  salt: string,
): Promise<string> {
  const derivedKey = (await scrypt(
    password,
    salt,
    PASSWORD_KEY_LENGTH,
  )) as Buffer;

  return derivedKey.toString('hex');
}

export async function verifyPassword(
  password: string,
  salt: string,
  hashedPassword: string,
): Promise<boolean> {
  const derivedKey = await hashPassword(password, salt);
  const expected = Buffer.from(hashedPassword, 'hex');
  const actual = Buffer.from(derivedKey, 'hex');

  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}
