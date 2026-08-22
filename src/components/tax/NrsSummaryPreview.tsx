import React, { useState } from 'react';
import { Download, FileJson, CheckCircle, Code } from 'lucide-react';
import type { AnswerStore, NrsExportPayload } from '../../types/nrsQuestionFlow';
import { hydrateForExport, flowConfig } from '../../lib/nrsFlowEngine';
import { formatCurrency } from '../../lib/format';
import { downloadCSV } from '../../lib/export';

interface NrsSummaryPreviewProps {
  answers: AnswerStore;
  onSubmit: () => void;
  submitting?: boolean;
}

export const NrsSummaryPreview: React.FC<NrsSummaryPreviewProps> = ({
  answers,
  onSubmit,
  submitting = false,
}) => {
  const [showJsonModal, setShowJsonModal] = useState(false);
  const hydratedPayload: NrsExportPayload = hydrateForExport(answers, flowConfig);

  const totalRevenue = Number(answers.total_revenue) || 0;
  const costOfSales = Number(answers.cost_of_sales_total) || 0;
  const grossProfit = totalRevenue - costOfSales;
  const otherIncome = Number(answers.total_other_income) || 0;
  const adminExpenses = Number(answers.total_admin_expenses) || 0;
  const operatingProfit = Number(answers.operating_profit_before_tax) || 0;
  const totalAssets = Number(answers.total_assets) || 0;
  const totalLiabilities = (Number(answers.total_current_liabilities) || 0) + (Number(answers.non_current_liabilities_total) || 0);
  const totalEquity = Number(answers.total_equity) || 0;
  const isBalanced = Boolean(answers.balance_check);

  const handleDownloadNrsJson = () => {
    const jsonStr = JSON.stringify(hydratedPayload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nrs-cit-filing-${answers.year_of_assessment || new Date().getFullYear()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadCsv = () => {
    const rows = Object.entries(hydratedPayload).map(([field, val]) => [field, val]);
    downloadCSV(`nrs-cit-export-${new Date().getFullYear()}.csv`, ['NRS Field Key', 'Amount / Value'], rows);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header Banner */}
      <div
        style={{
          padding: 20,
          background: 'linear-gradient(135deg, var(--accent-dim), var(--bg-elevated))',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--accent-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h3 style={{ fontSize: 18, marginBottom: 4, color: 'var(--text-primary)' }}>
            NRS CIT Financial Return Statement Preview
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Year of Assessment: <strong>{answers.year_of_assessment || 2026}</strong> · Entity: <strong>{answers.entity_type || 'Company'}</strong>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setShowJsonModal(true)}
            style={{
              padding: '8px 14px',
              background: 'var(--bg-base)',
              border: '1px solid var(--bg-border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--text-primary)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Code size={14} /> View Hydrated Payload ({Object.keys(hydratedPayload).length} NRS Fields)
          </button>
          <button
            type="button"
            onClick={handleDownloadNrsJson}
            style={{
              padding: '8px 14px',
              background: 'var(--bg-base)',
              border: '1px solid var(--bg-border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--text-primary)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <FileJson size={14} /> Export JSON
          </button>
          <button
            type="button"
            onClick={handleDownloadCsv}
            style={{
              padding: '8px 14px',
              background: 'var(--bg-base)',
              border: '1px solid var(--bg-border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--text-primary)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Statement Summaries */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        {/* Income Statement Card */}
        <div
          style={{
            padding: 20,
            background: 'var(--bg-elevated)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--bg-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-light)', textTransform: 'uppercase' }}>
            Income Statement Summary
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)' }}>
            <span>Total Revenue</span>
            <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(totalRevenue)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)' }}>
            <span>Cost of Sales / Direct Costs</span>
            <strong style={{ color: 'var(--text-primary)' }}>- {formatCurrency(costOfSales)}</strong>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 14,
              fontWeight: 700,
              paddingTop: 8,
              borderTop: '1px solid var(--bg-border)',
            }}
          >
            <span>Gross Profit</span>
            <span style={{ color: grossProfit >= 0 ? 'var(--success)' : 'var(--error)' }}>
              {formatCurrency(grossProfit)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)' }}>
            <span>Other Income</span>
            <strong style={{ color: 'var(--text-primary)' }}>+ {formatCurrency(otherIncome)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)' }}>
            <span>Administrative Expenses</span>
            <strong style={{ color: 'var(--text-primary)' }}>- {formatCurrency(adminExpenses)}</strong>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 15,
              fontWeight: 700,
              paddingTop: 8,
              borderTop: '1px solid var(--bg-border)',
            }}
          >
            <span>Operating Profit Before Tax</span>
            <span style={{ color: operatingProfit >= 0 ? 'var(--success)' : 'var(--error)' }}>
              {formatCurrency(operatingProfit)}
            </span>
          </div>
        </div>

        {/* Balance Sheet Card */}
        <div
          style={{
            padding: 20,
            background: 'var(--bg-elevated)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--bg-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-light)', textTransform: 'uppercase' }}>
            Balance Sheet Summary
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)' }}>
            <span>Total Non-Current Assets</span>
            <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(answers.total_non_current_assets || 0)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)' }}>
            <span>Total Current Assets (incl. Inventory)</span>
            <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(answers.total_current_assets || 0)}</strong>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 14,
              fontWeight: 700,
              paddingTop: 8,
              borderTop: '1px solid var(--bg-border)',
            }}
          >
            <span>Total Assets</span>
            <span style={{ color: 'var(--accent-light)' }}>{formatCurrency(totalAssets)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)' }}>
            <span>Total Liabilities</span>
            <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(totalLiabilities)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)' }}>
            <span>Total Equity (incl. Retained Earnings)</span>
            <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(totalEquity)}</strong>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 14,
              fontWeight: 700,
              paddingTop: 8,
              borderTop: '1px solid var(--bg-border)',
            }}
          >
            <span>Liabilities + Equity</span>
            <span style={{ color: isBalanced ? 'var(--success)' : 'var(--error)' }}>
              {formatCurrency(totalLiabilities + totalEquity)}
            </span>
          </div>
        </div>
      </div>

      {/* Submission Action */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 16 }}>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          style={{
            padding: '12px 24px',
            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-light))',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: 14,
            fontWeight: 700,
            cursor: submitting ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 4px 16px rgba(99,102,241,0.3)',
          }}
        >
          <CheckCircle size={18} />
          {submitting ? 'Submitting to NRS...' : 'Confirm & Submit CIT Return'}
        </button>
      </div>

      {/* Hydrated JSON Payload Modal */}
      {showJsonModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--bg-border)',
              borderRadius: 'var(--radius-lg)',
              maxWidth: 700,
              width: '100%',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              padding: 24,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h4 style={{ fontSize: 16, margin: 0, color: 'var(--text-primary)' }}>
                Hydrated NRS Export Payload ({Object.keys(hydratedPayload).length} Fields)
              </h4>
              <button
                type="button"
                onClick={() => setShowJsonModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}
              >
                ✕
              </button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              Every NRS field manifest key is populated with explicit "0.00" if unanswered, per filing submission specification.
            </div>
            <pre
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: 16,
                background: 'var(--bg-base)',
                borderRadius: 'var(--radius-md)',
                fontSize: 12,
                fontFamily: 'monospace',
                color: 'var(--accent-light)',
              }}
            >
              {JSON.stringify(hydratedPayload, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
