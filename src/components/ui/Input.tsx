import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string;
  error?: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, prefix, suffix, style, ...props }, ref) => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {label && (
          <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
            {label}
          </label>
        )}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          {prefix && (
            <span style={{
              position: 'absolute', left: 10, color: 'var(--text-muted)',
              display: 'flex', alignItems: 'center', pointerEvents: 'none',
            }}>
              {prefix}
            </span>
          )}
          <input
            ref={ref}
            {...props}
            style={{
              width: '100%',
              padding: `9px ${suffix ? '36px' : '12px'} 9px ${prefix ? '32px' : '12px'}`,
              background: 'var(--bg-elevated)',
              border: `1px solid ${error ? 'var(--error)' : 'var(--bg-border)'}`,
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              outline: 'none',
              transition: 'border-color 0.15s ease',
              ...style,
            }}
            onFocus={e => {
              e.target.style.borderColor = error ? 'var(--error)' : 'var(--accent-primary)';
              props.onFocus?.(e);
            }}
            onBlur={e => {
              e.target.style.borderColor = error ? 'var(--error)' : 'var(--bg-border)';
              props.onBlur?.(e);
            }}
          />
          {suffix && (
            <span style={{
              position: 'absolute', right: 10, color: 'var(--text-muted)',
              display: 'flex', alignItems: 'center',
            }}>
              {suffix}
            </span>
          )}
        </div>
        {error && <span style={{ fontSize: 12, color: 'var(--error)' }}>{error}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';
export default Input;
