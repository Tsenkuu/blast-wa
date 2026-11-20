import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import { config } from './config/index.js';

// Route imports
import authRoutes from './modules/auth/authRoutes.js';
import whatsappRoutes from './modules/whatsapp/whatsappRoutes.js';
import excelRoutes from './modules/excel/excelRoutes.js';
import broadcastRoutes from './modules/broadcast/broadcastRoutes.js';
import templateRoutes from './modules/templates/templateRoutes.js';
import mediaRoutes from './modules/media/mediaRoutes.js';
import adminRoutes from './modules/admin-bot/adminRoutes.js';
import logRoutes from './modules/logs/logRoutes.js';
import dashboardRoutes from './modules/dashboard/dashboardRoutes.js';
import settingsRoutes from './modules/settings/settingsRoutes.js';

export function createApp(): Express {
  const app = express();

  // Security Middleware
  app.use(helmet({
    contentSecurityPolicy: false, // allow Socket.IO and inline resources
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  }));

  // CORS configuration
  app.use(cors({
    origin: (origin, callback) => {
      // Allow localhost, local dev, or matching origins
      if (!origin || config.cors.origin.includes(origin) || origin.startsWith('http://localhost:')) {
        callback(null, true);
      } else {
        callback(null, true); // Dev-friendly permissive CORS
      }
    },
    credentials: true
  }));

  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // Static uploads serving
  if (!fs.existsSync(config.storage.uploadDir)) {
    fs.mkdirSync(config.storage.uploadDir, { recursive: true });
  }
  app.use('/uploads', express.static(config.storage.uploadDir));

  // Health check
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      app: 'WA BLAST MANAGER PRO',
      timestamp: new Date().toISOString()
    });
  });

  // Mount API modules
  app.use('/api/auth', authRoutes);
  app.use('/api/whatsapp', whatsappRoutes);
  app.use('/api/excel', excelRoutes);
  app.use('/api/broadcasts', broadcastRoutes);
  app.use('/api/templates', templateRoutes);
  app.use('/api/media', mediaRoutes);
  app.use('/api/admins', adminRoutes);
  app.use('/api/logs', logRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/settings', settingsRoutes);

  // Serve Frontend build in production if available
  const frontendDist = path.resolve(__dirname, '../../frontend/dist');
  if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    app.get('*', (req: Request, res: Response) => {
      if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
        res.sendFile(path.join(frontendDist, 'index.html'));
      }
    });
  }

  // Global Error Handler
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('Unhandled Server Error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Terjadi kesalahan internal pada server'
    });
  });

  return app;
}
