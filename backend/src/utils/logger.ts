import { db } from '../database/index.js';
import { Server as SocketServer } from 'socket.io';

export type LogLevel = 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';

let ioInstance: SocketServer | null = null;

export function setSocketIO(io: SocketServer) {
  ioInstance = io;
}

export function getSocketIO(): SocketServer | null {
  return ioInstance;
}

export async function logSystem(
  level: LogLevel,
  moduleName: string,
  message: string,
  metadata?: any
): Promise<void> {
  const timestamp = new Date().toISOString().substring(11, 19);
  const formattedConsole = `[${timestamp}] [${level}] ${moduleName}: ${message}`;

  if (level === 'ERROR') {
    console.error(formattedConsole);
  } else if (level === 'WARNING') {
    console.warn(formattedConsole);
  } else {
    console.log(formattedConsole);
  }

  // Persist to database
  try {
    const metaStr = metadata ? JSON.stringify(metadata) : null;
    await db.execute(
      'INSERT INTO system_logs (level, module, message, metadata_json) VALUES (?, ?, ?, ?)',
      [level, moduleName, message, metaStr]
    );
  } catch (err) {
    console.error('Failed to persist log to DB:', err);
  }

  // Stream via Socket.IO
  if (ioInstance) {
    ioInstance.emit('terminal:log', {
      timestamp: new Date().toLocaleTimeString('id-ID', { hour12: false }),
      level,
      module: moduleName,
      message,
      metadata
    });
  }
}

export async function logAudit(
  userId: number | null,
  action: string,
  resource: string,
  details?: any,
  ipAddress?: string | string[]
): Promise<void> {
  try {
    const detailsStr = details ? JSON.stringify(details) : null;
    const ipStr = Array.isArray(ipAddress) ? ipAddress[0] : (ipAddress || '127.0.0.1');
    await db.execute(
      'INSERT INTO audit_logs (user_id, action, resource, details_json, ip_address) VALUES (?, ?, ?, ?, ?)',
      [userId, action, resource, detailsStr, ipStr]
    );
  } catch (err) {
    console.error('Failed to persist audit log:', err);
  }
}
