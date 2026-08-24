

interface ChipSelectProps {
  options: string[];
  selectedOptions: string[];
  onChange: (selected: string[]) => void;
  isMulti?: boolean;
}

export function ChipSelect({ options, selectedOptions, onChange, isMulti = true }: ChipSelectProps) {
  const handleToggle = (opt: string) => {
    if (isMulti) {
      if (selectedOptions.includes(opt)) {
        onChange(selectedOptions.filter((s) => s !== opt));
      } else {
        onChange([...selectedOptions, opt]);
      }
    } else {
      onChange([opt]);
    }
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map((opt) => {
        const isSelected = selectedOptions.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => handleToggle(opt)}
            style={{
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: 500,
              border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--bg-border)',
              background: isSelected ? 'var(--accent-dim)' : 'var(--bg-elevated)',
              color: isSelected ? 'var(--accent-light)' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {isSelected ? '✓ ' : '+ '}
            {opt}
          </button>
        );
      })}
    </div>
  );
}
