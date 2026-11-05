// Input: campo com rótulo, prefixo (ex.: "R$"), dica, erro e disabled.
// O erro fica ligado ao campo por aria-describedby, para leitor de tela.
import { useId } from 'react';

export default function Input({ label, id, prefix, suffix, hint, error, className = '', ...rest }) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const noteId = `${inputId}-note`;
  const note = error || hint;

  return (
    <div className={`field ${className}`}>
      {label && <label htmlFor={inputId}>{label}</label>}
      <span className={`input-shell ${error ? 'has-error' : ''}`}>
        {prefix && <b aria-hidden="true">{prefix}</b>}
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={note ? noteId : undefined}
          {...rest}
        />
        {suffix && <span className="pr-3 flex items-center text-[var(--color-muted)]">{suffix}</span>}
      </span>
      {note && (
        <small id={noteId} className={error ? 'field-error' : undefined}>
          {note}
        </small>
      )}
    </div>
  );
}
