import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { TaxTooltip } from './TaxTooltip';

interface GateBlockProps {
  title: string;
  tooltipTerm?: string;
  isOpen?: boolean;
  onToggle?: (isOpen: boolean) => void;
  children: React.ReactNode;
}

export function GateBlock({ title, tooltipTerm, isOpen: controlledIsOpen, onToggle, children }: GateBlockProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

  const handleToggle = () => {
    const nextState = !isOpen;
    setInternalIsOpen(nextState);
    if (onToggle) onToggle(nextState);
  };

  return (
    <div
      style={{
        border: '1px solid var(--bg-border)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--bg-base)',
        overflow: 'hidden',
        marginBottom: 12,
      }}
    >
      <button
        type="button"
        onClick={handleToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: 'var(--bg-elevated)',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          color: 'var(--text-primary)',
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {title}
          <TaxTooltip term={tooltipTerm || title} size={15} />
        </span>
        {isOpen ? <ChevronDown size={18} color="var(--text-muted)" /> : <ChevronRight size={18} color="var(--text-muted)" />}
      </button>
      
      {isOpen && (
        <div style={{ padding: 16, borderTop: '1px solid var(--bg-border)' }}>
          {children}
        </div>
      )}
    </div>
  );
}
