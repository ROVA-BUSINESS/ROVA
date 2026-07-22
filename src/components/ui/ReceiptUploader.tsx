import React, { useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';

interface ReceiptUploaderProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
}

export const ReceiptUploader: React.FC<ReceiptUploaderProps> = ({ value, onChange, label = "Upload File" }) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setError(null);
    
    // Frontend validation
    if (file.size > 5 * 1024 * 1024) {
      setError("File exceeds the 5MB size limit.");
      return;
    }
    
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      setError("Invalid file type. Only JPG, PNG, and PDF are allowed.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      // Invoke our edge function
      const { data, error: uploadError } = await supabase.functions.invoke('upload-receipt', {
        body: formData,
      });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      if (data && data.url) {
        onChange(data.url);
      } else if (data && data.error) {
        throw new Error(data.error);
      } else {
        throw new Error("No URL returned from upload service.");
      }
    } catch (err: any) {
      console.error("Upload error:", err);
      setError(err.message || "Failed to upload file.");
    } finally {
      setUploading(false);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUpload(e.dataTransfer.files[0]);
    }
  };

  // Extract a readable filename from the URL if possible
  const getDisplayFilename = (urlStr: string) => {
    try {
      const parsedUrl = new URL(urlStr);
      const pathParts = parsedUrl.pathname.split('/');
      const lastPart = pathParts[pathParts.length - 1];
      // If it contains a UUID-based name, we can decode it
      return decodeURIComponent(lastPart);
    } catch {
      return "uploaded_attachment";
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</label>
      <div 
        onDragOver={onDragOver}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: '2px dashed var(--bg-border)',
          borderRadius: 'var(--radius-md)',
          padding: '16px',
          textAlign: 'center',
          cursor: 'pointer',
          background: 'var(--bg-elevated)',
          transition: 'all 0.2s',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          position: 'relative',
          minHeight: '90px'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--accent-primary)';
          e.currentTarget.style.background = 'rgba(147, 51, 234, 0.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'var(--bg-border)';
          e.currentTarget.style.background = 'var(--bg-elevated)';
        }}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          accept="image/jpeg,image/png,application/pdf"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleUpload(e.target.files[0]);
            }
          }}
        />
        
        {uploading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Scanning for malware & uploading...</span>
            <div className="upload-spinner" style={{
              width: 16,
              height: 16,
              border: '2px solid rgba(147, 51, 234, 0.2)',
              borderTop: '2px solid var(--accent-primary)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite'
            }}></div>
          </div>
        ) : value ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 13, color: '#10b981', fontWeight: 500 }}>✓ Document verified clean & saved</span>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', wordBreak: 'break-all', maxWidth: '300px' }}>
              {getDisplayFilename(value)}
            </span>
            <span style={{ fontSize: 11, color: 'var(--accent-primary)', textDecoration: 'underline' }}>Click to replace file</span>
          </div>
        ) : (
          <>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Drag & drop file here or <span style={{ color: 'var(--accent-primary)', fontWeight: 500 }}>browse</span>
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Supports JPG, PNG, PDF (max 5MB)</span>
          </>
        )}
      </div>
      {error && <span style={{ fontSize: 12, color: '#ef4444' }}>{error}</span>}
      
      {/* Keyframe animation for spinner */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
