'use client';

import { useEffect, useState } from 'react';
import { shrinkImageDataUrl, cropImageByAnchor } from '../../lib/imageUtils';

// ─── Types ──────────────────────────────────────────────────────────────

export type PreviewStatus = 'pending' | 'loading' | 'done' | 'failed';

export type ItemPreviewState = {
  status: PreviewStatus;
  imageUrl: string;
  attempts: number;
  error?: string;
};

export type ItemPreviewTrace = {
  itemId: number;
  itemName: string;
  status: PreviewStatus;
  attempts: number;
  durationMs: number;
  error?: string;
};

export type CostEntry = {
  api: string;
  model: string;
  estimatedCost: number;
  timestamp: number;
};

export type PreviewBatchTrace = {
  totalItems: number;
  succeeded: number;
  failed: number;
  retried: number;
  totalDurationMs: number;
  items: ItemPreviewTrace[];
  costs: CostEntry[];
};

// ─── Minimal item interface (avoids importing GuideItem) ────────────────

type PreviewableItem = {
  id: number;
  name: string;
  category: string;
  placement?: string;
  reason?: string;
  imageTarget?: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  };
};

// ─── Utilities ──────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 2;
const TIMEOUT_MS = 65_000;
const CONCURRENCY = 1;
const DELAY_BETWEEN_MS = 1_500; // avoid Gemini rate limits

async function mapWithConcurrency<T, R>(
  values: T[],
  limit: number,
  mapper: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (cursor < values.length) {
      const i = cursor++;
      results[i] = await mapper(values[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

async function callItemPreview(
  item: PreviewableItem,
  shrunkAfter: string,
  afterCrop: string | undefined,
  signal: AbortSignal,
): Promise<{ previewImage?: string; error?: string; cost?: CostEntry }> {
  const anchor = item.imageTarget;
  const hasAnchor =
    anchor &&
    Number.isFinite(anchor.x) &&
    Number.isFinite(anchor.y) &&
    (anchor.width || 0) > 6 &&
    (anchor.height || 0) > 6;

  const res = await fetch('/api/item-preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      afterImage: shrunkAfter,
      afterCrop: afterCrop || undefined,
      item: {
        name: item.name,
        category: item.category,
        placement: item.placement || '',
        reason: item.reason || '',
        anchor: hasAnchor
          ? { centerX: anchor!.x, centerY: anchor!.y, width: anchor!.width, height: anchor!.height }
          : undefined,
      },
    }),
    signal,
  });

  const data = (await res.json().catch(() => ({}))) as { previewImage?: string; error?: string; cost?: CostEntry };
  if (res.ok && data.previewImage) {
    return { previewImage: data.previewImage, cost: data.cost };
  }
  return { error: data.error || `HTTP ${res.status}` };
}

// ─── Hook ───────────────────────────────────────────────────────────────

export function useItemPreviews(
  items: PreviewableItem[],
  afterImage: string,
) {
  const [previews, setPreviews] = useState<Map<number, ItemPreviewState>>(new Map());
  const [trace, setTrace] = useState<PreviewBatchTrace | null>(null);

  useEffect(() => {
    if (!afterImage || items.length === 0) {
      setPreviews(new Map());
      setTrace(null);
      return;
    }

    let cancelled = false;
    const startTime = Date.now();

    async function run() {
      const shrunkAfter = await shrinkImageDataUrl(afterImage, 1280, 0.84);

      const itemTraces: ItemPreviewTrace[] = [];
      const costs: CostEntry[] = [];

      await mapWithConcurrency(items, CONCURRENCY, async (item, index) => {
        // Stagger requests to avoid Gemini rate limits
        if (index > 0) {
          await new Promise((r) => setTimeout(r, DELAY_BETWEEN_MS));
        }
        const itemStart = Date.now();

        // Set loading
        if (!cancelled) {
          setPreviews((prev) => {
            const next = new Map(prev);
            next.set(item.id, { status: 'loading', imageUrl: '', attempts: 0 });
            return next;
          });
        }

        // Prepare afterCrop — crop from AFTER image by anchor
        const anchor = item.imageTarget;
        const hasAnchor =
          anchor &&
          Number.isFinite(anchor.x) &&
          Number.isFinite(anchor.y) &&
          (anchor.width || 0) > 6 &&
          (anchor.height || 0) > 6;

        let afterCrop: string | undefined;
        if (hasAnchor) {
          try {
            afterCrop = await cropImageByAnchor(shrunkAfter, {
              centerX: anchor!.x!,
              centerY: anchor!.y!,
              width: anchor!.width!,
              height: anchor!.height!,
            });
          } catch {
            // Crop failure doesn't block
          }
        }

        // Try with auto-retry
        let lastError = '';
        let attempts = 0;

        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          attempts = attempt;
          const controller = new AbortController();
          const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);

          try {
            const result = await callItemPreview(
              item,
              shrunkAfter,
              afterCrop,
              controller.signal,
            );

            if (result.previewImage) {
              const state: ItemPreviewState = {
                status: 'done',
                imageUrl: result.previewImage,
                attempts,
              };

              if (!cancelled) {
                setPreviews((prev) => new Map(prev).set(item.id, state));
              }

              if (result.cost) costs.push(result.cost);

              itemTraces.push({
                itemId: item.id,
                itemName: item.name,
                status: 'done',
                attempts,
                durationMs: Date.now() - itemStart,
              });
              return;
            }

            lastError = result.error || 'No image returned';
          } catch (err) {
            lastError = err instanceof Error ? err.message : String(err);
          } finally {
            window.clearTimeout(timer);
          }

          if (attempt < MAX_ATTEMPTS) {
            await new Promise((r) => setTimeout(r, 800));
          }
        }

        // All attempts failed
        const failedState: ItemPreviewState = {
          status: 'failed',
          imageUrl: '',
          attempts,
          error: lastError,
        };

        if (!cancelled) {
          setPreviews((prev) => new Map(prev).set(item.id, failedState));
        }

        itemTraces.push({
          itemId: item.id,
          itemName: item.name,
          status: 'failed',
          attempts,
          durationMs: Date.now() - itemStart,
          error: lastError,
        });
      });

      // Build batch trace
      if (!cancelled) {
        setTrace({
          totalItems: items.length,
          succeeded: itemTraces.filter((t) => t.status === 'done').length,
          failed: itemTraces.filter((t) => t.status === 'failed').length,
          retried: itemTraces.filter((t) => t.attempts > 1).length,
          totalDurationMs: Date.now() - startTime,
          items: itemTraces,
          costs,
        });
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [afterImage, items]);

  return { previews, trace };
}
