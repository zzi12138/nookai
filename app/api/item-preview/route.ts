import { NextResponse } from 'next/server';
import { generateGeminiImageFromReferences } from '../../lib/server/gemini-image';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Payload = {
  beforeImage?: string;
  afterImage?: string;
  afterCrop?: string;
  theme?: string;
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

function describeLocation(anchor?: { centerX?: number; centerY?: number; width?: number; height?: number }) {
  if (!anchor?.centerX || !anchor?.centerY) return '';
  const cx = anchor.centerX;
  const cy = anchor.centerY;
  const horizontal = cx < 33 ? '左侧' : cx > 66 ? '右侧' : '中间';
  const vertical = cy < 33 ? '上方' : cy > 66 ? '下方' : '中部';
  return `位于房间${vertical}${horizontal}（约 ${Math.round(cx)}%, ${Math.round(cy)}%）`;
}

function buildItemPrompt(theme: string, item: Payload['item'], hasAfterCrop: boolean) {
  const location = describeLocation(item?.anchor);
  return `
Your task: Extract and display ONE specific soft furnishing item from the provided AFTER room image.
${hasAfterCrop ? 'A cropped reference image is also provided showing the approximate location of this item in the room. Use it to precisely locate the target.' : ''}

=== TARGET ITEM ===
Name: ${item?.name || 'item'}
Category: ${item?.category || 'accessory'}
Placement: ${item?.placement || 'visible in the room'}
${location ? `Location: ${location}` : ''}
Style: ${theme || 'Japandi'}

=== HARD CONSTRAINTS (must follow ALL) ===

[SUBJECT FOCUS]
- Show ONLY this one item. No other furniture, lamps, plants, or unrelated objects.
- Do NOT generate an entire room or wide scene — show the item alone.
- If the target is a lamp, show only the lamp. If a pillow, show only the pillow.

[SUBJECT PROPORTION]
- The target item must fill 60%–80% of the image area.
- Center the item with only a small amount of breathing room around it.
- Do NOT leave large empty areas — the item must dominate the frame.

[CONSISTENCY]
- Color, material, texture, and form must EXACTLY match the AFTER image.
- Do NOT redesign, substitute, beautify, or simplify the item's appearance.
- This is "extraction", NOT "re-creation".

[STRUCTURAL INTEGRITY]
- Maintain the item's original perspective angle. Do NOT change the viewpoint.
- Do NOT stretch, compress, tilt, skew, or distort the item.
- The ENTIRE item must be fully visible within the frame — no part may be cropped or cut off by the image edge.

[BACKGROUND]
- Use a soft, natural warm-neutral background (beige / cream / light wood tone).
- Background may be slightly blurred but must transition naturally.
- Do NOT use pure white studio background.
- Do NOT include walls, floors, windows, or any architectural elements.

[ABSOLUTELY FORBIDDEN]
- No text, labels, watermarks, borders, or arrows.
- No multi-object compositions.
- No collage or grid layouts.
`.trim();
}

function buildRetryPrompt(theme: string, item: Payload['item'], hasAfterCrop: boolean) {
  const base = buildItemPrompt(theme, item, hasAfterCrop);
  return `${base}

=== CRITICAL CORRECTION ===
The previous generation was rejected. Pay extra attention:
- The image must show ONLY this one item — do NOT include room scenes or other furniture.
- The item must fill 60%–80% of the frame — do NOT leave large blank areas.
- The ENTIRE item must be visible — no cropping or cutting off at the edges.
- Maintain exact appearance from the AFTER image — do NOT distort or change perspective.
Regenerate strictly following ALL constraints above.
`;
}


export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Payload;
    const theme = body.theme || '日式原木风';
    const item = body.item;
    const beforeImage = body.beforeImage || '';
    const afterImage = body.afterImage || '';
    const afterCrop = body.afterCrop || '';

    if (!item?.name || !afterImage) {
      return NextResponse.json({ error: 'Missing item or afterImage' }, { status: 400 });
    }

    // Reference images: afterCrop first (primary locator), then after, then before
    const references: string[] = [];
    if (afterCrop) references.push(afterCrop);
    references.push(afterImage);
    if (beforeImage) references.push(beforeImage);

    const hasAfterCrop = Boolean(afterCrop);

    // First attempt
    const prompt1 = buildItemPrompt(theme, item, hasAfterCrop);
    const result1 = await generateGeminiImageFromReferences(references, prompt1);

    if (result1) {
      return NextResponse.json({ previewImage: result1 });
    }

    // Retry with reinforced prompt
    const prompt2 = buildRetryPrompt(theme, item, hasAfterCrop);
    const result2 = await generateGeminiImageFromReferences(references, prompt2);

    return NextResponse.json({ previewImage: result2 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
