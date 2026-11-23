import { Plus, Trash2, Package } from 'lucide-react';
import { type InventoryItem } from '../lib/supabase';
import { formatCurrency } from '../lib/format';

export interface SaleItemSelection {
  itemId: string;
  quantity: number;
}

interface SalesItemsPickerProps {
  items: InventoryItem[];
  selections: SaleItemSelection[];
  onChange: (next: SaleItemSelection[]) => void;
}

export default function SalesItemsPicker({ items, selections, onChange }: SalesItemsPickerProps) {
  const activeItems = items.filter((i) => i.status === 'active');

  function addRow() {
    const usedIds = new Set(selections.map((s) => s.itemId));
    const nextAvailable = activeItems.find((i) => !usedIds.has(i.id)) || activeItems[0];
    if (!nextAvailable) return;
    onChange([...selections, { itemId: nextAvailable.id, quantity: 1 }]);
  }

  function updateRow(idx: number, patch: Partial<SaleItemSelection>) {
    const next = selections.map((row, i) => (i === idx ? { ...row, ...patch } : row));
    onChange(next);
  }

  function removeRow(idx: number) {
    onChange(selections.filter((_, i) => i !== idx));
  }

  const totalCalculated = selections.reduce((sum, sel) => {
    const item = items.find((i) => i.id === sel.itemId);
    if (!item) return sum;
    return sum + (Number(item.selling_price) || 0) * (Number(sel.quantity) || 0);
  }, 0);

  return (
    <div
      style={{
        padding: '12px 14px',
        borderRadius: 'var(--radius-md)',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--accent-border)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Package size={14} color="var(--accent-light)" />
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>
            Items Sold (Deducts from Inventory)
          </span>
        </div>
        {activeItems.length > 0 && (
          <button
            type="button"
            onClick={addRow}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--accent-dim)',
              border: '1px solid var(--accent-border)',
              color: 'var(--accent-light)',
              fontSize: 11.5,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Plus size={12} /> Add Item
          </button>
        )}
      </div>

      {activeItems.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          No active inventory items found. Add products in the <strong>Inventory</strong> page to link them to sales and track stock automatically.
        </div>
      ) : selections.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Optionally select the products sold to auto-calculate revenue &amp; update stock.
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {selections.map((sel, idx) => {
            const matched = items.find((i) => i.id === sel.itemId);
            const lineTotal = matched ? (Number(matched.selling_price) || 0) * (Number(sel.quantity) || 0) : 0;
            const currentStock = Number(matched?.current_stock || 0);
            const overStock = matched && sel.quantity > currentStock;

            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--bg-border)',
                }}
              >
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select
                    value={sel.itemId}
                    onChange={(e) => updateRow(idx, { itemId: e.target.value })}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      padding: '7px 8px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--bg-border)',
                      color: 'var(--text-primary)',
                      fontSize: 12.5,
                      outline: 'none',
                    }}
                  >
                    {activeItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} — {formatCurrency(item.selling_price)} ({item.current_stock} {item.unit} left)
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min="0.001"
                    step="any"
                    value={sel.quantity}
                    onChange={(e) => updateRow(idx, { quantity: Math.max(0, Number(e.target.value) || 0) })}
                    title="Quantity sold"
                    style={{
                      width: 68,
                      padding: '7px 8px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--bg-border)',
                      color: 'var(--text-primary)',
                      fontSize: 12.5,
                      textAlign: 'center',
                      outline: 'none',
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => removeRow(idx)}
                    title="Remove item"
                    style={{
                      padding: 6,
                      borderRadius: 'var(--radius-sm)',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--error)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: 'var(--text-muted)' }}>
                  <span>
                    {overStock ? (
                      <span style={{ color: 'var(--warning)', fontWeight: 600 }}>
                        Exceeds current stock ({currentStock} {matched?.unit})
                      </span>
                    ) : (
                      <span>
                        {matched ? `${formatCurrency(matched.selling_price)} × ${sel.quantity} ${matched.unit}` : ''}
                      </span>
                    )}
                  </span>
                  <strong style={{ color: 'var(--text-primary)', fontFamily: 'Space Grotesk, sans-serif' }}>
                    {formatCurrency(lineTotal)}
                  </strong>
                </div>
              </div>
            );
          })}

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: 4,
              borderTop: '1px solid var(--bg-border)',
              fontSize: 12,
            }}
          >
            <span style={{ color: 'var(--text-muted)' }}>Calculated Items Total (editable in Amount)</span>
            <strong style={{ color: 'var(--success)', fontFamily: 'Space Grotesk, sans-serif', fontSize: 13.5 }}>
              {formatCurrency(totalCalculated)}
            </strong>
          </div>
        </div>
      )}
    </div>
  );
}
