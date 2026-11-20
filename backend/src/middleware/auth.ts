import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { db } from '../database/index.js';

export interface AuthUser {
  id: number;
  username: string;
  roleId: number;
  roleName: string;
  fullName: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      roleId: user.roleId,
      roleName: user.roleName,
      fullName: user.fullName
    },
    config.jwtSecret,
    { expiresIn: '24h' }
  );
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.substring(7)
    : req.cookies?.token;

  if (!token) {
    res.status(401).json({ success: false, message: 'Autentikasi diperlukan. Silakan login terlebih dahulu.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as any;
    
    // Check if user is still active in database
    const user = await db.getOne<{ id: number; username: string; is_active: number; role_name: string; full_name: string; role_id: number }>(
      `SELECT u.id, u.username, u.is_active, u.full_name, u.role_id, r.name as role_name 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.id = ?`,
      [decoded.id]
    );

    if (!user || user.is_active !== 1) {
      res.status(401).json({ success: false, message: 'Akun tidak aktif atau sesi telah berakhir.' });
      return;
    }

    req.user = {
      id: user.id,
      username: user.username,
      roleId: user.role_id,
      roleName: user.role_name,
      fullName: user.full_name
    };

    next();
  } catch (err) {
    res.status(401).json({ success: false, message: 'Token tidak valid atau telah kadaluarsa.' });
    return;
  }
}

export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Autentikasi diperlukan.' });
      return;
    }

    if (!allowedRoles.includes(req.user.roleName)) {
      res.status(403).json({
        success: false,
        message: 'Akses ditolak. Anda tidak memiliki izin untuk fitur ini.'
      });
      return;
    }

    next();
  };
}
