import { NextResponse } from 'next/server';
import { generateGeminiImageFromReferences } from '../../lib/server/gemini-image';

export const runtime = 'nodejs';
export const maxDuration = 45;

type Payload = {
  beforeImage?: string;
  afterImage?: string;
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
  return `\n- location in image: approximately at the ${vertical}${horizontal} of the room (${Math.round(cx)}%, ${Math.round(cy)}% from top-left)`;
}

function buildItemPrompt(theme: string, item: Payload['item']) {
  const locationHint = describeLocation(item?.anchor);
  return `
Use the provided room image as the ONLY visual reference.
Generate ONE isolated product photo for the exact object below.

Goal:
The image must look like a clean product shot of the exact object that appears in the room.
Do not create a similar substitute. Do not create a room scene. Do not create a collage.

Rules:
1) Preserve silhouette, proportions, materials, texture, and color cues from the room.
2) Keep the object centered, complete, and clearly recognizable.
3) Use a pure white or very light warm-neutral studio background.
4) Soft studio lighting only.
5) No text, no labels, no numbers, no arrows, no borders, no boxes, no frames.
6) No walls, no floor, no furniture, no windows, no architecture.
7) Only one item in the image.

Theme context: ${theme || '日式原木风'}

Shopping item:
- name: ${item?.name || '商品'}
- category: ${item?.category || 'Functional accessories'}
- placement: ${item?.placement || '放在合适位置'}
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

    if (!item?.name || !afterImage) {
      return NextResponse.json({ error: 'Missing item or afterImage' }, { status: 400 });
    }

    const references = beforeImage ? [beforeImage, afterImage] : [afterImage];
    const previewImage = await generateGeminiImageFromReferences(references, buildItemPrompt(theme, item));

    return NextResponse.json({ previewImage });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
