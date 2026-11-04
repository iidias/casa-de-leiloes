import { env } from '../config/env.js';
import { hmacHex, sha256Hex } from './crypto.js';

// Cadeia de auditoria (docs/AUDIT.md). Aqui só entra o que a criação do lote precisa
// (tarefa 43): o hash gênese e o selo do topo. Lance e verificação vêm na tarefa 54.

// Gênese: amarra a cadeia aos termos do lote. Alterar lance inicial, incremento,
// horários ou leiloeiro direto no banco quebra a verificação.
export function genesisHash(lot) {
  return sha256Hex(
    [
      'v1',
      'genesis',
      lot.id,
      lot.startingPriceCents,
      lot.minIncrementCents,
      lot.startsAt.toISOString(),
      lot.originalEndsAt.toISOString(),
      lot.sellerId,
    ].join('|'),
  );
}

// Selo do topo: pega a remoção do ÚLTIMO lance, que só a cadeia não pegaria.
export function headSeal(lotId, bidCount, headHash) {
  return hmacHex(env.keys.audit, `${lotId}|${bidCount}|${headHash}`);
}
