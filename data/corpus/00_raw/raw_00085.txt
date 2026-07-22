/**
 * 图片增强工具 — 解决 Seedance 等模型对图片尺寸的最低要求
 *
 * 背景：火山引擎 Seedance 要求图片宽度 >= 300px，否则报错：
 *   "expected the width to be at least 300px, but received a 225x300px image instead"
 *
 * 解决：客户端用 Canvas 加载图片 → 检测尺寸 → 太窄则按比例放大到 720px
 *       → 转成 base64 dataURL 直接发给后端（不依赖任何上传接口）
 */

const DEFAULT_MIN_WIDTH = 720; // 安全余量 = 300 × 2.4

/**
 * 把 URL 图片加载到 canvas，检测尺寸，如果太窄就按比例放大，返回新的 dataURL
 * @param url 原图 URL（http(s):// 或 blob:// 或 data:）
 * @param minWidth 最小宽度，默认 720
 * @returns { url: dataURL, width, height, enhanced }
 */
export async function enhanceImage(
  url: string,
  minWidth = DEFAULT_MIN_WIDTH
): Promise<{ url: string; width: number; height: number; enhanced: boolean }> {
  if (!url) return { url, width: 0, height: 0, enhanced: false };

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { url, width: 0, height: 0, enhanced: false };
  }

  // 已经是 data URL 的：检查尺寸
  if (url.startsWith('data:')) {
    const img = await loadImage(url);
    return { url, width: img.naturalWidth, height: img.naturalHeight, enhanced: false };
  }

  try {
    const img = await loadImage(url);
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (w === 0 || h === 0) return { url, width: 0, height: 0, enhanced: false };

    // 尺寸足够：直接返回原 URL
    if (w >= minWidth) {
      return { url, width: w, height: h, enhanced: false };
    }

    // 尺寸不足：按比例放大
    const scale = minWidth / w;
    const targetW = Math.round(w * scale);
    const targetH = Math.round(h * scale);

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { url, width: w, height: h, enhanced: false };

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, targetW, targetH);

    // 强制转 base64 dataURL — 不依赖任何外部上传接口
    const dataUrl = canvas.toDataURL('image/png', 0.95);
    return { url: dataUrl, width: targetW, height: targetH, enhanced: true };
  } catch (e: any) {
    console.warn('[image-enhance] 增强失败，使用原图:', e.message);
    return { url, width: 0, height: 0, enhanced: false };
  }
}

/**
 * 加载图片（支持跨域 CORS）
 */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`图片加载失败: ${url.slice(0, 80)}`));
    img.src = url;
  });
}

/**
 * 批量处理多张图
 */
export async function enhanceImages(
  urls: string[],
  minWidth = DEFAULT_MIN_WIDTH
): Promise<Array<{ url: string; width: number; height: number; enhanced: boolean }>> {
  return Promise.all(urls.filter(Boolean).map((u) => enhanceImage(u, minWidth)));
}

/**
 * @deprecated 旧版上传方案，新版直接用 dataURL
 * 保留以兼容旧调用
 */
export async function uploadBlob(blobUrl: string, fileName = 'enhanced.png'): Promise<string> {
  if (!blobUrl.startsWith('blob:')) return blobUrl;
  const blob = await fetch(blobUrl).then((r) => r.blob());
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  return dataUrl;
}
