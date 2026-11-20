/**
 * Phone number validation and normalization utility
 * Specifically tuned for Indonesian phone numbers while supporting standard international formatting
 */

export interface PhoneValidationResult {
  isValid: boolean;
  normalized: string;
  original: string;
  errorMessage?: string;
}

export function normalizePhoneNumber(rawPhone: string | number): PhoneValidationResult {
  if (!rawPhone) {
    return {
      isValid: false,
      normalized: '',
      original: '',
      errorMessage: 'Nomor telepon kosong'
    };
  }

  const str = String(rawPhone).trim();
  // Strip spaces, dashes, parentheses, plus signs
  let cleaned = str.replace(/[^\d+]/g, '');

  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  // Indonesian local formats:
  // 08xx -> 628xx
  if (cleaned.startsWith('08')) {
    cleaned = '628' + cleaned.substring(2);
  } else if (cleaned.startsWith('8')) {
    // 8xx -> 628xx
    cleaned = '628' + cleaned.substring(1);
  } else if (cleaned.startsWith('6208')) {
    // 6208xx -> 628xx
    cleaned = '628' + cleaned.substring(4);
  }

  // Digits validation: E.164 typically between 10 and 15 digits
  if (cleaned.length < 10) {
    return {
      isValid: false,
      normalized: cleaned,
      original: str,
      errorMessage: 'Nomor terlalu pendek (minimal 10 digit)'
    };
  }

  if (cleaned.length > 16) {
    return {
      isValid: false,
      normalized: cleaned,
      original: str,
      errorMessage: 'Nomor terlalu panjang (maksimal 16 digit)'
    };
  }

  // Check valid numerical string
  if (!/^\d+$/.test(cleaned)) {
    return {
      isValid: false,
      normalized: cleaned,
      original: str,
      errorMessage: 'Nomor hanya boleh berisi angka'
    };
  }

  return {
    isValid: true,
    normalized: cleaned,
    original: str
  };
}

/**
 * Format JID for Baileys WhatsApp
 */
export function formatToWhatsAppJid(phone: string): string {
  const norm = normalizePhoneNumber(phone);
  if (!norm.isValid) return '';
  return `${norm.normalized}@s.whatsapp.net`;
}

/**
 * Extract pure phone number from Baileys JID
 */
export function extractPhoneFromJid(jid: string): string {
  if (!jid) return '';
  return jid.replace(/@.*$/, '').replace(/:\d+$/, '');
}
