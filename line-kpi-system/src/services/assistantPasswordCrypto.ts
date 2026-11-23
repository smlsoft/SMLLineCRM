import crypto from 'crypto';
import { config } from '../config';

// Reversible copy of employee assistant passwords so managers can view them (agreed trade-off).
// Format: v1:<iv b64>:<tag b64>:<ciphertext b64>, AES-256-GCM with a key derived from ASSISTANT_PASSWORD_KEY.

function key(): Buffer | null {
  if (!config.assistantPasswordKey) return null;
  return crypto.createHash('sha256').update(config.assistantPasswordKey, 'utf8').digest();
}

export function canStoreViewablePassword(): boolean {
  return key() !== null;
}

/** null when no key is configured. */
export function encryptPassword(plain: string): string | null {
  const k = key();
  if (!k) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', k, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), ct.toString('base64')].join(':');
}

/** null when no key is configured or the value cannot be decrypted (e.g. the key changed). */
export function decryptPassword(stored: string): string | null {
  const k = key();
  if (!k) return null;
  const [v, iv, tag, ct] = stored.split(':');
  if (v !== 'v1' || !iv || !tag || !ct) return null;
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', k, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(ct, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
