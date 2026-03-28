// ─── Cost Ledger: per-request cost estimation ─────────────────────────────
// This module tracks estimated API costs for each request.
// It returns cost data in API responses so the client can display it.
// Can be removed at any time without affecting core functionality.

export type CostEntry = {
  api: string;           // e.g. 'generate', 'item-preview', 'explainer'
  model: string;         // e.g. 'gemini-2.5-flash-image', 'gpt-image-1-mini'
  inputTokens?: number;  // estimated input tokens
  outputTokens?: number; // estimated output tokens
  imageOutputs?: number; // number of images generated
  estimatedCost: number; // USD
  timestamp: number;
};

// ─── Pricing constants (USD per unit) ────────────────────────────────────

const PRICING = {
  // Gemini 2.5 Flash Image
  'gemini-2.5-flash-image': {
    inputPerMToken: 0.30,
    outputImageCost: 0.039, // per image, 1024x1024
  },
  // Gemini 3.1 Flash Image Preview (Nano Banana 2)
  'gemini-3.1-flash-image-preview': {
    inputPerMToken: 0.50,
    outputImageCost: 0.067, // per image, 1K
  },
  // Gemini 2.5 Flash (text/vision only)
  'gemini-2.5-flash': {
    inputPerMToken: 0.30,
    outputPerMToken: 2.50,
  },
  // OpenAI GPT Image 1 Mini
  'gpt-image-1-mini': {
    inputPerMToken: 0.15, // approximate text+image input
    outputImageCost: 0.005, // low quality, 1024x1024
  },
  // OpenAI GPT Image 1
  'gpt-image-1': {
    inputPerMToken: 2.50,
    outputImageCost: 0.042, // medium quality, 1024x1024
  },
} as const;

type ModelKey = keyof typeof PRICING;

// ─── Token estimation helpers ────────────────────────────────────────────

/** Estimate tokens for an image based on pixel dimensions (Gemini formula) */
export function estimateImageTokens(width = 1000, height = 1000): number {
  const minDim = Math.min(width, height);
  const maxDim = Math.max(width, height);
  if (minDim <= 384 && maxDim <= 384) return 258;
  const cropUnit = Math.floor(minDim / 1.5);
  const tilesW = Math.ceil(maxDim / cropUnit);
  const tilesH = Math.ceil(minDim / cropUnit);
  return tilesW * tilesH * 258;
}

/** Estimate tokens for a text prompt (~1 token per 4 characters for English) */
export function estimateTextTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ─── Cost calculation ────────────────────────────────────────────────────

export function estimateCost(opts: {
  api: string;
  model: string;
  inputImages?: number;         // number of input images
  inputImageAvgSize?: number;   // average px of input images
  promptLength?: number;        // character length of prompt
  outputImages?: number;        // number of output images
  outputTextTokens?: number;    // estimated output text tokens
}): CostEntry {
  const pricing = PRICING[opts.model as ModelKey];
  const imgTokens = (opts.inputImages || 0) * estimateImageTokens(opts.inputImageAvgSize, opts.inputImageAvgSize);
  const textTokens = estimateTextTokens('x'.repeat(opts.promptLength || 0));
  const totalInputTokens = imgTokens + textTokens;

  let cost = 0;

  if (pricing) {
    // Input cost
    const inputRate = 'inputPerMToken' in pricing ? pricing.inputPerMToken : 0;
    cost += (totalInputTokens / 1_000_000) * inputRate;

    // Output cost
    if ('outputImageCost' in pricing && opts.outputImages) {
      cost += opts.outputImages * pricing.outputImageCost;
    }
    if ('outputPerMToken' in pricing && opts.outputTextTokens) {
      cost += (opts.outputTextTokens / 1_000_000) * pricing.outputPerMToken;
    }
  }

  return {
    api: opts.api,
    model: opts.model,
    inputTokens: totalInputTokens,
    outputTokens: opts.outputTextTokens,
    imageOutputs: opts.outputImages || 0,
    estimatedCost: Math.round(cost * 1_000_000) / 1_000_000, // 6 decimal places
    timestamp: Date.now(),
  };
}
