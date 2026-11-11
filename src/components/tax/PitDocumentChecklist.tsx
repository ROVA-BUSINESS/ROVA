import { useState } from 'react';
import { CheckCircle2, FileText } from 'lucide-react';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { ReceiptUploader } from '../ui/ReceiptUploader';

export interface PitUploadedDocItem {
  docKey: string;
  label: string;
  url: string;
}

export interface PitRequiredDocSpec {
  docKey: string;
  label: string;
  hint: string;
}

interface PitDocumentChecklistProps {
  specs: PitRequiredDocSpec[];
  docs: PitUploadedDocItem[];
  onAddDoc: (doc: PitUploadedDocItem) => void;
  onRemoveDoc: (index: number) => void;
}

export function PitDocumentChecklist({ specs, docs, onAddDoc, onRemoveDoc }: PitDocumentChecklistProps) {
  const [selectedKey, setSelectedKey] = useState<string>(specs[0]?.docKey || 'other');
  const [pendingUrl, setPendingUrl] = useState('');

  const uploadedKeys = new Set(docs.map((d) => d.docKey));
  const selectedSpec = specs.find((s) => s.docKey === selectedKey) || specs[0];

  const handleAttach = () => {
    if (!pendingUrl || !selectedSpec) return;
    onAddDoc({
      docKey: selectedSpec.docKey,
      label: selectedSpec.label,
      url: pendingUrl,
    });
    setPendingUrl('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
        {specs.map((spec) => {
          const done = uploadedKeys.has(spec.docKey);
          const active = selectedKey === spec.docKey;
          return (
            <button
              key={spec.docKey}
              type="button"
              onClick={() => setSelectedKey(spec.docKey)}
              style={{
                textAlign: 'left',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${active ? 'var(--accent-primary)' : 'var(--bg-border)'}`,
                background: active ? 'var(--accent-dim)' : 'var(--bg-surface)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{spec.label}</span>
                {done ? <CheckCircle2 size={14} color="var(--success)" /> : <Badge variant="default">Select</Badge>}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>{spec.hint}</div>
            </button>
          );
        })}
      </div>

      {selectedSpec && (
        <div
          style={{
            padding: 12,
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--bg-border)',
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
            Upload: {selectedSpec.label}
          </div>
          <ReceiptUploader
            value={pendingUrl}
            onChange={setPendingUrl}
            label={`Upload ${selectedSpec.label} (PDF, JPG, PNG)`}
          />
          {pendingUrl && (
            <div style={{ marginTop: 8 }}>
              <Button variant="primary" size="sm" onClick={handleAttach}>
                Attach to Filing Package
              </Button>
            </div>
          )}
        </div>
      )}

      {docs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
            Attached Documents ({docs.length})
          </div>
          {docs.map((doc, idx) => (
            <div
              key={`${doc.docKey}-${idx}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-surface)',
                border: '1px solid var(--bg-border)',
                fontSize: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={14} color="var(--accent-light)" />
                <span>{doc.label}</span>
                <a href={doc.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-light)' }}>
                  View
                </a>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onRemoveDoc(idx)}>
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
