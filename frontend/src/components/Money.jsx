// Money: mostra centavos como reais ("R$ 1.234,56"), com algarismos alinhados.
import { formatBRL } from '../lib/money.js';

export default function Money({ cents, as: Tag = 'span', className = '' }) {
  return <Tag className={`money ${className}`}>{formatBRL(cents)}</Tag>;
}
