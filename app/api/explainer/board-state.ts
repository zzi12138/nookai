import type { BoardCell, BoardCategory } from '../../lib/itemsBoard';

export type Category = BoardCategory;

export type Necessity = 'Must-have' | 'Recommended' | 'Optional';

export type RawItem = {
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

export type NormalizedItem = {
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
  previewImage?: string;
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

export type ValidationRegion = {
  left: number;
  top: number;
  width: number;
  height: number;
  confidence: number;
  label: string;
};

export type ExtractedBoardValidation = {
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

export type ExtractedBoardDebug = {
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
  thumbnailSource: 'gemini_item_preview' | 'main_image_fallback';
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function stripDataUrl(value: string) {
  return value.includes(',') ? value.split(',')[1] : value;
}

export function extractMimeType(dataUrl: string) {
  const m = dataUrl.match(/^data:([^;]+);base64,/i);
  return m?.[1] || 'image/jpeg';
}

export function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

export function isDataUrl(value: string) {
  return /^data:[^;]+;base64,/i.test(value);
}

export function isProbablyBase64(value: string) {
  if (!value) return false;
  return /^[A-Za-z0-9+/=\r\n]+$/.test(value) && value.length > 64;
}

export function toRegion(raw: any, fallbackLabel: string): ValidationRegion | null {
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

export function getImageDebugMeta(imageUrl?: string) {
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

export function makeDefaultValidation(): ExtractedBoardValidation {
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

export function makeDefaultBoardDebug(): ExtractedBoardDebug {
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

function normalizeNecessity(raw?: string): Necessity {
  const v = (raw || '').toLowerCase();
  if (v.includes('must') || v.includes('必买') || v.includes('high')) return 'Must-have';
  if (v.includes('recommended') || v.includes('建议')) return 'Recommended';
  return 'Optional';
}

function inferCategory(name: string): Category {
  const n = name.toLowerCase();
  if (n.includes('灯') || n.includes('lamp') || n.includes('light')) return 'Ambient lighting';
  if (
    n.includes('床品') ||
    n.includes('抱枕') ||
    n.includes('毯') ||
    n.includes('bedding') ||
    n.includes('pillow') ||
    n.includes('throw') ||
    n.includes('textile')
  )
    return 'Bedding & soft textiles';
  if (n.includes('地毯') || n.includes('rug') || n.includes('mat')) return 'Floor soft furnishings';
  if (n.includes('画') || n.includes('art') || n.includes('挂') || n.includes('poster')) return 'Wall decor';
  if (n.includes('绿植') || n.includes('plant') || n.includes('树') || n.includes('leaf')) return 'Plants';
  return 'Functional accessories';
}

function compactName(raw?: string) {
  const name = (raw || '').trim();
  return name.replace(/\s+/g, ' ').replace(/^[-•\d.]+\s*/, '').slice(0, 40);
}

function normalizePlacement(raw?: string) {
  const value = (raw || '').trim();
  return value.replace(/\s+/g, ' ').slice(0, 40);
}

function normalizeReason(raw?: string) {
  const value = (raw || '').trim();
  return value.replace(/\s+/g, ' ').slice(0, 40);
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
  if (n.includes('table lamp') || n.includes('desk lamp')) return '桌面台灯';
  if (n.includes('rug')) return '地毯';
  if (n.includes('bedding') || n.includes('bed')) return '亚麻床品';
  if (n.includes('pillow')) return '装饰抱枕';
  if (n.includes('throw') || n.includes('blanket')) return '针织披毯';
  if (n.includes('plant')) return '中型绿植';
  if (n.includes('art') || n.includes('poster') || n.includes('frame')) return '免打孔挂画';
  if (n.includes('basket')) return '收纳篮';
  if (n.includes('tray')) return '木质托盘';
  if (n.includes('sofa')) return '沙发';
  if (n.includes('desk')) return '书桌';
  if (n.includes('chair')) return '椅子';
  return name;
}

function toChinesePlacement(raw: string) {
  const value = normalizePlacement(raw);
  if (!value) return '';
  if (hasChinese(value)) return value;
  const n = value.toLowerCase();
  if (n.includes('sofa')) return '沙发旁';
  if (n.includes('bed')) return '床头或床尾';
  if (n.includes('desk')) return '书桌一侧';
  if (n.includes('window')) return '窗边';
  if (n.includes('corner')) return '房间角落';
  return value;
}

function toChineseReason(raw: string) {
  const value = normalizeReason(raw);
  if (!value) return '';
  if (hasChinese(value)) return value;
  const n = value.toLowerCase();
  if (n.includes('light')) return '补充柔和光线';
  if (n.includes('texture') || n.includes('layer')) return '增加软装层次';
  if (n.includes('cozy')) return '提升温馨感';
  if (n.includes('focus')) return '形成视觉焦点';
  if (n.includes('order')) return '让空间更整洁';
  return value;
}

function narrowRangeByName(name: string) {
  const n = name.toLowerCase();
  if (n.includes('落地灯')) return { min: 159, max: 239 };
  if (n.includes('台灯')) return { min: 69, max: 119 };
  if (n.includes('地毯')) return { min: 199, max: 299 };
  if (n.includes('床品')) return { min: 179, max: 259 };
  if (n.includes('抱枕')) return { min: 39, max: 89 };
  if (n.includes('披毯')) return { min: 79, max: 149 };
  if (n.includes('挂画')) return { min: 79, max: 129 };
  if (n.includes('绿植')) return { min: 89, max: 169 };
  if (n.includes('收纳')) return { min: 39, max: 89 };
  if (n.includes('托盘')) return { min: 59, max: 99 };
  return { min: 49, max: 149 };
}

function normalizePrice(name: string, minRaw?: number, maxRaw?: number) {
  const preset = narrowRangeByName(name);
  const min = Number.isFinite(minRaw) ? Number(minRaw) : preset.min;
  const max = Number.isFinite(maxRaw) ? Number(maxRaw) : preset.max;

  const safeMin = clamp(Math.round(Math.min(min, max)), 0, 9999);
  const safeMax = clamp(Math.round(Math.max(min, max)), safeMin, 9999);
  const span = max - min;

  if (span > 120) {
    return { min: preset.min, max: preset.max };
  }

  return { min: safeMin, max: safeMax };
}

function fallbackSizeByName(name: string) {
  const n = name.toLowerCase();
  if (n.includes('落地灯')) return { width: 12, height: 28 };
  if (n.includes('台灯')) return { width: 10, height: 18 };
  if (n.includes('地毯')) return { width: 30, height: 22 };
  if (n.includes('床品')) return { width: 34, height: 26 };
  if (n.includes('抱枕')) return { width: 12, height: 12 };
  if (n.includes('披毯')) return { width: 18, height: 12 };
  if (n.includes('挂画')) return { width: 16, height: 20 };
  if (n.includes('绿植')) return { width: 18, height: 24 };
  if (n.includes('收纳')) return { width: 14, height: 14 };
  if (n.includes('托盘')) return { width: 14, height: 10 };
  return { width: 14, height: 14 };
}

function shouldExcludeItem(name: string) {
  const n = name.toLowerCase();

  // Always blocked — structural / hard furnishing keywords
  const alwaysBlocked = [
    'wall',
    'floor',
    'ceiling',
    'door',
    'window',
    'cabinet',
    'air conditioner',
    '窗框',
    '电视柜',
    'built-in',
  ];
  if (alwaysBlocked.some((kw) => n.includes(kw))) return true;

  // Block large furniture only when the name IS the furniture itself,
  // not when it's a modifier (e.g. "bedside lamp", "desk organizer").
  const furnitureExact = [
    { keyword: 'sofa', allowIf: ['sofa cover', 'sofa pillow', 'sofa cushion', '沙发套', '沙发垫', '沙发抱枕'] },
    { keyword: 'bed', allowIf: ['bedding', 'bedside', 'bed sheet', 'bed cover', 'bed linen', '床品', '床头灯', '床头柜灯', '床尾毯'] },
    { keyword: 'desk', allowIf: ['desk lamp', 'desk mat', 'desk organizer', '桌面', '台灯', '桌垫'] },
    { keyword: 'chair', allowIf: ['chair cushion', 'chair pad', '椅垫', '椅套'] },
    { keyword: '沙发', allowIf: ['沙发套', '沙发垫', '沙发抱枕', '沙发盖毯'] },
    { keyword: '原有床', allowIf: [] },
    { keyword: '原有沙发', allowIf: [] },
    { keyword: '原有书桌', allowIf: [] },
  ];

  for (const rule of furnitureExact) {
    if (n.includes(rule.keyword)) {
      if (rule.allowIf.some((allowed) => n.includes(allowed.toLowerCase()))) return false;
      // If the name is just the furniture keyword (possibly with quantity/color prefix), exclude it
      const stripped = n.replace(/[^a-z\u4e00-\u9fff]/g, '');
      if (stripped === rule.keyword || stripped.length <= rule.keyword.length + 4) return true;
    }
  }

  return false;
}

export function getFallbackRawItems(theme: string): RawItem[] {
  const styleHint = (theme || '').toLowerCase();
  const isMinimal = styleHint.includes('简约') || styleHint.includes('minimal');
  const isVintage = styleHint.includes('复古') || styleHint.includes('vintage');
  const isNature = styleHint.includes('绿植') || styleHint.includes('nature');

  return [
    { name: '暖光落地灯', quantity: 1, necessity: 'Must-have', priceMin: 159, priceMax: 239, placement: '沙发右侧', reason: '最快提升氛围感' },
    { name: '纸灯落地灯', quantity: 1, necessity: 'Must-have', priceMin: 179, priceMax: 259, placement: '沙发后方或床边', reason: '补充柔和侧光层次' },
    { name: '桌面台灯', quantity: 1, necessity: 'Recommended', priceMin: 69, priceMax: 119, placement: '书桌右上角', reason: '补充局部照明' },
    { name: isMinimal ? '素色几何地毯' : '方形地毯', quantity: 1, necessity: 'Must-have', priceMin: 199, priceMax: 299, placement: '床尾或床侧', reason: '统一地面视觉' },
    { name: '亚麻床品', quantity: 1, necessity: 'Must-have', priceMin: 179, priceMax: 259, placement: '床面整体', reason: '降低杂乱感' },
    { name: isVintage ? '复古抱枕' : '装饰抱枕', quantity: 2, necessity: 'Recommended', priceMin: 49, priceMax: 99, placement: '床头或沙发', reason: '增加软装层次' },
    { name: '针织披毯', quantity: 1, necessity: 'Optional', priceMin: 79, priceMax: 149, placement: '床尾', reason: '提升舒适度' },
    { name: '免打孔挂画', quantity: 1, necessity: 'Recommended', priceMin: 79, priceMax: 129, placement: '床头墙面', reason: '形成视觉焦点' },
    { name: isNature ? '中型绿植（龟背竹）' : '中型绿植', quantity: 1, necessity: 'Recommended', priceMin: 89, priceMax: 169, placement: '窗边或角落', reason: '增强空间生气' },
    { name: '木质托盘', quantity: 1, necessity: 'Optional', priceMin: 39, priceMax: 89, placement: '桌面或茶几', reason: '让台面更有秩序' },
    { name: '茶几摆件', quantity: 1, necessity: 'Optional', priceMin: 39, priceMax: 99, placement: '茶几中间', reason: '补足桌面装饰重点' },
  ];
}

export function normalizeGuideRawItems(rawItems: RawItem[], options?: { allowSyntheticAnchor?: boolean }) {
  const allowSyntheticAnchor = Boolean(options?.allowSyntheticAnchor);
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
        : hasAnchor ? 0.5 : 0;
      const syntheticConfidence = allowSyntheticAnchor ? 0.32 : 0;
      const effectiveConfidence = confidence || syntheticConfidence;

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
      } else if (allowSyntheticAnchor) {
        const gridX = (index % 6) * 14 + 10;
        const gridY = Math.floor(index / 6) * 28 + 16;
        left = gridX;
        top = gridY;
      }

      const safeLeft = Number.isFinite(left) ? clamp(left, 0, 100 - width) : 50 - width / 2;
      const safeTop = Number.isFinite(top) ? clamp(top, 0, 100 - height) : 50 - height / 2;
      const x = clamp(safeLeft + width / 2, width / 2 + 1, 100 - width / 2 - 1);
      const y = clamp(safeTop + height / 2, height / 2 + 1, 100 - height / 2 - 1);
      const hasPoint = (hasAnchor || allowSyntheticAnchor) && effectiveConfidence >= 0.25;

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
          confidence: effectiveConfidence,
          hasAnchor: hasAnchor || allowSyntheticAnchor,
          hasPoint,
        },
      } satisfies NormalizedItem;
    })
    .filter((item): item is NormalizedItem => Boolean(item))
    .filter((item) => item.imageTarget.confidence >= 0.1);
}

export function dedupeByObject(items: RawItem[]) {
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
