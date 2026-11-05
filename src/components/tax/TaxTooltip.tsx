import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  const [coords, setCoords] = useState<{ top: number; left: number; placeAbove: boolean } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
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

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const tooltipWidth = Math.min(340, window.innerWidth - 24);
    
    // Check if there is enough space above (at least 200px)
    const placeAbove = rect.top >= 220;
    
    // Center horizontally on button, clamped to viewport margins
    const halfWidth = tooltipWidth / 2;
    let targetLeft = rect.left + rect.width / 2;
    if (targetLeft - halfWidth < 12) {
      targetLeft = halfWidth + 12;
    } else if (targetLeft + halfWidth > window.innerWidth - 12) {
      targetLeft = window.innerWidth - halfWidth - 12;
    }

    setCoords({
      top: placeAbove ? rect.top - 8 : rect.bottom + 8,
      left: targetLeft,
      placeAbove,
    });
  };

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      const handleScrollOrResize = () => updatePosition();
      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);

      const handleClickOutside = (e: MouseEvent | TouchEvent) => {
        if (
          triggerRef.current &&
          !triggerRef.current.contains(e.target as Node) &&
          tooltipRef.current &&
          !tooltipRef.current.contains(e.target as Node)
        ) {
          setIsOpen(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);

      return () => {
        window.removeEventListener('scroll', handleScrollOrResize, true);
        window.removeEventListener('resize', handleScrollOrResize);
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('touchstart', handleClickOutside);
      };
    }
  }, [isOpen]);

  if (!data) return null;

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    updatePosition();
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 200);
  };

  return (
    <>
      <span
        style={{
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
          ref={triggerRef}
          type="button"
          aria-label={`Tax info for ${data.title}`}
          onClick={(e) => {
            e.stopPropagation();
            updatePosition();
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
      </span>

      {isOpen &&
        coords &&
        createPortal(
          <div
            ref={tooltipRef}
            role="tooltip"
            onMouseEnter={() => {
              if (timeoutRef.current) clearTimeout(timeoutRef.current);
            }}
            onMouseLeave={handleMouseLeave}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: coords.placeAbove ? undefined : `${coords.top}px`,
              bottom: coords.placeAbove ? `${window.innerHeight - coords.top}px` : undefined,
              left: `${coords.left}px`,
              transform: 'translateX(-50%)',
              width: 'min(340px, calc(100vw - 24px))',
              maxHeight: 'min(360px, 80vh)',
              overflowY: 'auto',
              background: 'var(--bg-card, #1f232b)',
              color: 'var(--text-primary, #ffffff)',
              border: '1px solid var(--bg-border, #374151)',
              borderRadius: 8,
              padding: '12px 14px',
              boxShadow: '0 12px 30px rgba(0, 0, 0, 0.5), 0 4px 10px rgba(0, 0, 0, 0.3)',
              zIndex: 99999999,
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
          </div>,
          document.body
        )}
    </>
  );
};
