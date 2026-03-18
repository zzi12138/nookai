import { NextResponse } from 'next/server';
import { generateImage } from '../../lib/server/imageProvider';

export const runtime = 'nodejs';

type Payload = {
  image?: string;
  theme?: string;
};

type PlanItem = {
  id: number;
  markerLabel: string;
  name: string;
  imageTarget: {
    x: number;
    y: number;
  };
  module: string;
  buy: string;
  priceRange: string;
  placement: string;
  value: string;
};

function toMarker(index: number) {
  const markers = ['①', '②', '③', '④', '⑤', '⑥'];
  return markers[index - 1] || String(index);
}

function getStyleHint(theme: string) {
  if (theme.includes('原木') || theme.toLowerCase().includes('japandi')) {
    return 'natural wood, linen, beige, warm white light';
  }
  if (theme.includes('奶油')) {
    return 'soft creamy, boucle texture, warm neutral, cozy';
  }
  if (theme.includes('复古')) {
    return 'vintage artistic, warm brown, nostalgic decor';
  }
  if (theme.includes('极简')) {
    return 'modern minimalist, clean line, monochrome neutral';
  }
  return 'warm neutral, clean renter-friendly style';
}

function buildExplainerPrompt(theme: string) {
  const styleHint = getStyleHint(theme);

  return `
Create a clean interior transformation explainer diagram from the provided room image.

Keep exactly the same room geometry, camera angle, perspective, and composition.
Do not modify architecture or layout.

Visual goal:
- line-art / instruction-style explainer image
- background simplified and faded in light neutral tones
- highlight only renter-friendly upgrade objects

Highlight only these concrete objects:
1) floor lamp near sofa
2) rug in seating zone
3) wall art above sofa or bed
4) medium indoor plant in corner
5) bedding textile set

Style context: ${styleHint}

Output style:
- minimal, clean, product-manual style (Apple / IKEA feel)
- high readability, lots of negative space
- not poster-like, not cluttered
`.trim();
}

function buildItems(theme: string): PlanItem[] {
  const styleHint = getStyleHint(theme);

  return [
    {
      id: 1,
      markerLabel: toMarker(1),
      name: '暖光落地灯',
      imageTarget: { x: 73, y: 58 },
      module: '补一层侧向暖光，让房间从“亮”变成“有氛围”。',
      buy: `简约暖光落地灯（${styleHint}，建议 3000K）`,
      priceRange: '¥159-399',
      placement: '沙发右侧或沙发后方，灯头朝向休息区。',
      value: '这是最快、最稳定的氛围提升项。',
    },
    {
      id: 2,
      markerLabel: toMarker(2),
      name: '浅色地毯',
      imageTarget: { x: 52, y: 75 },
      module: '把休息区域明确划出来，空间层次更清晰。',
      buy: '浅色短绒地毯（易打理）',
      priceRange: '¥199-499',
      placement: '沙发前或床尾区域，压住家具前脚更自然。',
      value: '能快速解决房间“空、散”的问题。',
    },
    {
      id: 3,
      markerLabel: toMarker(3),
      name: '简约挂画',
      imageTarget: { x: 67, y: 33 },
      module: '给墙面一个焦点，不改硬装也能提升完成度。',
      buy: '免打孔挂画（单幅优先）',
      priceRange: '¥69-199',
      placement: '沙发或床上方中线位置，避免挂得过高。',
      value: '视觉重心会更稳，照片观感明显更高级。',
    },
    {
      id: 4,
      markerLabel: toMarker(4),
      name: '中型绿植',
      imageTarget: { x: 84, y: 56 },
      module: '增加自然元素，软化硬边界。',
      buy: '中型绿植（龟背竹/虎尾兰）',
      priceRange: '¥79-259',
      placement: '窗边或角落过渡区，避免挡住动线。',
      value: '低预算也能明显提升生活感。',
    },
    {
      id: 5,
      markerLabel: toMarker(5),
      name: '米色床品',
      imageTarget: { x: 24, y: 84 },
      module: '统一大面积织物主色，整体更干净。',
      buy: '米色床品套装 + 小抱枕',
      priceRange: '¥179-459',
      placement: '床面主色保持浅暖色，深色只留小面积点缀。',
      value: '床面占比最大，改完后整体风格立刻统一。',
    },
  ];
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Payload;
    const image = body.image || '';
    const theme = body.theme || '日式原木风';

    if (!image) {
      return NextResponse.json({ error: 'Missing image' }, { status: 400 });
    }

    const { imageUrl } = await generateImage({
      image,
      prompt: buildExplainerPrompt(theme),
      negativePrompt:
        'photorealistic texture, noisy background, random typography, busy composition, excessive color, blurred line art, distorted geometry, changed architecture',
      strength: 0.38,
      nanobananaModel: process.env.NANOBANANA_EXPLAINER_MODEL || 'nb2-interior-pro',
    });

    return NextResponse.json({
      summary:
        '这次改造重点是补光、统一织物和增加装饰焦点。你可以直接按图上编号逐个补齐，不需要动任何硬装。',
      explainerImageUrl: imageUrl,
      items: buildItems(theme),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
