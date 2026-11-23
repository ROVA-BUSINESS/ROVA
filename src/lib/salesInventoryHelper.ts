import { supabase, type Category, type InventoryItem } from './supabase';
import type { SaleItemSelection } from '../components/SalesItemsPicker';

export function isSalesCategory(categoryId: string, categories: Category[], type: 'income' | 'expense'): boolean {
  if (type !== 'income' || !categoryId) return false;
  const cat = categories.find((c) => c.id === categoryId);
  if (!cat) return false;
  const lower = cat.name.toLowerCase();
  return lower.includes('sales') || lower.includes('sale') || lower.includes('revenue');
}

export function buildSalesDescription(selections: SaleItemSelection[], items: InventoryItem[]): string {
  const parts = selections
    .filter((s) => s.itemId && s.quantity > 0)
    .map((s) => {
      const item = items.find((i) => i.id === s.itemId);
      return item ? `${s.quantity}x ${item.name}` : null;
    })
    .filter(Boolean);
  return parts.length > 0 ? `Sale: ${parts.join(', ')}` : '';
}

export function calcSalesSelectionsTotal(selections: SaleItemSelection[], items: InventoryItem[]): number {
  return selections.reduce((sum, s) => {
    const item = items.find((i) => i.id === s.itemId);
    if (!item) return sum;
    return sum + (Number(item.selling_price) || 0) * (Number(s.quantity) || 0);
  }, 0);
}

/**
 * Records 'sale' entries in inventory_transactions and deducts sold quantities
 * from inventory_items.current_stock.
 */
export async function recordInventorySalesForTransaction(params: {
  userId: string;
  transactionId: string;
  date: string;
  selections: SaleItemSelection[];
  items: InventoryItem[];
}) {
  const { userId, transactionId, date, selections, items } = params;
  const validSelections = selections.filter((s) => s.itemId && s.quantity > 0);
  if (validSelections.length === 0) return;

  // Aggregate quantities in case user picked the same item on two rows
  const qtyByItem: Record<string, number> = {};
  for (const sel of validSelections) {
    qtyByItem[sel.itemId] = (qtyByItem[sel.itemId] || 0) + Number(sel.quantity);
  }

  for (const [itemId, qty] of Object.entries(qtyByItem)) {
    const item = items.find((i) => i.id === itemId);
    if (!item) continue;

    const unitPrice = Number(item.selling_price) || Number(item.cost_price) || 0;
    const totalCost = qty * unitPrice;

    // 1. Log inventory_transactions sale movement
    await supabase.from('inventory_transactions').insert({
      user_id: userId,
      item_id: itemId,
      transaction_id: transactionId,
      type: 'sale',
      quantity: qty,
      unit_cost: unitPrice,
      total_cost: totalCost,
      date: date || new Date().toISOString().split('T')[0],
      notes: `Sold via Sales transaction (${qty} ${item.unit || 'unit'})`,
    });

    // 2. Fetch latest stock & deduct
    const { data: freshItem } = await supabase
      .from('inventory_items')
      .select('current_stock')
      .eq('id', itemId)
      .single();

    const currentStock = Number(freshItem?.current_stock ?? item.current_stock ?? 0);
    const nextStock = Math.max(0, currentStock - qty);

    await supabase
      .from('inventory_items')
      .update({ current_stock: nextStock, updated_at: new Date().toISOString() })
      .eq('id', itemId)
      .eq('user_id', userId);
  }
}
