/**
 * Currency and string formatting utilities for ROVA Nigerian SME platform.
 */
export function formatCurrency(amount: number, currency: string = 'NGN'): string {
  if (currency === 'NGN' || !currency) {
    return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }
  return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
