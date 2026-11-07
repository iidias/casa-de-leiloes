// Conferência da cadeia de lances feita no navegador (tarefa 93, docs/AUDIT.md).
// Refaz, com o SHA-256 do próprio navegador, a mesma conta do backend (backend/src/lib/auditChain.js):
//   hash(lance) = SHA-256("v1|lotId|seq|alias|amountCents|createdAt|endsAtAfter|prevHash")
// e confere que cada lance aponta para o anterior (o 1º aponta para a gênese) e que a sequência não pula.
// Os selos HMAC ficam de fora: só o servidor tem a chave. Por isso são duas camadas.

const encoder = new TextEncoder();

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

// O backend usa Date.toISOString(); refazer a partir da data garante o mesmo texto.
const iso = (value) => new Date(value).toISOString();

export function canVerifyInBrowser() {
  return typeof crypto !== 'undefined' && Boolean(crypto.subtle?.digest);
}

/**
 * @param {string} lotId
 * @param {string} genesisHash
 * @param {Array<{seq:number, alias:number, amountCents:number, createdAt:string, endsAtAfter:string, prevHash:string, hash:string}>} bids
 * @returns {Promise<{ ok: boolean, problems: { seq: number|null, message: string }[] }>}
 */
export async function verifyChainInBrowser(lotId, genesisHash, bids) {
  const ordered = [...bids].sort((a, b) => a.seq - b.seq);
  const problems = [];
  let prevHash = genesisHash;

  for (const [i, bid] of ordered.entries()) {
    const expectedSeq = i === 0 ? 1 : ordered[i - 1].seq + 1;
    if (bid.seq !== expectedSeq) {
      problems.push({
        seq: bid.seq,
        message: i === 0 ? `Falta o lance #1 (o primeiro publicado é o #${bid.seq})` : `A sequência pula do #${ordered[i - 1].seq} para o #${bid.seq}`,
      });
    }
    if (bid.prevHash !== prevHash) {
      problems.push({ seq: bid.seq, message: `Lance #${bid.seq}: não aponta para o ${i === 0 ? 'início da cadeia' : 'lance anterior'}` });
    }
    const canonical = ['v1', lotId, bid.seq, bid.alias, bid.amountCents, iso(bid.createdAt), iso(bid.endsAtAfter), bid.prevHash].join('|');
    if ((await sha256Hex(canonical)) !== bid.hash) {
      problems.push({ seq: bid.seq, message: `Lance #${bid.seq}: o hash não confere com o conteúdo` });
    }
    prevHash = bid.hash;
  }

  return { ok: problems.length === 0, problems };
}
