import { NextResponse } from 'next/server';
import { generateGeminiImageFromReferences } from '../../lib/server/gemini-image';

export const runtime = 'nodejs';
export const maxDuration = 45;

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
  return `\n- location in room: approximately ${vertical}${horizontal} (${Math.round(cx)}%, ${Math.round(cy)}% from top-left)`;
}

function buildItemPrompt(theme: string, item: Payload['item'], hasAfterCrop: boolean) {
  const locationHint = describeLocation(item?.anchor);
  return `
Based on the provided room images, generate a focused close-up preview of ONE specific item.

The AFTER image shows the redesigned room. Your task is to extract and clearly show the specific item described below, exactly as it appears in the AFTER image, but larger and more focused.
${hasAfterCrop ? '\nA cropped reference image is also provided showing the approximate area where this item is located. Use it to identify the exact item.' : ''}

Rules:
1) The item MUST match the AFTER image exactly — same color, material, texture, and shape.
2) Center the item in the frame, filling at least 60% of the image.
3) Use a clean, softly blurred or simplified background. Does NOT need to be pure white.
4) The item must be complete, clearly recognizable, and the dominant subject.
5) Do NOT invent a different item. Do NOT substitute with something similar.
6) Do NOT add extra objects that are not part of this specific item.
7) No text, labels, numbers, arrows, borders, boxes, or frames.
8) Only ONE item in the image.

Theme context: ${theme || '日式原木风'}

Target item:
- name: ${item?.name || '商品'}
- category: ${item?.category || '摆件'}
- placement: ${item?.placement || '效果图中可见位置'}
- reason: ${item?.reason || '提升空间完成度'}${locationHint}
`.trim();
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

    // Build reference images: [before?, after, afterCrop?]
    const references: string[] = [];
    if (beforeImage) references.push(beforeImage);
    references.push(afterImage);
    if (afterCrop) references.push(afterCrop);

    const prompt = buildItemPrompt(theme, item, Boolean(afterCrop));
    const previewImage = await generateGeminiImageFromReferences(references, prompt);

    return NextResponse.json({ previewImage });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
