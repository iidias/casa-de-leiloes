// Título de página do protótipo: sobretítulo vermelho, título e linha de apoio.
export default function PageTitle({ eyebrow, title, children }) {
  return (
    <header className="page-title">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {children && <p>{children}</p>}
    </header>
  );
}
