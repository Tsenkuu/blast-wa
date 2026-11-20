import React, { createContext, useContext, useEffect, useState } from 'react';
import { getSocket } from '../services/socket.js';
import { WhatsAppStatus, SystemLog } from '../types/index.js';

interface BroadcastProgressUpdate {
  id: number;
  name: string;
  status: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  skipped_count: number;
  pending_count: number;
  progressPercent: number;
}

interface SocketContextType {
  isConnected: boolean;
  waStatus: WhatsAppStatus;
  latestBroadcastProgress: BroadcastProgressUpdate | null;
  logs: SystemLog[];
  clearLogs: () => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [waStatus, setWaStatus] = useState<WhatsAppStatus>({
    status: 'disconnected',
    phone: null,
    name: null,
    qrCode: null
  });
  const [latestBroadcastProgress, setLatestBroadcastProgress] = useState<BroadcastProgressUpdate | null>(null);
  const [logs, setLogs] = useState<SystemLog[]>([]);

  useEffect(() => {
    const socket = getSocket();

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('wa:status', (data: WhatsAppStatus) => {
      setWaStatus(data);
    });

    socket.on('broadcast:progress', (data: BroadcastProgressUpdate) => {
      setLatestBroadcastProgress(data);
    });

    socket.on('terminal:log', (logEntry: SystemLog) => {
      setLogs((prev) => [logEntry, ...prev.slice(0, 499)]); // keep last 500
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('wa:status');
      socket.off('broadcast:progress');
      socket.off('terminal:log');
    };
  }, []);

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <SocketContext.Provider
      value={{
        isConnected,
        waStatus,
        latestBroadcastProgress,
        logs,
        clearLogs
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocket must be used within a SocketProvider');
  return context;
};
