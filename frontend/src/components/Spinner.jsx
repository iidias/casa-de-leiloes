// Spinner do design system.
import { LoaderCircle } from 'lucide-react';

export default function Spinner({ size = 16, className = '' }) {
  return <LoaderCircle className={`spin ${className}`} size={size} role="status" aria-label="Carregando" />;
}
