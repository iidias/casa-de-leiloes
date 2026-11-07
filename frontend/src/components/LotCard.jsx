// Card de lote da vitrine. A imagem vem do nosso backend (gravada no banco ao criar
// o lote), então a vitrine continua com foto mesmo se a API do museu cair.
import { useState } from 'react';
import { ArrowRight, ImageOff } from 'lucide-react';
import { buildUrl } from '../api/client.js';
import { formatDateTime } from '../lib/format.js';
import { formatBRL } from '../lib/money.js';
import { PhaseBadge } from './Badge.jsx';
import { ButtonLink } from './Button.jsx';
import Card from './Card.jsx';
import Countdown from './Countdown.jsx';

function bidsLabel(count) {
  if (!count) return 'Nenhum lance ainda';
  return count === 1 ? '1 lance' : `${count} lances`;
}

// O que o rodapé mostra em cada fase.
function priceOf(lot) {
  if (lot.phase === 'LIVE') {
    return lot.bidCount
      ? { label: 'Lance atual', value: formatBRL(lot.currentPriceCents) }
      : { label: 'Lance inicial', value: formatBRL(lot.startingPriceCents) };
  }
  if (lot.phase === 'SCHEDULED') return { label: 'Lance inicial', value: formatBRL(lot.startingPriceCents) };
  return lot.bidCount
    ? { label: 'Valor final', value: formatBRL(lot.currentPriceCents) }
    : { label: 'Resultado', value: 'Sem lances' };
}

export default function LotCard({ lot, onPhaseChange }) {
  const [imageFailed, setImageFailed] = useState(false);
  const price = priceOf(lot);

  return (
    <Card as="article" className="lot-card">
      <div className="lot-image">
        {imageFailed ? (
          <div className="no-image">
            <ImageOff size={28} aria-label="Imagem indisponível" />
          </div>
        ) : (
          <img
            className="artwork-image"
            src={buildUrl(lot.imageUrl)}
            alt={lot.title}
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        )}
        <PhaseBadge phase={lot.phase} />
      </div>

      <div className="lot-body">
        <h2 title={lot.title}>{lot.title}</h2>
        {lot.artist && <p>{lot.artist}</p>}
        <span>{bidsLabel(lot.bidCount)}</span>
      </div>

      <div className="lot-footer">
        <div>
          <span>{price.label}</span>
          <strong>{price.value}</strong>
          <small>
            {lot.phase === 'LIVE' && (
              <>
                termina em <Countdown to={lot.endsAt} onEnd={onPhaseChange} />
              </>
            )}
            {lot.phase === 'SCHEDULED' && (
              <>
                abre em <Countdown to={lot.startsAt} urgentBelowMs={0} onEnd={onPhaseChange} />
              </>
            )}
            {lot.phase === 'ENDED' && <>encerrado em {formatDateTime(lot.endsAt)}</>}
          </small>
        </div>
        <ButtonLink
          to={`/lotes/${lot.id}`}
          variant={lot.phase === 'LIVE' ? 'primary' : 'outline'}
          size="sm"
          aria-label={`${lot.phase === 'LIVE' ? 'Entrar na sala' : 'Ver lote'}: ${lot.title}`}
        >
          {lot.phase === 'LIVE' ? 'Entrar na sala' : 'Ver lote'} <ArrowRight size={14} aria-hidden="true" />
        </ButtonLink>
      </div>
    </Card>
  );
}
