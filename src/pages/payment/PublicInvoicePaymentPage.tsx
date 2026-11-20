import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  CheckCircle2,
  ShieldCheck,
  CreditCard,
  AlertCircle,
  ArrowLeft,
  Loader2,
  Sparkles,
  Calendar,
  Clock,
  Printer
} from 'lucide-react';
import { formatCurrency } from '../../lib/format';
import { openPaystackPopup, verifyInvoicePaymentOnServer } from '../../lib/paystack';
import { getPublicInvoice, type PublicInvoiceResponse } from '../../lib/invoiceService';

export default function PublicInvoicePaymentPage() {
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoiceData, setInvoiceData] = useState<PublicInvoiceResponse | null>(null);

  // Payment method selection & amount inputs
  const [paymentOption, setPaymentOption] = useState<'full' | 'partial'>('full');
  const [customAmount, setCustomAmount] = useState<string>('');
  const [payerName, setPayerName] = useState('');
  const [payerEmail, setPayerEmail] = useState('');
  const [paying, setPaying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<{
    reference: string;
    amount: number;
    newBalance: number;
  } | null>(null);

  useEffect(() => {
    if (!id) {
      setError('Invoice ID is missing from the URL.');
      setLoading(false);
      return;
    }
    loadInvoice();
  }, [id]);

  async function loadInvoice() {
    setLoading(true);
    setError(null);
    try {
      // 1. Try public API endpoint first
      const res = await fetch(`/api/payment/invoices/public?id=${encodeURIComponent(id || '')}`);
      if (res.ok) {
        const body = await res.json();
        if (body.success && body.invoice) {
          setInvoiceData(body);
          initPayerDefaults(body);
          setLoading(false);
          return;
        }
      }

      // 2. Fallback to client service
      const data = await getPublicInvoice(id || '');
      if (!data) {
        throw new Error('Invoice could not be found or has expired.');
      }
      setInvoiceData(data);
      initPayerDefaults(data);
    } catch (err: any) {
      setError(err.message || 'Invoice not found.');
    } finally {
      setLoading(false);
    }
  }

  function initPayerDefaults(data: PublicInvoiceResponse) {
    if (data.invoice.client_name && !payerName) {
      setPayerName(data.invoice.client_name);
    }
    if (data.invoice.client_email && !payerEmail) {
      setPayerEmail(data.invoice.client_email);
    }

    const balanceDue = Number(data.invoice.balance_due ?? Math.max(0, data.invoice.total - (data.invoice.amount_paid || 0)));
    
    // Set default custom amount based on partial payment settings
    if (data.invoice.allow_partial_payments) {
      if (data.invoice.partial_payment_type === 'fixed_deposit' && data.invoice.fixed_deposit_amount && (data.invoice.amount_paid || 0) === 0) {
        setCustomAmount(String(Math.min(data.invoice.fixed_deposit_amount, balanceDue)));
        setPaymentOption('partial');
      } else if (data.invoice.partial_payment_type === 'minimum' && data.invoice.minimum_partial_amount) {
        setCustomAmount(String(Math.min(data.invoice.minimum_partial_amount, balanceDue)));
      } else {
        // Suggested first instalment = 50% or ₦5,000
        const suggested = Math.min(balanceDue, Math.max(1000, Math.round(balanceDue / 2)));
        setCustomAmount(String(suggested));
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mb-4" />
        <p className="text-slate-600 text-sm font-medium">Loading invoice details...</p>
      </div>
    );
  }

  if (error || !invoiceData) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Invoice Not Found</h1>
          <p className="text-sm text-slate-600 mb-6">{error || 'This invoice does not exist or the link is invalid.'}</p>
          <Link
            to="/"
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const { invoice, items, payments, merchant } = invoiceData;
  const total = Number(invoice.total || 0);
  const amountPaid = Number(invoice.amount_paid || 0);
  const balanceDue = Number(invoice.balance_due ?? Math.max(0, total - amountPaid));
  const progressPercent = total > 0 ? Math.min(100, Math.round((amountPaid / total) * 100)) : 0;

  const isFullyPaid = invoice.status === 'paid' || balanceDue <= 0;
  const isCancelled = invoice.status === 'cancelled';

  // Amount chosen by customer
  let selectedPayAmount = 0;
  if (paymentOption === 'full') {
    selectedPayAmount = balanceDue;
  } else {
    selectedPayAmount = parseFloat(customAmount || '0') || 0;
  }

  // Validation rules for partial payment
  let validationMessage: string | null = null;
  if (!isFullyPaid && !isCancelled) {
    if (selectedPayAmount <= 0) {
      validationMessage = 'Please enter an amount greater than ₦0.';
    } else if (selectedPayAmount > balanceDue) {
      validationMessage = `Amount cannot exceed the remaining balance of ${formatCurrency(balanceDue)}.`;
    } else if (invoice.allow_partial_payments) {
      if (
        invoice.partial_payment_type === 'fixed_deposit' &&
        invoice.fixed_deposit_amount &&
        amountPaid === 0 &&
        selectedPayAmount < invoice.fixed_deposit_amount &&
        invoice.fixed_deposit_amount <= balanceDue
      ) {
        validationMessage = `Initial deposit must be at least ${formatCurrency(invoice.fixed_deposit_amount)}.`;
      } else if (
        invoice.partial_payment_type === 'minimum' &&
        invoice.minimum_partial_amount &&
        selectedPayAmount < invoice.minimum_partial_amount &&
        invoice.minimum_partial_amount <= balanceDue
      ) {
        validationMessage = `Minimum payment amount is ${formatCurrency(invoice.minimum_partial_amount)}.`;
      }
    }
  }

  async function handleProceedToPayment(e: React.FormEvent) {
    e.preventDefault();
    setVerificationError(null);

    if (isFullyPaid || isCancelled) return;

    if (validationMessage) {
      alert(validationMessage);
      return;
    }

    if (!payerEmail || !payerEmail.includes('@')) {
      alert('Please enter a valid email address so we can send your payment receipt.');
      return;
    }

    setPaying(true);

    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    const reference = `ROVA_INV_${timestamp}_${random}`;

    try {
      await openPaystackPopup({
        amountNaira: selectedPayAmount,
        email: payerEmail.trim(),
        reference,
        metadata: {
          invoice_id: invoice.id,
          invoice_number: invoice.invoice_number,
          user_id: invoice.user_id,
          payer_name: payerName.trim(),
          payer_email: payerEmail.trim(),
          payment_type: paymentOption,
          notes: `Invoice ${invoice.invoice_number} instalment payment`,
          via: 'rova_invoice_portal',
        },
        onSuccess: async (verifiedRef) => {
          const finalRef = verifiedRef || reference;
          
          // Verify on server and atomically record instalment
          try {
            const verifyResult = await verifyInvoicePaymentOnServer({
              reference: finalRef,
              invoiceId: invoice.id,
              amount: selectedPayAmount,
              payerName: payerName.trim(),
              payerEmail: payerEmail.trim(),
            });

            if (verifyResult.success) {
              const newBalance = Math.max(0, balanceDue - selectedPayAmount);
              setPaymentSuccess({
                reference: finalRef,
                amount: selectedPayAmount,
                newBalance,
              });
              // Reload fresh invoice state
              loadInvoice();
            } else {
              setVerificationError(verifyResult.error || 'Payment recorded with Paystack, updating invoice state...');
              loadInvoice();
            }
          } catch (verErr: any) {
            console.error('Payment verification error:', verErr);
            loadInvoice();
          } finally {
            setPaying(false);
          }
        },
        onClose: () => {
          setPaying(false);
        },
      });
    } catch (popupErr: any) {
      alert(popupErr.message || 'Unable to open Paystack payment window.');
      setPaying(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 py-8 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Header Branding */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
              {merchant?.business_name ? merchant.business_name.charAt(0).toUpperCase() : 'R'}
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">{merchant?.business_name || 'ROVA Merchant'}</h2>
              <p className="text-xs text-slate-500">Official Invoice Payment Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / Save PDF
            </button>
            <div className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full font-medium border border-emerald-100">
              <ShieldCheck className="w-3.5 h-3.5" />
              Secured with Paystack
            </div>
          </div>
        </div>

        {/* Success Modal / Banner */}
        {paymentSuccess && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-slate-800 shadow-sm animate-in fade-in duration-300">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="flex-1 space-y-2">
                <h3 className="text-base font-bold text-emerald-900">Payment Successful!</h3>
                <p className="text-sm text-emerald-800">
                  We received your payment of <span className="font-semibold">{formatCurrency(paymentSuccess.amount)}</span> for invoice <span className="font-semibold">{invoice.invoice_number}</span>.
                </p>
                <div className="text-xs text-emerald-700 bg-emerald-100/60 rounded-lg p-2.5 inline-block font-mono">
                  Reference: {paymentSuccess.reference}
                </div>
                {paymentSuccess.newBalance > 0 ? (
                  <p className="text-xs text-slate-600 pt-1">
                    Remaining balance to be paid: <strong className="text-slate-900">{formatCurrency(paymentSuccess.newBalance)}</strong>. You can pay the balance in further instalments anytime before the due date.
                  </p>
                ) : (
                  <p className="text-xs text-emerald-900 font-semibold pt-1">
                    🎉 This invoice is now fully settled! Thank you for your business.
                  </p>
                )}
                <div className="pt-2">
                  <button
                    onClick={() => setPaymentSuccess(null)}
                    className="text-xs font-medium text-emerald-700 underline hover:text-emerald-800"
                  >
                    Dismiss notification
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {verificationError && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>{verificationError}</span>
          </div>
        )}

        {/* Invoice Summary Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 sm:p-8 space-y-6">
            
            {/* Top row: Invoice #, Date, Status */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Invoice</span>
                <h1 className="text-2xl font-extrabold text-slate-900">{invoice.invoice_number}</h1>
                <div className="flex items-center gap-4 text-xs text-slate-500 mt-1">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    Issued: {invoice.issue_date || 'N/A'}
                  </span>
                  {invoice.due_date && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      Due: {invoice.due_date}
                    </span>
                  )}
                </div>
              </div>

              <div>
                {invoice.status === 'paid' && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Fully Paid
                  </span>
                )}
                {invoice.status === 'partially_paid' && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                    Partially Paid
                  </span>
                )}
                {invoice.status === 'unpaid' && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                    Unpaid
                  </span>
                )}
                {invoice.status === 'overdue' && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                    Overdue
                  </span>
                )}
                {invoice.status === 'cancelled' && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                    Cancelled
                  </span>
                )}
              </div>
            </div>

            {/* Billed To / Billed From */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100 text-xs">
              <div>
                <span className="text-slate-400 uppercase font-semibold">Billed To</span>
                <p className="font-semibold text-slate-800 text-sm mt-0.5">{invoice.client_name || 'Valued Customer'}</p>
                {invoice.client_email && <p className="text-slate-500">{invoice.client_email}</p>}
                {invoice.client_phone && <p className="text-slate-500">{invoice.client_phone}</p>}
                {invoice.client_address && <p className="text-slate-500">{invoice.client_address}</p>}
              </div>
              <div className="sm:text-right">
                <span className="text-slate-400 uppercase font-semibold">Payable To</span>
                <p className="font-semibold text-slate-800 text-sm mt-0.5">{merchant?.business_name || 'Business Merchant'}</p>
                {merchant?.email && <p className="text-slate-500">{merchant.email}</p>}
                {merchant?.phone && <p className="text-slate-500">{merchant.phone}</p>}
                {merchant?.address && <p className="text-slate-500">{merchant.address}</p>}
              </div>
            </div>

            {/* Progress & Balances */}
            <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center sm:text-left">
                <div>
                  <div className="text-xs text-slate-500">Invoice Total</div>
                  <div className="text-base sm:text-lg font-bold text-slate-900">{formatCurrency(total)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Amount Paid</div>
                  <div className="text-base sm:text-lg font-bold text-emerald-600">{formatCurrency(amountPaid)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Balance Due</div>
                  <div className="text-base sm:text-lg font-bold text-slate-900">
                    {formatCurrency(balanceDue)}
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-1">
                <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full transition-all duration-500 ease-out rounded-full"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                  <span>{progressPercent}% paid</span>
                  <span>{formatCurrency(balanceDue)} remaining</span>
                </div>
              </div>
            </div>

            {/* Line items table */}
            {items && items.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Item Details</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Item</th>
                        <th className="py-2.5 px-3 text-right">Qty</th>
                        <th className="py-2.5 px-3 text-right">Rate</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((item: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3 text-slate-800 font-medium">{item.description}</td>
                          <td className="py-2 px-3 text-right text-slate-500">{item.quantity}</td>
                          <td className="py-2 px-3 text-right text-slate-500">{formatCurrency(item.unit_price)}</td>
                          <td className="py-2 px-3 text-right text-slate-900 font-semibold">{formatCurrency(item.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Payment history list */}
            {payments && payments.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Payment History ({payments.length})</h4>
                  <span className="text-xs text-emerald-600 font-semibold">Total Paid: {formatCurrency(amountPaid)}</span>
                </div>
                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
                  {payments.map((p: any, idx: number) => (
                    <div key={p.id || idx} className="p-3 bg-white flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-[10px]">
                          #{payments.length - idx}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-800">
                            {formatCurrency(p.amount)}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {p.payment_date ? new Date(p.payment_date).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'Recent'} &bull; {p.payment_method || 'Online'}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                          Verified
                        </span>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{p.payment_reference}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {invoice.notes && (
              <div className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3 border border-slate-100">
                <span className="font-semibold text-slate-700">Notes:</span> {invoice.notes}
              </div>
            )}
          </div>
        </div>

        {/* Payment Action Section (if balance remains) */}
        {!isFullyPaid && !isCancelled && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Make a Payment</h3>
              <p className="text-xs text-slate-500 mt-1">
                Choose to settle the full remaining balance or pay a permitted instalment online securely with Paystack.
              </p>
            </div>

            {/* Partial Payments Allowed Selector */}
            {invoice.allow_partial_payments ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentOption('full')}
                  className={`p-4 rounded-xl border-2 text-left transition ${
                    paymentOption === 'full'
                      ? 'border-emerald-600 bg-emerald-50/40 text-emerald-950 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm">Option A: Pay Full Balance</span>
                    <CreditCard className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-lg font-black text-slate-900">{formatCurrency(balanceDue)}</div>
                  <p className="text-xs text-slate-500 mt-1">Clear the entire outstanding balance today.</p>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentOption('partial')}
                  className={`p-4 rounded-xl border-2 text-left transition ${
                    paymentOption === 'partial'
                      ? 'border-emerald-600 bg-emerald-50/40 text-emerald-950 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm">Option B: Pay in Instalments</span>
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-lg font-black text-slate-900">Custom Amount</div>
                  <p className="text-xs text-slate-500 mt-1">
                    {invoice.partial_payment_type === 'fixed_deposit' && invoice.fixed_deposit_amount && amountPaid === 0
                      ? `Requires fixed deposit of ${formatCurrency(invoice.fixed_deposit_amount)}`
                      : invoice.partial_payment_type === 'minimum' && invoice.minimum_partial_amount
                      ? `Minimum payment ${formatCurrency(invoice.minimum_partial_amount)}`
                      : 'Pay any custom amount towards the balance.'}
                  </p>
                </button>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Due Today</span>
                  <div className="text-xl font-black text-slate-900">{formatCurrency(balanceDue)}</div>
                  <p className="text-xs text-slate-500 mt-0.5">This invoice requires full payment.</p>
                </div>
                <CreditCard className="w-6 h-6 text-emerald-600" />
              </div>
            )}

            {/* Custom amount input if Option B is active */}
            {invoice.allow_partial_payments && paymentOption === 'partial' && (
              <div className="space-y-2 pt-2 animate-in fade-in duration-200">
                <label className="block text-xs font-semibold text-slate-700">
                  Enter Payment Amount (₦)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₦</span>
                  <input
                    type="number"
                    min="100"
                    max={balanceDue}
                    step="100"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder="Enter amount to pay"
                    className="w-full pl-8 pr-4 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden font-semibold"
                  />
                </div>

                {/* Helpful constraints / guidance */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 pt-1">
                  <span>
                    Remaining balance: <strong className="text-slate-800">{formatCurrency(balanceDue)}</strong>
                  </span>
                  {invoice.partial_payment_type === 'minimum' && invoice.minimum_partial_amount && (
                    <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-sm">
                      Min payment: {formatCurrency(invoice.minimum_partial_amount)}
                    </span>
                  )}
                  {invoice.partial_payment_type === 'fixed_deposit' && invoice.fixed_deposit_amount && amountPaid === 0 && (
                    <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded-sm">
                      Fixed deposit: {formatCurrency(invoice.fixed_deposit_amount)}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Customer Contact Details */}
            <form onSubmit={handleProceedToPayment} className="space-y-4 pt-2 border-t border-slate-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Your Name
                  </label>
                  <input
                    type="text"
                    required
                    value={payerName}
                    onChange={(e) => setPayerName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full px-3.5 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address <span className="text-slate-400 font-normal">(for receipt)</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={payerEmail}
                    onChange={(e) => setPayerEmail(e.target.value)}
                    placeholder="e.g. john@example.com"
                    className="w-full px-3.5 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-hidden"
                  />
                </div>
              </div>

              {validationMessage && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{validationMessage}</span>
                </div>
              )}

              {/* Pay Now Button */}
              <button
                type="submit"
                disabled={paying || !!validationMessage || selectedPayAmount <= 0}
                className="w-full py-3 px-4 rounded-xl font-bold text-sm text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 shadow-sm"
              >
                {paying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing Payment with Paystack...</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    <span>Pay {formatCurrency(selectedPayAmount)} Online</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-2 text-slate-400 text-[11px] pt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>256-bit bank grade encryption via Paystack. Your card details are never stored.</span>
              </div>
            </form>
          </div>
        )}

        {/* Fully Paid View */}
        {isFullyPaid && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
            <h3 className="text-base font-bold text-emerald-950">Invoice Fully Settled</h3>
            <p className="text-xs text-emerald-800 max-w-md mx-auto">
              This invoice has been completely paid. No further payments are required. Thank you!
            </p>
          </div>
        )}

        {/* Cancelled View */}
        {isCancelled && (
          <div className="bg-slate-100 border border-slate-200 rounded-2xl p-6 text-center space-y-2">
            <AlertCircle className="w-10 h-10 text-slate-400 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">Invoice Cancelled</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              This invoice has been marked as cancelled by the merchant. Payments cannot be accepted.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
