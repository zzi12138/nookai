'use client';

import { useState, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

// ─── Constants ──────────────────────────────────────────────────────────────

const STYLES = ['日式原木风', '奶油治愈风', '现代简约风', '轻复古文艺风', '氛围感深色风'] as const;
const BOUNDARIES = ['不动墙面', '不替换家具', '不改动布局', '不改门窗', '不改吊顶', '不增加人工光源'] as const;
const PREFERENCES = ['宠物友好', '社交友好', '收纳优化', '加入绿植', '投影放松'] as const;

type ReviewScore = '' | 'great' | 'ok' | 'bad';
type ReviewBool = '' | 'yes' | 'no';

type TestResult = {
  id: string;
  style: string;
  boundaries: string[];
  preferences: string[];
  status: 'pending' | 'running' | 'done' | 'error';
  imageUrl: string;
  error: string;
  durationMs: number;
  promptSummary: string;
  // Review
  overallScore: ReviewScore;
  styleAccuracy: ReviewBool;
  boundaryCompliance: ReviewBool;
  preferenceReflection: ReviewBool;
  note: string;
  createdAt: string;
};

type SavedTemplate = {
  name: string;
  styles: string[];
  boundaries: string[];
  preferences: string[];
};

const TEMPLATE_STORAGE_KEY = 'nookai-qa-templates';
const RESULT_STORAGE_KEY = 'nookai-qa-results';

// ─── Helpers ────────────────────────────────────────────────────────────────

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function toCSV(results: TestResult[]): string {
  const headers = [
    'testCaseId', 'selectedStyle', 'selectedBoundaries', 'selectedPreferences',
    'status', 'durationMs', 'overallScore', 'styleAccuracy', 'boundaryCompliance',
    'preferenceReflection', 'note', 'imageFile', 'createdAt',
  ];
  const rows = results.map((r) => {
    const imgFile = r.imageUrl ? `${r.id}.png` : '';
    return [
      r.id, r.style, `"${r.boundaries.join(';')}"`, `"${r.preferences.join(';')}"`,
      r.status, r.durationMs, r.overallScore, r.styleAccuracy, r.boundaryCompliance,
      r.preferenceReflection, `"${(r.note || '').replace(/"/g, '""')}"`, imgFile, r.createdAt,
    ].join(',');
  });
  return [headers.join(','), ...rows].join('\n');
}

async function exportZip(results: TestResult[]) {
  // Dynamically import JSZip
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();

  // Add CSV
  zip.file('qa-results.csv', toCSV(results));

  // Add images
  for (const r of results) {
    if (!r.imageUrl) continue;
    // Convert data URL to blob
    const base64 = r.imageUrl.split(',')[1];
    if (base64) {
      zip.file(`${r.id}.png`, base64, { base64: true });
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `qa-results-${Date.now()}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Styles (inline, minimal) ───────────────────────────────────────────────

const S = {
  page: { maxWidth: 1400, margin: '0 auto', padding: '24px 20px', fontFamily: '-apple-system, "PingFang SC", sans-serif', background: '#faf8f5', minHeight: '100vh' } as React.CSSProperties,
  h1: { fontSize: 22, fontWeight: 700, marginBottom: 4, color: '#333' } as React.CSSProperties,
  subtitle: { fontSize: 13, color: '#888', marginBottom: 24 } as React.CSSProperties,
  section: { background: '#fff', borderRadius: 10, padding: 20, marginBottom: 16, border: '1px solid #e8e0d8' } as React.CSSProperties,
  sectionTitle: { fontSize: 14, fontWeight: 700, marginBottom: 12, color: '#52372d' } as React.CSSProperties,
  chipRow: { display: 'flex', flexWrap: 'wrap' as const, gap: 8 },
  chip: (active: boolean) => ({
    padding: '5px 14px', borderRadius: 20, fontSize: 13, cursor: 'pointer', border: '1px solid',
    borderColor: active ? '#8f4d2c' : '#d0c8c0', background: active ? '#8f4d2c' : '#fff',
    color: active ? '#fff' : '#555', transition: 'all .15s', userSelect: 'none' as const,
  }),
  btn: (primary?: boolean) => ({
    padding: '8px 24px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
    border: primary ? 'none' : '1px solid #ccc',
    background: primary ? '#8f4d2c' : '#fff', color: primary ? '#fff' : '#555',
  }),
  btnSmall: (active?: boolean) => ({
    padding: '3px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
    border: '1px solid', borderColor: active ? '#8f4d2c' : '#d0c8c0',
    background: active ? '#8f4d2c' : '#fff', color: active ? '#fff' : '#666',
  }),
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 16 } as React.CSSProperties,
  card: { background: '#fff', borderRadius: 10, border: '1px solid #e8e0d8', overflow: 'hidden' } as React.CSSProperties,
  cardImg: { width: '100%', height: 280, objectFit: 'cover' as const, display: 'block', background: '#f0ebe5' },
  cardBody: { padding: 14 } as React.CSSProperties,
  tag: { display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, background: '#f5efe8', color: '#8f4d2c', marginRight: 4, marginBottom: 4 } as React.CSSProperties,
  textarea: { width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d0c8c0', fontSize: 12, resize: 'vertical' as const, minHeight: 36, fontFamily: 'inherit' } as React.CSSProperties,
  input: { width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d0c8c0', fontSize: 13 } as React.CSSProperties,
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function QAPage() {
  return (
    <Suspense fallback={<div style={{ padding: 60, textAlign: 'center', color: '#999' }}>Loading...</div>}>
      <QAGate />
    </Suspense>
  );
}

function QAGate() {
  const params = useSearchParams();
  const isDev = process.env.NODE_ENV !== 'production';
  const isQA = params.get('qa') === '1' || params.get('debug') === '1';

  if (!isDev && !isQA) {
    return <div style={{ padding: 60, textAlign: 'center', color: '#999' }}>QA Panel — dev only. Add ?qa=1 to access.</div>;
  }

  return <QAPanel />;
}

function QAPanel() {
  // ── Image ──
  const [imageDataUrl, setImageDataUrl] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Selections ──
  const [selStyles, setSelStyles] = useState<Set<string>>(new Set([STYLES[0]]));
  const [selBounds, setSelBounds] = useState<Set<string>>(new Set());
  const [selPrefs, setSelPrefs] = useState<Set<string>>(new Set());

  // ── Results ──
  const [results, setResults] = useState<TestResult[]>(() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem(RESULT_STORAGE_KEY) || '[]'); } catch { return []; }
  });

  // ── Templates ──
  const [templates, setTemplates] = useState<SavedTemplate[]>(() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem(TEMPLATE_STORAGE_KEY) || '[]'); } catch { return []; }
  });
  const [templateName, setTemplateName] = useState('');

  // ── Repeat count ──
  const [repeatCount, setRepeatCount] = useState(1);

  // ── Running state ──
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  // ── Toggle helpers ──
  const toggle = (set: Set<string>, val: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    next.has(val) ? next.delete(val) : next.add(val);
    setter(next);
  };

  // ── Image upload ──
  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImageDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  // ── Save template ──
  const saveTemplate = () => {
    if (!templateName.trim()) return;
    const t: SavedTemplate = {
      name: templateName.trim(),
      styles: [...selStyles],
      boundaries: [...selBounds],
      preferences: [...selPrefs],
    };
    const next = [...templates.filter((x) => x.name !== t.name), t];
    setTemplates(next);
    localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(next));
    setTemplateName('');
  };

  const loadTemplate = (t: SavedTemplate) => {
    setSelStyles(new Set(t.styles));
    setSelBounds(new Set(t.boundaries));
    setSelPrefs(new Set(t.preferences));
  };

  const deleteTemplate = (name: string) => {
    const next = templates.filter((x) => x.name !== name);
    setTemplates(next);
    localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(next));
  };

  // ── Batch generate ──
  const runBatch = async () => {
    if (!imageDataUrl || selStyles.size === 0) return;
    setRunning(true);

    const combos: { style: string; boundaries: string[]; preferences: string[]; round: number }[] = [];
    for (const style of selStyles) {
      for (let round = 1; round <= repeatCount; round++) {
        combos.push({ style, boundaries: [...selBounds], preferences: [...selPrefs], round });
      }
    }

    setProgress({ done: 0, total: combos.length });

    // Create placeholder results
    const newResults: TestResult[] = combos.map((c) => ({
      id: uid(),
      style: c.style,
      boundaries: c.boundaries,
      preferences: c.preferences,
      status: 'pending' as const,
      imageUrl: '',
      error: '',
      durationMs: 0,
      promptSummary: '',
      overallScore: '' as const,
      styleAccuracy: '' as const,
      boundaryCompliance: '' as const,
      preferenceReflection: '' as const,
      note: '',
      createdAt: new Date().toISOString(),
    }));

    setResults((prev) => [...newResults, ...prev]);

    // Run sequentially to avoid rate limits
    for (let i = 0; i < newResults.length; i++) {
      const r = newResults[i];
      const combo = combos[i];

      // Mark running
      setResults((prev) => prev.map((x) => x.id === r.id ? { ...x, status: 'running' as const } : x));

      const t0 = Date.now();
      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: imageDataUrl,
            theme: combo.style,
            constraints: combo.boundaries,
            requirements: combo.preferences,
          }),
        });
        const data = await res.json();
        const elapsed = Date.now() - t0;

        if (data.imageUrl) {
          setResults((prev) => prev.map((x) => x.id === r.id ? {
            ...x,
            status: 'done' as const,
            imageUrl: data.imageUrl,
            durationMs: elapsed,
            promptSummary: `#${combo.round} style=${combo.style} bounds=[${combo.boundaries.join(',')}] prefs=[${combo.preferences.join(',')}]`,
          } : x));
        } else {
          setResults((prev) => prev.map((x) => x.id === r.id ? {
            ...x,
            status: 'error' as const,
            error: data.error || 'Unknown error',
            durationMs: elapsed,
          } : x));
        }
      } catch (err: unknown) {
        setResults((prev) => prev.map((x) => x.id === r.id ? {
          ...x,
          status: 'error' as const,
          error: err instanceof Error ? err.message : 'Network error',
          durationMs: Date.now() - t0,
        } : x));
      }

      setProgress((p) => ({ ...p, done: i + 1 }));
    }

    setRunning(false);
  };

  // ── Persist results on change ──
  const updateResult = (id: string, patch: Partial<TestResult>) => {
    setResults((prev) => {
      const next = prev.map((x) => x.id === id ? { ...x, ...patch } : x);
      try { localStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(next)); } catch { /* */ }
      return next;
    });
  };

  // ── Export ──
  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `qa-results-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    const blob = new Blob([toCSV(results)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `qa-results-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const clearResults = () => {
    setResults([]);
    localStorage.removeItem(RESULT_STORAGE_KEY);
  };

  // ── Render ──
  return (
    <div style={S.page}>
      <h1 style={S.h1}>NookAI QA Panel</h1>
      <div style={S.subtitle}>批量测试生图效果 &middot; 人工验收 &middot; 导出结果</div>

      {/* ── Image Upload ── */}
      <div style={S.section}>
        <div style={S.sectionTitle}>测试图片</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button style={S.btn()} onClick={() => fileRef.current?.click()}>
            {imageDataUrl ? '更换图片' : '上传图片'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
          {imageDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageDataUrl} alt="test" style={{ height: 80, borderRadius: 8, objectFit: 'cover' }} />
          )}
        </div>
      </div>

      {/* ── Style Select ── */}
      <div style={S.section}>
        <div style={S.sectionTitle}>风格（多选）</div>
        <div style={S.chipRow}>
          {STYLES.map((s) => (
            <div key={s} style={S.chip(selStyles.has(s))} onClick={() => toggle(selStyles, s, setSelStyles)}>{s}</div>
          ))}
        </div>
      </div>

      {/* ── Boundary Select ── */}
      <div style={S.section}>
        <div style={S.sectionTitle}>边界约束（多选）</div>
        <div style={S.chipRow}>
          {BOUNDARIES.map((b) => (
            <div key={b} style={S.chip(selBounds.has(b))} onClick={() => toggle(selBounds, b, setSelBounds)}>{b}</div>
          ))}
        </div>
      </div>

      {/* ── Preference Select ── */}
      <div style={S.section}>
        <div style={S.sectionTitle}>偏好（多选）</div>
        <div style={S.chipRow}>
          {PREFERENCES.map((p) => (
            <div key={p} style={S.chip(selPrefs.has(p))} onClick={() => toggle(selPrefs, p, setSelPrefs)}>{p}</div>
          ))}
        </div>
      </div>

      {/* ── Templates ── */}
      <div style={S.section}>
        <div style={S.sectionTitle}>测试模板</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input
            style={{ ...S.input, flex: 1 }}
            placeholder="模板名称"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
          />
          <button style={S.btn()} onClick={saveTemplate}>保存当前</button>
        </div>
        {templates.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {templates.map((t) => (
              <div key={t.name} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <button style={S.btnSmall()} onClick={() => loadTemplate(t)}>{t.name}</button>
                <button style={{ ...S.btnSmall(), color: '#c00', borderColor: '#dcc' }} onClick={() => deleteTemplate(t.name)}>x</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Actions ── */}
      <div style={{ ...S.section, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, color: '#555' }}>每组重复</span>
          <input
            type="number"
            min={1}
            max={10}
            value={repeatCount}
            onChange={(e) => setRepeatCount(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
            style={{ width: 48, padding: '5px 8px', borderRadius: 6, border: '1px solid #d0c8c0', fontSize: 13, textAlign: 'center' as const }}
          />
          <span style={{ fontSize: 13, color: '#555' }}>次</span>
        </div>
        <button
          style={{ ...S.btn(true), opacity: running || !imageDataUrl || selStyles.size === 0 ? 0.5 : 1 }}
          disabled={running || !imageDataUrl || selStyles.size === 0}
          onClick={runBatch}
        >
          {running ? `生成中 ${progress.done}/${progress.total}...` : `批量生成 (${selStyles.size} 风格 × ${repeatCount} 次 = ${selStyles.size * repeatCount} 组)`}
        </button>
        <button style={S.btn()} onClick={exportJSON}>导出 JSON</button>
        <button style={S.btn()} onClick={exportCSV}>导出 CSV</button>
        <button style={S.btn()} onClick={() => exportZip(results)}>导出 ZIP（含图片+评价）</button>
        <button style={{ ...S.btn(), color: '#c00' }} onClick={clearResults}>清空结果</button>
        <span style={{ fontSize: 12, color: '#999' }}>共 {results.length} 条结果</span>
      </div>

      {/* ── Results Grid ── */}
      <div style={S.grid}>
        {results.map((r) => (
          <ResultCard key={r.id} result={r} onUpdate={(patch) => updateResult(r.id, patch)} />
        ))}
      </div>
    </div>
  );
}

// ─── Result Card ────────────────────────────────────────────────────────────

function ResultCard({ result: r, onUpdate }: { result: TestResult; onUpdate: (p: Partial<TestResult>) => void }) {
  const [showPrompt, setShowPrompt] = useState(false);

  const statusColor = r.status === 'done' ? '#2a8' : r.status === 'error' ? '#c33' : r.status === 'running' ? '#e90' : '#999';
  const statusText = r.status === 'done' ? `${(r.durationMs / 1000).toFixed(1)}s` : r.status === 'error' ? 'Error' : r.status === 'running' ? 'Running...' : 'Pending';

  return (
    <div style={S.card}>
      {/* Image */}
      {r.status === 'done' && r.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={r.imageUrl} alt={r.style} style={S.cardImg} />
      ) : (
        <div style={{ ...S.cardImg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#999' }}>
          {r.status === 'running' && <span>生成中...</span>}
          {r.status === 'pending' && <span>等待中</span>}
          {r.status === 'error' && <span style={{ color: '#c33', padding: 12 }}>{r.error}</span>}
        </div>
      )}

      <div style={S.cardBody}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#333' }}>{r.style}</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: statusColor }}>{statusText}</span>
        </div>

        {/* Tags */}
        <div style={{ marginBottom: 8 }}>
          {r.boundaries.map((b) => <span key={b} style={S.tag}>{b}</span>)}
          {r.preferences.map((p) => <span key={p} style={{ ...S.tag, background: '#e8f0e5', color: '#3a6' }}>{p}</span>)}
        </div>

        {/* Prompt toggle */}
        {r.promptSummary && (
          <div style={{ marginBottom: 8 }}>
            <button style={{ ...S.btnSmall(), fontSize: 10 }} onClick={() => setShowPrompt(!showPrompt)}>
              {showPrompt ? '收起 Prompt' : '展开 Prompt'}
            </button>
            {showPrompt && (
              <pre style={{ marginTop: 6, padding: 8, background: '#f8f5f0', borderRadius: 6, fontSize: 10, whiteSpace: 'pre-wrap', color: '#666', maxHeight: 120, overflow: 'auto' }}>
                {r.promptSummary}
              </pre>
            )}
          </div>
        )}

        {/* Review: Overall */}
        <div style={{ marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: '#888', marginRight: 8 }}>整体：</span>
          {(['great', 'ok', 'bad'] as ReviewScore[]).map((v) => (
            <button key={v} style={S.btnSmall(r.overallScore === v)} onClick={() => onUpdate({ overallScore: v })}>
              {v === 'great' ? '惊艳 ✅' : v === 'ok' ? '一般' : '不行'}
            </button>
          ))}
        </div>

        {/* Review: Style accuracy */}
        <div style={{ marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: '#888', marginRight: 8 }}>风格：</span>
          {(['yes', 'no'] as ReviewBool[]).map((v) => (
            <button key={v} style={S.btnSmall(r.styleAccuracy === v)} onClick={() => onUpdate({ styleAccuracy: v })}>
              {v === 'yes' ? '准确 ✅' : '偏差'}
            </button>
          ))}
        </div>

        {/* Review: Boundary */}
        <div style={{ marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: '#888', marginRight: 8 }}>约束：</span>
          {(['yes', 'no'] as ReviewBool[]).map((v) => (
            <button key={v} style={S.btnSmall(r.boundaryCompliance === v)} onClick={() => onUpdate({ boundaryCompliance: v })}>
              {v === 'yes' ? '遵守 ✅' : '违规'}
            </button>
          ))}
        </div>

        {/* Review: Preference */}
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: '#888', marginRight: 8 }}>偏好：</span>
          {(['yes', 'no'] as ReviewBool[]).map((v) => (
            <button key={v} style={S.btnSmall(r.preferenceReflection === v)} onClick={() => onUpdate({ preferenceReflection: v })}>
              {v === 'yes' ? '体现 ✅' : '不明显'}
            </button>
          ))}
        </div>

        {/* Note */}
        <textarea
          style={S.textarea}
          placeholder="验收备注..."
          value={r.note}
          onChange={(e) => onUpdate({ note: e.target.value })}
        />
      </div>
    </div>
  );
}
