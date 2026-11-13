import React, { useEffect, useRef, useState } from 'react';
import {
  Globe,
  Lock,
  Shield,
  CheckCircle,
  Send,
  RefreshCw,
} from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Input from '../ui/Input';

interface CustomerFilingBrowserProps {
  sessionId: string;
  authorityCode: string;
  authorityName: string;
  portalUrl: string;
  taxData: Record<string, any>;
  onComplete?: () => void;
  onCancel?: () => void;
}

export default function CustomerFilingBrowser({
  sessionId,
  authorityCode,
  authorityName,
  portalUrl,
  taxData,
  onComplete,
  onCancel,
}: CustomerFilingBrowserProps) {
  const [, setWsConnected] = useState(false);
  const [frameData, setFrameData] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<string>('INITIALIZING');
  const [logs, setLogs] = useState<string[]>([]);
  const [handoffPrompt, setHandoffPrompt] = useState<{
    prompt: string;
    handoffType: string;
  } | null>(null);
  const [handoffInputValue, setHandoffInputValue] = useState('');
  const [isTakeoverActive, setIsTakeoverActive] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const canvasRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const host = window.location.hostname || 'localhost';
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${host}:8089?sessionId=${sessionId}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      ws.send(
        JSON.stringify({
          type: 'START_FILING_SESSION',
          authorityCode,
          taxData,
        })
      );
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'SCREEN_FRAME') {
          setFrameData(msg.data);
        } else if (msg.type === 'STEP_LOG') {
          setLogs((prev) => [...prev, msg.log]);
          if (msg.status) setSessionStatus(msg.status);
        } else if (msg.type === 'HANDOFF_PROMPT') {
          setHandoffPrompt({ prompt: msg.prompt, handoffType: msg.handoffType });
          setSessionStatus('WAITING_CUSTOMER');
        } else if (msg.type === 'APPROVAL_REQUIRED') {
          setSessionStatus('REVIEW_READY');
        } else if (msg.type === 'FILING_COMPLETE') {
          setSessionStatus('SUBMITTED');
          if (onComplete) onComplete();
        }
      } catch (err) {
        console.error('Frame decode error:', err);
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [sessionId, authorityCode, taxData, onComplete]);

  function handleCanvasClick(e: React.MouseEvent<HTMLImageElement>) {
    if (!isTakeoverActive || !canvasRef.current || !wsRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = 1280 / rect.width;
    const scaleY = 800 / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    wsRef.current.send(
      JSON.stringify({
        type: 'CUSTOMER_CLICK',
        x,
        y,
      })
    );
  }

  function submitHandoffValue() {
    if (!wsRef.current || !handoffInputValue) return;
    wsRef.current.send(
      JSON.stringify({
        type: 'CUSTOMER_RESOLVE_HANDOFF',
        value: handoffInputValue,
      })
    );
    setHandoffPrompt(null);
    setHandoffInputValue('');
  }

  function approveFinalSubmission() {
    if (!wsRef.current) return;
    wsRef.current.send(
      JSON.stringify({
        type: 'CUSTOMER_RESOLVE_HANDOFF',
        value: 'APPROVED',
      })
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top Session Bar */}
      <Card style={{ padding: '12px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'var(--accent-dim)',
                color: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Globe size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                  {authorityName}
                </span>
                <Badge variant={sessionStatus === 'RUNNING' ? 'info' : sessionStatus === 'WAITING_CUSTOMER' ? 'warning' : 'success'}>
                  {sessionStatus.replace('_', ' ')}
                </Badge>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{portalUrl}</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Button
              variant={isTakeoverActive ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setIsTakeoverActive(!isTakeoverActive)}
            >
              {isTakeoverActive ? 'Exit Customer Takeover' : 'Take Control of Browser'}
            </Button>
            {onCancel && (
              <Button variant="ghost" size="sm" onClick={onCancel}>
                Cancel Session
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Main Viewport & Right Control Sidebar */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        {/* Browser Screencast Viewport */}
        <Card style={{ padding: 12, overflow: 'hidden' }}>
          <div
            style={{
              position: 'relative',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              background: '#0a0d14',
              minHeight: 460,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {frameData ? (
              <img
                ref={canvasRef}
                src={`data:image/jpeg;base64,${frameData}`}
                alt="Tax Portal Live Stream"
                onClick={handleCanvasClick}
                style={{
                  width: '100%',
                  height: 'auto',
                  display: 'block',
                  cursor: isTakeoverActive ? 'crosshair' : 'default',
                  border: isTakeoverActive ? '2px solid var(--accent)' : 'none',
                }}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
                <RefreshCw size={36} className="spin" style={{ color: 'var(--accent)', marginBottom: 12 }} />
                <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>Connecting to Cloud Browser...</p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-tertiary)' }}>
                  Isolated secure filing container starting up.
                </p>
              </div>
            )}

            {isTakeoverActive && (
              <div
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 12,
                  background: 'rgba(59, 130, 246, 0.9)',
                  color: '#fff',
                  padding: '4px 10px',
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 700,
                  backdropFilter: 'blur(4px)',
                }}
              >
                🎮 Interactive Takeover Active (Click anywhere on screen)
              </div>
            )}
          </div>
        </Card>

        {/* Action & Sensitive Checkpoint Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Sensitive Checkpoint Dialog */}
          {handoffPrompt && (
            <Card style={{ padding: 16, border: '2px solid var(--warning)', background: 'rgba(245, 158, 11, 0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Lock size={18} style={{ color: 'var(--warning)' }} />
                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                  Customer Action Required
                </span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 12px' }}>
                {handoffPrompt.prompt}
              </p>

              <div style={{ display: 'flex', gap: 8 }}>
                <Input
                  type={handoffPrompt.handoffType.includes('PASSWORD') ? 'password' : 'text'}
                  placeholder="Enter required value..."
                  value={handoffInputValue}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHandoffInputValue(e.target.value)}
                  style={{ flex: 1 }}
                />
                <Button variant="primary" size="sm" onClick={submitHandoffValue}>
                  <Send size={14} style={{ marginRight: 4 }} /> Submit
                </Button>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '8px 0 0' }}>
                🔒 This value is passed directly to the portal session and is never logged in Rova.
              </p>
            </Card>
          )}

          {/* Final Submission Gate */}
          {sessionStatus === 'REVIEW_READY' && (
            <Card style={{ padding: 16, border: '2px solid var(--success)', background: 'rgba(16, 185, 129, 0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Shield size={18} style={{ color: 'var(--success)' }} />
                <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                  Final Submission Approval
                </span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 12px' }}>
                Review the completed return and assessment notice in the browser view. Click below to authorize filing.
              </p>
              <Button variant="success" size="sm" fullWidth onClick={approveFinalSubmission}>
                <CheckCircle size={15} style={{ marginRight: 6 }} /> Authorize & Submit Return
              </Button>
            </Card>
          )}

          {/* Real-time Progress Log */}
          <Card style={{ padding: 14, flex: 1 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
              Filing Activity Log
            </span>
            <div
              style={{
                height: 220,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                fontFamily: 'monospace',
                fontSize: 11,
              }}
            >
              {logs.length === 0 ? (
                <span style={{ color: 'var(--text-tertiary)' }}>Waiting for session updates...</span>
              ) : (
                logs.map((log, i) => (
                  <div key={i} style={{ color: log.includes('✅') ? '#10b981' : log.includes('🛡️') ? 'var(--accent)' : 'var(--text-secondary)' }}>
                    {log}
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
