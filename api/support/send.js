// Vercel Serverless Function: /api/support/send
// Delivers ROVA Support messages to:
// - Officialrovabusiness@gmail.com
// - davidomoniyi33@gmail.com
// - segunerin955 / seguneri955@gmail.com

const RECIPIENTS = [
  'Officialrovabusiness@gmail.com',
  'davidomoniyi33@gmail.com',
  'seguneri955@gmail.com',
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      name = 'ROVA User',
      email = '',
      businessName = '',
      category = 'General Inquiry',
      subject = '',
      message = '',
      userId = '',
    } = req.body || {};

    if (!subject.trim() || !message.trim()) {
      return res.status(400).json({ error: 'Subject and message are required.' });
    }

    const formattedSubject = `[ROVA Support · ${category}] ${subject.trim()}`;
    const plainBody = [
      `New ROVA Support Request`,
      `----------------------------------------`,
      `From: ${name}${businessName ? ` (${businessName})` : ''}`,
      `Reply-To Email: ${email || 'Not provided'}`,
      `User ID: ${userId || 'N/A'}`,
      `Category: ${category}`,
      `Subject: ${subject.trim()}`,
      `----------------------------------------`,
      ``,
      message.trim(),
    ].join('\n');

    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
        <h2 style="margin: 0 0 12px; color: #662D91;">New ROVA Support Message</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 18px; font-size: 13px;">
          <tr><td style="padding: 6px 0; color: #64748b; width: 130px;"><strong>Sender:</strong></td><td style="padding: 6px 0; color: #111827;">${escapeHtml(name)}${businessName ? ` (${escapeHtml(businessName)})` : ''}</td></tr>
          <tr><td style="padding: 6px 0; color: #64748b;"><strong>Email:</strong></td><td style="padding: 6px 0; color: #111827;">${escapeHtml(email || 'Not provided')}</td></tr>
          <tr><td style="padding: 6px 0; color: #64748b;"><strong>Category:</strong></td><td style="padding: 6px 0; color: #111827;">${escapeHtml(category)}</td></tr>
          <tr><td style="padding: 6px 0; color: #64748b;"><strong>Subject:</strong></td><td style="padding: 6px 0; color: #111827;">${escapeHtml(subject.trim())}</td></tr>
          ${userId ? `<tr><td style="padding: 6px 0; color: #64748b;"><strong>User ID:</strong></td><td style="padding: 6px 0; color: #64748b; font-size: 11px;">${escapeHtml(userId)}</td></tr>` : ''}
        </table>
        <div style="padding: 16px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; white-space: pre-wrap; font-size: 14px; line-height: 1.6; color: #111827;">${escapeHtml(message.trim())}</div>
      </div>
    `;

    // 1. Prefer Resend if RESEND_API_KEY is configured in Vercel environment variables
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const fromAddress = process.env.SUPPORT_FROM_EMAIL || 'ROVA Support <onboarding@resend.dev>';
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: fromAddress,
          to: RECIPIENTS,
          reply_to: email || undefined,
          subject: formattedSubject,
          text: plainBody,
          html: htmlBody,
        }),
      });

      if (resendRes.ok) {
        return res.status(200).json({ ok: true, provider: 'resend', recipients: RECIPIENTS });
      }
      const errTxt = await resendRes.text().catch(() => '');
      console.warn('[Support API] Resend failed, falling back to FormSubmit:', errTxt);
    }

    // 2. Fallback: FormSubmit AJAX endpoint (sends to Officialrovabusiness@gmail.com + CC to both team emails)
    const formSubmitRes = await fetch('https://formsubmit.co/ajax/Officialrovabusiness@gmail.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Origin: 'https://www.rovabusiness.com',
        Referer: 'https://www.rovabusiness.com/app/support',
      },
      body: JSON.stringify({
        name,
        email: email || 'no-reply@rovabusiness.com',
        business: businessName || 'N/A',
        category,
        subject: subject.trim(),
        message: message.trim(),
        user_id: userId || 'N/A',
        _subject: formattedSubject,
        _cc: 'davidomoniyi33@gmail.com,seguneri955@gmail.com',
        _replyto: email || undefined,
        _template: 'table',
        _captcha: 'false',
      }),
    });

    if (formSubmitRes.ok) {
      return res.status(200).json({ ok: true, provider: 'formsubmit', recipients: RECIPIENTS });
    }

    const fsErr = await formSubmitRes.text().catch(() => '');
    console.error('[Support API] FormSubmit error:', fsErr);
    return res.status(502).json({
      error: 'Email delivery service is temporarily unavailable. Please try the direct email button below.',
    });
  } catch (err) {
    console.error('[Support API] Unexpected error:', err);
    return res.status(500).json({ error: 'Failed to send support message.' });
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
