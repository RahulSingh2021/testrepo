const MAX_WIDTH = 1200;
const MAX_HEIGHT = 1200;
const DEFAULT_QUALITY = 0.7;
const SIGNATURE_QUALITY = 0.8;
const MAX_FILE_SIZE_BYTES = 100 * 1024;

function getDataUrlSizeBytes(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1];
  if (!base64) return dataUrl.length;
  return Math.ceil(base64.length * 3 / 4);
}

function resizeAndCompress(
  img: HTMLImageElement,
  maxW: number,
  maxH: number,
  quality: number,
  asTransparentPng: boolean
): string {
  let { width, height } = img;
  if (width > maxW || height > maxH) {
    const ratio = Math.min(maxW / width, maxH / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.drawImage(img, 0, 0, width, height);
  if (asTransparentPng) {
    return canvas.toDataURL('image/png');
  }
  return canvas.toDataURL('image/jpeg', quality);
}

export function compressImage(
  dataUrl: string,
  options?: { maxWidth?: number; maxHeight?: number; quality?: number; isSignature?: boolean; maxSizeBytes?: number }
): Promise<string> {
  return new Promise((resolve) => {
    if (!dataUrl || !dataUrl.startsWith('data:image')) {
      resolve(dataUrl);
      return;
    }

    const maxW = options?.maxWidth ?? (options?.isSignature ? 600 : MAX_WIDTH);
    const maxH = options?.maxHeight ?? (options?.isSignature ? 300 : MAX_HEIGHT);
    const quality = options?.quality ?? (options?.isSignature ? SIGNATURE_QUALITY : DEFAULT_QUALITY);
    const maxSize = options?.maxSizeBytes ?? MAX_FILE_SIZE_BYTES;
    const isPng = dataUrl.startsWith('data:image/png');
    const hasTransparency = isPng && !!options?.isSignature;

    if (hasTransparency) {
      const img = new Image();
      img.onload = () => {
        const result = resizeAndCompress(img, maxW, maxH, quality, true);
        resolve(result || dataUrl);
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
      return;
    }

    const img = new Image();
    img.onload = () => {
      let currentMaxW = maxW;
      let currentMaxH = maxH;
      let currentQuality = quality;
      let result = resizeAndCompress(img, currentMaxW, currentMaxH, currentQuality, false);

      if (!result) { resolve(dataUrl); return; }

      let iterations = 0;
      while (getDataUrlSizeBytes(result) > maxSize && iterations < 20) {
        iterations++;
        if (currentQuality > 0.15) {
          currentQuality = Math.max(0.08, currentQuality - 0.08);
        } else {
          currentMaxW = Math.round(currentMaxW * 0.75);
          currentMaxH = Math.round(currentMaxH * 0.75);
          if (currentMaxW < 100 || currentMaxH < 100) break;
        }
        result = resizeAndCompress(img, currentMaxW, currentMaxH, currentQuality, false);
        if (!result) { resolve(dataUrl); return; }
      }

      resolve(result);
    };

    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function compressSignature(dataUrl: string): Promise<string> {
  return compressImage(dataUrl, { isSignature: true });
}

export function compressForPdf(dataUrl: string): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:image')) return Promise.resolve(dataUrl);
  return compressImage(dataUrl, { maxWidth: 200, maxHeight: 200, quality: 0.4 });
}

export function compressSignatureForPdf(dataUrl: string): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:image')) return Promise.resolve(dataUrl);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      const maxW = 160;
      const maxH = 60;
      if (width > maxW || height > maxH) {
        const ratio = Math.min(maxW / width, maxH / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(dataUrl); return; }
      ctx.drawImage(img, 0, 0, width, height);
      const compressed = canvas.toDataURL('image/png');
      resolve(compressed.length < dataUrl.length ? compressed : dataUrl);
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}
