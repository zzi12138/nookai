'use client';

import React from 'react';

// ─── Brand Logo SVG ────────────────────────────────────────────────────────────
export function NookLogo({ size = 48 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
    >
      {/* Floor lamp — pole */}
      <line x1="79" y1="22" x2="79" y2="62" stroke="#52372d" strokeWidth="3.5" strokeLinecap="round" />
      {/* Floor lamp — base */}
      <ellipse cx="79" cy="64" rx="8" ry="3" fill="#52372d" />
      {/* Floor lamp — arc arm */}
      <path d="M79 22 C79 11 70 8 63 11" stroke="#52372d" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      {/* Glow dots */}
      <circle cx="59" cy="14" r="4" fill="#c97a52" opacity="0.9" />
      <circle cx="53" cy="20" r="2.8" fill="#c97a52" opacity="0.65" />
      <circle cx="55" cy="8"  r="2"   fill="#c97a52" opacity="0.45" />

      {/* Armchair — back */}
      <path
        d="M14 42 C14 25 26 19 44 19 C62 19 72 25 72 42 L72 52 C72 56 68 58 64 58 L24 58 C20 58 14 56 14 52 Z"
        fill="#8f4d2c"
      />
      {/* Armchair — left arm */}
      <rect x="10" y="38" width="11" height="21" rx="5.5" fill="#72381f" />
      {/* Armchair — right arm */}
      <rect x="67" y="38" width="11" height="21" rx="5.5" fill="#72381f" />
      {/* Armchair — seat */}
      <ellipse cx="44" cy="58" rx="25" ry="8.5" fill="#72381f" />
      {/* Armchair — seat highlight */}
      <ellipse cx="44" cy="55" rx="17" ry="5.5" fill="#b86040" opacity="0.35" />
      {/* Armchair — back cushion ring */}
      <ellipse cx="44" cy="37" rx="15" ry="11" fill="none" stroke="#f0dece" strokeWidth="2" opacity="0.5" />
      {/* Armchair — legs */}
      <rect x="22" y="64" width="7" height="10" rx="3.5" fill="#52372d" />
      <rect x="59" y="64" width="7" height="10" rx="3.5" fill="#52372d" />
    </svg>
  );
}

// ─── Types ─────────────────────────────────────────────────────────────────────
export type ExportItem = {
  id: number;
  name: string;
  priceRange: string;
  priceMin: number;
  priceMax: number;
  category: string;
  categoryLabel: string;
  necessity: string;
  necessityLabel: string;
  placement: string;
  quantity: number;
  previewImage?: string;
};

type Props = {
  theme: string;
  before: string;
  after: string;
  summary: string;
  items: ExportItem[];
  previewImages: Record<number, string>;
  budgetMin: number;
  budgetMax: number;
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
const COLS = 4;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Page dimensions (px, @1x — html2canvas will scale ×2)
const W = 1080;

// ─── Shared section title ──────────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
      <div style={{ width: 3, height: 16, borderRadius: 2, background: '#8f4d2c' }} />
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, color: '#8f4d2c', textTransform: 'uppercase' as const }}>
        {children}
      </span>
    </div>
  );
}

// ─── Page header (appears at top of every page) ────────────────────────────────
function PageHeader({ theme, date }: { theme: string; date: string }) {
  return (
    <div
      style={{
        width: W,
        background: '#52372d',
        padding: '28px 52px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxSizing: 'border-box' as const,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ background: '#fff8f2', borderRadius: 12, padding: 6 }}>
          <NookLogo size={36} />
        </div>
        <div>
          <div style={{ color: '#fff8f2', fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>NookAI</div>
          <div style={{ color: '#c9b8aa', fontSize: 12, marginTop: 1 }}>出租屋软装改造方案</div>
        </div>
      </div>
      <div style={{ textAlign: 'right' as const }}>
        <div style={{ color: '#f1e7d9', fontSize: 14, fontWeight: 600 }}>{theme}</div>
        <div style={{ color: '#c9b8aa', fontSize: 12, marginTop: 2 }}>{date}</div>
      </div>
    </div>
  );
}

// ─── Page footer (appears at bottom of every page) ────────────────────────────
function PageFooter({ budgetMin, budgetMax }: { budgetMin: number; budgetMax: number }) {
  return (
    <div
      style={{
        width: W,
        background: '#f1e7d9',
        padding: '20px 52px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxSizing: 'border-box' as const,
        borderTop: '1px solid #e0d0c0',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <NookLogo size={28} />
        <span style={{ color: '#52372d', fontWeight: 800, fontSize: 16, letterSpacing: -0.3 }}>nook</span>
      </div>
      <div style={{ color: '#827470', fontSize: 12 }}>由 NookAI 智能生成 · nookai.app</div>
      {budgetMax > 0 ? (
        <div style={{ textAlign: 'right' as const }}>
          <div style={{ color: '#827470', fontSize: 11 }}>预计总预算</div>
          <div style={{ color: '#52372d', fontSize: 18, fontWeight: 800 }}>¥{budgetMin}–{budgetMax}</div>
        </div>
      ) : (
        <div />
      )}
    </div>
  );
}

// ─── Item card ─────────────────────────────────────────────────────────────────
function ItemCard({ item, previewImages }: { item: ExportItem; previewImages: Record<number, string> }) {
  const imgSrc = item.previewImage || previewImages[item.id] || '';
  const necessityColor: Record<string, string> = {
    'Must-have': '#7a3f25',
    Recommended: '#8f4d2c',
    Optional: '#b8a8a2',
  };

  return (
    <div
      style={{
        background: 'white',
        borderRadius: 14,
        overflow: 'hidden',
        border: '1px solid #e8ddd4',
        display: 'flex',
        flexDirection: 'column' as const,
      }}
    >
      {/* Preview */}
      <div style={{ height: 130, background: '#fcf2e4', overflow: 'hidden', position: 'relative' as const }}>
        {imgSrc ? (
          <img src={imgSrc} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' as const, display: 'block' }} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#c9b8aa', fontSize: 12 }}>
            软装预览
          </div>
        )}
        {/* Necessity badge */}
        <div
          style={{
            position: 'absolute' as const,
            top: 8,
            right: 8,
            background: necessityColor[item.necessity] || '#8f4d2c',
            color: 'white',
            fontSize: 10,
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 20,
          }}
        >
          {item.necessityLabel}
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: '10px 13px 12px', flex: 1, display: 'flex', flexDirection: 'column' as const, gap: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1f1b13', lineHeight: 1.3 }}>{item.name}</div>
        <div style={{ fontSize: 13, color: '#8f4d2c', fontWeight: 700 }}>{item.priceRange}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <span style={{ fontSize: 10, background: '#f1e7d9', color: '#52372d', padding: '2px 7px', borderRadius: 10, fontWeight: 600 }}>
            {item.categoryLabel}
          </span>
          {item.quantity > 1 && (
            <span style={{ fontSize: 10, color: '#827470' }}>×{item.quantity}</span>
          )}
        </div>
        {item.placement && (
          <div style={{ fontSize: 11, color: '#827470', marginTop: 2 }}>{item.placement}</div>
        )}
      </div>
    </div>
  );
}

// ─── Page 1: Cover (header + before/after + summary) ──────────────────────────
function CoverPage({ theme, date, before, after, summary }: {
  theme: string; date: string; before: string; after: string; summary: string;
}) {
  return (
    <div style={{ width: W, background: '#fff8f2', boxSizing: 'border-box' as const }}>
      <PageHeader theme={theme} date={date} />

      {/* Before / After */}
      <div style={{ padding: '40px 52px 32px', boxSizing: 'border-box' as const }}>
        <SectionTitle>改造对比 / Before &amp; After</SectionTitle>
        <div style={{ display: 'flex', gap: 14, borderRadius: 16, overflow: 'hidden' }}>
          {/* Before */}
          <div style={{ flex: 1, position: 'relative' as const, borderRadius: 14, overflow: 'hidden' }}>
            <img src={before} alt="改造前" style={{ width: '100%', height: 310, objectFit: 'cover' as const, display: 'block' }} />
            <div style={{
              position: 'absolute' as const, bottom: 12, left: 12,
              background: 'rgba(30,20,10,0.55)', color: 'white',
              padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, letterSpacing: 1,
            }}>
              BEFORE
            </div>
          </div>
          {/* After */}
          <div style={{ flex: 1, position: 'relative' as const, borderRadius: 14, overflow: 'hidden' }}>
            <img src={after} alt="改造后" style={{ width: '100%', height: 310, objectFit: 'cover' as const, display: 'block' }} />
            <div style={{
              position: 'absolute' as const, bottom: 12, left: 12,
              background: 'rgba(82,55,45,0.75)', color: 'white',
              padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, letterSpacing: 1,
            }}>
              AFTER
            </div>
          </div>
        </div>

        {/* Summary */}
        {summary && (
          <div style={{
            marginTop: 20, padding: '16px 20px', background: '#f7edde',
            borderRadius: 12, borderLeft: '3px solid #8f4d2c',
            fontSize: 13, color: '#504440', lineHeight: 1.7,
          }}>
            {summary}
          </div>
        )}
      </div>

      <PageFooter budgetMin={0} budgetMax={0} />
    </div>
  );
}

// ─── Page N: Items page ────────────────────────────────────────────────────────
function ItemsPage({
  theme, date, pageIndex, totalPages, rows, previewImages, budgetMin, budgetMax,
}: {
  theme: string;
  date: string;
  pageIndex: number;
  totalPages: number;
  rows: ExportItem[][];
  previewImages: Record<number, string>;
  budgetMin: number;
  budgetMax: number;
}) {
  const colWidth = Math.floor((W - 104 - (COLS - 1) * 14) / COLS); // 52px padding × 2, 14px gap

  return (
    <div style={{ width: W, background: '#fff8f2', boxSizing: 'border-box' as const }}>
      <PageHeader theme={theme} date={date} />

      <div style={{ padding: '36px 52px 32px', boxSizing: 'border-box' as const }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <SectionTitle>改造购物清单 / Shopping Guide</SectionTitle>
          <span style={{ fontSize: 11, color: '#827470' }}>第 {pageIndex} / {totalPages} 页</span>
        </div>

        {/* Item grid */}
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 14 }}>
          {rows.map((row, ri) => (
            <div key={ri} style={{ display: 'flex', gap: 14 }}>
              {row.map((item) => (
                <div key={item.id} style={{ width: colWidth, flexShrink: 0 }}>
                  <ItemCard item={item} previewImages={previewImages} />
                </div>
              ))}
              {/* Fill empty cells */}
              {Array.from({ length: COLS - row.length }).map((_, i) => (
                <div key={`empty-${i}`} style={{ width: colWidth, flexShrink: 0 }} />
              ))}
            </div>
          ))}
        </div>
      </div>

      <PageFooter budgetMin={budgetMin} budgetMax={budgetMax} />
    </div>
  );
}

// ─── Main export card ──────────────────────────────────────────────────────────
export function ExportCard({ theme, before, after, summary, items, previewImages, budgetMin, budgetMax }: Props) {
  const date = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
  const itemRows = chunk(items, COLS);

  // Split items into pages of 8 (2 rows × 4 cols)
  const ROWS_PER_PAGE = 2;
  const rowPages = chunk(itemRows, ROWS_PER_PAGE);
  const totalItemPages = rowPages.length;

  return (
    <div style={{ width: W, display: 'inline-flex', flexDirection: 'column' as const, gap: 0 }}>
      {/* Cover page */}
      <CoverPage theme={theme} date={date} before={before} after={after} summary={summary} />

      {/* Divider between pages */}
      {items.length > 0 && <div style={{ height: 8, background: '#e8ddd4' }} />}

      {/* Item pages */}
      {rowPages.map((rows, pi) => (
        <React.Fragment key={pi}>
          <ItemsPage
            theme={theme}
            date={date}
            pageIndex={pi + 1}
            totalPages={totalItemPages}
            rows={rows}
            previewImages={previewImages}
            budgetMin={budgetMin}
            budgetMax={budgetMax}
          />
          {pi < rowPages.length - 1 && <div style={{ height: 8, background: '#e8ddd4' }} />}
        </React.Fragment>
      ))}
    </div>
  );
}
