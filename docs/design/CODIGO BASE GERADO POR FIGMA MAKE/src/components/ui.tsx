import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react"
import { AlertCircle, Check, LoaderCircle, ShieldCheck } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Link } from "react-router"
import type { Phase } from "../data"

export function Logo() {
  return (
    <Link className="logo" to="/" aria-label="leilõesPaintings — início">
      leilões<span>Paintings</span>
    </Link>
  )
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline" | "ghost"
  size?: "sm" | "md" | "lg"
  loading?: boolean
  icon?: LucideIcon
}

export function Button({
  variant = "primary",
  size = "md",
  loading,
  icon: Icon,
  children,
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`btn btn-${variant} btn-${size} ${className}`}
      {...props}
    >
      {loading ? (
        <LoaderCircle className="spin" size={16} />
      ) : Icon ? (
        <Icon size={16} />
      ) : null}
      {children}
    </button>
  )
}

export function ButtonLink({
  to,
  variant = "primary",
  size = "md",
  children,
  className = "",
}: {
  to: string
  variant?: ButtonProps["variant"]
  size?: ButtonProps["size"]
  children: ReactNode
  className?: string
}) {
  return (
    <Link className={`btn btn-${variant} btn-${size} ${className}`} to={to}>
      {children}
    </Link>
  )
}

export function PageTitle({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string
  title: string
  children?: ReactNode
}) {
  return (
    <header className="page-title">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {children && <p>{children}</p>}
    </header>
  )
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode
  className?: string
}) {
  return <section className={`card ${className}`}>{children}</section>
}

export function PhaseBadge({ phase }: { phase: Phase }) {
  const labels = { LIVE: "Ao vivo", SCHEDULED: "Agendado", ENDED: "Encerrado" }
  return (
    <span className={`badge badge-${phase.toLowerCase()}`}>
      {phase === "LIVE" && <i />}
      {labels[phase]}
    </span>
  )
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode
  tone?: "neutral" | "success" | "danger" | "info" | "dark"
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

export function Field({
  label,
  hint,
  prefix,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string
  hint?: string
  prefix?: string
  error?: string
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <span className={`input-shell ${error ? "has-error" : ""}`}>
        {prefix && <b>{prefix}</b>}
        <input {...props} />
      </span>
      {hint && !error && <small>{hint}</small>}
      {error && <small className="field-error">{error}</small>}
    </label>
  )
}

export function SelectField({
  label,
  children,
  className = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  children: ReactNode
}) {
  return (
    <label className={`field select-field ${className}`}>
      <span>{label}</span>
      <select {...props}>{children}</select>
    </label>
  )
}

export function Alert({
  tone = "info",
  children,
  action,
}: {
  tone?: "success" | "danger" | "warning" | "info"
  children: ReactNode
  action?: ReactNode
}) {
  const Icon = tone === "success" ? Check : AlertCircle
  return (
    <div className={`alert alert-${tone}`}>
      <Icon size={18} />
      <div>{children}</div>
      {action}
    </div>
  )
}

export function IntegritySeal({
  valid = true,
  count = 8,
}: {
  valid?: boolean
  count?: number
}) {
  return (
    <div className={`integrity-seal ${valid ? "valid" : "invalid"}`}>
      {valid ? <ShieldCheck size={34} /> : <AlertCircle size={34} />}
      <div>
        <strong>{valid ? "Íntegro" : "Adulterado"}</strong>
        <span>
          {valid
            ? `Nenhuma alteração detectada no histórico de ${count} lances`
            : "Foram encontradas inconsistências no histórico"}
        </span>
      </div>
    </div>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon
  title: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="empty-state">
      <span>
        <Icon size={28} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  )
}

export function ArtworkImage({
  src,
  alt,
  className = "",
}: {
  src: string
  alt: string
  className?: string
}) {
  return <img className={`artwork-image ${className}`} src={src} alt={alt} />
}
