import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const sha256Hex = (msg) => createHash('sha256').update(msg).digest('hex');

export const hmac = (key, msg) => createHmac('sha256', key).update(msg).digest();

export const hmacHex = (key, msg) => hmac(key, msg).toString('hex');

// Comparação em tempo constante (não vaza, pelo tempo, quantos bytes bateram).
export const safeEqual = (a, b) => a.length === b.length && timingSafeEqual(a, b);
