import * as XLSX from 'xlsx';

export function downloadCSV(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const escape = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadExcelWorkbook(
  filename: string,
  sheets: { sheetName: string; rows: (string | number | null | undefined)[][] }[]
) {
  const wb = XLSX.utils.book_new();
  sheets.forEach(s => {
    const ws = XLSX.utils.aoa_to_sheet(s.rows);
    XLSX.utils.book_append_sheet(wb, ws, s.sheetName.slice(0, 31));
  });
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

export function printStatementHTML(title: string, subtitle: string, businessName: string, html: string) {
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a; font-size: 13px; line-height: 1.5; background: white; }
    .page { max-width: 820px; margin: 0 auto; padding: 48px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 2px solid #e5e7eb; }
    .brand-name { font-size: 24px; font-weight: 800; color: #111; letter-spacing: -0.5px; }
    .brand-tag { font-size: 11px; color: #6b7280; letter-spacing: 0.5px; margin-top: 2px; }
    .doc-meta { text-align: right; }
    .doc-title { font-size: 18px; font-weight: 700; color: #111; }
    .doc-sub { font-size: 12px; color: #6b7280; margin-top: 3px; }
    table { width: 100%; border-collapse: collapse; }
    .section-header td { padding: 9px 16px; background: #f9fafb; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #374151; border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; }
    .line-row td { padding: 8px 16px 8px 28px; font-size: 13px; border-bottom: 1px solid #f3f4f6; color: #374151; }
    .subtotal-row td { padding: 9px 16px; font-size: 13px; font-weight: 600; background: #f9fafb; border-top: 1px solid #e5e7eb; }
    .total-row td { padding: 12px 16px; font-size: 14px; font-weight: 800; background: #f3f4f6; border-top: 2px solid #d1d5db; }
    .amount { text-align: right; font-family: monospace; font-size: 13px; }
    .positive { color: #16a34a; }
    .negative { color: #dc2626; }
    .neutral { color: #374151; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div>
        <div class="brand-name">${businessName}</div>
        <div class="brand-tag">ROVA Financial OS</div>
      </div>
      <div class="doc-meta">
        <div class="doc-title">${title}</div>
        <div class="doc-sub">${subtitle}</div>
      </div>
    </div>
    ${html}
  </div>
  <script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`);
  win.document.close();
}

export function formatAmountCell(value: number, forceSign = false): string {
  const formatted = value.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sign = forceSign && value > 0 ? '+' : '';
  return `${sign}₦${Math.abs(value) === value ? '' : '-'}${formatted.replace('-', '')}`;
}
