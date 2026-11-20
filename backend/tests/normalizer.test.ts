import { describe, it, expect } from 'vitest';
import { normalizePhoneNumber, formatToWhatsAppJid, extractPhoneFromJid } from '../src/utils/normalizer.js';

describe('Phone Number Normalizer & Validator', () => {
  it('should normalize Indonesian 08xx to 628xx', () => {
    const res = normalizePhoneNumber('081234567890');
    expect(res.isValid).toBe(true);
    expect(res.normalized).toBe('6281234567890');
  });

  it('should normalize international format with +62', () => {
    const res = normalizePhoneNumber('+62 812-3456-7890');
    expect(res.isValid).toBe(true);
    expect(res.normalized).toBe('6281234567890');
  });

  it('should normalize starting with 8xx to 628xx', () => {
    const res = normalizePhoneNumber('81234567890');
    expect(res.isValid).toBe(true);
    expect(res.normalized).toBe('6281234567890');
  });

  it('should reject numbers that are too short', () => {
    const res = normalizePhoneNumber('08123');
    expect(res.isValid).toBe(false);
    expect(res.errorMessage).toContain('terlalu pendek');
  });

  it('should reject empty or invalid strings', () => {
    const res = normalizePhoneNumber('abcde');
    expect(res.isValid).toBe(false);
  });

  it('should format to valid WhatsApp JID', () => {
    const jid = formatToWhatsAppJid('081234567890');
    expect(jid).toBe('6281234567890@s.whatsapp.net');
  });

  it('should extract phone number from JID', () => {
    const phone = extractPhoneFromJid('6281234567890:12@s.whatsapp.net');
    expect(phone).toBe('6281234567890');
  });
});
