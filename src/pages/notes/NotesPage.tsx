import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus, Search, Pin, Trash2, NotebookPen,
  Bold, Italic, List, ListOrdered, Heading1, Heading2,
  CheckCircle, AlertCircle, Loader2, ChevronLeft
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { BusinessNote } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useMobile } from '../../hooks/useMobile';
import { format, formatDistanceToNow } from 'date-fns';

// ─── helpers ───────────────────────────────────────────────────────────────

function htmlToPlainText(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim();
}

function formatTimestamp(iso: string) {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    if (diffMs < 60_000) return 'just now';
    if (diffMs < 86_400_000) return formatDistanceToNow(d, { addSuffix: true });
    return format(d, 'd MMM yyyy');
  } catch {
    return '';
  }
}

// ─── Empty state ────────────────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', flex: 1, gap: 16, padding: 40, textAlign: 'center'
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: 20,
        background: 'var(--accent-primary)', opacity: 0.12,
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <NotebookPen size={36} style={{ color: 'var(--accent-primary)', opacity: 1 }} />
      </div>
      <div>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>
          No notes yet
        </h3>
        <p style={{ margin: '8px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>
          Create your first note to capture ideas, plans, or anything you need to remember.
        </p>
      </div>
      <button
        onClick={onNew}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 20px', borderRadius: 8, border: 'none',
          background: 'var(--accent-primary)', color: '#fff',
          fontSize: 14, fontWeight: 600, cursor: 'pointer'
        }}
      >
        <Plus size={16} /> New Note
      </button>
    </div>
  );
}

// ─── Toolbar button ──────────────────────────────────────────────────────────

function ToolBtn({
  onClick, title, children, active
}: {
  onClick: () => void; title: string; children: React.ReactNode; active?: boolean;
}) {
  return (
    <button
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      title={title}
      style={{
        width: 32, height: 32, border: 'none', borderRadius: 6, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active ? 'var(--accent-primary)' : 'transparent',
        color: active ? '#fff' : 'var(--text-muted)',
        transition: 'background 0.15s, color 0.15s'
      }}
    >
      {children}
    </button>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function NotesPage() {
  const { user } = useAuth();
  const isMobile = useMobile(1024);

  const [notes, setNotes] = useState<BusinessNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<BusinessNote | null>(null);
  const [search, setSearch] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false); // mobile: toggle between list and editor

  const editorRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedRef = useRef<BusinessNote | null>(null);
  selectedRef.current = selected;

  // ── Load notes ───────────────────────────────────────────────────────────

  async function loadNotes() {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('business_notes')
      .select('*')
      .eq('user_id', user.id)
      .order('is_pinned', { ascending: false })
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Notes load error:', error);
    } else {
      setNotes(data as BusinessNote[]);
    }
    setLoading(false);
  }

  useEffect(() => { loadNotes(); }, [user]);

  // ── Populate editor when selected note changes ───────────────────────────

  useEffect(() => {
    if (!selected) {
      if (editorRef.current) editorRef.current.innerHTML = '';
      if (titleRef.current) titleRef.current.value = '';
      return;
    }
    if (titleRef.current) titleRef.current.value = selected.title;
    if (editorRef.current) editorRef.current.innerHTML = selected.content_html || '';
  }, [selected?.id]);

  // ── Auto-save (debounced 800ms) ──────────────────────────────────────────

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus('saving');
    saveTimer.current = setTimeout(() => { doSave(); }, 800);
  }, []);

  async function doSave() {
    const note = selectedRef.current;
    if (!note || !user) return;
    const title = titleRef.current?.value ?? '';
    const content_html = editorRef.current?.innerHTML ?? '';
    const content = htmlToPlainText(content_html);
    const updated_at = new Date().toISOString();

    const { error } = await supabase
      .from('business_notes')
      .update({ title, content, content_html, updated_at })
      .eq('id', note.id);

    if (error) {
      console.error('Save error:', error);
      setSaveStatus('error');
    } else {
      setSaveStatus('saved');
      setNotes(prev =>
        prev.map(n => n.id === note.id ? { ...n, title, content, content_html, updated_at } : n)
      );
      selectedRef.current = { ...note, title, content, content_html, updated_at };
      setSelected(s => s ? { ...s, title, content, content_html, updated_at } : s);
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  }

  // ── Create note ──────────────────────────────────────────────────────────

  async function createNote() {
    if (!user) return;
    const { data, error } = await supabase
      .from('business_notes')
      .insert({
        user_id: user.id,
        title: '',
        content: '',
        content_html: '',
        is_pinned: false,
        color: 'default',
        tags: []
      })
      .select()
      .single();

    if (error) { console.error('Create note error:', error); return; }
    const newNote = data as BusinessNote;
    setNotes(prev => [newNote, ...prev]);
    setSelected(newNote);
    setShowEditor(true);
    setTimeout(() => titleRef.current?.focus(), 50);
  }

  // ── Delete note ──────────────────────────────────────────────────────────

  async function deleteNote(id: string) {
    const { error } = await supabase.from('business_notes').delete().eq('id', id);
    if (error) { console.error('Delete error:', error); return; }
    setNotes(prev => prev.filter(n => n.id !== id));
    if (selected?.id === id) { setSelected(null); setShowEditor(false); }
    setDeleteConfirm(null);
  }

  // ── Pin toggle ───────────────────────────────────────────────────────────

  async function togglePin(note: BusinessNote) {
    const is_pinned = !note.is_pinned;
    const { error } = await supabase
      .from('business_notes')
      .update({ is_pinned })
      .eq('id', note.id);
    if (error) { console.error('Pin error:', error); return; }
    setNotes(prev =>
      [...prev.map(n => n.id === note.id ? { ...n, is_pinned } : n)]
        .sort((a, b) => {
          if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        })
    );
    if (selected?.id === note.id) setSelected(s => s ? { ...s, is_pinned } : s);
  }

  // ── Rich-text commands ───────────────────────────────────────────────────

  function exec(cmd: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
    scheduleSave();
  }

  // ── Filtered notes ───────────────────────────────────────────────────────

  const filtered = notes.filter(n => {
    if (!search) return true;
    const q = search.toLowerCase();
    return n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q);
  });

  const pinned = filtered.filter(n => n.is_pinned);
  const unpinned = filtered.filter(n => !n.is_pinned);

  // ─── Shared styles ────────────────────────────────────────────────────────

  const panelStyle: React.CSSProperties = {
    background: 'var(--bg-card)',
    borderRadius: 12,
    border: '1px solid var(--bg-border)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  };

  // ─── Note card ─────────────────────────────────────────────────────────────

  function NoteCard({ note }: { note: BusinessNote }) {
    const isActive = selected?.id === note.id;
    return (
      <div
        onClick={() => { setSelected(note); setShowEditor(true); setSaveStatus('idle'); }}
        style={{
          padding: '12px 14px',
          borderRadius: 8,
          cursor: 'pointer',
          background: isActive ? 'var(--accent-primary)' : 'transparent',
          transition: 'background 0.15s',
          position: 'relative'
        }}
        onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'; }}
        onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              margin: 0, fontWeight: 600, fontSize: 14,
              color: isActive ? '#fff' : 'var(--text-primary)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
            }}>
              {note.title || 'Untitled'}
            </p>
            <p style={{
              margin: '4px 0 0', fontSize: 12,
              color: isActive ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)',
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              overflow: 'hidden', lineHeight: 1.4
            }}>
              {note.content || 'No content'}
            </p>
            <p style={{
              margin: '6px 0 0', fontSize: 11,
              color: isActive ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)'
            }}>
              {formatTimestamp(note.updated_at)}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
            <button
              onClick={e => { e.stopPropagation(); togglePin(note); }}
              title={note.is_pinned ? 'Unpin' : 'Pin'}
              style={{
                width: 26, height: 26, border: 'none', borderRadius: 4,
                background: 'transparent', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: note.is_pinned
                  ? (isActive ? '#fff' : 'var(--accent-primary)')
                  : (isActive ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)')
              }}
            >
              <Pin size={13} fill={note.is_pinned ? 'currentColor' : 'none'} />
            </button>
            <button
              onClick={e => { e.stopPropagation(); setDeleteConfirm(note.id); }}
              title="Delete"
              style={{
                width: 26, height: 26, border: 'none', borderRadius: 4,
                background: 'transparent', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: isActive ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)'
              }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── List panel ────────────────────────────────────────────────────────────

  const ListPanel = (
    <div style={{ ...panelStyle, flex: isMobile ? 1 : '0 0 300px', minWidth: 0 }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--bg-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Notes Pad</h2>
          <button
            onClick={createNote}
            title="New note"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 12px', borderRadius: 8, border: 'none',
              background: 'var(--accent-primary)', color: '#fff',
              fontSize: 13, fontWeight: 600, cursor: 'pointer'
            }}
          >
            <Plus size={14} /> New
          </button>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 10px', borderRadius: 8,
          background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)'
        }}>
          <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search notes…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex: 1, border: 'none', background: 'transparent', outline: 'none',
              fontSize: 13, color: 'var(--text-primary)'
            }}
          />
        </div>
      </div>

      {/* Note list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
            <Loader2 size={22} style={{ color: 'var(--text-muted)', animation: 'spin 1s linear infinite' }} />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState onNew={createNote} />
        ) : (
          <>
            {pinned.length > 0 && (
              <>
                <p style={{ margin: '4px 6px 2px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Pinned
                </p>
                {pinned.map(n => <NoteCard key={n.id} note={n} />)}
                {unpinned.length > 0 && (
                  <p style={{ margin: '10px 6px 2px', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    All Notes
                  </p>
                )}
              </>
            )}
            {unpinned.map(n => <NoteCard key={n.id} note={n} />)}
          </>
        )}
      </div>
    </div>
  );

  // ─── Editor panel ───────────────────────────────────────────────────────────

  const EditorPanel = (
    <div style={{ ...panelStyle, flex: 1, minWidth: 0 }}>
      {selected ? (
        <>
          {/* Editor header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', borderBottom: '1px solid var(--bg-border)', gap: 8, flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
              {isMobile && (
                <button
                  onClick={() => setShowEditor(false)}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4 }}
                >
                  <ChevronLeft size={18} />
                </button>
              )}
              {/* Formatting toolbar */}
              <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <ToolBtn onClick={() => exec('bold')} title="Bold (Ctrl+B)"><Bold size={14} /></ToolBtn>
                <ToolBtn onClick={() => exec('italic')} title="Italic (Ctrl+I)"><Italic size={14} /></ToolBtn>
                <div style={{ width: 1, background: 'var(--bg-border)', margin: '4px 2px', alignSelf: 'stretch' }} />
                <ToolBtn onClick={() => exec('formatBlock', 'h1')} title="Heading 1"><Heading1 size={14} /></ToolBtn>
                <ToolBtn onClick={() => exec('formatBlock', 'h2')} title="Heading 2"><Heading2 size={14} /></ToolBtn>
                <div style={{ width: 1, background: 'var(--bg-border)', margin: '4px 2px', alignSelf: 'stretch' }} />
                <ToolBtn onClick={() => exec('insertUnorderedList')} title="Bullet list"><List size={14} /></ToolBtn>
                <ToolBtn onClick={() => exec('insertOrderedList')} title="Numbered list"><ListOrdered size={14} /></ToolBtn>
              </div>
            </div>
            {/* Save status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              {saveStatus === 'saving' && (
                <><Loader2 size={13} style={{ color: 'var(--text-muted)', animation: 'spin 1s linear infinite' }} />
                <span style={{ color: 'var(--text-muted)' }}>Saving…</span></>
              )}
              {saveStatus === 'saved' && (
                <><CheckCircle size={13} style={{ color: 'var(--success)' }} />
                <span style={{ color: 'var(--success)' }}>Saved</span></>
              )}
              {saveStatus === 'error' && (
                <><AlertCircle size={13} style={{ color: 'var(--error)' }} />
                <span style={{ color: 'var(--error)' }}>Error saving</span></>
              )}
            </div>
          </div>

          {/* Title input */}
          <input
            ref={titleRef}
            type="text"
            placeholder="Note title…"
            defaultValue={selected.title}
            onChange={scheduleSave}
            style={{
              width: '100%', border: 'none', borderBottom: '1px solid var(--bg-border)',
              background: 'transparent', outline: 'none', padding: '14px 20px',
              fontSize: 20, fontWeight: 700, color: 'var(--text-primary)',
              boxSizing: 'border-box'
            }}
          />

          {/* Rich text editor */}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={scheduleSave}
            style={{
              flex: 1, padding: '16px 20px', outline: 'none', overflowY: 'auto',
              color: 'var(--text-primary)', fontSize: 15, lineHeight: 1.7,
              minHeight: 300
            }}
            data-placeholder="Start writing…"
          />

          {/* Created timestamp */}
          <div style={{
            padding: '8px 20px', borderTop: '1px solid var(--bg-border)',
            fontSize: 11, color: 'var(--text-muted)'
          }}>
            Created {format(new Date(selected.created_at), "d MMM yyyy 'at' HH:mm")}
          </div>
        </>
      ) : (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 12, opacity: 0.5
        }}>
          <NotebookPen size={40} style={{ color: 'var(--text-muted)' }} />
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 14 }}>
            Select a note or create a new one
          </p>
        </div>
      )}
    </div>
  );

  // ─── Delete confirm modal ───────────────────────────────────────────────────

  const DeleteModal = deleteConfirm && (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div style={{
        background: 'var(--bg-card)', borderRadius: 12, padding: 28,
        maxWidth: 360, width: '90%', border: '1px solid var(--bg-border)'
      }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
          Delete note?
        </h3>
        <p style={{ margin: '0 0 20px', color: 'var(--text-muted)', fontSize: 14 }}>
          This action cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={() => setDeleteConfirm(null)}
            style={{
              padding: '8px 16px', borderRadius: 8, border: '1px solid var(--bg-border)',
              background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 14
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => deleteNote(deleteConfirm)}
            style={{
              padding: '8px 16px', borderRadius: 8, border: 'none',
              background: 'var(--error)', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: var(--text-muted);
          pointer-events: none;
        }
        [contenteditable] h1 { font-size: 1.5em; margin: 0.5em 0; }
        [contenteditable] h2 { font-size: 1.25em; margin: 0.5em 0; }
        [contenteditable] ul, [contenteditable] ol { padding-left: 1.5em; margin: 0.4em 0; }
        [contenteditable] li { margin: 0.2em 0; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      <div style={{
        display: 'flex', flexDirection: 'column',
        height: '100%', padding: '20px', gap: 16, boxSizing: 'border-box',
        maxWidth: 1300, margin: '0 auto', width: '100%'
      }}>
        {/* Page title */}
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>
            Notes Pad
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>
            Capture and organise your business ideas and notes.
          </p>
        </div>

        {/* Two-panel layout */}
        <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>
          {isMobile ? (
            showEditor ? EditorPanel : ListPanel
          ) : (
            <>{ListPanel}{EditorPanel}</>
          )}
        </div>
      </div>

      {DeleteModal}
    </>
  );
}
