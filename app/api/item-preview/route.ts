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
你的任务：从提供的房间效果图（AFTER）中，提取并单独展示下方指定的那一件软装物件。
${hasAfterCrop ? '同时提供了一张局部裁切参考图，标示了该物件在房间中的大致位置，请据此精确定位目标。' : ''}

═══ 目标物件 ═══
名称：${item?.name || '商品'}
分类：${item?.category || '摆件'}
摆放：${item?.placement || '效果图中可见位置'}
${location ? `定位：${location}` : ''}
风格：${theme || '日式原木风'}

═══ 硬性约束（必须全部遵守）═══

【主体聚焦】
- 画面中只能出现这一件物件，禁止出现其他家具、灯具、植物等无关物品
- 禁止生成整间房间或大范围场景——只展示物件本身
- 如果目标是灯具，只画灯；如果是抱枕，只画抱枕

【主体占比】
- 目标物件必须占据画面面积的 60%–80%
- 物件居中放置，四周留少量呼吸空间即可
- 禁止大面积空白或留白——物件必须撑满画面

【一致性】
- 颜色、材质、纹理、形态必须与 AFTER 效果图中完全一致
- 禁止重新设计、替换、美化或简化物件外观
- 这是"提取"不是"重新创作"

【结构完整性】
- 保持物件原始透视角度，禁止改变视角
- 禁止拉伸、压缩、倾斜、扭曲
- 物件必须完整呈现，不能裁切掉任何部分

【背景】
- 使用柔和、自然的浅暖色背景（米色/奶白/浅木色）
- 背景可以轻微虚化，但必须自然过渡
- 禁止纯白色棚拍背景
- 禁止出现墙壁、地板、窗户等建筑元素

【绝对禁止】
- 禁止出现文字、标签、水印、边框、箭头
- 禁止多物件构图
- 禁止拼贴或分格排版
`.trim();
}

function buildRetryPrompt(theme: string, item: Payload['item'], hasAfterCrop: boolean) {
  const base = buildItemPrompt(theme, item, hasAfterCrop);
  return `${base}

═══ 重要修正 ═══
上一次生成的结果不合格。请特别注意：
- 画面中必须只有这一件物件，不要包含房间场景
- 物件必须占画面 60%–80%，不要留大面积空白
- 保持与效果图中完全一致的外观，不要变形或改变透视
请严格按照上述所有约束重新生成。
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
