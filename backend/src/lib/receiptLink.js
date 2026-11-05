import { randomBytes } from 'node:crypto';
import { env } from '../config/env.js';
import { hmac, safeEqual } from './crypto.js';

// Link público do comprovante (tarefa 70): r1.<linkId>.<tag>
//
// Mesmo desenho do ticketCode.js do meu projeto anterior (ingressos), que separava
// "esse código existe na tabela" de "esse código foi emitido por mim":
// - o banco guarda SÓ o linkId; a tag (HMAC) é recalculada quando o link é montado ou conferido,
//   então um vazamento do banco não entrega links prontos;
// - a conferência acontece ANTES de consultar o banco: link forjado nunca chega à consulta;
// - a versão entra na mensagem assinada, para uma futura troca de chave conviver com os links já emitidos.
// O que mudou em relação ao ingresso, pela devolutiva da Verzel: o id tem 128 bits (o ingresso tinha 60,
// e o código antigo, 40) e a tag tem 128 bits (o ingresso tinha 30), com chave própria (RECEIPT_LINK_KEY).

const PREFIX = 'r1';
const VERSION = 'receipt-link|v1|';
const ID_BYTES = 16; // 128 bits
const TAG_BYTES = 16; // 128 bits
const B64 = '[A-Za-z0-9_-]{22}'; // 16 bytes em base64url sem preenchimento
const TOKEN_PATTERN = new RegExp(`^${PREFIX}\\.(${B64})\\.(${B64})$`);

export function generateLinkId() {
  return randomBytes(ID_BYTES).toString('base64url');
}

function tagFor(linkId) {
  return hmac(env.keys.receiptLink, VERSION + linkId).subarray(0, TAG_BYTES);
}

export function toShareToken(linkId) {
  return `${PREFIX}.${linkId}.${tagFor(linkId).toString('base64url')}`;
}

export function shareUrlFor(linkId) {
  return `${env.appPublicUrl.replace(/\/+$/, '')}/c/${toShareToken(linkId)}`;
}

// Confere o link sem tocar no banco. { ok: true, linkId } ou { ok: false, reason }.
// FORMAT = nem parece um link; SIGNATURE = bem formado, mas a tag não confere (tentativa de forjar).
// Para quem chama a rota pública, as duas viram o mesmo 404.
export function verifyShareToken(token) {
  const match = TOKEN_PATTERN.exec(String(token ?? ''));
  if (!match) return { ok: false, reason: 'FORMAT' };
  const [, linkId, tag] = match;
  // Só a forma canônica do base64url: dois textos diferentes nunca valem pelo mesmo id.
  const idBytes = Buffer.from(linkId, 'base64url');
  const tagBytes = Buffer.from(tag, 'base64url');
  if (idBytes.length !== ID_BYTES || idBytes.toString('base64url') !== linkId || tagBytes.toString('base64url') !== tag) {
    return { ok: false, reason: 'FORMAT' };
  }
  if (!safeEqual(tagFor(linkId), tagBytes)) return { ok: false, reason: 'SIGNATURE' };
  return { ok: true, linkId };
}
