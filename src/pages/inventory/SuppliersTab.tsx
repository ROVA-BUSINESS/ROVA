import { useState, type FormEvent } from 'react';
import { Plus, Pencil, Trash2, Building2 } from 'lucide-react';
import { supabase, type Supplier } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import { useMobile } from '../../hooks/useMobile';

const EMPTY: Omit<Supplier, 'id' | 'user_id' | 'created_at'> = {
  name: '', contact_person: '', email: '', phone: '',
  address: '', payment_terms: 'net_30', notes: '', is_active: true,
};

interface Props {
  suppliers: Supplier[];
  onRefresh: () => void;
}

export default function SuppliersTab({ suppliers, onRefresh }: Props) {
  const { user } = useAuth();
  const isMobile = useMobile(1024);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  function openNew() { setEditing(null); setForm(EMPTY); setShowModal(true); }
  function openEdit(s: Supplier) {
    setEditing(s);
    setForm({ name: s.name, contact_person: s.contact_person, email: s.email, phone: s.phone, address: s.address, payment_terms: s.payment_terms, notes: s.notes, is_active: s.is_active });
    setShowModal(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    if (editing) {
      await supabase.from('suppliers').update({ ...form }).eq('id', editing.id);
    } else {
      await supabase.from('suppliers').insert({ ...form, user_id: user!.id });
    }
    setSaving(false);
    setShowModal(false);
    onRefresh();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this supplier?')) return;
    await supabase.from('suppliers').delete().eq('id', id);
    onRefresh();
  }

  function f(field: keyof typeof EMPTY) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [field]: e.target.value }));
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600 }}>Suppliers & Vendors</h3>
        <Button variant="primary" icon={<Plus size={14} />} onClick={openNew}>Add Supplier</Button>
      </div>

      {suppliers.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Building2 size={32} color="var(--text-disabled)" style={{ margin: '0 auto 12px' }} />
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No suppliers yet</p>
            <p style={{ color: 'var(--text-disabled)', fontSize: 12, marginTop: 4, marginBottom: 16 }}>Add suppliers to link with inventory items</p>
            <Button variant="primary" icon={<Plus size={14} />} onClick={openNew}>Add Supplier</Button>
          </div>
        </Card>
      ) : (
        <div className="mobile-grid-1 mobile-gap-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {suppliers.map(s => (
            <Card key={s.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</span>
                    <Badge variant={s.is_active ? 'success' : 'warning'}>{s.is_active ? 'Active' : 'Inactive'}</Badge>
                  </div>
                  {s.contact_person && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.contact_person}</div>}
                  {s.email && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{s.email}</div>}
                  {s.phone && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.phone}</div>}
                  <div style={{ marginTop: 8 }}>
                    <Badge variant="default">{s.payment_terms.replace('_', ' ')}</Badge>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginLeft: 8 }}>
                  <button onClick={() => openEdit(s)}
                    style={{ padding: 5, borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', transition: 'all 0.15s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-border)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                  ><Pencil size={12} /></button>
                  <button onClick={() => handleDelete(s.id)}
                    style={{ padding: 5, borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', transition: 'all 0.15s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--error-dim)'; (e.currentTarget as HTMLElement).style.color = 'var(--error)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                  ><Trash2 size={12} /></button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Supplier' : 'Add Supplier'}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input label="Supplier Name" placeholder="ABC Distributors" value={form.name} onChange={f('name')} required />
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
            <Input label="Contact Person" placeholder="John Doe" value={form.contact_person} onChange={f('contact_person')} />
            <Input label="Phone" placeholder="+234..." value={form.phone} onChange={f('phone')} />
          </div>
          <Input label="Email" type="email" placeholder="supplier@example.com" value={form.email} onChange={f('email')} />
          <Input label="Address" placeholder="123 Street, Lagos" value={form.address} onChange={f('address')} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Payment Terms</label>
            <select value={form.payment_terms} onChange={f('payment_terms')}
              style={{ padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none' }}>
              <option value="immediate">Immediate</option>
              <option value="net_7">Net 7</option>
              <option value="net_15">Net 15</option>
              <option value="net_30">Net 30</option>
              <option value="net_60">Net 60</option>
              <option value="net_90">Net 90</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
            <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button variant="primary" loading={saving} type="submit">{editing ? 'Save Changes' : 'Add Supplier'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
