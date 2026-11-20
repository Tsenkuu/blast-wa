export interface User {
  id: number;
  username: string;
  roleId: number;
  roleName: 'Super Admin' | 'Operator';
  fullName: string;
}

export interface WhatsAppStatus {
  status: 'connecting' | 'connected' | 'disconnected' | 'logged_out';
  phone: string | null;
  name: string | null;
  qrCode: string | null;
}

export interface Dataset {
  id: number;
  name: string;
  filename: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  created_by: string;
  created_at: string;
  contact_count?: number;
  used_in_broadcasts?: number;
}

export interface Broadcast {
  id: number;
  broadcast_code: string;
  name: string;
  dataset_id: number;
  dataset_name?: string;
  template_id?: number;
  custom_message: string;
  media_id?: number;
  media_filename?: string;
  status: 'draft' | 'queued' | 'running' | 'paused' | 'completed' | 'cancelled' | 'failed';
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  skipped_count: number;
  pending_count: number;
  scheduled_at?: string;
  started_at?: string;
  completed_at?: string;
  paused_at?: string;
  created_at: string;
}

export interface Recipient {
  id: number;
  broadcast_id: number;
  contact_id?: number;
  phone_number: string;
  recipient_name: string;
  personalized_message: string;
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'skipped';
  error_reason?: string;
  attempts: number;
  sent_at?: string;
}

export interface Template {
  id: number;
  name: string;
  content: string;
  has_media: number;
  default_media_id?: number;
  media_filename?: string;
}

export interface MediaFile {
  id: number;
  filename: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  created_at: string;
}

export interface WhatsAppAdmin {
  id: number;
  phone_number: string;
  name: string;
  can_broadcast: number;
  can_manage_excel: number;
  can_manage_sessions: number;
  is_active: number;
  notify_on_events: number;
  created_at: string;
}

export interface SystemLog {
  id?: number;
  timestamp?: string;
  level: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
  module: string;
  message: string;
  metadata?: any;
  created_at?: string;
}
