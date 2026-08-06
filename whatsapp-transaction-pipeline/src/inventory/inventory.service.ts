import { supabase } from '../config/supabase';
import { ExtractedTransaction } from '../types';
import { Logger } from '../utils/logger';

export class InventoryService {
  /**
   * Processes inventory purchases by:
   * 1. Creating or updating supplier records in `suppliers`
   * 2. Updating stock quantity-on-hand in `inventory_items`
   * 3. Logging inventory audit events in `inventory_transactions`
   */
  async processInventoryPurchase(
    userId: string,
    transactionId: string,
    extracted: ExtractedTransaction
  ): Promise<void> {
    try {
      let supplierId: string | null = null;

      // ── Step 1: Supplier Management ──────────────────────────────────
      if (extracted.supplier) {
        supplierId = await this.ensureSupplier(userId, extracted.supplier);
      }

      // ── Step 2: Update Inventory Stock & Movement Log ────────────────
      if (extracted.inventory_items && extracted.inventory_items.length > 0) {
        for (const item of extracted.inventory_items) {
          await this.updateStockItem(userId, supplierId, transactionId, item);
        }
      } else if (extracted.description || extracted.category) {
        // Fallback: If no explicit item list was parsed, record generic stock item
        const fallbackItem = {
          name: extracted.description || extracted.category || 'General Stock',
          quantity: 1,
          unit_price: extracted.amount,
        };
        await this.updateStockItem(userId, supplierId, transactionId, fallbackItem);
      }

      Logger.info(`📦 Inventory & Supplier processing complete for user ${userId}`);
    } catch (err: any) {
      Logger.error(`Failed to process inventory purchase: ${err.message}`);
      // Non-blocking: inventory failure shouldn't fail the primary ledger transaction recording
    }
  }

  /**
   * Creates or fetches supplier by name.
   */
  private async ensureSupplier(userId: string, supplierName: string): Promise<string | null> {
    // Check if supplier exists
    const { data: existing } = await supabase
      .from('suppliers')
      .select('id')
      .eq('user_id', userId)
      .ilike('name', supplierName.trim())
      .limit(1)
      .maybeSingle();

    if (existing) {
      return existing.id;
    }

    // Insert new supplier
    const { data: created, error } = await supabase
      .from('suppliers')
      .insert({
        user_id: userId,
        name: supplierName.trim(),
        status: 'active',
      })
      .select('id')
      .single();

    if (error) {
      Logger.warn(`Could not create supplier "${supplierName}": ${error.message}`);
      return null;
    }

    return created.id;
  }

  /**
   * Upserts inventory item quantity and logs the movement transaction.
   */
  private async updateStockItem(
    userId: string,
    supplierId: string | null,
    transactionId: string,
    item: { name: string; quantity: number; unit_price: number }
  ): Promise<void> {
    // Check for existing inventory item
    const { data: existing } = await supabase
      .from('inventory_items')
      .select('id, quantity_on_hand')
      .eq('user_id', userId)
      .ilike('name', item.name.trim())
      .limit(1)
      .maybeSingle();

    let itemId: string;

    if (existing) {
      itemId = existing.id;
      const newQty = (existing.quantity_on_hand || 0) + item.quantity;
      await supabase
        .from('inventory_items')
        .update({
          quantity_on_hand: newQty,
          unit_cost: item.unit_price,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId);
    } else {
      const { data: created, error } = await supabase
        .from('inventory_items')
        .insert({
          user_id: userId,
          supplier_id: supplierId,
          name: item.name.trim(),
          quantity_on_hand: item.quantity,
          unit_cost: item.unit_price,
          reorder_level: 5,
        })
        .select('id')
        .single();

      if (error) {
        Logger.warn(`Could not create inventory item "${item.name}": ${error.message}`);
        return;
      }
      itemId = created.id;
    }

    // Log movement in inventory_transactions
    await supabase.from('inventory_transactions').insert({
      user_id: userId,
      item_id: itemId,
      transaction_id: transactionId,
      type: 'purchase',
      quantity: item.quantity,
      unit_cost: item.unit_price,
      total_cost: item.quantity * item.unit_price,
      notes: 'Purchased via WhatsApp transaction pipeline',
    });
  }
}
