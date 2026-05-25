import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Package, Building2 } from 'lucide-react';
import { supabase, type InventoryItem, type Supplier } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import StockTab from './StockTab';
import SuppliersTab from './SuppliersTab';

type Tab = 'stock' | 'suppliers';

export default function InventoryPage() {
  const { user } = useAuth();
  const location = useLocation();
  const [tab, setTab] = useState<Tab>('stock');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  async function loadData() {
    setLoading(true);
    const [itemsRes, suppliersRes] = await Promise.all([
      supabase.from('inventory_items').select('*, supplier:suppliers(*)').eq('user_id', user!.id).order('name'),
      supabase.from('suppliers').select('*').eq('user_id', user!.id).order('name'),
    ]);
    setItems(itemsRes.data || []);
    setSuppliers(suppliersRes.data || []);
    setLoading(false);
  }

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'stock', label: 'Stock & Products', icon: Package },
    { key: 'suppliers', label: 'Suppliers', icon: Building2 },
  ];

  return (
    <div className="mobile-p-4" style={{ padding: 24, maxWidth: 1200, animation: 'fadeIn 0.3s ease' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>Inventory</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Track stock levels, COGS, and suppliers</p>
      </div>

      <div className="mobile-overflow-x" style={{ display: 'flex', gap: 2, marginBottom: 24, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: 4, width: 'fit-content', maxWidth: '100%' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '7px 16px',
              borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 500,
              background: tab === t.key ? 'var(--bg-card)' : 'transparent',
              color: tab === t.key ? 'var(--text-primary)' : 'var(--text-muted)',
              transition: 'all 0.15s', boxShadow: tab === t.key ? 'var(--shadow-sm)' : 'none',
              border: tab === t.key ? '1px solid var(--bg-border)' : '1px solid transparent',
            }}
          >
            <t.icon size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div>{[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 56, marginBottom: 10 }} />)}</div>
      ) : tab === 'stock' ? (
        <StockTab items={items} suppliers={suppliers} onRefresh={loadData} locationState={location.state} />
      ) : (
        <SuppliersTab suppliers={suppliers} onRefresh={loadData} />
      )}
    </div>
  );
}
