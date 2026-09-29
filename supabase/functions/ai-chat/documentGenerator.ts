// documentGenerator.ts
// Pure Deno PDF generation -- NO external imports required.
// Generates A4 PDF documents for Receipts and Invoices using raw PDF 1.4 syntax.

function fmt(amount: number): string {
  const val = Number(amount || 0);
  return `NGN ${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(dateStr?: string): string {
  if (!dateStr) return new Date().toISOString().split("T")[0];
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? dateStr : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch { return dateStr; }
}

function safe(str: string, limit = 60): string {
  return (str || "").replace(/[^\x20-\x7E]/g, "").replace(/[()\\]/g, "\\$&").slice(0, limit);
}

interface TextCmd { x: number; y: number; size: number; text: string; bold?: boolean; }
interface RectCmd { x: number; y: number; w: number; h: number; fill?: string; stroke?: string; lw?: number; }
interface LineCmd { x1: number; y1: number; x2: number; y2: number; rgb?: string; lw?: number; }

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255) as [number, number, number];
}

function buildPDF(texts: TextCmd[], rects: RectCmd[], lines: LineCmd[]): Uint8Array {
  const PAGE_W = 595, PAGE_H = 842;
  const cmds: string[] = [];

  for (const r of rects) {
    if (r.fill) {
      const [fr, fg, fb] = hexToRgb(r.fill);
      cmds.push(`${fr.toFixed(3)} ${fg.toFixed(3)} ${fb.toFixed(3)} rg`);
      cmds.push(`${r.x.toFixed(2)} ${r.y.toFixed(2)} ${r.w.toFixed(2)} ${r.h.toFixed(2)} re f`);
    }
    if (r.stroke) {
      const [sr, sg, sb] = hexToRgb(r.stroke);
      cmds.push(`${sr.toFixed(3)} ${sg.toFixed(3)} ${sb.toFixed(3)} RG`);
      cmds.push(`${(r.lw ?? 1).toFixed(2)} w`);
      cmds.push(`${r.x.toFixed(2)} ${r.y.toFixed(2)} ${r.w.toFixed(2)} ${r.h.toFixed(2)} re S`);
    }
  }

  for (const l of lines) {
    const [lr, lg, lb] = hexToRgb(l.rgb ?? "#d1d5db");
    cmds.push(`${lr.toFixed(3)} ${lg.toFixed(3)} ${lb.toFixed(3)} RG`);
    cmds.push(`${(l.lw ?? 0.5).toFixed(2)} w`);
    cmds.push(`${l.x1.toFixed(2)} ${l.y1.toFixed(2)} m ${l.x2.toFixed(2)} ${l.y2.toFixed(2)} l S`);
  }

  for (const t of texts) {
    const fontName = t.bold ? "F2" : "F1";
    cmds.push("BT");
    cmds.push(`/${fontName} ${t.size} Tf`);
    cmds.push(`${t.x.toFixed(2)} ${t.y.toFixed(2)} Td`);
    cmds.push(`(${t.text}) Tj`);
    cmds.push("ET");
  }

  const contentStr = cmds.join("\n");
  const contentBytes = new TextEncoder().encode(contentStr);

  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let offset = 0;

  const push = (s: string) => {
    const b = new TextEncoder().encode(s + "\n");
    parts.push(b);
    offset += b.length;
  };
  const pushRaw = (b: Uint8Array) => {
    parts.push(b);
    offset += b.length;
    const nl = new TextEncoder().encode("\n");
    parts.push(nl);
    offset += nl.length;
  };

  push("%PDF-1.4");
  push("%âµâ¶");

  offsets[1] = offset;
  push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj");

  offsets[2] = offset;
  push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj");

  offsets[3] = offset;
  push(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}]\n   /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj`);

  offsets[4] = offset;
  push(`4 0 obj\n<< /Length ${contentBytes.length} >>`);
  push("stream");
  pushRaw(contentBytes);
  push("endstream\nendobj");

  offsets[5] = offset;
  push("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj");

  offsets[6] = offset;
  push("6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj");

  const xrefOffset = offset;
  const objCount = 7;
  let xref = `xref\n0 ${objCount}\n`;
  xref += "0000000000 65535 f \n";
  for (let i = 1; i < objCount; i++) {
    xref += `${String(offsets[i] || 0).padStart(10, "0")} 00000 n \n`;
  }
  push(xref);
  push(`trailer\n<< /Size ${objCount} /Root 1 0 R >>`);
  push(`startxref\n${xrefOffset}\n%%EOF`);

  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) { out.set(p, pos); pos += p.length; }
  return out;
}

export async function generateReceiptPDF(
  supabaseClient: any, userId: string, receipt: any, profile?: any
): Promise<{ pdfUrl: string; fileName: string; filePath: string }> {
  const businessName = safe(profile?.business_name || profile?.full_name || "ROVA Business", 50);
  const customerName = safe(receipt.customer_name || "Customer", 45);
  const customerPhone = safe(receipt.customer_phone || "", 40);
  const receiptNumber = safe(receipt.receipt_number || "RCPT-001", 20);
  const paymentMethod = safe(receipt.payment_method || "Bank Transfer", 30);
  const paymentRef = safe(receipt.payment_reference || "", 30);
  const receiptDate = fmtDate(receipt.receipt_date);
  const subtotal = Number(receipt.subtotal || receipt.amount || receipt.total || 0);
  const discount = Number(receipt.discount || 0);
  const total = Number(receipt.total || receipt.amount || subtotal);
  const items = receipt.items && receipt.items.length > 0
    ? receipt.items
    : [{ description: receipt.description || "Payment received", quantity: 1, unit_price: total, total }];

  const PW = 595, PH = 842, MARGIN = 45;
  const rects: RectCmd[] = [], lines: LineCmd[] = [], texts: TextCmd[] = [];

  rects.push({ x: 0, y: PH - 8, w: PW, h: 8, fill: "#7c3aed" });
  texts.push({ x: MARGIN, y: PH - 48, size: 18, text: businessName, bold: true });
  texts.push({ x: MARGIN, y: PH - 63, size: 9, text: "ROVA Financial Operating System" });
  texts.push({ x: PW - MARGIN - 160, y: PH - 50, size: 11, text: `Receipt No: ${receiptNumber}`, bold: true });
  texts.push({ x: PW - MARGIN - 160, y: PH - 64, size: 9, text: `Date: ${receiptDate}` });
  texts.push({ x: PW - MARGIN - 160, y: PH - 78, size: 9, text: "PAYMENT RECEIVED", bold: true });

  const titleY = PH - 120;
  rects.push({ x: MARGIN, y: titleY - 22, w: PW - 90, h: 28, fill: "#f9fafb", stroke: "#e5e7eb", lw: 1 });
  texts.push({ x: MARGIN + 140, y: titleY - 12, size: 11, text: "OFFICIAL PAYMENT RECEIPT", bold: true });

  const cardY = PH - 175;
  const colW = Math.floor((PW - 105) / 2);
  rects.push({ x: MARGIN, y: cardY - 65, w: colW, h: 70, fill: "#f9fafb", stroke: "#e5e7eb", lw: 1 });
  texts.push({ x: MARGIN + 8, y: cardY - 16, size: 7, text: "RECEIVED FROM (CUSTOMER)", bold: true });
  texts.push({ x: MARGIN + 8, y: cardY - 30, size: 11, text: customerName, bold: true });
  if (customerPhone) texts.push({ x: MARGIN + 8, y: cardY - 44, size: 9, text: customerPhone });

  const col2X = MARGIN + colW + 15;
  rects.push({ x: col2X, y: cardY - 65, w: colW, h: 70, fill: "#f9fafb", stroke: "#e5e7eb", lw: 1 });
  texts.push({ x: col2X + 8, y: cardY - 16, size: 7, text: "PAYMENT DETAILS", bold: true });
  texts.push({ x: col2X + 8, y: cardY - 30, size: 9, text: `Method: ${paymentMethod}` });
  texts.push({ x: col2X + 8, y: cardY - 44, size: 9, text: `Date: ${receiptDate}` });
  if (paymentRef) texts.push({ x: col2X + 8, y: cardY - 58, size: 8, text: `Ref: ${paymentRef}` });

  let rowY = cardY - 90;
  rects.push({ x: MARGIN, y: rowY - 16, w: PW - 90, h: 22, fill: "#efefef", stroke: "#e5e7eb", lw: 1 });
  texts.push({ x: MARGIN + 8, y: rowY - 10, size: 7, text: "ITEM / DESCRIPTION", bold: true });
  texts.push({ x: 325, y: rowY - 10, size: 7, text: "QTY", bold: true });
  texts.push({ x: 385, y: rowY - 10, size: 7, text: "UNIT PRICE", bold: true });
  texts.push({ x: 478, y: rowY - 10, size: 7, text: "TOTAL", bold: true });

  for (const item of items) {
    rowY -= 20;
    lines.push({ x1: MARGIN, y1: rowY + 14, x2: PW - MARGIN, y2: rowY + 14, rgb: "#e5e7eb", lw: 0.5 });
    texts.push({ x: MARGIN + 8, y: rowY + 3, size: 8, text: safe(item.description || "Item", 42) });
    texts.push({ x: 330, y: rowY + 3, size: 8, text: String(item.quantity || 1) });
    texts.push({ x: 385, y: rowY + 3, size: 8, text: fmt(item.unit_price || 0) });
    texts.push({ x: 468, y: rowY + 3, size: 8, text: fmt(item.total || (item.quantity * item.unit_price) || 0), bold: true });
  }

  rowY -= 12;
  lines.push({ x1: MARGIN, y1: rowY + 8, x2: PW - MARGIN, y2: rowY + 8, rgb: "#d1d5db", lw: 1 });
  const totX = PW - MARGIN - 220;
  rowY -= 14;
  texts.push({ x: totX, y: rowY, size: 8, text: "Subtotal:" });
  texts.push({ x: totX + 100, y: rowY, size: 8, text: fmt(subtotal) });
  if (discount > 0) {
    rowY -= 13;
    texts.push({ x: totX, y: rowY, size: 8, text: "Discount:" });
    texts.push({ x: totX + 100, y: rowY, size: 8, text: `-${fmt(discount)}` });
  }
  rowY -= 16;
  lines.push({ x1: totX, y1: rowY + 12, x2: PW - MARGIN, y2: rowY + 12, rgb: "#7c3aed", lw: 1.5 });
  texts.push({ x: totX, y: rowY, size: 11, text: "TOTAL PAID:", bold: true });
  texts.push({ x: totX + 90, y: rowY, size: 11, text: fmt(total), bold: true });

  lines.push({ x1: MARGIN, y1: 58, x2: PW - MARGIN, y2: 58, rgb: "#e5e7eb", lw: 0.5 });
  texts.push({ x: 175, y: 43, size: 8, text: "Thank you for your business!", bold: true });
  texts.push({ x: 80, y: 29, size: 7, text: "Official Payment Record - Generated via ROVA Financial Operating System" });

  const pdfBytes = buildPDF(texts, rects, lines);
  const safeNum = receiptNumber.replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `Receipt_${safeNum}.pdf`;
  const filePath = `${userId}/${fileName}`;

  await supabaseClient.storage.from("receipts").upload(filePath, pdfBytes, { contentType: "application/pdf", upsert: true });
  const { data: signedData } = await supabaseClient.storage.from("receipts").createSignedUrl(filePath, 315360000);
  const pdfUrl = signedData?.signedUrl || "";
  if (receipt.id && pdfUrl) {
    await supabaseClient.from("receipts").update({ pdf_url: pdfUrl }).eq("id", receipt.id);
  }
  return { pdfUrl, fileName, filePath };
}

export async function generateInvoicePDF(
  supabaseClient: any, userId: string, invoice: any, profile?: any
): Promise<{ pdfUrl: string; fileName: string; filePath: string }> {
  const businessName = safe(profile?.business_name || profile?.full_name || "ROVA Business", 50);
  const businessPhone = safe(profile?.phone || "", 30);
  const clientName = safe(invoice.client_name || "Client", 45);
  const clientEmail = safe(invoice.client_email || "", 40);
  const clientAddress = safe(invoice.client_address || "", 40);
  const invoiceNumber = safe(invoice.invoice_number || "INV-001", 20);
  const status = (invoice.status || "sent").toUpperCase();
  const issueDate = fmtDate(invoice.issue_date);
  const dueDate = fmtDate(invoice.due_date);
  const subtotal = Number(invoice.subtotal || invoice.total || 0);
  const taxAmount = Number(invoice.tax_amount || 0);
  const discountAmount = Number(invoice.discount_amount || 0);
  const total = Number(invoice.total || subtotal);
  const amountPaid = Number(invoice.amount_paid || 0);
  const balanceDue = Math.max(0, total - amountPaid);
  const items = invoice.items && invoice.items.length > 0
    ? invoice.items
    : [{ description: invoice.description || "Services rendered", quantity: 1, unit_price: subtotal, amount: total }];

  const PW = 595, PH = 842, MARGIN = 45;
  const rects: RectCmd[] = [], lines: LineCmd[] = [], texts: TextCmd[] = [];

  rects.push({ x: 0, y: PH - 8, w: PW, h: 8, fill: "#7c3aed" });
  texts.push({ x: MARGIN, y: PH - 48, size: 18, text: businessName, bold: true });
  texts.push({ x: MARGIN, y: PH - 63, size: 9, text: "ROVA Financial Operating System" });
  if (businessPhone) texts.push({ x: MARGIN, y: PH - 76, size: 8, text: `Tel: ${businessPhone}` });
  texts.push({ x: PW - MARGIN - 130, y: PH - 48, size: 18, text: "INVOICE", bold: true });
  texts.push({ x: PW - MARGIN - 130, y: PH - 66, size: 10, text: `No: ${invoiceNumber}`, bold: true });
  texts.push({ x: PW - MARGIN - 130, y: PH - 80, size: 9, text: `Status: ${status}`, bold: true });

  const colW = Math.floor((PW - 105) / 2);
  const cardY = PH - 170;
  rects.push({ x: MARGIN, y: cardY - 70, w: colW, h: 75, fill: "#f9fafb", stroke: "#e5e7eb", lw: 1 });
  texts.push({ x: MARGIN + 8, y: cardY - 16, size: 7, text: "BILLED TO (CUSTOMER)", bold: true });
  texts.push({ x: MARGIN + 8, y: cardY - 30, size: 11, text: clientName, bold: true });
  if (clientEmail) texts.push({ x: MARGIN + 8, y: cardY - 44, size: 9, text: clientEmail });
  if (clientAddress) texts.push({ x: MARGIN + 8, y: cardY - 58, size: 9, text: clientAddress });

  const col2X = MARGIN + colW + 15;
  rects.push({ x: col2X, y: cardY - 70, w: colW, h: 75, fill: "#f9fafb", stroke: "#e5e7eb", lw: 1 });
  texts.push({ x: col2X + 8, y: cardY - 16, size: 7, text: "INVOICE SCHEDULE", bold: true });
  texts.push({ x: col2X + 8, y: cardY - 32, size: 9, text: `Issue Date: ${issueDate}` });
  texts.push({ x: col2X + 8, y: cardY - 48, size: 9, text: `Due Date: ${dueDate}`, bold: true });

  let rowY = cardY - 95;
  rects.push({ x: MARGIN, y: rowY - 16, w: PW - 90, h: 22, fill: "#efefef", stroke: "#e5e7eb", lw: 1 });
  texts.push({ x: MARGIN + 8, y: rowY - 10, size: 7, text: "ITEM / DESCRIPTION", bold: true });
  texts.push({ x: 325, y: rowY - 10, size: 7, text: "QTY", bold: true });
  texts.push({ x: 385, y: rowY - 10, size: 7, text: "UNIT PRICE", bold: true });
  texts.push({ x: 472, y: rowY - 10, size: 7, text: "AMOUNT", bold: true });

  for (const item of items) {
    rowY -= 20;
    lines.push({ x1: MARGIN, y1: rowY + 14, x2: PW - MARGIN, y2: rowY + 14, rgb: "#e5e7eb", lw: 0.5 });
    texts.push({ x: MARGIN + 8, y: rowY + 3, size: 8, text: safe(item.description || "Item", 42) });
    texts.push({ x: 330, y: rowY + 3, size: 8, text: String(item.quantity || 1) });
    texts.push({ x: 385, y: rowY + 3, size: 8, text: fmt(item.unit_price || 0) });
    texts.push({ x: 468, y: rowY + 3, size: 8, text: fmt(item.amount || (item.quantity * item.unit_price) || 0), bold: true });
  }

  rowY -= 12;
  lines.push({ x1: MARGIN, y1: rowY + 8, x2: PW - MARGIN, y2: rowY + 8, rgb: "#d1d5db", lw: 1 });
  const totX = PW - MARGIN - 230;
  rowY -= 14;
  texts.push({ x: totX, y: rowY, size: 8, text: "Subtotal:" });
  texts.push({ x: totX + 110, y: rowY, size: 8, text: fmt(subtotal) });
  if (discountAmount > 0) {
    rowY -= 13;
    texts.push({ x: totX, y: rowY, size: 8, text: `Discount (${invoice.discount_rate || 0}%):` });
    texts.push({ x: totX + 110, y: rowY, size: 8, text: `-${fmt(discountAmount)}` });
  }
  if (taxAmount > 0) {
    rowY -= 13;
    texts.push({ x: totX, y: rowY, size: 8, text: `VAT / Tax (${invoice.tax_rate || 0}%):` });
    texts.push({ x: totX + 110, y: rowY, size: 8, text: fmt(taxAmount) });
  }
  rowY -= 16;
  lines.push({ x1: totX, y1: rowY + 12, x2: PW - MARGIN, y2: rowY + 12, rgb: "#7c3aed", lw: 1.5 });
  texts.push({ x: totX, y: rowY, size: 11, text: "TOTAL:", bold: true });
  texts.push({ x: totX + 90, y: rowY, size: 11, text: fmt(total), bold: true });
  if (amountPaid > 0) {
    rowY -= 14;
    texts.push({ x: totX, y: rowY, size: 9, text: "Amount Paid:", bold: true });
    texts.push({ x: totX + 110, y: rowY, size: 9, text: fmt(amountPaid) });
    rowY -= 14;
    texts.push({ x: totX, y: rowY, size: 10, text: "Balance Due:", bold: true });
    texts.push({ x: totX + 110, y: rowY, size: 10, text: fmt(balanceDue), bold: true });
  }
  if (invoice.notes) {
    texts.push({ x: MARGIN, y: rowY - 14, size: 8, text: `Notes: ${safe(invoice.notes, 80)}` });
  }

  lines.push({ x1: MARGIN, y1: 58, x2: PW - MARGIN, y2: 58, rgb: "#e5e7eb", lw: 0.5 });
  texts.push({ x: 180, y: 43, size: 8, text: "Thank you for your business!", bold: true });
  texts.push({ x: 65, y: 29, size: 7, text: "Official Commercial Invoice - Generated via ROVA Financial Operating System" });

  const pdfBytes = buildPDF(texts, rects, lines);
  const safeNum = invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `Invoice_${safeNum}.pdf`;
  const filePath = `${userId}/${fileName}`;

  await supabaseClient.storage.from("receipts").upload(filePath, pdfBytes, { contentType: "application/pdf", upsert: true });
  const { data: signedData } = await supabaseClient.storage.from("receipts").createSignedUrl(filePath, 315360000);
  const pdfUrl = signedData?.signedUrl || "";
  if (invoice.id && pdfUrl) {
    await supabaseClient.from("invoices").update({ pdf_url: pdfUrl }).eq("id", invoice.id);
  }
  return { pdfUrl, fileName, filePath };
}
