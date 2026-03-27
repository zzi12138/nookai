'use client';

/**
 * Client-side image utilities.
 * - shrinkImageDataUrl: resize image for API transmission
 * - cropImageByAnchor: crop a region from image by percentage anchor (for AI input only)
 */

export async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image-load-failed'));
    img.src = src;
  });
}

export async function shrinkImageDataUrl(
  dataUrl: string,
  maxEdge = 1280,
  quality = 0.82,
): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) return dataUrl;

  try {
    const image = await loadImage(dataUrl);
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    if (!width || !height) return dataUrl;

    const scale = Math.min(1, maxEdge / Math.max(width, height));
    if (scale >= 1 && dataUrl.length < 1_500_000) return dataUrl;

    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;
    ctx.drawImage(image, 0, 0, targetW, targetH);

    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    return dataUrl;
  }
}

/**
 * Crop a region from an image using percentage-based anchor coordinates.
 * Used only as supplementary AI input, NOT for user-facing display.
 */
export async function cropImageByAnchor(
  imageDataUrl: string,
  anchor: { centerX: number; centerY: number; width: number; height: number },
  padding = 0.35,
): Promise<string> {
  const img = await loadImage(imageDataUrl);
  const imgW = img.naturalWidth;
  const imgH = img.naturalHeight;

  const cx = (anchor.centerX / 100) * imgW;
  const cy = (anchor.centerY / 100) * imgH;
  const w = (anchor.width / 100) * imgW;
  const h = (anchor.height / 100) * imgH;

  const padW = w * padding;
  const padH = h * padding;
  const cropX = Math.max(0, cx - w / 2 - padW);
  const cropY = Math.max(0, cy - h / 2 - padH);
  const cropW = Math.min(imgW - cropX, w + padW * 2);
  const cropH = Math.min(imgH - cropY, h + padH * 2);

  if (cropW < 20 || cropH < 20) throw new Error('Crop area too small');

  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 512 / Math.max(cropW, cropH));
  canvas.width = Math.round(cropW * scale);
  canvas.height = Math.round(cropH * scale);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85);
}
