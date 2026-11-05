// Campo de senha com o botão de mostrar/ocultar.
import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import Input from './Input.jsx';

export default function PasswordInput(props) {
  const [visible, setVisible] = useState(false);
  return (
    <Input
      {...props}
      type={visible ? 'text' : 'password'}
      suffix={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
          className="cursor-pointer hover:text-[var(--color-ink)]"
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      }
    />
  );
}
