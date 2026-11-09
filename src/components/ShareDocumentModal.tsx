import { useState } from 'react';
import { 
  Mail, MessageSquare, Copy, Check, Download, Share2, 
  Send as TelegramIcon, Globe 
} from 'lucide-react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { formatCurrency, formatDate } from '../lib/format';

export interface ShareDocumentData {
  type: 'invoice' | 'receipt';
  documentNumber: string;
  recipientName: string;
  recipientPhone?: string;
  recipientEmail?: string;
  amount: number;
  amountPaid?: number;
  balanceDue?: number;
  issueDate?: string;
  dueDate?: string;
  paymentMethod?: string;
  status?: string;
  businessName: string;
  notes?: string;
  onDownloadPDF?: () => void;
  onDownloadImage?: () => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
  data: ShareDocumentData | null;
}

export default function ShareDocumentModal({ open, onClose, data }: Props) {
  if (!data) return null;

  const [phone, setPhone] = useState(data.recipientPhone || '');
  const [email, setEmail] = useState(data.recipientEmail || '');
  const [copied, setCopied] = useState(false);

  const cleanPhone = phone.replace(/\D/g, '');
  const internationalPhone = cleanPhone
    ? (cleanPhone.startsWith('0') ? `234${cleanPhone.slice(1)}` : cleanPhone)
    : '';

  // Generate formatted message text
  const isInvoice = data.type === 'invoice';
  const docTitle = isInvoice ? 'Invoice' : 'Payment Receipt';
  
  const shareText = isInvoice
    ? `Hello ${data.recipientName || 'Customer'},\n\nHere is your official invoice from ${data.businessName || 'ROVA Business'}:\n\n` +
      `📄 Invoice No: ${data.documentNumber}\n` +
      `📅 Issue Date: ${data.issueDate ? formatDate(data.issueDate) : 'N/A'}\n` +
      (data.dueDate ? `⏰ Due Date: ${formatDate(data.dueDate)}\n` : '') +
      `💰 Total Amount: ${formatCurrency(data.amount)}\n` +
      (data.amountPaid !== undefined ? `✅ Amount Paid: ${formatCurrency(data.amountPaid)}\n` : '') +
      (data.balanceDue !== undefined && data.balanceDue > 0 ? `⚠️ Balance Due: ${formatCurrency(data.balanceDue)}\n` : '') +
      (data.status ? `📌 Status: ${data.status.toUpperCase()}\n` : '') +
      (data.notes ? `\nNote: ${data.notes}\n` : '') +
      `\nThank you for your business! Please let us know once payment has been processed.`
    : `Hello ${data.recipientName || 'Customer'},\n\nHere is your official payment receipt from ${data.businessName || 'ROVA Business'}:\n\n` +
      `🧾 Receipt No: ${data.documentNumber}\n` +
      `📅 Payment Date: ${data.issueDate ? formatDate(data.issueDate) : 'N/A'}\n` +
      (data.paymentMethod ? `💳 Payment Method: ${data.paymentMethod}\n` : '') +
      `💰 Amount Paid: ${formatCurrency(data.amount)}\n` +
      `✅ Status: PAYMENT RECEIVED & CONFIRMED\n` +
      (data.notes ? `\nNote: ${data.notes}\n` : '') +
      `\nThank you for choosing ${data.businessName || 'us'}!`;

  const emailSubject = `${docTitle} ${data.documentNumber} from ${data.businessName || 'ROVA Business'}`;

  // Medium handlers
  const handleWhatsApp = () => {
    const encoded = encodeURIComponent(shareText);
    const url = internationalPhone
      ? `https://wa.me/${internationalPhone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank');
  };

  const handleTelegram = () => {
    const encodedText = encodeURIComponent(shareText);
    const url = `https://t.me/share/url?url=${encodeURIComponent(window.location.origin)}&text=${encodedText}`;
    window.open(url, '_blank');
  };

  const handleGmailWeb = () => {
    const encodedSubject = encodeURIComponent(emailSubject);
    const encodedBody = encodeURIComponent(shareText);
    const toParam = email ? encodeURIComponent(email) : '';
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${toParam}&su=${encodedSubject}&body=${encodedBody}`;
    window.open(url, '_blank');
  };

  const handleDefaultEmail = () => {
    const encodedSubject = encodeURIComponent(emailSubject);
    const encodedBody = encodeURIComponent(shareText);
    const url = `mailto:${email || ''}?subject=${encodedSubject}&body=${encodedBody}`;
    window.location.href = url;
  };

  const handleSMS = () => {
    const encodedBody = encodeURIComponent(shareText);
    const url = internationalPhone ? `sms:${internationalPhone}?body=${encodedBody}` : `sms:?body=${encodedBody}`;
    window.location.href = url;
  };

  const handleTwitter = () => {
    const shortText = `${docTitle} ${data.documentNumber} for ${data.recipientName} - ${formatCurrency(data.amount)} via ${data.businessName}`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shortText)}`;
    window.open(url, '_blank');
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = shareText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDeviceShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: emailSubject,
          text: shareText,
        });
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          handleCopy();
        }
      }
    } else {
      handleCopy();
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Share ${docTitle}`} size="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        
        {/* Document Mini-Card */}
        <div
          style={{
            padding: '14px 16px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--bg-border)',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-light)', letterSpacing: '0.5px' }}>
              {docTitle} · {data.documentNumber}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
              {data.recipientName || 'Valued Customer'}
            </div>
            {data.issueDate && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                Date: {formatDate(data.issueDate)}
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total</div>
            <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--success)' }}>
              {formatCurrency(data.amount)}
            </div>
            {data.balanceDue !== undefined && data.balanceDue > 0 && (
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--warning)', marginTop: 2 }}>
                Due: {formatCurrency(data.balanceDue)}
              </div>
            )}
          </div>
        </div>

        {/* Contact fields for recipient */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>WhatsApp / Phone</label>
            <input
              type="tel"
              placeholder="e.g. 08012345678"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              style={{
                padding: '8px 12px',
                background: 'var(--bg-base)',
                border: '1px solid var(--bg-border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Recipient Email</label>
            <input
              type="email"
              placeholder="customer@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{
                padding: '8px 12px',
                background: 'var(--bg-base)',
                border: '1px solid var(--bg-border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Sharing Channels Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
            Choose Medium
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
            {/* WhatsApp */}
            <button
              type="button"
              onClick={handleWhatsApp}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '11px 12px',
                background: 'linear-gradient(135deg, rgba(37, 211, 102, 0.15), rgba(18, 140, 62, 0.15))',
                border: '1px solid rgba(37, 211, 102, 0.4)',
                borderRadius: 'var(--radius-md)',
                color: '#25D366',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 12.5,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(37, 211, 102, 0.25)';
                (e.currentTarget as HTMLElement).style.borderColor = '#25D366';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'linear-gradient(135deg, rgba(37, 211, 102, 0.15), rgba(18, 140, 62, 0.15))';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(37, 211, 102, 0.4)';
              }}
            >
              <img src="/whatsapp-logo.png" alt="WhatsApp" style={{ width: 18, height: 18, objectFit: 'contain' }} />
              <span>WhatsApp</span>
            </button>

            {/* Telegram */}
            <button
              type="button"
              onClick={handleTelegram}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '11px 12px',
                background: 'rgba(34, 158, 217, 0.12)',
                border: '1px solid rgba(34, 158, 217, 0.4)',
                borderRadius: 'var(--radius-md)',
                color: '#229ED9',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 12.5,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(34, 158, 217, 0.22)';
                (e.currentTarget as HTMLElement).style.borderColor = '#229ED9';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(34, 158, 217, 0.12)';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(34, 158, 217, 0.4)';
              }}
            >
              <TelegramIcon size={17} color="#229ED9" />
              <span>Telegram</span>
            </button>

            {/* Gmail Web */}
            <button
              type="button"
              onClick={handleGmailWeb}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '11px 12px',
                background: 'rgba(234, 67, 53, 0.12)',
                border: '1px solid rgba(234, 67, 53, 0.35)',
                borderRadius: 'var(--radius-md)',
                color: '#EA4335',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 12.5,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(234, 67, 53, 0.22)';
                (e.currentTarget as HTMLElement).style.borderColor = '#EA4335';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(234, 67, 53, 0.12)';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(234, 67, 53, 0.35)';
              }}
            >
              <Mail size={17} color="#EA4335" />
              <span>Gmail Web</span>
            </button>

            {/* Email App */}
            <button
              type="button"
              onClick={handleDefaultEmail}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '11px 12px',
                background: 'rgba(59, 130, 246, 0.12)',
                border: '1px solid rgba(59, 130, 246, 0.35)',
                borderRadius: 'var(--radius-md)',
                color: '#60a5fa',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 12.5,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(59, 130, 246, 0.22)';
                (e.currentTarget as HTMLElement).style.borderColor = '#3b82f6';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(59, 130, 246, 0.12)';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(59, 130, 246, 0.35)';
              }}
            >
              <Mail size={17} color="#3b82f6" />
              <span>Email App</span>
            </button>

            {/* SMS */}
            <button
              type="button"
              onClick={handleSMS}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '11px 12px',
                background: 'rgba(234, 179, 8, 0.12)',
                border: '1px solid rgba(234, 179, 8, 0.35)',
                borderRadius: 'var(--radius-md)',
                color: '#facc15',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 12.5,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(234, 179, 8, 0.22)';
                (e.currentTarget as HTMLElement).style.borderColor = '#eab308';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(234, 179, 8, 0.12)';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(234, 179, 8, 0.35)';
              }}
            >
              <MessageSquare size={17} color="#facc15" />
              <span>SMS / Text</span>
            </button>

            {/* X / Twitter */}
            <button
              type="button"
              onClick={handleTwitter}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '11px 12px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 12.5,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255, 255, 255, 0.12)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255, 255, 255, 0.06)';
              }}
            >
              <Globe size={17} />
              <span>X (Twitter)</span>
            </button>

            {/* Device / Apps Share Sheet */}
            <button
              type="button"
              onClick={handleDeviceShare}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '11px 12px',
                background: 'rgba(168, 85, 247, 0.12)',
                border: '1px solid rgba(168, 85, 247, 0.35)',
                borderRadius: 'var(--radius-md)',
                color: '#c084fc',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 12.5,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(168, 85, 247, 0.22)';
                (e.currentTarget as HTMLElement).style.borderColor = '#a855f7';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(168, 85, 247, 0.12)';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(168, 85, 247, 0.35)';
              }}
            >
              <Share2 size={17} color="#c084fc" />
              <span>More Apps</span>
            </button>
          </div>
        </div>

        {/* Copy Text Preview Box */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Message Preview</span>
            <button
              type="button"
              onClick={handleCopy}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: copied ? 'var(--success-dim)' : 'transparent',
                color: copied ? 'var(--success)' : 'var(--accent-light)',
                border: 'none',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: 'var(--radius-sm)',
                transition: 'all 0.15s ease',
              }}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              <span>{copied ? 'Copied to Clipboard!' : 'Copy Summary'}</span>
            </button>
          </div>
          <textarea
            readOnly
            value={shareText}
            rows={5}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '10px 12px',
              background: 'var(--bg-base)',
              border: '1px solid var(--bg-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-muted)',
              fontSize: 12,
              lineHeight: 1.5,
              resize: 'none',
              outline: 'none',
              fontFamily: 'monospace',
            }}
          />
        </div>

        {/* Action Buttons Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 10,
            borderTop: '1px solid var(--bg-border)',
            paddingTop: 12,
          }}
        >
          {data.onDownloadImage && (
            <Button variant="secondary" icon={<Download size={14} />} onClick={data.onDownloadImage}>
              Save Image
            </Button>
          )}
          {data.onDownloadPDF && (
            <Button variant="primary" icon={<Download size={14} />} onClick={data.onDownloadPDF}>
              Download PDF
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>

      </div>
    </Modal>
  );
}
