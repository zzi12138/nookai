'use client';

import React from 'react';

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
const W = 1080;
const PAD = 52;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ─── Item card ─────────────────────────────────────────────────────────────────
function ItemCard({ item, previewImages }: { item: ExportItem; previewImages: Record<number, string> }) {
  const imgSrc = item.previewImage || previewImages[item.id] || '';

  const necessityColor: Record<string, string> = {
    'Must-have': '#ad3b2f',
    Recommended: '#9a6b16',
    Optional: '#827470',
  };
  const necessityBg: Record<string, string> = {
    'Must-have': '#ffe2de',
    Recommended: '#fff0d8',
    Optional: '#f5ede5',
  };

  return (
    <div style={{
      background: 'white',
      borderRadius: 12,
      overflow: 'hidden',
      border: '1px solid #e8ddd4',
      display: 'flex',
      flexDirection: 'column' as const,
    }}>
      {/* Preview */}
      <div style={{ height: 120, background: '#fcf2e4', overflow: 'hidden', position: 'relative' as const }}>
        {imgSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imgSrc} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' as const, display: 'block' }} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#c9b8aa', fontSize: 11 }}>
            软装预览
          </div>
        )}
        <div style={{
          position: 'absolute' as const,
          top: 7, right: 7,
          background: necessityBg[item.necessity] || '#f5ede5',
          color: necessityColor[item.necessity] || '#827470',
          fontSize: 10, fontWeight: 700,
          padding: '2px 7px', borderRadius: 20,
        }}>
          {item.necessityLabel}
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: '9px 12px 11px', display: 'flex', flexDirection: 'column' as const, gap: 3 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1f1b13', lineHeight: 1.3 }}>{item.name}</div>
        <div style={{ fontSize: 13, color: '#8f4d2c', fontWeight: 700 }}>{item.priceRange}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
          <span style={{ fontSize: 10, background: '#f1e7d9', color: '#52372d', padding: '2px 6px', borderRadius: 8, fontWeight: 600 }}>
            {item.categoryLabel}
          </span>
          {item.quantity > 1 && (
            <span style={{ fontSize: 10, color: '#827470' }}>×{item.quantity}</span>
          )}
        </div>
        {item.placement && (
          <div style={{ fontSize: 10, color: '#9e8f8b', marginTop: 1 }}>{item.placement}</div>
        )}
      </div>
    </div>
  );
}

// ─── Single-page export card ───────────────────────────────────────────────────
export function ExportCard({ theme, before, after, summary, items, previewImages, budgetMin, budgetMax }: Props) {
  const date = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
  const COLS = Math.min(4, Math.max(1, items.length <= 3 ? items.length : 4));
  const colWidth = Math.floor((W - PAD * 2 - (COLS - 1) * 12) / COLS);
  const rows = chunk(items, COLS);

  return (
    <div style={{
      width: W,
      background: '#fff8f2',
      display: 'flex',
      flexDirection: 'column' as const,
      fontFamily: '-apple-system, "PingFang SC", "Hiragino Sans GB", sans-serif',
    }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        background: '#52372d',
        padding: '22px 52px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxSizing: 'border-box' as const,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: '#fff8f2', borderRadius: 10, padding: '5px 10px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="nook" style={{ height: 30, width: 'auto', display: 'block' }} />
          </div>
          <span style={{ color: '#c9b8aa', fontSize: 12 }}>出租屋软装改造方案</span>
        </div>
        <div style={{ textAlign: 'right' as const }}>
          <div style={{ color: '#f1e7d9', fontSize: 14, fontWeight: 600 }}>{theme}</div>
          <div style={{ color: '#c9b8aa', fontSize: 12, marginTop: 2 }}>{date}</div>
        </div>
      </div>

      {/* ── Before / After ─────────────────────────────────────────────────── */}
      <div style={{ padding: '24px 52px 0', boxSizing: 'border-box' as const }}>
        {/* Section label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ width: 3, height: 14, borderRadius: 2, background: '#8f4d2c' }} />
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, color: '#8f4d2c', textTransform: 'uppercase' as const }}>
            改造对比 / Before &amp; After
          </span>
        </div>

        {/* Images row */}
        <div style={{ display: 'flex', gap: 14 }}>
          <div style={{ flex: 1, position: 'relative' as const, borderRadius: 12, overflow: 'hidden' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={before} alt="改造前" style={{ width: '100%', height: 260, objectFit: 'cover' as const, display: 'block' }} />
            <div style={{
              position: 'absolute' as const, bottom: 10, left: 10,
              background: 'rgba(30,20,10,0.55)', color: 'white',
              padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: 1,
            }}>BEFORE</div>
          </div>
          <div style={{ flex: 1, position: 'relative' as const, borderRadius: 12, overflow: 'hidden' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={after} alt="改造后" style={{ width: '100%', height: 260, objectFit: 'cover' as const, display: 'block' }} />
            <div style={{
              position: 'absolute' as const, bottom: 10, left: 10,
              background: 'rgba(82,55,45,0.75)', color: 'white',
              padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: 1,
            }}>AFTER</div>
          </div>
        </div>

        {/* Summary + budget bar */}
        {(summary || budgetMax > 0) && (
          <div style={{
            marginTop: 14,
            padding: '14px 20px',
            background: '#f7edde',
            borderRadius: 10,
            borderLeft: '3px solid #8f4d2c',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 20,
          }}>
            {summary && (
              <div style={{ fontSize: 13, color: '#504440', lineHeight: 1.7, flex: 1 }}>{summary}</div>
            )}
            {budgetMax > 0 && (
              <div style={{ flexShrink: 0, textAlign: 'right' as const }}>
                <div style={{ color: '#827470', fontSize: 11 }}>购物车预算</div>
                <div style={{ color: '#52372d', fontSize: 22, fontWeight: 800, lineHeight: 1.2 }}>
                  ¥{budgetMin}–{budgetMax}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Shopping list ───────────────────────────────────────────────────── */}
      {items.length > 0 && (
        <div style={{ padding: '0 52px 28px', boxSizing: 'border-box' as const }}>
          {/* Section label */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            borderTop: '1px solid #e0d0c0',
            marginTop: 16, paddingTop: 14, marginBottom: 12,
          }}>
            <div style={{ width: 3, height: 14, borderRadius: 2, background: '#8f4d2c' }} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, color: '#8f4d2c', textTransform: 'uppercase' as const }}>
              购物清单 / Shopping List
            </span>
            <span style={{ color: '#827470', fontSize: 12, marginLeft: 'auto' }}>
              {items.length} 件单品
            </span>
          </div>

          {/* Item grid */}
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
            {rows.map((row, ri) => (
              <div key={ri} style={{ display: 'flex', gap: 12 }}>
                {row.map((item) => (
                  <div key={item.id} style={{ width: colWidth, flexShrink: 0 }}>
                    <ItemCard item={item} previewImages={previewImages} />
                  </div>
                ))}
                {Array.from({ length: COLS - row.length }).map((_, i) => (
                  <div key={`empty-${i}`} style={{ width: colWidth, flexShrink: 0 }} />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <div style={{
        background: '#f1e7d9',
        padding: '16px 52px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTop: '1px solid #e0d0c0',
        boxSizing: 'border-box' as const,
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="nook" style={{ height: 24, width: 'auto', display: 'block' }} />
        <span style={{ color: '#827470', fontSize: 12 }}>由 NookAI 智能生成 · nookai.app</span>
        <div />
      </div>
    </div>
  );
}
