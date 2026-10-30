// Small shared UI kit so every screen uses the same spacing, type and touch sizes.
// Phone-first: 44px+ touch targets, single column by default, wider layouts from sm:.

import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-3 mb-4 md:mb-6">
      <div className="min-w-0">
        <h1 className="text-xl md:text-2xl font-semibold text-ink leading-tight">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-1 leading-snug">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

export function Card({ children, className, pad = true }: { children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={cx('bg-white rounded-2xl border border-black/5 shadow-card', pad && 'p-4 md:p-5', className)}>
      {children}
    </section>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <h2 className="text-[0.9375rem] font-semibold text-ink">{children}</h2>
      {action}
    </div>
  );
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'gold';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800',
  secondary: 'bg-white text-ink border border-gray-300 hover:bg-gray-50 active:bg-gray-100',
  ghost: 'text-brand-700 hover:bg-brand-50 active:bg-brand-100',
  danger: 'text-red-700 hover:bg-red-50 active:bg-red-100',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800',
  gold: 'bg-gold-400 text-brand-950 hover:bg-gold-500 active:bg-gold-600',
};

export function Button({
  variant = 'primary', size = 'md', block, className, children, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; block?: boolean }) {
  const sizes = { sm: 'h-9 px-3 text-sm', md: 'h-11 px-4 text-[0.9375rem]', lg: 'h-12 px-5 text-base' };
  return (
    <button
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition select-none',
        'disabled:opacity-45 disabled:pointer-events-none',
        sizes[size], VARIANTS[variant], block && 'w-full', className,
      )}
    >
      {children}
    </button>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-gray-500 mt-1.5 leading-snug">{hint}</span>}
    </label>
  );
}

const control =
  'w-full h-11 rounded-xl border border-gray-300 bg-white px-3 text-ink placeholder:text-gray-400 ' +
  'focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 disabled:bg-gray-50';

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cx(control, className)} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={cx(control, 'pr-8', className)}>
      {children}
    </select>
  );
}

export function Badge({ tone = 'gray', children }: { tone?: 'gray' | 'green' | 'amber' | 'red' | 'brand' | 'gold'; children: ReactNode }) {
  const tones = {
    gray: 'bg-gray-100 text-gray-700',
    green: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/15',
    amber: 'bg-amber-50 text-amber-800 ring-1 ring-amber-600/15',
    red: 'bg-red-50 text-red-700 ring-1 ring-red-600/15',
    brand: 'bg-brand-50 text-brand-700 ring-1 ring-brand-600/15',
    gold: 'bg-gold-100 text-gold-600 ring-1 ring-gold-500/20',
  };
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', tones[tone])}>{children}</span>;
}

export function Stat({ label, value, hint, tone = 'default' }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'default' | 'warn' | 'ok' }) {
  return (
    <div className="bg-white rounded-2xl border border-black/5 shadow-card px-3.5 py-3 min-w-0">
      <div className="text-[0.6875rem] uppercase tracking-wide text-gray-500 truncate">{label}</div>
      <div className={cx('text-lg font-semibold mt-0.5 truncate', tone === 'warn' && 'text-amber-700', tone === 'ok' && 'text-brand-700')}>{value}</div>
      {hint && <div className="text-xs text-gray-500 mt-0.5 truncate">{hint}</div>}
    </div>
  );
}

export function Empty({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 bg-white/60 px-5 py-8 text-center">
      {icon && <div className="text-3xl mb-2" aria-hidden>{icon}</div>}
      <div className="font-medium text-ink">{title}</div>
      {children && <div className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">{children}</div>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'error' | 'ok'; children: ReactNode }) {
  const tones = {
    info: 'bg-brand-50 border-brand-100 text-brand-900',
    warn: 'bg-amber-50 border-amber-200 text-amber-900',
    error: 'bg-red-50 border-red-200 text-red-900',
    ok: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  };
  return <div className={cx('rounded-xl border px-3.5 py-3 text-sm leading-snug', tones[tone])}>{children}</div>;
}

/** Segmented control (pill tabs) — replaces underline tabs that overflow on phones. */
export function Segmented<T extends string>({ value, options, onChange }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div className="flex p-1 bg-gray-200/70 rounded-xl gap-1" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            // Wraps to two lines rather than cutting labels off (Tamil words run long).
            'flex-1 min-w-0 min-h-9 px-1.5 py-1 rounded-lg text-sm leading-tight font-medium transition break-words',
            value === o.value ? 'bg-white text-brand-800 shadow-card' : 'text-gray-600',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Tappable settings/menu row. */
export function Row({ icon, title, subtitle, right, onClick }: {
  icon?: ReactNode; title: ReactNode; subtitle?: ReactNode; right?: ReactNode; onClick?: () => void;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} className={cx('w-full flex items-center gap-3 px-4 py-3.5 text-left', onClick && 'active:bg-gray-50')}>
      {icon && <span className="w-9 h-9 rounded-xl bg-brand-50 text-brand-700 grid place-items-center shrink-0">{icon}</span>}
      <span className="flex-1 min-w-0">
        <span className="block text-[0.9375rem] font-medium text-ink">{title}</span>
        {subtitle && <span className="block text-xs text-gray-500 mt-0.5 leading-snug">{subtitle}</span>}
      </span>
      {right ?? (onClick && <Chevron />)}
    </Tag>
  );
}

export function Chevron() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 shrink-0" aria-hidden>
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** "Mon · 26 Oct" style label from an ISO date. */
export function dayLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}
