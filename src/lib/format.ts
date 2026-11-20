export function formatCurrency(amount: number | string | null | undefined, currency = 'NGN'): string {
  if (amount === null || amount === undefined || amount === '') {
    return currency === 'NGN' ? '₦0.00' : '0.00';
  }
  const numeric = typeof amount === 'number' ? amount : parseFloat(String(amount));
  const safeAmount = isNaN(numeric) ? 0 : numeric;
  const safeCurrency = currency || 'NGN';

  if (safeCurrency === 'NGN') {
    return `₦${safeAmount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: safeCurrency }).format(safeAmount);
  } catch {
    return `₦${safeAmount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return String(dateStr);
  return date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function formatShortDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function cleanDescription(desc: string | null | undefined): string {
  if (!desc) return '';
  // Match patterns like "TRANSFER (SMS ALERT CHARGE OUTSTANDING)" or "NIP TRANSFER (SOME TEXT)"
  const match = desc.match(/^\s*[A-Za-z0-9\s\-_\/]+\s*\((.+)\)\s*$/);
  if (match) return match[1].trim();
  return desc;
}

export function extractAmountFromText(text: string | null | undefined): number | null {
  if (!text) return null;
  const kMatch = text.match(/\b(\d+(?:\.\d+)?)\s*k\b/i);
  if (kMatch) {
    const val = parseFloat(kMatch[1]) * 1000;
    if (!isNaN(val) && val > 0) return val;
  }
  const nairaMatch = text.match(/(?:(?:₦|ngn|naira)\s*([0-9,]+(?:\.[0-9]{1,2})?))|([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:ngn|naira)/i);
  if (nairaMatch) {
    const raw = (nairaMatch[1] || nairaMatch[2] || '').replace(/,/g, '');
    const val = parseFloat(raw);
    if (!isNaN(val) && val > 0) return val;
  }
  const actionMatch = text.match(/\b(?:for|worth|cost|paid|spent|sold|amount|price)\s+(?:of\s+)?(?:₦|ngn|naira)?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i);
  if (actionMatch) {
    const raw = actionMatch[1].replace(/,/g, '');
    const val = parseFloat(raw);
    if (!isNaN(val) && val > 0) return val;
  }
  const numMatch = text.match(/(?:^|\s)(?:₦)?([1-9][0-9]{2,}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)(?:\s|$)/);
  if (numMatch) {
    const raw = numMatch[1].replace(/,/g, '');
    const val = parseFloat(raw);
    if (!isNaN(val) && val > 0) return val;
  }
  return null;
}

