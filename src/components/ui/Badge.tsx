import type { ReactNode } from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, { background: string; color: string }> = {
  default: { background: 'var(--bg-elevated)', color: 'var(--text-secondary)' },
  success: { background: 'var(--success-dim)', color: 'var(--success)' },
  warning: { background: 'var(--warning-dim)', color: 'var(--warning)' },
  error: { background: 'var(--error-dim)', color: 'var(--error)' },
  info: { background: 'var(--info-dim)', color: 'var(--info)' },
  purple: { background: 'var(--accent-dim)', color: 'var(--accent-light)' },
};

export default function Badge({ children, variant = 'default', style, ...props }: BadgeProps) {
  const s = variantStyles[variant];
  return (
    <span 
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 'var(--radius-full)',
        fontSize: '11px',
        fontWeight: 500,
        background: s.background,
        color: s.color,
        whiteSpace: 'nowrap',
        ...style
      }}
      {...props}
    >
      {children}
    </span>
  );
}
