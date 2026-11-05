// Card: superfície branca com borda (lote, carteira, comprovante...).
export default function Card({ as: Tag = 'section', className = '', children, ...rest }) {
  return (
    <Tag className={`card ${className}`} {...rest}>
      {children}
    </Tag>
  );
}
