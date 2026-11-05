import { env } from '../config/env.js';
import { hmacHex, safeEqual, sha256Hex } from './crypto.js';

// Assinatura do comprovante (tarefa 69), com chave própria (RECEIPT_SIGNING_KEY).
// O finalChainHash amarra o comprovante à auditoria: se alguém restaurar o lote inteiro para
// uma cópia antiga e coerente, o último hash da cadeia deixa de bater com o do comprovante.
// O apelido (e não a pessoa) entra na assinatura: o comprovante público não expõe dado pessoal.

export function receiptCanonical(r) {
  return [
    'v1',
    'receipt',
    r.id,
    r.lotId,
    r.title,
    r.winnerAlias,
    r.amountCents,
    r.issuedAt.toISOString(),
    r.finalChainHash,
  ].join('|');
}

export const signReceipt = (r) => hmacHex(env.keys.receiptSigning, receiptCanonical(r));

export function receiptSignatureValid(r, signature) {
  if (typeof signature !== 'string' || !/^[0-9a-f]{64}$/.test(signature)) return false;
  return safeEqual(Buffer.from(signReceipt(r), 'hex'), Buffer.from(signature, 'hex'));
}

// Número curto, só para referência visual (8 caracteres do hash da assinatura).
export const receiptNumber = (signature) => sha256Hex(signature).slice(0, 8).toUpperCase();
