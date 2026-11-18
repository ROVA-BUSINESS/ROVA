import { useState } from 'react';
import {
  Building2,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Star,
  Loader2,
  CreditCard,
  Shield,
} from 'lucide-react';
import {
  NIGERIAN_BANKS,
  verifyBankAccount,
  saveSettlementAccount,
  setPrimarySettlementAccount,
  deleteSettlementAccount,
} from '../../lib/paymentService';
import type { SettlementAccount, NigerianBank } from '../../types/payment';

interface Props {
  userId: string;
  settlementAccounts: SettlementAccount[];
  onAccountsChanged: () => Promise<void>;
}

function maskAccountNumber(accountNumber: string): string {
  if (accountNumber.length <= 4) return accountNumber;
  return '****' + accountNumber.slice(-4);
}

export default function SettlementAccountSection({
  userId,
  settlementAccounts,
  onAccountsChanged,
}: Props) {
  const [showAddForm, setShowAddForm] = useState(false);

  // Form state
  const [selectedBankCode, setSelectedBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [verifiedAccountName, setVerifiedAccountName] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Per-card action states
  const [settingPrimary, setSettingPrimary] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const selectedBank: NigerianBank | undefined = NIGERIAN_BANKS.find(
    (b) => b.code === selectedBankCode
  );

  function resetForm() {
    setSelectedBankCode('');
    setAccountNumber('');
    setVerifiedAccountName(null);
    setVerifyError(null);
    setSaveError(null);
  }

  async function handleVerify() {
    if (!selectedBankCode || accountNumber.length !== 10) return;
    setVerifying(true);
    setVerifiedAccountName(null);
    setVerifyError(null);
    try {
      const result = await verifyBankAccount({ accountNumber, bankCode: selectedBankCode });
      if (!result.success || !result.accountName) {
        setVerifyError(result.error || 'Verification failed. Please check your account number and selected bank.');
      } else {
        setVerifiedAccountName(result.accountName);
      }
    } catch (err: any) {
      setVerifyError(err?.message ?? 'Verification failed. Please check your details.');
    } finally {
      setVerifying(false);
    }
  }

  async function handleSave() {
    if (!verifiedAccountName || !selectedBank) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await saveSettlementAccount({
        userId,
        bankName: selectedBank.name,
        bankCode: selectedBank.code,
        accountNumber,
        accountName: verifiedAccountName,
      });
      if (!res.success) {
        setSaveError(res.error || 'Failed to save account. Please try again.');
        return;
      }
      await onAccountsChanged();
      resetForm();
      setShowAddForm(false);
    } catch (err: any) {
      setSaveError(err?.message ?? 'Failed to save account. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSetPrimary(accountId: string) {
    setSettingPrimary(accountId);
    try {
      await setPrimarySettlementAccount(userId, accountId);
      await onAccountsChanged();
    } finally {
      setSettingPrimary(null);
    }
  }

  async function handleDelete(accountId: string) {
    setDeleting(accountId);
    try {
      await deleteSettlementAccount(userId, accountId);
      await onAccountsChanged();
    } finally {
      setDeleting(null);
    }
  }

  const canVerify =
    selectedBankCode !== '' && accountNumber.length === 10 && !verifying;
  const canSave = !!verifiedAccountName && !saving;

  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--bg-border)',
        borderRadius: 'var(--radius-md)',
        padding: '1.5rem',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.25rem',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Building2 size={20} style={{ color: 'var(--accent-primary)' }} />
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: '1rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              Settlement Accounts
            </h3>
            <p
              style={{
                margin: 0,
                fontSize: '0.78rem',
                color: 'var(--text-muted)',
              }}
            >
              Manage your Nigerian bank accounts for settlement payouts
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setShowAddForm((v) => !v);
            if (showAddForm) resetForm();
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: showAddForm ? 'transparent' : 'var(--accent-primary)',
            color: showAddForm ? 'var(--text-secondary)' : '#fff',
            border: showAddForm ? '1px solid var(--bg-border)' : 'none',
            borderRadius: 'var(--radius-md)',
            padding: '0.45rem 1rem',
            fontSize: '0.85rem',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <Plus size={15} />
          {showAddForm ? 'Cancel' : 'Add Settlement Account'}
        </button>
      </div>

      {/* Inline Add Form */}
      {showAddForm && (
        <div
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--accent-primary)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
            marginBottom: '1.25rem',
          }}
        >
          <h4
            style={{
              margin: '0 0 1rem 0',
              fontSize: '0.9rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <Shield size={15} style={{ color: 'var(--accent-primary)' }} />
            Add New Settlement Account
          </h4>

          {/* Bank Selector */}
          <div style={{ marginBottom: '0.9rem' }}>
            <label
              style={{
                display: 'block',
                fontSize: '0.8rem',
                fontWeight: 500,
                color: 'var(--text-secondary)',
                marginBottom: '0.35rem',
              }}
            >
              Bank
            </label>
            <select
              value={selectedBankCode}
              onChange={(e) => {
                setSelectedBankCode(e.target.value);
                setVerifiedAccountName(null);
                setVerifyError(null);
              }}
              style={{
                width: '100%',
                padding: '0.55rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--bg-border)',
                background: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
                outline: 'none',
              }}
            >
              <option value="">-- Select a bank --</option>
              {NIGERIAN_BANKS.map((bank) => (
                <option key={bank.code} value={bank.code}>
                  {bank.name}
                </option>
              ))}
            </select>
          </div>

          {/* Account Number */}
          <div style={{ marginBottom: '0.9rem' }}>
            <label
              style={{
                display: 'block',
                fontSize: '0.8rem',
                fontWeight: 500,
                color: 'var(--text-secondary)',
                marginBottom: '0.35rem',
              }}
            >
              Account Number
            </label>
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <input
                type="text"
                inputMode="numeric"
                maxLength={10}
                placeholder="10-digit account number"
                value={accountNumber}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setAccountNumber(val);
                  setVerifiedAccountName(null);
                  setVerifyError(null);
                }}
                style={{
                  flex: 1,
                  padding: '0.55rem 0.75rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--bg-border)',
                  background: 'var(--bg-elevated)',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  outline: 'none',
                  letterSpacing: '0.08em',
                }}
              />
              <button
                onClick={handleVerify}
                disabled={!canVerify}
                style={{
                  padding: '0.55rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  background: canVerify ? 'var(--accent-primary)' : 'var(--bg-border)',
                  color: canVerify ? '#fff' : 'var(--text-muted)',
                  fontWeight: 500,
                  fontSize: '0.85rem',
                  cursor: canVerify ? 'pointer' : 'not-allowed',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  whiteSpace: 'nowrap',
                }}
              >
                {verifying ? (
                  <>
                    <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    Verifying…
                  </>
                ) : (
                  'Verify Account'
                )}
              </button>
            </div>
          </div>

          {/* Verification Result */}
          {verifiedAccountName && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.6rem 0.9rem',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(0,200,100,0.08)',
                border: '1px solid var(--success)',
                marginBottom: '0.9rem',
              }}
            >
              <CheckCircle2 size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />
              <span style={{ fontSize: '0.88rem', color: 'var(--success)', fontWeight: 600 }}>
                {verifiedAccountName}
              </span>
            </div>
          )}

          {/* Verify Error */}
          {verifyError && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.6rem 0.9rem',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(220,50,50,0.07)',
                border: '1px solid var(--error)',
                marginBottom: '0.9rem',
              }}
            >
              <AlertCircle size={16} style={{ color: 'var(--error)', flexShrink: 0 }} />
              <span style={{ fontSize: '0.85rem', color: 'var(--error)' }}>{verifyError}</span>
            </div>
          )}

          {/* Save Error */}
          {saveError && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.6rem 0.9rem',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(220,50,50,0.07)',
                border: '1px solid var(--error)',
                marginBottom: '0.9rem',
              }}
            >
              <AlertCircle size={16} style={{ color: 'var(--error)', flexShrink: 0 }} />
              <span style={{ fontSize: '0.85rem', color: 'var(--error)' }}>{saveError}</span>
            </div>
          )}

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={!canSave}
            style={{
              padding: '0.55rem 1.25rem',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: canSave ? 'var(--accent-primary)' : 'var(--bg-border)',
              color: canSave ? '#fff' : 'var(--text-muted)',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: canSave ? 'pointer' : 'not-allowed',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            {saving ? (
              <>
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                Saving…
              </>
            ) : (
              <>
                <CreditCard size={14} />
                Save Account
              </>
            )}
          </button>
        </div>
      )}

      {/* Saved Accounts List */}
      {settlementAccounts.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '2rem 1rem',
            color: 'var(--text-muted)',
          }}
        >
          <Building2
            size={36}
            style={{ color: 'var(--bg-border)', marginBottom: '0.6rem' }}
          />
          <p style={{ margin: 0, fontSize: '0.9rem' }}>
            No settlement accounts yet. Add one to receive payouts.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {settlementAccounts.map((acct) => (
            <div
              key={acct.id}
              style={{
                border: acct.is_primary
                  ? '1.5px solid var(--accent-primary)'
                  : '1px solid var(--bg-border)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem 1.1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                flexWrap: 'wrap',
                background: acct.is_primary
                  ? 'rgba(var(--accent-primary-rgb, 99,102,241), 0.04)'
                  : 'transparent',
              }}
            >
              {/* Account Info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: 'var(--bg-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Building2 size={18} style={{ color: 'var(--accent-primary)' }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: '0.9rem',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {acct.bank_name}
                    </span>
                    {acct.is_primary && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          background: 'var(--success)',
                          color: '#fff',
                          borderRadius: '999px',
                          padding: '0.1rem 0.5rem',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                        }}
                      >
                        <Star size={10} />
                        Primary
                      </span>
                    )}
                    {acct.paystack_subaccount_code && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          background: 'rgba(99,102,241,0.12)',
                          color: 'var(--accent-primary)',
                          borderRadius: '999px',
                          padding: '0.1rem 0.5rem',
                          fontSize: '0.7rem',
                          fontWeight: 500,
                        }}
                      >
                        <Shield size={9} />
                        Paystack Subaccount Ready
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: '0.82rem',
                      color: 'var(--text-secondary)',
                      marginTop: '0.1rem',
                    }}
                  >
                    {maskAccountNumber(acct.account_number)}
                    <span style={{ color: 'var(--text-muted)', margin: '0 0.35rem' }}>·</span>
                    {acct.account_name}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                {!acct.is_primary && (
                  <button
                    onClick={() => handleSetPrimary(acct.id)}
                    disabled={settingPrimary === acct.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      padding: '0.35rem 0.75rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--bg-border)',
                      background: 'transparent',
                      color: 'var(--text-secondary)',
                      fontSize: '0.8rem',
                      fontWeight: 500,
                      cursor: settingPrimary === acct.id ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {settingPrimary === acct.id ? (
                      <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                    ) : (
                      <Star size={12} />
                    )}
                    Set as Primary
                  </button>
                )}
                <button
                  onClick={() => handleDelete(acct.id)}
                  disabled={deleting === acct.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '0.35rem 0.7rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--error)',
                    background: 'transparent',
                    color: 'var(--error)',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    cursor: deleting === acct.id ? 'not-allowed' : 'pointer',
                  }}
                >
                  {deleting === acct.id ? (
                    <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <Trash2 size={12} />
                  )}
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Spinner keyframe — injected once */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
