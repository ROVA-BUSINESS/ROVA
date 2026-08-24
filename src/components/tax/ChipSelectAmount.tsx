import React, { useState } from 'react';
import { Search, Plus, Check, X } from 'lucide-react';

interface ChipSelectAmountProps {
  options?: string[];
  groups?: Record<string, string[]>;
  value: Record<string, number>;
  onChange: (value: Record<string, number>) => void;
  searchable?: boolean;
}

export const ChipSelectAmount: React.FC<ChipSelectAmountProps> = ({
  options = [],
  groups,
  value = {},
  onChange,
  searchable = false
}) => {
  const [search, setSearch] = useState('');

  let allOptions: string[] = [];
  if (groups) {
    Object.values(groups).forEach(items => allOptions.push(...items));
  } else {
    allOptions = [...options];
  }

  const filteredOptions = allOptions.filter(opt =>
    opt.toLowerCase().includes(search.toLowerCase())
  );

  const handleToggleChip = (optionName: string) => {
    const nextVal = { ...value };
    if (nextVal[optionName] !== undefined) {
      delete nextVal[optionName];
    } else {
      nextVal[optionName] = 0;
    }
    onChange(nextVal);
  };

  const handleAmountChange = (optionName: string, amountStr: string) => {
    const num = Math.max(0, parseFloat(amountStr) || 0);
    onChange({
      ...value,
      [optionName]: num,
    });
  };

  const selectedKeys = Object.keys(value);

  const renderChip = (opt: string) => {
    const isSelected = value[opt] !== undefined;
    return (
      <button
        key={opt}
        type="button"
        onClick={() => handleToggleChip(opt)}
        style={{
          padding: '6px 12px',
          borderRadius: 20,
          fontSize: 13,
          fontWeight: 500,
          border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--bg-border)',
          background: isSelected ? 'var(--accent-dim)' : 'var(--bg-elevated)',
          color: isSelected ? 'var(--accent-light)' : 'var(--text-secondary)',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          transition: 'all 0.15s ease',
        }}
      >
        {isSelected ? <Check size={14} /> : <Plus size={14} />}
        {opt}
      </button>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {(searchable || allOptions.length > 8) && (
        <div style={{ position: 'relative' }}>
          <Search
            size={16}
            color="var(--text-muted)"
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--bg-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: 13,
              outline: 'none',
            }}
          />
        </div>
      )}

      {groups && !search ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {Object.entries(groups).map(([groupName, items]) => (
            <div key={groupName}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--accent-light)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: 8,
                }}
              >
                {groupName}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {items.map(renderChip)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {filteredOptions.map(renderChip)}
        </div>
      )}

      {selectedKeys.length > 0 && (
        <div
          style={{
            marginTop: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            padding: 16,
            background: 'var(--bg-base)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--bg-border)',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
            Enter amounts for selected items ({selectedKeys.length})
          </div>
          {selectedKeys.map((keyName) => (
            <div
              key={keyName}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '8px 12px',
                background: 'var(--bg-elevated)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--bg-border)',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', flex: 1 }}>
                {keyName}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>₦</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={value[keyName] || ''}
                  onChange={(e) => handleAmountChange(keyName, e.target.value)}
                  style={{
                    width: 140,
                    padding: '6px 10px',
                    background: 'var(--bg-base)',
                    border: '1px solid var(--bg-border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-primary)',
                    fontSize: 14,
                    fontWeight: 600,
                    textAlign: 'right',
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleToggleChip(keyName)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
                  title="Remove"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
