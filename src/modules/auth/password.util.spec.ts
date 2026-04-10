import {
  generatePasswordSalt,
  hashPassword,
  verifyPassword,
} from './password.util';

describe('password util', () => {
  it('should hash and verify password successfully', async () => {
    const password = 'P@ssw0rd';
    const salt = generatePasswordSalt();
    const hashedPassword = await hashPassword(password, salt);

    expect(hashedPassword).not.toBe(password);
    await expect(verifyPassword(password, salt, hashedPassword)).resolves.toBe(
      true,
    );
    await expect(
      verifyPassword('wrong-password', salt, hashedPassword),
    ).resolves.toBe(false);
  });
});
