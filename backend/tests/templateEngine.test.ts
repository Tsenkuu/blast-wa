import { describe, it, expect } from 'vitest';
import { resolveTemplate, parseTemplateVariables, validateTemplate } from '../src/utils/templateEngine.js';

describe('Message Template Engine', () => {
  it('should resolve column letters and aliases case-insensitively', () => {
    const template = 'Halo {{B}}, kami mengundang ke {{C}}. Nomor Anda: {{A}} atau {{nomor}}.';
    const data = {
      A: '081234567890',
      B: 'Ahmad',
      C: 'Tulungagung',
      nomor: '6281234567890',
      nama: 'Ahmad'
    };

    const res = resolveTemplate(template, data);
    expect(res.text).toBe('Halo Ahmad, kami mengundang ke Tulungagung. Nomor Anda: 081234567890 atau 6281234567890.');
    expect(res.unresolvedVariables.length).toBe(0);
  });

  it('should support Unicode, emojis and multiline strings', () => {
    const template = 'Salam hangat 🎉 {{nama}}!\nJangan lupa hadir di 📍 {{lokasi}}.';
    const data = {
      nama: 'Siti Rahma 🌸',
      lokasi: 'Jl. Merdeka No. 45 Bandung'
    };

    const res = resolveTemplate(template, data);
    expect(res.text).toBe('Salam hangat 🎉 Siti Rahma 🌸!\nJangan lupa hadir di 📍 Jl. Merdeka No. 45 Bandung.');
  });

  it('should detect unresolved variables', () => {
    const template = 'Halo {{nama}}, status Anda: {{status_keanggotaan}}';
    const data = {
      nama: 'Budi'
    };

    const res = resolveTemplate(template, data);
    expect(res.unresolvedVariables).toContain('status_keanggotaan');
  });

  it('should validate template against dataset headers', () => {
    const template = 'Halo {{nama}}, silakan hadir di {{keterangan}}';
    const validSample = { nama: 'Budi', keterangan: 'Bandung' };
    const invalidSample = { nama: 'Budi' };

    expect(validateTemplate(template, validSample).isValid).toBe(true);
    expect(validateTemplate(template, invalidSample).isValid).toBe(false);
    expect(validateTemplate(template, invalidSample).missingVariables).toContain('keterangan');
  });
});
