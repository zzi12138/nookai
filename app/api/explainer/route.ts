import { NextResponse } from 'next/server';
import {
  assignItemsToBoardCells,
  ITEMS_BOARD_CONFIG,
  type BoardCell,
} from '../../lib/itemsBoard';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Payload = {
  image?: string;
  beforeImage?: string;
  afterImage?: string;
  theme?: string;
  provider?: 'nanobanana' | 'gemini';
};

type Category =
  | 'Ambient lighting'
  | 'Bedding & soft textiles'
  | 'Floor soft furnishings'
  | 'Wall decor'
  | 'Plants'
  | 'Functional accessories';

type Necessity = 'Must-have' | 'Recommended' | 'Optional';

type RawItem = {
  name?: string;
  quantity?: number;
  priceMin?: number;
  priceMax?: number;
  placement?: string;
  necessity?: string;
  reason?: string;
  anchor?: {
    x?: number;
    y?: number;
    centerX?: number;
    centerY?: number;
    cx?: number;
    cy?: number;
    left?: number;
    top?: number;
    right?: number;
    bottom?: number;
    width?: number;
    height?: number;
    w?: number;
    h?: number;
    confidence?: number;
  };
};

type NormalizedItem = {
  id: number;
  name: string;
  category: Category;
  quantity: number;
  priceMin: number;
  priceMax: number;
  priceRange: string;
  placement: string;
  necessity: Necessity;
  reason: string;
  boardCell?: BoardCell;
  imageTarget: {
    x: number;
    y: number;
    left: number;
    top: number;
    width: number;
    height: number;
    confidence: number;
    hasAnchor: boolean;
    hasPoint: boolean;
  };
};

type ValidationRegion = {
  left: number;
  top: number;
  width: number;
  height: number;
  confidence: number;
  label: string;
};

type ExtractedBoardValidation = {
  checked: boolean;
  valid: boolean;
  hasText: boolean;
  hasGridOrFrames: boolean;
  whiteBackgroundScore: number;
  backgroundMostlyWhite: boolean;
  textRegions: ValidationRegion[];
  frameRegions: ValidationRegion[];
  reasons: string[];
  failureCode: string | null;
};

type ExtractedBoardDebug = {
  status:
    | 'not_attempted'
    | 'generation_failed'
    | 'generated_unchecked'
    | 'generated_valid'
    | 'generated_invalid'
    | 'cleaned_valid'
    | 'extracted_board_invalid';
  generationAttempted: boolean;
  generationSucceeded: boolean;
  rawImageKind: 'data_url' | 'remote_url' | 'empty' | 'unknown';
  rawImageRef: string;
  rawImageLength: number;
  cleanupAttempted: boolean;
  cleanupSucceeded: boolean;
  cleanedImageKind: 'data_url' | 'remote_url' | 'empty' | 'unknown';
  cleanedImageRef: string;
  cleanedImageLength: number;
  validation: ExtractedBoardValidation;
  failureCode: string | null;
  failureReason: string | null;
  fallbackReason: string | null;
  thumbnailSource: 'extracted_board' | 'main_image_fallback';
};

function stripDataUrl(value: string) {
  return value.includes(',') ? value.split(',')[1] : value;
}

function extractMimeType(dataUrl: string) {
  const m = dataUrl.match(/^data:([^;]+);base64,/i);
  return m?.[1] || 'image/jpeg';
}

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function isDataUrl(value: string) {
  return /^data:[^;]+;base64,/i.test(value);
}

function isProbablyBase64(value: string) {
  if (!value) return false;
  return /^[A-Za-z0-9+/=\r\n]+$/.test(value) && value.length > 64;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toRegion(raw: any, fallbackLabel: string): ValidationRegion | null {
  const left = Number(raw?.left);
  const top = Number(raw?.top);
  const width = Number(raw?.width);
  const height = Number(raw?.height);
  const confidence = clamp(Number(raw?.confidence || 0), 0, 1);

  if (![left, top, width, height].every(Number.isFinite)) return null;

  return {
    left: clamp(left, 0, 100),
    top: clamp(top, 0, 100),
    width: clamp(width, 0, 100),
    height: clamp(height, 0, 100),
    confidence,
    label: String(raw?.label || fallbackLabel || '').trim() || fallbackLabel,
  };
}

function getImageDebugMeta(imageUrl?: string) {
  const image = imageUrl || '';
  if (!image) {
    return {
      kind: 'empty' as const,
      ref: '',
      length: 0,
    };
  }

  if (isDataUrl(image)) {
    const mimeType = extractMimeType(image);
    return {
      kind: 'data_url' as const,
      ref: `data:${mimeType}`,
      length: image.length,
    };
  }

  if (isHttpUrl(image)) {
    return {
      kind: 'remote_url' as const,
      ref: image,
      length: image.length,
    };
  }

  return {
    kind: 'unknown' as const,
    ref: image.slice(0, 80),
    length: image.length,
  };
}

function makeDefaultValidation(): ExtractedBoardValidation {
  return {
    checked: false,
    valid: false,
    hasText: false,
    hasGridOrFrames: false,
    whiteBackgroundScore: 0,
    backgroundMostlyWhite: false,
    textRegions: [],
    frameRegions: [],
    reasons: [],
    failureCode: null,
  };
}

function makeDefaultBoardDebug(): ExtractedBoardDebug {
  return {
    status: 'not_attempted',
    generationAttempted: false,
    generationSucceeded: false,
    rawImageKind: 'empty',
    rawImageRef: '',
    rawImageLength: 0,
    cleanupAttempted: false,
    cleanupSucceeded: false,
    cleanedImageKind: 'empty',
    cleanedImageRef: '',
    cleanedImageLength: 0,
    validation: makeDefaultValidation(),
    failureCode: null,
    failureReason: null,
    fallbackReason: null,
    thumbnailSource: 'main_image_fallback',
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function safeParseJson<T>(text: string): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}

function normalizeNecessity(raw?: string): Necessity {
  const v = (raw || '').toLowerCase();
  if (v.includes('must') || v.includes('必')) return 'Must-have';
  if (v.includes('optional') || v.includes('可选')) return 'Optional';
  return 'Recommended';
}

function inferCategory(name: string): Category {
  const n = name.toLowerCase();
  if (
    n.includes('floor lamp') ||
    n.includes('table lamp') ||
    n.includes('desk lamp') ||
    n.includes('灯') ||
    n.includes('light strip') ||
    n.includes('string light')
  ) {
    return 'Ambient lighting';
  }
  if (
    n.includes('bedding') ||
    n.includes('duvet') ||
    n.includes('pillow') ||
    n.includes('blanket') ||
    n.includes('床品') ||
    n.includes('抱枕') ||
    n.includes('毯')
  ) {
    return 'Bedding & soft textiles';
  }
  if (n.includes('rug') || n.includes('carpet') || n.includes('地毯')) {
    return 'Floor soft furnishings';
  }
  if (n.includes('wall art') || n.includes('poster') || n.includes('挂画') || n.includes('装饰画')) {
    return 'Wall decor';
  }
  if (n.includes('plant') || n.includes('greenery') || n.includes('绿植')) {
    return 'Plants';
  }
  return 'Functional accessories';
}

function compactName(raw?: string) {
  const name = (raw || '').trim();
  if (!name) return '';
  return name;
}

function normalizePlacement(raw?: string) {
  const value = (raw || '').trim();
  return value || '放在不影响动线的位置';
}

function normalizeReason(raw?: string) {
  const value = (raw || '').trim();
  return value || '提升空间氛围最直接';
}

function hasChinese(text: string) {
  return /[\u4e00-\u9fff]/.test(text);
}

function toChineseName(raw: string) {
  const name = compactName(raw);
  if (!name) return '';
  if (hasChinese(name)) return name;

  const n = name.toLowerCase();
  if (n.includes('floor lamp')) return '暖光落地灯';
  if (n.includes('desk lamp') || n.includes('table lamp')) return '桌面台灯';
  if (n.includes('light strip') || n.includes('string light')) return '窗帘灯串';
  if (n.includes('rug') || n.includes('carpet')) return '圆形地毯';
  if (n.includes('bedding') || n.includes('duvet')) return '亚麻床品';
  if (n.includes('pillow')) return '装饰抱枕';
  if (n.includes('blanket') || n.includes('throw')) return '针织披毯';
  if (n.includes('wall art') || n.includes('poster') || n.includes('painting')) return '免打孔挂画';
  if (n.includes('plant') || n.includes('greenery')) return '中型绿植';
  if (n.includes('projector')) return '投影仪';
  if (n.includes('stand')) return '投影支架';
  if (n.includes('side table')) return '小边几';
  if (n.includes('tray') || n.includes('storage')) return '桌面收纳盘';
  return name;
}

function toChinesePlacement(raw: string) {
  const value = normalizePlacement(raw);
  if (hasChinese(value)) return value;

  const n = value.toLowerCase();
  if (n.includes('sofa') && n.includes('right')) return '沙发右侧';
  if (n.includes('sofa')) return '沙发附近';
  if (n.includes('bedside') || n.includes('bed side')) return '床边';
  if (n.includes('desk')) return '书桌一角';
  if (n.includes('wall')) return '床头或沙发背墙';
  if (n.includes('window')) return '窗边';
  if (n.includes('corner')) return '房间角落';
  if (n.includes('center')) return '空间中部';
  return value;
}

function toChineseReason(raw: string) {
  const value = normalizeReason(raw);
  if (hasChinese(value)) return value;

  const n = value.toLowerCase();
  if (n.includes('warm') || n.includes('light')) return '补充暖光后，空间更有层次';
  if (n.includes('cozy')) return '让房间更放松舒适';
  if (n.includes('focus')) return '快速形成视觉焦点';
  if (n.includes('texture')) return '提升软装质感';
  return '提升空间完成度';
}

function narrowRangeByName(name: string) {
  const n = name.toLowerCase();

  if (n.includes('floor lamp') || n.includes('落地灯')) return { min: 159, max: 239 };
  if (n.includes('desk lamp') || n.includes('table lamp') || n.includes('台灯')) return { min: 69, max: 119 };
  if (n.includes('light strip') || n.includes('string light') || n.includes('灯带')) return { min: 49, max: 99 };

  if (n.includes('rug') || n.includes('carpet') || n.includes('地毯')) return { min: 199, max: 299 };

  if (n.includes('bedding') || n.includes('duvet') || n.includes('床品')) return { min: 179, max: 259 };
  if (n.includes('pillow') || n.includes('抱枕')) return { min: 49, max: 99 };
  if (n.includes('blanket') || n.includes('throw') || n.includes('毯')) return { min: 79, max: 149 };

  if (n.includes('wall art') || n.includes('poster') || n.includes('挂画')) return { min: 79, max: 129 };

  if (n.includes('plant') || n.includes('绿植')) return { min: 89, max: 169 };

  if (n.includes('projector') || n.includes('投影')) return { min: 499, max: 899 };
  if (n.includes('stand') || n.includes('支架')) return { min: 79, max: 169 };
  if (n.includes('side table') || n.includes('边几')) return { min: 129, max: 229 };
  if (n.includes('tray') || n.includes('收纳')) return { min: 39, max: 89 };

  return { min: 99, max: 179 };
}

function normalizePrice(name: string, minRaw?: number, maxRaw?: number) {
  const preset = narrowRangeByName(name);

  if (!Number.isFinite(minRaw) || !Number.isFinite(maxRaw) || (maxRaw as number) <= (minRaw as number)) {
    return preset;
  }

  let min = Math.round(clamp(Number(minRaw), 39, 4999));
  let max = Math.round(clamp(Number(maxRaw), min + 20, min + 180));

  const span = max - min;
  if (span > 120) {
    max = min + 120;
  }

  if (min < preset.min - 40 || max > preset.max + 120) {
    return preset;
  }

  return { min, max };
}

function inferProviderFromImage(image: string): 'nanobanana' | 'gemini' | undefined {
  if (!image) return undefined;
  if (image.startsWith('data:image/')) return 'gemini';
  if (/^https?:\/\//i.test(image)) return 'nanobanana';
  return undefined;
}

function fallbackSizeByName(name: string) {
  const n = name.toLowerCase();
  if (n.includes('floor lamp') || n.includes('落地灯')) return { width: 12, height: 26 };
  if (n.includes('desk lamp') || n.includes('table lamp') || n.includes('台灯')) return { width: 9, height: 13 };
  if (n.includes('light strip') || n.includes('string light') || n.includes('灯带')) return { width: 24, height: 10 };
  if (n.includes('rug') || n.includes('carpet') || n.includes('地毯')) return { width: 34, height: 22 };
  if (n.includes('bedding') || n.includes('床品')) return { width: 30, height: 24 };
  if (n.includes('pillow') || n.includes('抱枕')) return { width: 12, height: 10 };
  if (n.includes('blanket') || n.includes('throw') || n.includes('毯')) return { width: 18, height: 14 };
  if (n.includes('wall art') || n.includes('poster') || n.includes('挂画')) return { width: 20, height: 16 };
  if (n.includes('plant') || n.includes('绿植')) return { width: 14, height: 24 };
  if (n.includes('projector') || n.includes('投影')) return { width: 12, height: 10 };
  if (n.includes('side table') || n.includes('边几')) return { width: 13, height: 14 };
  return { width: 16, height: 16 };
}

function shouldExcludeItem(name: string) {
  const n = name.toLowerCase();
  const blocked = [
    '床架',
    '床垫',
    '沙发',
    '书桌',
    '桌子',
    '椅子',
    '餐椅',
    '餐桌',
    '电视',
    '柜',
    '衣柜',
    '空调',
    '硬装墙',
    '地板',
    '天花板',
    '吊顶',
    '门框',
    '窗框',
    '电视柜',
    '原有床',
    '原有沙发',
    '原有书桌',
    'built-in',
    'wall',
    'floor',
    'ceiling',
    'door',
    'window',
    'cabinet',
    'sofa',
    'bed',
    'desk',
    'chair',
    'air conditioner',
  ];

  return blocked.some((kw) => n.includes(kw));
}

function getFallbackRawItems(theme: string): RawItem[] {
  const styleHint = (theme || '').toLowerCase();
  const isMinimal = styleHint.includes('简约') || styleHint.includes('minimal');
  const isVintage = styleHint.includes('复古') || styleHint.includes('vintage');
  const isNature = styleHint.includes('绿植') || styleHint.includes('nature');

  return [
    { name: '暖光落地灯', quantity: 1, necessity: 'Must-have', priceMin: 159, priceMax: 239, placement: '沙发右侧', reason: '最快提升氛围感' },
    { name: '桌面台灯', quantity: 1, necessity: 'Recommended', priceMin: 69, priceMax: 119, placement: '书桌右上角', reason: '补充局部照明' },
    { name: isMinimal ? '素色几何地毯' : '圆形地毯', quantity: 1, necessity: 'Must-have', priceMin: 199, priceMax: 299, placement: '床尾或床侧', reason: '统一地面视觉' },
    { name: '亚麻床品', quantity: 1, necessity: 'Must-have', priceMin: 179, priceMax: 259, placement: '床面整体', reason: '降低杂乱感' },
    { name: isVintage ? '复古抱枕' : '装饰抱枕', quantity: 2, necessity: 'Recommended', priceMin: 49, priceMax: 99, placement: '床头或沙发', reason: '增加软装层次' },
    { name: '针织披毯', quantity: 1, necessity: 'Optional', priceMin: 79, priceMax: 149, placement: '床尾', reason: '提升舒适度' },
    { name: isVintage ? '复古装饰画' : '免打孔挂画', quantity: 1, necessity: 'Recommended', priceMin: 79, priceMax: 129, placement: '床头墙面', reason: '形成视觉焦点' },
    { name: isNature ? '中型绿植（龟背竹）' : '中型绿植', quantity: 1, necessity: 'Recommended', priceMin: 89, priceMax: 169, placement: '窗边或角落', reason: '增强空间生气' },
    { name: '收纳篮', quantity: 1, necessity: 'Optional', priceMin: 39, priceMax: 89, placement: '床边地面', reason: '收纳杂物更整洁' },
    { name: '木质托盘', quantity: 1, necessity: 'Optional', priceMin: 39, priceMax: 89, placement: '桌面或边几', reason: '让台面更有秩序' },
  ];
}

function normalizeGuideRawItems(rawItems: RawItem[]) {
  return rawItems
    .slice(0, 18)
    .map((item, index) => {
      const id = index + 1;
      const name = toChineseName(item.name || '');
      if (!name || shouldExcludeItem(name)) return null;

      const category = inferCategory(name);
      const necessity = normalizeNecessity(item.necessity);
      const quantity = Math.round(clamp(Number(item.quantity || 1), 1, 3));
      const price = normalizePrice(name, item.priceMin, item.priceMax);

      const rawCenterX = Number(item.anchor?.centerX ?? item.anchor?.cx);
      const rawCenterY = Number(item.anchor?.centerY ?? item.anchor?.cy);
      const rawX = Number(item.anchor?.x);
      const rawY = Number(item.anchor?.y);
      const rawLeft = Number(item.anchor?.left);
      const rawTop = Number(item.anchor?.top);
      const rawRight = Number(item.anchor?.right);
      const rawBottom = Number(item.anchor?.bottom);
      const rawW = Number(item.anchor?.width ?? item.anchor?.w);
      const rawH = Number(item.anchor?.height ?? item.anchor?.h);
      const hasRightBottom = Number.isFinite(rawRight) && Number.isFinite(rawBottom);
      const hasBoxFromSide = hasRightBottom && Number.isFinite(rawLeft) && Number.isFinite(rawTop);
      const hasBox = Number.isFinite(rawW) && Number.isFinite(rawH);
      const hasCenter = Number.isFinite(rawCenterX) && Number.isFinite(rawCenterY);
      const hasXY = Number.isFinite(rawX) && Number.isFinite(rawY);
      const hasLeftTop = Number.isFinite(rawLeft) && Number.isFinite(rawTop);
      const hasAnchor = hasCenter || hasXY || hasLeftTop || hasRightBottom;
      const confidence = Number.isFinite(item.anchor?.confidence as number)
        ? clamp(Number(item.anchor?.confidence), 0, 1)
        : 0;

      const fallbackSize = fallbackSizeByName(name);
      const width = hasBox
        ? clamp(rawW, 6, 56)
        : hasBoxFromSide
          ? clamp(rawRight - rawLeft, 6, 56)
          : fallbackSize.width;
      const height = hasBox
        ? clamp(rawH, 6, 56)
        : hasBoxFromSide
          ? clamp(rawBottom - rawTop, 6, 56)
          : fallbackSize.height;

      let left = Number.NaN;
      let top = Number.NaN;

      if (hasLeftTop) {
        left = rawLeft;
        top = rawTop;
      } else if (hasCenter) {
        left = rawCenterX - width / 2;
        top = rawCenterY - height / 2;
      } else if (hasXY) {
        const centerCandidateLeft = rawX - width / 2;
        const centerCandidateTop = rawY - height / 2;
        const centerCandidateValid =
          centerCandidateLeft >= -5 &&
          centerCandidateTop >= -5 &&
          centerCandidateLeft + width <= 105 &&
          centerCandidateTop + height <= 105;

        if (centerCandidateValid) {
          left = centerCandidateLeft;
          top = centerCandidateTop;
        } else {
          left = rawX;
          top = rawY;
        }
      } else if (hasRightBottom) {
        left = rawRight - width;
        top = rawBottom - height;
      }

      const safeLeft = Number.isFinite(left) ? clamp(left, 0, 100 - width) : 50 - width / 2;
      const safeTop = Number.isFinite(top) ? clamp(top, 0, 100 - height) : 50 - height / 2;
      const x = clamp(safeLeft + width / 2, width / 2 + 1, 100 - width / 2 - 1);
      const y = clamp(safeTop + height / 2, height / 2 + 1, 100 - height / 2 - 1);
      const hasPoint = hasAnchor && confidence >= 0.63;

      const placement = toChinesePlacement(item.placement || '');
      const reason = toChineseReason(item.reason || '');

      return {
        id,
        name,
        category,
        quantity,
        priceMin: price.min,
        priceMax: price.max,
        priceRange: `¥${price.min}-${price.max}`,
        placement,
        necessity,
        reason,
        imageTarget: {
          x,
          y,
          left: safeLeft,
          top: safeTop,
          width,
          height,
          confidence,
          hasAnchor,
          hasPoint,
        },
      } satisfies NormalizedItem;
    })
    .filter((item): item is NormalizedItem => Boolean(item))
    .filter((item) => item.imageTarget.confidence >= 0.1);
}

function resolveInlineImagePart(image: string) {
  if (isDataUrl(image)) {
    return {
      mimeType: extractMimeType(image),
      data: stripDataUrl(image),
    };
  }

  if (isProbablyBase64(image)) {
    return {
      mimeType: 'image/jpeg',
      data: stripDataUrl(image),
    };
  }

  return null;
}

async function fetchRemoteImageAsInlinePart(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(url, { method: 'GET', signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Failed to fetch source image: ${response.status}`);
    }
    const mimeType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = Buffer.from(await response.arrayBuffer());
    return {
      mimeType,
      data: buffer.toString('base64'),
    };
  } finally {
    clearTimeout(timer);
  }
}

type InlineImagePart = { mimeType: string; data: string };

async function toInlineImagePart(image?: string): Promise<InlineImagePart | null> {
  if (!image) return null;
  const inline = resolveInlineImagePart(image);
  if (inline) return inline;
  if (isHttpUrl(image)) return fetchRemoteImageAsInlinePart(image);
  return null;
}

async function generateGeminiImageFromReference(
  image: string,
  prompt: string,
  negativePrompt?: string
) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GEMINI_API_KEY (or GOOGLE_API_KEY)');
  }

  const imagePart = await toInlineImagePart(image);
  if (!imagePart) {
    throw new Error('Unsupported image format');
  }

  const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image-preview';
  const finalPrompt = negativePrompt
    ? `${prompt}\n\nNegative prompt (must avoid):\n${negativePrompt}`
    : prompt;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: finalPrompt },
              {
                inline_data: {
                  mime_type: imagePart.mimeType,
                  data: imagePart.data,
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ['IMAGE'],
        },
      }),
    }
  );

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result?.error?.message || result?.error || `Gemini ${response.status}`);
  }

  const parts = result?.candidates?.[0]?.content?.parts ?? [];
  const imageResultPart = parts.find((part: any) => part?.inline_data || part?.inlineData);
  const inline = imageResultPart?.inline_data || imageResultPart?.inlineData;
  const mimeType = inline?.mime_type || inline?.mimeType || 'image/png';
  const data = inline?.data;

  if (!data) {
    throw new Error('No image data returned from Gemini');
  }

  return `data:${mimeType};base64,${data}`;
}

function getPrompt(theme: string, hasBefore: boolean) {
  return `
你是租房改造购物助手。请基于${hasBefore ? '原图 + 效果图对照' : '效果图'}，识别可购买、可摆放的具体物件（目标 12-18 个）。

硬性规则：
1) 只能输出具体物品，不要抽象概念。
2) 只基于图中可见物件，不得臆造。
3) 如果提供了原图：只保留“效果图中新增或明显增强”的物件；原图里本来就有且无明显变化的物件必须排除。
4) 每个物件必须有 anchor 坐标与尺寸：centerX/centerY（中心点）、left/top（左上角）、width/height（0-100）和 confidence（0-1）。
5) centerX/centerY 必须基于物体几何中心；width/height 贴合物体轮廓，不要固定模板尺寸。
6) 如果不确定，把 confidence 降低到 0.55 以下；不确定项宁可不输出。
7) 需要尽量覆盖：所有可见灯具、地毯/地面织物、床品/抱枕/毯子、装饰摆件、挂画、绿植。
8) 同类型可重复输出（例如两个灯），不要只保留一个。
9) 价格区间要收窄，符合中国电商常见区间。
10) 所有字段优先用中文，名称要简洁完整，禁止省略号。

风格上下文：${theme || '日式原木风'}

推荐识别对象：
落地灯、台灯、灯串、地毯、床品、抱枕、披毯、挂画、绿植、投影仪、小边几、收纳托盘。

返回 JSON，格式严格如下：
{
  "summary": "一句简短中文总结",
  "items": [
    {
      "name": "暖光落地灯",
      "quantity": 1,
      "priceMin": 159,
      "priceMax": 239,
      "placement": "沙发右侧",
      "necessity": "Must-have|Recommended|Optional",
      "reason": "一句中文短句",
      "anchor": { "centerX": 72, "centerY": 58, "left": 66, "top": 45, "width": 12, "height": 26, "confidence": 0.82 }
    }
  ]
}
`.trim();
}

function buildItemsBoardPrompt(theme: string, items: NormalizedItem[]) {
  const assignedOrder = items
    .filter((item) => item.boardCell)
    .sort((a, b) => (a.boardCell?.index || 99) - (b.boardCell?.index || 99))
    .map((item, index) => `${index + 1}. ${item.name}`)
    .join('、');

  return `
Use the provided generated room image as the ONLY visual reference.
Generate a single hidden extraction image for deterministic thumbnail crops.

GOAL:
Create one clean white-background composite image containing isolated purchasable objects from the room.
This image is for internal cropping only, not for user display.

STRICT LAYOUT:
1) Final canvas must be exactly ${ITEMS_BOARD_CONFIG.width}x${ITEMS_BOARD_CONFIG.height} pixels.
2) Use an invisible 4 columns x 3 rows placement map with 12 equal regions.
3) Do NOT draw the map. Do NOT render region borders, frames, dividers, cards, boxes, tiles, or outlines.
4) Put exactly one complete object in each region.
5) Every object must be centered in its region with large empty white margin around it.
6) Each object should occupy only about 60% to 70% of its region, never touching edges.
7) No overlap between objects.
8) No room background, no architecture, no furniture scene, no walls, no floor, no windows.

OBJECT RULES:
1) Preserve the same color, material, and overall styling seen in the generated room.
2) Show complete recognizable objects, never texture fragments or cropped corners.
3) Prioritize visible purchasable items only: lamps, rugs, bedding, pillows, throws, decor objects, framed art, plants, accessories.
4) Forbidden: wall paint, wall color, ceiling, flooring material, doors, windows, architectural elements.

ABSOLUTELY FORBIDDEN:
- text
- letters
- numbers
- labels
- arrows
- callouts
- guide lines
- captions
- logos
- watermarks
- UI overlays
- borders
- frames
- boxes
- dividers
- poster layouts
- magazine layouts
- infographic styling

VISUAL STYLE:
- e-commerce product photography
- pure white or very light neutral background
- soft studio lighting
- realistic materials
- clean, sharp edges
- no decorative composition

PLACE OBJECTS in exact reading order from top-left to bottom-right:
${assignedOrder || 'Use visible purchasable objects from the generated room and place them deterministically.'}

Theme context: ${theme || '日式原木风'}
`.trim();
}

function getBoardValidationPrompt(theme: string) {
  return `
You are validating an internal extracted-items board image for a shopping guide.
Inspect the image and return strict JSON only.

Validation goals:
1) detect whether there are visible text or number regions
2) detect whether there are visible frames, boxes, dividers, or grid-like lines
3) estimate whether the background is mostly white or very light neutral
4) provide rough bounding regions for text and frame artifacts when visible

Rules:
- text includes any letters, Chinese text, numbers, labels, captions, or watermarks
- frame artifacts include borders, cell outlines, dividers, panel lines, box edges, grid lines
- only mark regions when reasonably visible
- coordinates must be percentages from 0 to 100
- return at most 8 text regions and 8 frame regions

Theme context: ${theme || '日式原木风'}

Return JSON in this exact structure:
{
  "hasText": true,
  "hasGridOrFrames": true,
  "whiteBackgroundScore": 0.72,
  "backgroundMostlyWhite": true,
  "textRegions": [
    { "left": 10, "top": 10, "width": 20, "height": 8, "confidence": 0.81, "label": "text" }
  ],
  "frameRegions": [
    { "left": 0, "top": 0, "width": 100, "height": 100, "confidence": 0.78, "label": "frame" }
  ],
  "reasons": ["text detected", "frame lines detected"]
}
`.trim();
}

function getBoardCleanupPrompt(theme: string) {
  return `
Use the provided extracted-items board as the exact base image.

Task:
Remove only unwanted artifacts from the board:
- any text
- any letters
- any numbers
- any labels
- any captions
- any arrows
- any guide lines
- any borders
- any frames
- any boxes
- any dividers
- any faint UI chrome

Preserve strictly:
- same canvas size
- same background whiteness
- same object count
- same object order
- same object placement
- same object scale
- same object colors and materials

Do not redesign the objects.
Do not add new objects.
Do not remove valid objects.
Do not move objects.

Theme context: ${theme || '日式原木风'}
`.trim();
}

function dedupeByObject(items: RawItem[]) {
  const seen = new Set<string>();
  const out: RawItem[] = [];

  for (const item of items) {
    const baseName = compactName(item.name).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '').slice(0, 28);
    if (!baseName) continue;
    const ax = Number(item.anchor?.x ?? item.anchor?.centerX ?? item.anchor?.left ?? 0);
    const ay = Number(item.anchor?.y ?? item.anchor?.centerY ?? item.anchor?.top ?? 0);
    const gx = Number.isFinite(ax) ? Math.round(ax / 5) : -1;
    const gy = Number.isFinite(ay) ? Math.round(ay / 5) : -1;
    const key = `${baseName}@${gx},${gy}`;
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

async function validateExtractedBoardImage(image: string, theme: string, apiKey: string) {
  const imagePart = await toInlineImagePart(image);
  if (!imagePart) {
    throw new Error('board image unsupported for validation');
  }

  const model = process.env.GEMINI_VISION_MODEL || 'gemini-2.5-flash';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 18000);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: getBoardValidationPrompt(theme) },
                {
                  inline_data: {
                    mime_type: imagePart.mimeType,
                    data: imagePart.data,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        }),
        signal: controller.signal,
      }
    );

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result?.error?.message || result?.error || `Validation failed (${response.status})`);
    }

    const parts = result?.candidates?.[0]?.content?.parts ?? [];
    const text = parts.map((p: any) => p?.text || '').join('\n').trim();
    const parsed = safeParseJson<any>(text);
    if (!parsed) {
      throw new Error('validation parse failed');
    }

    const textRegions = Array.isArray(parsed.textRegions)
      ? parsed.textRegions.map((region: any) => toRegion(region, 'text')).filter(Boolean).slice(0, 8) as ValidationRegion[]
      : [];
    const frameRegions = Array.isArray(parsed.frameRegions)
      ? parsed.frameRegions.map((region: any) => toRegion(region, 'frame')).filter(Boolean).slice(0, 8) as ValidationRegion[]
      : [];

    const hasText = Boolean(parsed.hasText) || textRegions.length > 0;
    const hasGridOrFrames = Boolean(parsed.hasGridOrFrames) || frameRegions.length > 0;
    const whiteBackgroundScore = clamp(Number(parsed.whiteBackgroundScore || 0), 0, 1);
    const backgroundMostlyWhite = Boolean(parsed.backgroundMostlyWhite) || whiteBackgroundScore >= 0.72;

    const reasons = Array.isArray(parsed.reasons)
      ? parsed.reasons.map((reason: unknown) => String(reason)).filter(Boolean)
      : [];

    let failureCode: string | null = null;
    if (hasText) failureCode = 'text_regions_detected';
    else if (hasGridOrFrames) failureCode = 'frame_lines_detected';
    else if (!backgroundMostlyWhite) failureCode = 'background_not_white';

    return {
      checked: true,
      valid: !hasText && !hasGridOrFrames && backgroundMostlyWhite,
      hasText,
      hasGridOrFrames,
      whiteBackgroundScore,
      backgroundMostlyWhite,
      textRegions,
      frameRegions,
      reasons,
      failureCode,
    } satisfies ExtractedBoardValidation;
  } finally {
    clearTimeout(timer);
  }
}

async function cleanupExtractedBoardImage(
  image: string,
  theme: string
) {
  return withTimeout(
    generateGeminiImageFromReference(
      image,
      getBoardCleanupPrompt(theme),
      'text, letters, numbers, labels, captions, arrows, guide lines, borders, frames, boxes, cards, tiles, dividers, panel outlines, grid lines, table lines, watermark, logo, ui overlay, infographic layout, poster layout'
    ),
    45000,
    'board cleanup timeout'
  );
}

async function analyzeItems(beforeImage: string | undefined, afterImage: string, theme: string, apiKey: string) {
  const beforePart = await toInlineImagePart(beforeImage).catch(() => null);
  const afterPart = await toInlineImagePart(afterImage);

  if (!afterPart) {
    throw new Error('Unsupported image format');
  }

  const model = process.env.GEMINI_VISION_MODEL || 'gemini-2.5-flash';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: getPrompt(theme, Boolean(beforePart)) },
                ...(beforePart
                  ? [
                      { text: '[原图 BEFORE]' },
                      {
                        inline_data: {
                          mime_type: beforePart.mimeType,
                          data: beforePart.data,
                        },
                      },
                    ]
                  : []),
                { text: '[效果图 AFTER]' },
                {
                  inline_data: {
                    mime_type: afterPart.mimeType,
                    data: afterPart.data,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.15,
            responseMimeType: 'application/json',
          },
        }),
        signal: controller.signal,
      }
    );

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result?.error?.message || result?.error || `Analysis failed (${response.status})`);
    }

    const parts = result?.candidates?.[0]?.content?.parts ?? [];
    const text = parts.map((p: any) => p?.text || '').join('\n').trim();
    const parsed = safeParseJson<{ summary?: string; items?: RawItem[] }>(text);

    if (!parsed?.items || !Array.isArray(parsed.items) || parsed.items.length === 0) {
      throw new Error('No items detected from image');
    }

    return {
      summary: (parsed.summary || '').trim(),
      items: dedupeByObject(parsed.items),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Payload;
    const beforeImage = body.beforeImage || '';
    const afterImage = body.afterImage || body.image || '';
    const theme = body.theme || 'Japandi';

    if (!afterImage) {
      return NextResponse.json({ error: 'Missing image' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    let analyzed: { summary: string; items: RawItem[] } = {
      summary:
        '已根据效果图生成基础购物建议。你可以先从灯光、床品和地毯三项开始落地，最快看到空间变化。',
      items: getFallbackRawItems(theme),
    };

    if (apiKey) {
      try {
        analyzed = await withTimeout(
          analyzeItems(beforeImage || undefined, afterImage, theme, apiKey),
          12000,
          'analysis timeout'
        );
      } catch (error) {
        console.error('guide analysis fallback:', error);
      }
    }

    let normalizedAll = normalizeGuideRawItems(analyzed.items);
    let usedThemeFallback = false;

    if (normalizedAll.length === 0) {
      normalizedAll = normalizeGuideRawItems(getFallbackRawItems(theme));
      usedThemeFallback = true;
    }

    const normalized = normalizedAll;

    let reduced = normalized
      .sort((a, b) => {
        const score = (n: Necessity) => (n === 'Must-have' ? 0 : n === 'Recommended' ? 1 : 2);
        if (score(a.necessity) !== score(b.necessity)) {
          return score(a.necessity) - score(b.necessity);
        }
        return b.imageTarget.confidence - a.imageTarget.confidence;
      })
      .slice(0, 12);

    if (reduced.length < 10) {
      const picked = new Set(reduced.map((item) => item.id));
      const topUp = normalizedAll
        .filter((item) => !picked.has(item.id))
        .sort((a, b) => b.imageTarget.confidence - a.imageTarget.confidence)
        .slice(0, 12 - reduced.length);
      reduced = [...reduced, ...topUp];
    }

    const boardItems = assignItemsToBoardCells(reduced.slice(0, 12));
    let itemsBoardImageUrl = '';
    const boardDebug = makeDefaultBoardDebug();
    if (usedThemeFallback) {
      boardDebug.failureCode = 'analysis_fallback';
      boardDebug.failureReason = 'analysis returned no valid purchasable items; used theme fallback list';
      boardDebug.fallbackReason = 'analysis_fallback';
    }

    try {
      if (boardItems.length > 0) {
        boardDebug.generationAttempted = true;
        const boardPrompt = buildItemsBoardPrompt(theme, boardItems);
        const candidateUrl = await withTimeout(
          generateGeminiImageFromReference(
            afterImage,
            boardPrompt,
            'room background, full room scene, interior scene, architecture, walls, floor, windows, clutter, watermark, logo, text, letters, numbers, labels, captions, arrows, guide lines, callouts, UI overlays, annotation text, index markers, borders, frames, boxes, cards, dividers, panel outlines, grid lines, table lines, collage layout, poster layout, infographic layout, overlapping objects, cropped fragments, texture close-up'
          ),
          35000,
          'items board timeout'
        );
        const rawMeta = getImageDebugMeta(candidateUrl);
        boardDebug.generationSucceeded = Boolean(candidateUrl);
        boardDebug.rawImageKind = rawMeta.kind;
        boardDebug.rawImageRef = rawMeta.ref;
        boardDebug.rawImageLength = rawMeta.length;

        if (!candidateUrl) {
          boardDebug.status = 'generation_failed';
          boardDebug.failureCode = 'missing_board_image';
          boardDebug.failureReason = 'board generator returned empty image';
          boardDebug.fallbackReason = 'missing_board_image';
        } else if (!apiKey) {
          itemsBoardImageUrl = candidateUrl;
          boardDebug.status = 'generated_unchecked';
          boardDebug.thumbnailSource = 'extracted_board';
          boardDebug.failureCode = 'validation_unavailable';
          boardDebug.failureReason = 'missing GEMINI_API_KEY (or GOOGLE_API_KEY) for validation';
        } else {
          let rawValidation: ExtractedBoardValidation;
          try {
            rawValidation = await withTimeout(
              validateExtractedBoardImage(candidateUrl, theme, apiKey),
              6000,
              'board validation timeout'
            );
          } catch (validationError) {
            itemsBoardImageUrl = candidateUrl;
            boardDebug.status = 'generated_unchecked';
            boardDebug.thumbnailSource = 'extracted_board';
            boardDebug.failureCode = 'validation_unavailable';
            boardDebug.failureReason =
              validationError instanceof Error ? validationError.message : 'board validation failed';
            boardDebug.fallbackReason = null;
            rawValidation = {
              ...makeDefaultValidation(),
              checked: false,
              failureCode: 'validation_unavailable',
              reasons: [boardDebug.failureReason],
            };
          }
          boardDebug.validation = rawValidation;

          if (rawValidation.valid) {
            itemsBoardImageUrl = candidateUrl;
            boardDebug.status = 'generated_valid';
            boardDebug.thumbnailSource = 'extracted_board';
          } else if (boardDebug.status !== 'generated_unchecked') {
            boardDebug.status = 'generated_invalid';
            boardDebug.failureCode = rawValidation.failureCode || 'extracted_board_invalid';
            boardDebug.failureReason = rawValidation.reasons.join(' | ') || rawValidation.failureCode || 'validation failed';
            boardDebug.cleanupAttempted = false;
            boardDebug.cleanupSucceeded = false;
            boardDebug.fallbackReason = boardDebug.failureCode;
          }
        }
      }
    } catch (error) {
      console.error('items board generation failed:', error);
      itemsBoardImageUrl = '';
      boardDebug.status = 'generation_failed';
      boardDebug.generationAttempted = true;
      boardDebug.generationSucceeded = false;
      boardDebug.failureCode = 'board_generation_failed';
      boardDebug.failureReason = error instanceof Error ? error.message : 'board generation failed';
      boardDebug.fallbackReason = 'board_generation_failed';
    }

    if (!itemsBoardImageUrl) {
      boardDebug.thumbnailSource = 'main_image_fallback';
      if (!boardDebug.fallbackReason) {
        boardDebug.fallbackReason = boardDebug.failureCode || 'board_missing';
      }
    }

    return NextResponse.json({
      summary:
        analyzed.summary ||
        '已从当前效果图识别关键可购买物件，可按优先级逐步添置。',
      items: boardItems,
      itemsBoardImageUrl,
      explainerImageUrl: itemsBoardImageUrl,
      extractedBoardStatus: itemsBoardImageUrl
        ? boardDebug.status
        : boardDebug.status === 'not_attempted'
          ? 'extracted_board_invalid'
          : boardDebug.status,
      extractedBoardDebug: boardDebug,
      fallbackReason: boardDebug.fallbackReason,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
