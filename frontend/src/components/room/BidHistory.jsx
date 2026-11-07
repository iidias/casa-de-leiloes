// Histórico de lances da sala: apelido, valor e horário. Nunca quem é a pessoa (PDF: privacidade).
// O lance do próprio usuário aparece marcado como "você"; lances novos piscam em verde.
import Badge from '../Badge.jsx';
import Card from '../Card.jsx';
import { formatTime } from '../../lib/format.js';
import { formatBRL } from '../../lib/money.js';

export default function BidHistory({ bids, myAlias, freshSeqs, startingPriceCents }) {
  return (
    <section className="history-section" aria-labelledby="titulo-historico">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Transparência</span>
          <h2 id="titulo-historico">Histórico de lances</h2>
        </div>
        <span>Mais recente primeiro · horário de Brasília</span>
      </div>
      <Card className="bid-history">
        {bids.length === 0 ? (
          <p className="px-5 py-6 text-[14px] text-[var(--color-copy)]">
            Nenhum lance ainda. O primeiro lance precisa ser de pelo menos {formatBRL(startingPriceCents)}.
          </p>
        ) : (
          <ol aria-live="polite" aria-relevant="additions">
            {bids.map((bid) => (
              <li key={bid.seq} className={freshSeqs.has(bid.seq) ? 'fresh' : ''}>
                <span className="bid-index" aria-label={`Lance ${bid.seq}`}>
                  {bid.seq}
                </span>
                <div>
                  <strong>{bid.alias}</strong>
                  {myAlias && bid.alias === myAlias && <Badge tone="info">você</Badge>}
                </div>
                <strong className="money">{formatBRL(bid.amountCents)}</strong>
                <time dateTime={bid.createdAt}>{formatTime(bid.createdAt)}</time>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </section>
  );
}
