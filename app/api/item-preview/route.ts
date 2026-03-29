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
  return `
This is NOT a product generation task. This is a ZOOM-IN and ENHANCE task.

=== TASK ===
${hasAfterCrop
    ? 'The FIRST image is a cropped region from the room photo showing the target object and its surroundings. The SECOND image is the full room for context.'
    : 'The provided image is the full room photo.'}

Focus on this specific object: "${item?.name || 'item'}" (${item?.category || 'accessory'}).
${item?.placement ? `Location: ${item.placement}.` : ''}

Your job: Create a zoomed-in, enhanced view of THIS EXACT object as it appears in the image.

=== WHAT TO DO ===
- Identify the target object in the provided image(s).
- Produce a close-up view where the object fills 60-80% of the frame.
- Center the object with a small amount of breathing room.
- Keep the object's EXACT appearance: same shape, color, material, texture, pattern, and proportions.
- Keep the object's original perspective and viewing angle — do NOT straighten or re-angle it.
- Slightly soften or simplify the surrounding area so the object stands out, but keep some natural context (the surface it sits on, nearby shadows).
- Subtly improve lighting clarity for better visibility, but keep it realistic and consistent with the room's lighting.
- The ENTIRE object must be fully visible — no part may be cropped or cut off by the image edge.

=== WHAT NOT TO DO (CRITICAL) ===
- Do NOT invent, redesign, or generate a new object.
- Do NOT create a studio product shot with a clean white/gray background.
- Do NOT replace the object with a different style, color, or design.
- Do NOT change the viewing angle or perspective of the object.
- Do NOT add any objects not in the original image.
- Do NOT show the full room — this should be a tight close-up.
- Do NOT add text, labels, watermarks, borders, or arrows.

=== VISUAL IDENTITY CHECK ===
The output object must be visually identical to the one in the original image.
If someone compared the output side-by-side with the source image, they should immediately recognize it as the same object — same color, same form, same material, same details.

The result should look like a zoomed-in, enhanced crop of the SAME object from the original room — not a new product.
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
