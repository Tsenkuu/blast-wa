import { describe, it, expect, beforeAll } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../src/database/index.js';
import { runSeed } from '../src/database/seed.js';
import { generateToken } from '../src/middleware/auth.js';
import { config } from '../src/config/index.js';

describe('Authentication & Role System', () => {
  beforeAll(async () => {
    await db.init();
    await runSeed();
  });

  it('should authenticate user with valid credentials', async () => {
    const user = await db.getOne<{ id: number; username: string; password_hash: string }>(
      'SELECT id, username, password_hash FROM users WHERE username = ?',
      ['admin']
    );
    expect(user).toBeDefined();

    const isMatch = await bcrypt.compare('Admin@WA2026', user!.password_hash);
    expect(isMatch).toBe(true);

    const isWrongMatch = await bcrypt.compare('WrongPassword123', user!.password_hash);
    expect(isWrongMatch).toBe(false);
  });

  it('should generate and verify valid JWT token', () => {
    const authUser = {
      id: 1,
      username: 'admin',
      roleId: 1,
      roleName: 'Super Admin',
      fullName: 'Administrator Utama'
    };

    const token = generateToken(authUser);
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');

    const decoded = jwt.verify(token, config.jwtSecret) as any;
    expect(decoded.username).toBe('admin');
    expect(decoded.roleName).toBe('Super Admin');
  });
});
