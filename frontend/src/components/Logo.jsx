// Marca: "leilões" em preto + "Paintings" em vermelho, sem espaço.
import { Link } from 'react-router-dom';

export default function Logo({ to = '/' }) {
  return (
    <Link className="logo" to={to} aria-label="leilõesPaintings, início">
      leilões<span>Paintings</span>
    </Link>
  );
}
