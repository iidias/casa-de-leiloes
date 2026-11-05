// Button: variantes, tamanhos, disabled e loading (mesma API do projeto anterior;
// visual do protótipo). ButtonLink é um link com cara de botão.
import { Link } from 'react-router-dom';
import Spinner from './Spinner.jsx';

function classes(variant, size, className) {
  return ['btn', `btn-${variant}`, `btn-${size}`, className].filter(Boolean).join(' ');
}

export default function Button({
  variant = 'primary',
  size = 'md',
  type = 'button',
  disabled = false,
  loading = false,
  icon: Icon,
  className = '',
  children,
  ...rest
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={classes(variant, size, className)}
      {...rest}
    >
      {loading ? <Spinner /> : Icon ? <Icon size={16} aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export function ButtonLink({ to, variant = 'primary', size = 'md', icon: Icon, className = '', children, ...rest }) {
  return (
    <Link to={to} className={classes(variant, size, className)} {...rest}>
      {Icon && <Icon size={16} aria-hidden="true" />}
      {children}
    </Link>
  );
}
