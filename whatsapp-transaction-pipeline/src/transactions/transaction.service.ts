import { DatabaseService } from '../database/database.service';
import { InventoryService } from '../inventory/inventory.service';
import { ExtractedTransaction } from '../types';
import { Logger } from '../utils/logger';

export class TransactionService {
  private databaseService = new DatabaseService();
  private inventoryService = new InventoryService();

  /**
   * Orchestrates transaction persistence and inventory updates.
   */
  async processAndSaveTransaction(
    userId: string,
    extracted: ExtractedTransaction,
    rawSource: string,
    mediaType: 'text' | 'voice' | 'image' | 'document',
    processingTimeMs: number
  ): Promise<string> {
    // 1. Save core transaction record
    const transactionId = await this.databaseService.saveTransaction(
      userId,
      extracted,
      rawSource,
      mediaType,
      processingTimeMs
    );

    // 2. Execute inventory & supplier logic if applicable
    const isInventory =
      extracted.transaction_type.toLowerCase().includes('inventory') ||
      (extracted.inventory_items && extracted.inventory_items.length > 0);

    if (isInventory) {
      Logger.info(`📦 Triggering inventory updates for transaction ${transactionId}`);
      await this.inventoryService.processInventoryPurchase(userId, transactionId, extracted);
    }

    return transactionId;
  }
}
