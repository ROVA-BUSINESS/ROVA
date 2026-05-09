import { type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
}

const styles: Record<Variant, string> = {
  primary: 'background: var(--accent-primary); color: white;',
  secondary: 'background: var(--bg-elevated); color: var(--text-primary); border: 1px solid var(--bg-border);',
  ghost: 'background: transparent; color: var(--text-secondary);',
  danger: 'background: var(--error-dim); color: var(--error); border: 1px solid rgba(239,68,68,0.2);',
  success: 'background: var(--success-dim); color: var(--success); border: 1px solid rgba(34,197,94,0.2);',
  outline: 'background: transparent; color: var(--text-primary); border: 1px solid var(--bg-border);',
};

const sizes: Record<Size, string> = {
  sm: 'padding: 6px 12px; font-size: 12px; border-radius: var(--radius-sm);',
  md: 'padding: 8px 16px; font-size: 13px; border-radius: var(--radius-md);',
  lg: 'padding: 11px 22px; font-size: 14px; border-radius: var(--radius-md);',
};

export default function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  children,
  style,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontWeight: 500,
        transition: 'all 0.15s ease',
        cursor: loading || props.disabled ? 'not-allowed' : 'pointer',
        opacity: props.disabled ? 0.5 : 1,
        whiteSpace: 'nowrap',
        ...Object.fromEntries(
          styles[variant].split(';').filter(Boolean).map(s => {
            const [k, ...v] = s.split(':');
            return [k.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase()), v.join(':').trim()];
          })
        ),
        ...Object.fromEntries(
          sizes[size].split(';').filter(Boolean).map(s => {
            const [k, ...v] = s.split(':');
            return [k.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase()), v.join(':').trim()];
          })
        ),
        ...style,
      }}
    >
      {loading ? (
        <span style={{ width: 14, height: 14, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
      ) : icon}
      {children}
    </button>
  );
}
