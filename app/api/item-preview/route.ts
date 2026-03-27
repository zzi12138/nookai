import { NextResponse } from 'next/server';
import { generateGeminiImageFromReferences } from '../../lib/server/gemini-image';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Payload = {
  afterImage?: string;
  afterCrop?: string;
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

function describeAnchor(anchor?: { centerX?: number; centerY?: number; width?: number; height?: number }) {
  if (!anchor?.centerX || !anchor?.centerY) return '';
  return `Position in AFTER image: approximately (${Math.round(anchor.centerX)}%, ${Math.round(anchor.centerY)}%), bounding box ~${Math.round(anchor.width || 0)}% x ${Math.round(anchor.height || 0)}% of image.`;
}

function buildItemPrompt(item: Payload['item'], hasAfterCrop: boolean) {
  const anchorDesc = describeAnchor(item?.anchor);
  return `
This is NOT a product generation task. This is a ZOOM-IN and ENHANCE task.

=== TASK ===
${hasAfterCrop
    ? 'The FIRST image provided is a cropped region from the AFTER room photo, showing the target object and its immediate surroundings. The SECOND image is the full AFTER room photo for context.'
    : 'The provided image is the full AFTER room photo.'}

Focus on this specific object: "${item?.name || 'item'}" (${item?.category || 'accessory'}).
${item?.placement ? `It is located: ${item.placement}.` : ''}
${anchorDesc}

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
- Do NOT invent, redesign, or generate a new object. The object must be visually IDENTICAL to the one in the source image.
- Do NOT create a studio product shot, catalog image, or clean white/gray background.
- Do NOT replace the object with a different style, color, or design.
- Do NOT change the viewing angle or perspective of the object.
- Do NOT add any objects that are not in the original image.
- Do NOT show the full room — this should be a tight close-up.
- Do NOT add text, labels, watermarks, borders, or arrows.
- Do NOT use pure white or solid-color studio backgrounds.

=== VISUAL IDENTITY CHECK ===
The output object must be visually identical to the one in the original image.
If someone compared the output side-by-side with the source image, they should immediately recognize it as the same object — same color, same form, same material, same details.

The result should look like a zoomed-in, enhanced crop of the SAME object from the original room — not a new product.
`.trim();
}

function buildRetryPrompt(item: Payload['item'], hasAfterCrop: boolean) {
  return `${buildItemPrompt(item, hasAfterCrop)}

=== RETRY — PREVIOUS ATTEMPT REJECTED ===
The previous output did NOT match the source object. Common mistakes to avoid:
- Generated a NEW object instead of extracting the existing one.
- Changed the object's color, shape, or material.
- Showed a full room scene instead of a close-up.
- Used a studio/white background instead of natural context.

You MUST preserve the exact visual identity of the object from the source image.
Look carefully at the cropped reference — reproduce THAT object, not an idealized version.
`;
}


export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Payload;
    const item = body.item;
    const afterImage = body.afterImage || '';
    const afterCrop = body.afterCrop || '';

    if (!item?.name || !afterImage) {
      return NextResponse.json({ error: 'Missing item or afterImage' }, { status: 400 });
    }

    // Reference images: afterCrop is PRIMARY (closest to the object), afterImage for full context
    const references: string[] = [];
    if (afterCrop) references.push(afterCrop);
    references.push(afterImage);

    const hasAfterCrop = Boolean(afterCrop);

    // First attempt
    const prompt1 = buildItemPrompt(item, hasAfterCrop);
    const result1 = await generateGeminiImageFromReferences(references, prompt1);

    if (result1) {
      return NextResponse.json({ previewImage: result1 });
    }

    // Retry with reinforced prompt
    const prompt2 = buildRetryPrompt(item, hasAfterCrop);
    const result2 = await generateGeminiImageFromReferences(references, prompt2);

    return NextResponse.json({ previewImage: result2 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
