import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../../database/index.js';
import { generateToken, authenticate } from '../../middleware/auth.js';
import { loginLimiter } from '../../middleware/rateLimit.js';
import { logAudit, logSystem } from '../../utils/logger.js';

const router = Router();

// POST /api/auth/login
router.post('/login', loginLimiter, async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ success: false, message: 'Username dan password wajib diisi.' });
    return;
  }

  try {
    const user = await db.getOne<{
      id: number;
      username: string;
      password_hash: string;
      full_name: string;
      is_active: number;
      role_id: number;
      role_name: string;
    }>(
      `SELECT u.*, r.name as role_name 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.username = ?`,
      [username]
    );

    if (!user || user.is_active !== 1) {
      await logAudit(null, 'LOGIN_FAILED', 'auth', { username, reason: 'User not found or inactive' }, req.ip);
      res.status(401).json({ success: false, message: 'Username atau password salah.' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      await logAudit(user.id, 'LOGIN_FAILED', 'auth', { username, reason: 'Invalid password' }, req.ip);
      res.status(401).json({ success: false, message: 'Username atau password salah.' });
      return;
    }

    const authUser = {
      id: user.id,
      username: user.username,
      roleId: user.role_id,
      roleName: user.role_name,
      fullName: user.full_name
    };

    const token = generateToken(authUser);

    await logAudit(user.id, 'LOGIN_SUCCESS', 'auth', { username }, req.ip);
    await logSystem('INFO', 'AUTH', `User "${user.username}" (${user.role_name}) berhasil login.`);

    res.json({
      success: true,
      message: 'Login berhasil.',
      token,
      user: authUser
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server saat login.' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: Request, res: Response): Promise<void> => {
  res.json({
    success: true,
    user: req.user
  });
});

// POST /api/auth/change-password
router.post('/change-password', authenticate, async (req: Request, res: Response): Promise<void> => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword || newPassword.length < 6) {
    res.status(400).json({
      success: false,
      message: 'Password baru harus memiliki minimal 6 karakter.'
    });
    return;
  }

  try {
    const user = await db.getOne<{ id: number; password_hash: string }>(
      'SELECT id, password_hash FROM users WHERE id = ?',
      [req.user!.id]
    );

    if (!user) {
      res.status(404).json({ success: false, message: 'User tidak ditemukan.' });
      return;
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      res.status(400).json({ success: false, message: 'Password saat ini salah.' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    await db.execute('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, req.user!.id]);
    await logAudit(req.user!.id, 'PASSWORD_CHANGE', 'auth', {}, req.ip);

    res.json({ success: true, message: 'Password berhasil diubah.' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: 'Gagal mengubah password.' });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req: Request, res: Response): Promise<void> => {
  await logAudit(req.user!.id, 'LOGOUT', 'auth', {}, req.ip);
  res.json({ success: true, message: 'Logout berhasil.' });
});

export default router;
