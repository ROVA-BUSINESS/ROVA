import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { getTaxExplanation, type TaxExplanation } from './taxExplanations';

interface TaxTooltipProps {
  term?: string;
  title?: string;
  explanation?: string;
  example?: string;
  formula?: string;
  size?: number;
  inline?: boolean;
}

export const TaxTooltip: React.FC<TaxTooltipProps> = ({
  term,
  title: customTitle,
  explanation: customExplanation,
  example: customExample,
  formula: customFormula,
  size = 14,
  inline = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const data: TaxExplanation | null = term
    ? getTaxExplanation(term)
    : customTitle && customExplanation
    ? {
        title: customTitle,
        explanation: customExplanation,
        example: customExample,
        formula: customFormula,
      }
    : null;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isOpen]);

  if (!data) return null;

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 200);
  };

  return (
    <span
      ref={containerRef}
      style={{
        position: 'relative',
        display: inline ? 'inline-flex' : 'flex',
        alignItems: 'center',
        verticalAlign: 'middle',
        marginLeft: 4,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        aria-label={`Tax info for ${data.title}`}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'none',
          border: 'none',
          padding: 2,
          margin: 0,
          cursor: 'pointer',
          color: isOpen ? 'var(--accent-primary, #9333ea)' : 'var(--text-muted, #888)',
          transition: 'color 0.15s ease',
          lineHeight: 1,
        }}
        title={`Click or hover for explanation of ${data.title}`}
      >
        <HelpCircle size={size} />
      </button>

      {isOpen && (
        <div
          role="tooltip"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'min(320px, 85vw)',
            maxHeight: '360px',
            overflowY: 'auto',
            background: 'var(--bg-card, #1f232b)',
            color: 'var(--text-primary, #ffffff)',
            border: '1px solid var(--bg-border, #374151)',
            borderRadius: 8,
            padding: '12px 14px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
            zIndex: 999999,
            fontSize: 12.5,
            lineHeight: 1.45,
            textAlign: 'left',
            whiteSpace: 'normal',
            pointerEvents: 'auto',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 6,
              borderBottom: '1px solid var(--bg-border, #374151)',
              paddingBottom: 6,
            }}
          >
            <span
              style={{
                fontWeight: 700,
                fontSize: 13,
                color: 'var(--accent-light, #c084fc)',
              }}
            >
              {data.title}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }}
              style={{
                background: 'none',
                border: 'none',
                padding: 2,
                cursor: 'pointer',
                color: 'var(--text-muted, #888)',
              }}
            >
              <X size={13} />
            </button>
          </div>

          {/* Explanation */}
          <div style={{ color: 'var(--text-primary, #e5e7eb)', marginBottom: data.example || data.formula ? 8 : 0 }}>
            {data.explanation}
          </div>

          {/* Formula if present */}
          {data.formula && (
            <div
              style={{
                marginBottom: 8,
                padding: '6px 8px',
                borderRadius: 4,
                background: 'var(--bg-elevated, #2a2f3b)',
                borderLeft: '3px solid var(--accent-primary, #9333ea)',
                fontSize: 11.5,
                color: 'var(--text-secondary, #cbd5e1)',
              }}
            >
              <strong style={{ color: 'var(--accent-light, #c084fc)' }}>Formula: </strong>
              {data.formula}
            </div>
          )}

          {/* Example if present */}
          {data.example && (
            <div
              style={{
                padding: '6px 8px',
                borderRadius: 4,
                background: 'rgba(59, 130, 246, 0.1)',
                borderLeft: '3px solid #3b82f6',
                fontSize: 11.5,
                color: 'var(--text-secondary, #cbd5e1)',
              }}
            >
              <strong style={{ color: '#60a5fa' }}>Example: </strong>
              {data.example}
            </div>
          )}
        </div>
      )}
    </span>
  );
};
