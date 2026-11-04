import { supabase } from './supabase';

/**
 * Generate the next chronological SKU for an inventory item (e.g. SKU-001, SKU-002, SKU-003...)
 */
export async function getNextSku(
  userId?: string | null,
  currentItems?: Array<{ sku?: string | null }>,
  customClient?: any
): Promise<string> {
  const client = customClient || supabase;
  let items = currentItems;

  if ((!items || items.length === 0) && userId) {
    try {
      const { data } = await client
        .from('inventory_items')
        .select('sku')
        .eq('user_id', userId);
      items = data || [];
    } catch {
      items = [];
    }
  }

  let maxNum = 0;
  if (items && items.length > 0) {
    for (const item of items) {
      if (!item.sku) continue;
      const match = item.sku.match(/SKU-(\d+)/i);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > maxNum) maxNum = n;
      }
    }
    if (maxNum === 0) maxNum = items.length;
  }

  const nextNum = maxNum + 1;
  return `SKU-${String(nextNum).padStart(3, '0')}`;
}
