import { env } from '../config/env.js';
import { hmacHex, safeEqual, sha256Hex } from './crypto.js';

// Cadeia de auditoria dos lances (tarefa 54). A técnica está explicada em docs/AUDIT.md.
//
// canonical(lance) = "v1|lotId|seq|alias|amountCents|createdAt|endsAtAfter|prevHash"
// hash(lance)      = SHA-256(canonical)                  (hex)
// seal(lance)      = HMAC-SHA256(AUDIT_HMAC_KEY, hash)    (hex)
// prevHash do 1º   = hash gênese (termos do lote)
// lot.headHash     = hash do último lance (ou a gênese, sem lances)
// lot.headSeal     = HMAC(AUDIT_HMAC_KEY, "lotId|bidCount|headHash")
//
// O canônico usa o APELIDO, não o userId: a página pública recalcula os hashes sem ver dado pessoal.

export const ANTI_SNIPING_MS = 2 * 60 * 1000; // D9

const sealHex = (msg) => hmacHex(env.keys.audit, msg);

// Compara dois selos em hex em tempo constante. Selo ausente ou malformado nunca bate.
function sealMatches(expectedHex, storedHex) {
  if (typeof storedHex !== 'string' || !/^[0-9a-f]{64}$/.test(storedHex)) return false;
  return safeEqual(Buffer.from(expectedHex, 'hex'), Buffer.from(storedHex, 'hex'));
}

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
  return sealHex(`${lotId}|${bidCount}|${headHash}`);
}

export function bidCanonical(bid) {
  return [
    'v1',
    bid.lotId,
    bid.seq,
    bid.alias,
    bid.amountCents,
    bid.createdAt.toISOString(),
    bid.endsAtAfter.toISOString(),
    bid.prevHash,
  ].join('|');
}

export const bidHash = (bid) => sha256Hex(bidCanonical(bid));
export const bidSeal = (hash) => sealHex(hash);

// Selo do vínculo apelido → pessoa (tarefa 59). Trocar o userId de um apelido no banco
// mudaria quem paga e quem recebe o comprovante sem mexer em nenhum hash; o selo pega isso.
export function participantSeal(lotId, alias, userId) {
  return sealHex(`v1|participant|${lotId}|${alias}|${userId}`);
}

// Fim do lote depois de um lance aceito em `now` (anti-sniping, D9).
// "Últimos 2 minutos" inclui exatamente 2:00 restantes (<=). Soma sempre ao fim ATUAL.
export function endsAtAfterBid(currentEndsAt, now) {
  return currentEndsAt.getTime() - now.getTime() <= ANTI_SNIPING_MS
    ? new Date(currentEndsAt.getTime() + ANTI_SNIPING_MS)
    : currentEndsAt;
}

const brl = (cents) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Verificação completa, feita no servidor (só ele tem a chave). Itens numerados como em docs/AUDIT.md.
// Recebe o lote (com sellerId, leaderId, winnerId), os lances (com bidderId) e os participantes.
// Devolve a lista de problemas em português; lista vazia = íntegro.
// O item 7 (comprovante) entra na tarefa 69, quando o comprovante existir.
export function verifyChain(lot, bids, participants) {
  const problems = [];
  const ordered = [...bids].sort((a, b) => a.seq - b.seq);

  // 1. Gênese recalculada a partir dos termos atuais do lote.
  const genesis = genesisHash(lot);

  // 6. Participantes: selo de cada um, apelidos 1, 2, 3... sem repetição.
  const byAlias = new Map();
  for (const p of participants) {
    if (!sealMatches(participantSeal(lot.id, p.alias, p.userId), p.seal)) {
      problems.push(`Licitante #${p.alias}: o vínculo do apelido com a pessoa foi alterado`);
    }
    byAlias.set(p.alias, p);
  }

  // 2. Cada lance, em ordem.
  let prevHash = genesis;
  let prevAmount = null;
  let prevAlias = null;
  let currentEndsAt = lot.originalEndsAt;
  const firstSeen = []; // ordem em que cada apelido aparece pela primeira vez

  ordered.forEach((bid, i) => {
    const label = `Lance #${bid.seq}`;
    const expectedSeq = i === 0 ? 1 : ordered[i - 1].seq + 1;
    if (bid.seq !== expectedSeq) {
      problems.push(i === 0 ? `Falta o lance #1 (o primeiro registrado é o #${bid.seq})` : `Faltam lances entre o #${ordered[i - 1].seq} e o #${bid.seq}`);
    }
    if (bid.prevHash !== prevHash) {
      problems.push(i === 0 ? `${label}: não se encaixa nas regras do lote (gênese diferente)` : `${label}: não se encaixa no lance anterior`);
    }
    const hash = bidHash(bid);
    if (hash !== bid.hash) problems.push(`${label}: o conteúdo não confere com o registro`);
    if (!sealMatches(bidSeal(bid.hash), bid.seal)) problems.push(`${label}: selo inválido`);

    // Regras de negócio do lance, refeitas a partir do histórico.
    const minimum = prevAmount === null ? lot.startingPriceCents : prevAmount + lot.minIncrementCents;
    if (bid.amountCents < minimum) {
      problems.push(`${label}: valor ${brl(bid.amountCents)} abaixo do mínimo de ${brl(minimum)}`);
    }
    if (prevAlias !== null && bid.alias === prevAlias) {
      problems.push(`${label}: o líder cobriu o próprio lance`);
    }
    if (bid.createdAt < lot.startsAt || bid.createdAt >= currentEndsAt) {
      problems.push(`${label}: registrado fora do horário do lote`);
    }
    const expectedEnd = endsAtAfterBid(currentEndsAt, bid.createdAt);
    if (bid.endsAtAfter.getTime() !== expectedEnd.getTime()) {
      problems.push(`${label}: prorrogação do fim não confere com o horário do lance`);
    }

    // 6. O lance pertence à pessoa do seu apelido.
    const participant = byAlias.get(bid.alias);
    if (!participant) problems.push(`${label}: apelido Licitante #${bid.alias} não existe neste lote`);
    else if (participant.userId !== bid.bidderId) problems.push(`${label}: não pertence ao Licitante #${bid.alias}`);
    if (!firstSeen.includes(bid.alias)) firstSeen.push(bid.alias);

    prevHash = bid.hash;
    prevAmount = bid.amountCents;
    prevAlias = bid.alias;
    currentEndsAt = bid.endsAtAfter;
  });

  // 6. Apelidos numerados na ordem do primeiro lance, sem participante sobrando.
  firstSeen.forEach((alias, i) => {
    if (alias !== i + 1) problems.push(`Licitante #${alias}: numeração dos apelidos fora de ordem`);
  });
  if (participants.length !== firstSeen.length) {
    problems.push('Há participante registrado sem lance correspondente');
  }

  // 3. Topo selado do lote.
  const last = ordered.at(-1);
  if (ordered.length !== lot.bidCount) {
    problems.push(`O lote registra ${lot.bidCount} lance(s), mas o histórico tem ${ordered.length}`);
  }
  if ((last?.hash ?? genesis) !== lot.headHash) problems.push('O último lance não é o topo registrado no lote');
  if (!sealMatches(headSeal(lot.id, lot.bidCount, lot.headHash), lot.headSeal)) {
    problems.push('Selo do topo do lote inválido');
  }

  // 4. Estado atual do lote = último lance.
  if ((last?.amountCents ?? null) !== lot.currentPriceCents) problems.push('O preço atual do lote não é o valor do último lance');
  if ((last?.bidderId ?? null) !== lot.leaderId) problems.push('O líder do lote não é o autor do último lance');

  // 5. Fim atual = fim depois do último lance (ou o original).
  if (lot.endsAt.getTime() !== currentEndsAt.getTime()) problems.push('O horário de fim do lote foi alterado');

  // 7. Lote liquidado: valor final e vencedor = último lance.
  if (lot.status === 'SETTLED') {
    if ((last?.amountCents ?? null) !== lot.finalPriceCents) problems.push('O valor de arremate não é o último lance');
    if ((last?.bidderId ?? null) !== lot.winnerId) problems.push('O vencedor registrado não é o autor do último lance');
  }

  return { genesis, problems };
}
