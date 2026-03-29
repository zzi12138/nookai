import { NextResponse } from 'next/server';
import { generateGeminiImageFromReferences } from '../../lib/server/gemini-image';
import { estimateCost, type CostEntry } from '../../lib/server/cost-ledger';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Payload = {
  afterImage?: string;   // full AFTER room image (data URL or base64)
  afterCrop?: string;    // cropped region around the target object
  item?: {
    name?: string;
    category?: string;
    placement?: string;
    reason?: string;
    anchor?: {
      centerX?: number;
      centerY?: number;
      width?: number;
      height?: number;
    };
  };
};

// ─── Prompt ──────────────────────────────────────────────────────────────

function buildPrompt(item: Payload['item'], hasAfterCrop: boolean) {
  const name = item?.name || 'item';
  const category = item?.category || 'accessory';
  const placement = item?.placement || '';

  return `
Focus on the target object: "${name}" (${category})${placement ? ` at ${placement}` : ''}.

Input:
${hasAfterCrop
    ? '- cropped image (object region)\n- full room image (context)'
    : '- full room image'}

Task:
Create a close-up view of the SAME object.

Rules:
- The object must stay IDENTICAL (shape, color, material, texture).
- Keep original perspective and angle.
- The object fills 60–80% of the frame.
- Center it with slight breathing space.
- Show the FULL object (no cropping).

Enhance:
- slightly improve clarity and lighting
- softly reduce background distractions
- keep natural context (surface, shadows)

Do NOT:
- redesign or replace the object
- generate a new product
- change angle or structure
- create studio background
- include unrelated objects
- show full room
- add text or overlays

Result:
a clean, zoomed-in, enhanced view of the SAME object.
`.trim();
}

// ─── Route ───────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Payload;
    const item = body.item;
    const afterImage = body.afterImage || '';
    const afterCrop = body.afterCrop || '';

    if (!item?.name || !afterImage) {
      return NextResponse.json({ error: 'Missing item or afterImage' }, { status: 400 });
    }

    const hasAfterCrop = Boolean(afterCrop);
    const prompt = buildPrompt(item, hasAfterCrop);

    // Build image list: afterCrop first (primary), then full afterImage
    const images: string[] = [];
    if (afterCrop) images.push(afterCrop);
    images.push(afterImage);

    const previewImage = await generateGeminiImageFromReferences(images, prompt);

    // Cost estimation
    const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
    const cost = estimateCost({
      api: 'item-preview',
      model,
      inputImages: hasAfterCrop ? 2 : 1,
      inputImageAvgSize: hasAfterCrop ? 500 : 800,
      promptLength: prompt.length,
      outputImages: 1,
    });

    return NextResponse.json({ previewImage, cost });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
