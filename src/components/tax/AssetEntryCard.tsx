
import { X } from 'lucide-react';
import type { FixedAsset, AssetCategory } from '../../types/rovaTaxFlow';

const ASSET_CATEGORIES: AssetCategory[] = [
  'Building Industrial', 'Building Non-Industrial', 'Plants (excluding Furniture & Fittings)',
  'Agricultural Plants Expenditure', 'Furniture & Fittings Expenditure', 'Public Transport Motor Vehicles',
  'Motor Vehicles Expenditure', 'Plantation Equipment', 'Construction Plants Expenditure',
  'Research & Development Expenditure', 'Housing Estate Expenditure', 'Land',
  'Ranching & Plantation', 'Software', 'Others'
];

interface AssetEntryCardProps {
  asset: FixedAsset;
  salvageValue: number;
  annualDepreciation: number;
  onChange: (updated: FixedAsset) => void;
  onRemove: () => void;
}

export function AssetEntryCard({ asset, salvageValue, annualDepreciation, onChange, onRemove }: AssetEntryCardProps) {
  return (
    <div style={{
      border: '1px solid var(--bg-border)',
      borderRadius: 'var(--radius-md)',
      padding: 16,
      background: 'var(--bg-base)',
      marginBottom: 16,
      position: 'relative'
    }}>
      <button 
        type="button"
        onClick={onRemove}
        style={{
          position: 'absolute', top: 12, right: 12,
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)'
        }}
      >
        <X size={16} />
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Date first used</label>
          <input 
            type="date"
            value={asset.dateFirstUsed}
            onChange={e => onChange({ ...asset, dateFirstUsed: e.target.value })}
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--bg-border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)'
            }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Cost of asset (₦)</label>
          <input 
            type="number"
            value={asset.cost || ''}
            onChange={e => onChange({ ...asset, cost: Number(e.target.value) })}
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--bg-border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)'
            }}
          />
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Description</label>
        <input 
          type="text"
          value={asset.description}
          onChange={e => onChange({ ...asset, description: e.target.value })}
          placeholder="e.g. Delivery Van"
          style={{
            width: '100%', padding: '8px 12px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--bg-border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)'
          }}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Asset Category</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {ASSET_CATEGORIES.map(cat => {
            const isSelected = asset.category === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => onChange({ ...asset, category: cat })}
                style={{
                  padding: '6px 12px', borderRadius: '20px', fontSize: 12, fontWeight: 500,
                  border: isSelected ? '1px solid var(--accent-primary)' : '1px solid var(--bg-border)',
                  background: isSelected ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                  color: isSelected ? 'var(--accent-light)' : 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                {cat}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{
        padding: 12,
        background: 'var(--bg-elevated)',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--bg-border)',
        fontSize: 13,
        color: 'var(--text-secondary)'
      }}>
        {asset.category === 'Land' ? (
          <span>No salvage % or useful life applies (N/A).</span>
        ) : asset.category && asset.cost > 0 ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <span>Salvage Value: <strong style={{ color: 'var(--text-primary)' }}>₦{salvageValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
            <span>Annual Depreciation: <strong style={{ color: 'var(--text-primary)' }}>₦{annualDepreciation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
          </div>
        ) : (
          <span>Select a category and enter cost to see depreciation.</span>
        )}
      </div>
    </div>
  );
}
