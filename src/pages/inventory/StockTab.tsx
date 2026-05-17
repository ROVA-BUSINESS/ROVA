import { useState, type FormEvent } from 'react';
import { Plus, Pencil, Trash2, Package, TriangleAlert as AlertTriangle, TrendingDown, CircleArrowUp as ArrowUpCircle, CircleArrowDown as ArrowDownCircle } from 'lucide-react';
import { supabase, type InventoryItem, type Supplier } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency } from '../../lib/format';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import { useMobile } from '../../hooks/useMobile';

type StockMovement = {
  itemId: string;
  type: 'purchase' | 'sale' | 'adjustment';
  quantity: string;
  unit_cost: string;
  notes: string;
  date: string;
};

const EMPTY_ITEM = {
  sku: '', name: '', description: '', category: '', unit: 'unit',
  cost_price: '', selling_price: '', current_stock: '', reorder_level: '',
  supplier_id: '', notes: '', status: 'active' as InventoryItem['status'],
};

interface Props {
  items: InventoryItem[];
  suppliers: Supplier[];
  onRefresh: () => void;
}

export default function StockTab({ items, suppliers, onRefresh }: Props) {
  const { user } = useAuth();
  const isMobile = useMobile(1024);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState(EMPTY_ITEM);
  const [movement, setMovement] = useState<StockMovement>({ itemId: '', type: 'purchase', quantity: '', unit_cost: '', notes: '', date: new Date().toISOString().split('T')[0] });
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<'all' | 'low_stock' | 'out_of_stock'>('all');

  const lowStock = items.filter(i => i.current_stock <= i.reorder_level && i.current_stock > 0);
  const outOfStock = items.filter(i => i.current_stock === 0);
  const totalValue = items.reduce((s, i) => s + i.current_stock * i.cost_price, 0);

  function openNew() { setEditing(null); setForm(EMPTY_ITEM); setShowItemModal(true); }
  function openEdit(item: InventoryItem) {
    setEditing(item);
    setForm({
      sku: item.sku, name: item.name, description: item.description,
      category: item.category, unit: item.unit,
      cost_price: String(item.cost_price), selling_price: String(item.selling_price),
      current_stock: String(item.current_stock), reorder_level: String(item.reorder_level),
      supplier_id: item.supplier_id || '', notes: item.notes, status: item.status,
    });
    setShowItemModal(true);
  }
  function openMove(itemId: string) {
    setMovement({ itemId, type: 'purchase', quantity: '', unit_cost: '', notes: '', date: new Date().toISOString().split('T')[0] });
    setShowMoveModal(true);
  }

  async function handleItemSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      cost_price: Number(form.cost_price), selling_price: Number(form.selling_price),
      current_stock: Number(form.current_stock), reorder_level: Number(form.reorder_level),
      supplier_id: form.supplier_id || null, user_id: user!.id,
    };
    if (editing) await supabase.from('inventory_items').update(payload).eq('id', editing.id);
    else await supabase.from('inventory_items').insert(payload);
    setSaving(false);
    setShowItemModal(false);
    onRefresh();
  }

  async function handleMoveSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const qty = Number(movement.quantity);
    const unitCost = Number(movement.unit_cost) || 0;
    const item = items.find(i => i.id === movement.itemId);
    if (!item) { setSaving(false); return; }

    const qtyChange = movement.type === 'sale' ? -qty : movement.type === 'purchase' ? qty : qty;
    const newStock = item.current_stock + qtyChange;

    await supabase.from('inventory_transactions').insert({
      user_id: user!.id, item_id: movement.itemId,
      type: movement.type, quantity: qty,
      unit_cost: unitCost, total_cost: qty * unitCost,
      notes: movement.notes, date: movement.date,
    });
    await supabase.from('inventory_items').update({ current_stock: newStock }).eq('id', movement.itemId);

    if (movement.type === 'sale' && item.cost_price > 0) {
      await supabase.from('transactions').insert({
        user_id: user!.id, amount: qty * item.cost_price,
        type: 'expense', description: `COGS — ${item.name} (${qty} ${item.unit})`,
        date: movement.date, notes: `Cost of goods sold`,
      });
    } else if (movement.type === 'purchase') {
      await supabase.from('transactions').insert({
        user_id: user!.id, amount: qty * unitCost,
        type: 'expense', description: `Stock purchase — ${item.name} (${qty} ${item.unit})`,
        date: movement.date, notes: `Inventory purchase`,
      });
    }

    setSaving(false);
    setShowMoveModal(false);
    onRefresh();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this item?')) return;
    await supabase.from('inventory_items').delete().eq('id', id);
    onRefresh();
  }

  function f(field: keyof typeof EMPTY_ITEM) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [field]: e.target.value }));
  }

  const filtered = items.filter(i => {
    if (filter === 'low_stock') return i.current_stock <= i.reorder_level && i.current_stock > 0;
    if (filter === 'out_of_stock') return i.current_stock === 0;
    return true;
  });

  const selectedItem = items.find(i => i.id === movement.itemId);

  return (
    <div>
      <div className="mobile-grid-2 mobile-gap-4" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <Card>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total SKUs</div>
          <div className="mobile-stat-value" style={{ fontSize: 24, fontWeight: 700, fontFamily: 'Space Grotesk', color: 'var(--text-primary)' }}>{items.length}</div>
        </Card>
        <Card>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Inventory Value</div>
          <div className="mobile-stat-value" style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Space Grotesk', color: 'var(--accent-light)' }}>{formatCurrency(totalValue)}</div>
        </Card>
        <Card onClick={() => setFilter('low_stock')} hoverable>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Low Stock</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div className="mobile-stat-value" style={{ fontSize: 24, fontWeight: 700, fontFamily: 'Space Grotesk', color: lowStock.length > 0 ? 'var(--warning)' : 'var(--text-primary)' }}>{lowStock.length}</div>
            {lowStock.length > 0 && <AlertTriangle size={14} color="var(--warning)" />}
          </div>
        </Card>
        <Card onClick={() => setFilter('out_of_stock')} hoverable>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Out of Stock</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div className="mobile-stat-value" style={{ fontSize: 24, fontWeight: 700, fontFamily: 'Space Grotesk', color: outOfStock.length > 0 ? 'var(--error)' : 'var(--text-primary)' }}>{outOfStock.length}</div>
            {outOfStock.length > 0 && <TrendingDown size={14} color="var(--error)" />}
          </div>
        </Card>
      </div>

      <div className="mobile-col mobile-gap-4" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="mobile-overflow-x" style={{ display: 'flex', gap: 6, maxWidth: '100%' }}>
          {(['all', 'low_stock', 'out_of_stock'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{
                padding: '6px 12px', borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 500,
                background: filter === f ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                color: filter === f ? 'white' : 'var(--text-secondary)',
                border: `1px solid ${filter === f ? 'var(--accent-primary)' : 'var(--bg-border)'}`,
                transition: 'all 0.15s',
              }}>{f.replace('_', ' ')}</button>
          ))}
        </div>
        <div className="mobile-hide">
          <Button variant="primary" icon={<Plus size={14} />} onClick={openNew}>Add Item</Button>
        </div>
        <div className="mobile-only" style={{ display: 'none' }}>
          <Button variant="primary" icon={<Plus size={14} />} onClick={openNew} style={{ width: '100%' }}>Add Item</Button>
        </div>
      </div>

      {lowStock.length > 0 && filter === 'all' && (
        <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--warning-dim)', border: '1px solid rgba(245,158,11,0.2)', marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
          <AlertTriangle size={14} color="var(--warning)" />
          <span style={{ fontSize: 13, color: 'var(--warning)', fontWeight: 500 }}>Low stock alert:</span>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{lowStock.map(i => i.name).join(', ')}</span>
        </div>
      )}

      {filtered.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Package size={32} color="var(--text-disabled)" style={{ margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No items found</p>
            <p style={{ color: 'var(--text-disabled)', fontSize: 12, marginTop: 4, marginBottom: 16 }}>Add your first inventory item to start tracking stock</p>
            <Button variant="primary" icon={<Plus size={14} />} onClick={openNew}>Add Item</Button>
          </div>
        </Card>
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div className="mobile-table-container">
            <table className="transaction-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-elevated)' }}>
                  {[
                    { label: 'Item' },
                    { label: 'SKU', hideMobile: true },
                    { label: 'Category', hideMobile: true },
                    { label: 'Cost Price', width: '25%' },
                    { label: 'Sell Price', hideMobile: true },
                    { label: 'Stock' },
                    { label: 'Reorder Level', hideMobile: true },
                    { label: 'Stock Value', hideMobile: true },
                    { label: '', width: '90px' }
                  ].map(h => (
                    <th key={h.label} className={h.hideMobile ? 'mobile-hide' : 'mobile-tight-td'} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', width: h.width || 'auto' }}>{h.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, i) => {
                  const isLow = item.current_stock <= item.reorder_level && item.current_stock > 0;
                  const isOut = item.current_stock === 0;
                  return (
                    <tr key={item.id} style={{ borderTop: i > 0 ? '1px solid var(--bg-border)' : 'none' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                    >
                      <td className="mobile-tight-td" style={{ padding: '12px 14px' }}>
                        <div className="mobile-desc-text" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                        <div className="mobile-desc-text" style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.unit}</div>
                      </td>
                      <td className="mobile-hide" style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{item.sku || '—'}</td>
                      <td className="mobile-hide" style={{ padding: '12px 14px' }}><Badge variant="default">{item.category || '—'}</Badge></td>
                      <td className="mobile-tight-td" style={{ padding: '12px 14px', fontSize: 13, fontFamily: 'Space Grotesk', color: 'var(--text-secondary)' }}>{formatCurrency(item.cost_price)}</td>
                      <td className="mobile-hide" style={{ padding: '12px 14px', fontSize: 13, fontFamily: 'Space Grotesk', color: 'var(--success)' }}>{formatCurrency(item.selling_price)}</td>
                      <td className="mobile-tight-td" style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'Space Grotesk', color: isOut ? 'var(--error)' : isLow ? 'var(--warning)' : 'var(--text-primary)' }}>
                            {item.current_stock}
                          </span>
                          {isOut && <Badge variant="error">Out</Badge>}
                          {isLow && !isOut && <Badge variant="warning">Low</Badge>}
                        </div>
                      </td>
                      <td className="mobile-hide" style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-muted)' }}>{item.reorder_level}</td>
                      <td className="mobile-hide" style={{ padding: '12px 14px', fontSize: 13, fontFamily: 'Space Grotesk', fontWeight: 600, color: 'var(--accent-light)' }}>{formatCurrency(item.current_stock * item.cost_price)}</td>
                      <td className="mobile-tight-td" style={{ padding: '12px 14px', paddingRight: 8 }}>
                        <div style={{ display: 'flex', gap: 2 }}>
                          <button onClick={() => openMove(item.id)} title="Stock movement"
                            style={{ padding: 5, borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', transition: 'all 0.15s' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--success-dim)'; (e.currentTarget as HTMLElement).style.color = 'var(--success)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                          ><ArrowUpCircle size={13} /></button>
                          <button onClick={() => openEdit(item)}
                            style={{ padding: 5, borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', transition: 'all 0.15s' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-border)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                          ><Pencil size={12} /></button>
                          <button onClick={() => handleDelete(item.id)}
                            style={{ padding: 5, borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', transition: 'all 0.15s' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--error-dim)'; (e.currentTarget as HTMLElement).style.color = 'var(--error)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                          ><Trash2 size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={showItemModal} onClose={() => setShowItemModal(false)} title={editing ? 'Edit Item' : 'Add Inventory Item'} size="lg">
        <form onSubmit={handleItemSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
            <Input label="Item Name" placeholder="Product name" value={form.name} onChange={f('name')} required />
            <Input label="SKU / Code" placeholder="SKU-001" value={form.sku} onChange={f('sku')} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 10 }}>
            <Input label="Category" placeholder="Electronics, Food..." value={form.category} onChange={f('category')} />
            <Input label="Unit" placeholder="unit, kg, litre..." value={form.unit} onChange={f('unit')} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Supplier</label>
              <select value={form.supplier_id} onChange={f('supplier_id')}
                style={{ padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none' }}>
                <option value="">No supplier</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
            <Input label="Cost Price (₦)" type="number" min="0" step="0.01" placeholder="0.00" value={form.cost_price} onChange={f('cost_price')} required />
            <Input label="Selling Price (₦)" type="number" min="0" step="0.01" placeholder="0.00" value={form.selling_price} onChange={f('selling_price')} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
            <Input label="Current Stock" type="number" min="0" step="0.001" placeholder="0" value={form.current_stock} onChange={f('current_stock')} required />
            <Input label="Reorder Level (Low Stock Alert)" type="number" min="0" step="0.001" placeholder="0" value={form.reorder_level} onChange={f('reorder_level')} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
            <Button variant="secondary" type="button" onClick={() => setShowItemModal(false)}>Cancel</Button>
            <Button variant="primary" loading={saving} type="submit">{editing ? 'Save Changes' : 'Add Item'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={showMoveModal} onClose={() => setShowMoveModal(false)} title="Record Stock Movement" size="sm">
        <form onSubmit={handleMoveSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {selectedItem && (
            <div style={{ padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--bg-border)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{selectedItem.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Current stock: <strong>{selectedItem.current_stock} {selectedItem.unit}</strong></div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            {(['purchase', 'sale', 'adjustment'] as const).map(t => (
              <button key={t} type="button" onClick={() => setMovement(p => ({ ...p, type: t }))}
                style={{
                  flex: 1, padding: '8px', borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 500,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  background: movement.type === t ? (t === 'purchase' ? 'var(--success-dim)' : t === 'sale' ? 'var(--error-dim)' : 'var(--info-dim)') : 'var(--bg-elevated)',
                  color: movement.type === t ? (t === 'purchase' ? 'var(--success)' : t === 'sale' ? 'var(--error)' : 'var(--info)') : 'var(--text-muted)',
                  border: `1px solid ${movement.type === t ? (t === 'purchase' ? 'rgba(34,197,94,0.3)' : t === 'sale' ? 'rgba(239,68,68,0.3)' : 'rgba(59,130,246,0.3)') : 'var(--bg-border)'}`,
                  transition: 'all 0.15s',
                }}>
                {t === 'purchase' ? <ArrowUpCircle size={12} /> : t === 'sale' ? <ArrowDownCircle size={12} /> : null}
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <Input label="Quantity" type="number" min="0.001" step="0.001" placeholder="0" value={movement.quantity} onChange={e => setMovement(p => ({ ...p, quantity: e.target.value }))} required />
          {movement.type === 'purchase' && (
            <Input label="Unit Cost (₦)" type="number" min="0" step="0.01" placeholder="0.00" value={movement.unit_cost} onChange={e => setMovement(p => ({ ...p, unit_cost: e.target.value }))} />
          )}
          <Input label="Date" type="date" value={movement.date} onChange={e => setMovement(p => ({ ...p, date: e.target.value }))} required />
          <Input label="Notes (optional)" placeholder="Reference, reason..." value={movement.notes} onChange={e => setMovement(p => ({ ...p, notes: e.target.value }))} />
          {movement.type === 'sale' && selectedItem && (
            <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--warning-dim)', border: '1px solid rgba(245,158,11,0.2)', fontSize: 12, color: 'var(--text-secondary)' }}>
              A COGS expense transaction ({formatCurrency(Number(movement.quantity || 0) * selectedItem.cost_price)}) will be automatically created.
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setShowMoveModal(false)}>Cancel</Button>
            <Button variant="primary" loading={saving} type="submit">Record Movement</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
