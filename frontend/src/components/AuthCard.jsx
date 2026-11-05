// Moldura das telas de login e cadastro: tela cheia, sem o header, com a marca no topo.
import Logo from './Logo.jsx';

export default function AuthCard({ subtitle, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[400px] flex flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <Logo />
          <p className="text-[14px] text-[var(--color-copy)]">{subtitle}</p>
        </div>
        <div className="card p-6 sm:p-8 flex flex-col gap-5">{children}</div>
      </div>
    </div>
  );
}
