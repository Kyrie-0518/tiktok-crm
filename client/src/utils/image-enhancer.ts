/**
 * 图片增强工具 — 解决 Seedance 等模型对图片尺寸的最低要求
 *
 * 背景：火山引擎 Seedance 要求图片宽度 >= 300px，否则报错：
 *   "expected the width to be at least 300px, but received a 225x300px image instead"
 *
 * 解决：在客户端用 Canvas 把图片放大到目标尺寸（默认 720px），保持宽高比
 *       返回新 URL（blob://）供接口调用
 */

const DEFAULT_MIN_WIDTH = 720; // 安全余量 = 300 × 2.4

/**
 * 把 URL 图片加载到 canvas，检测尺寸，如果太窄就按比例放大，返回新的 blob URL
 * @param url 原图 URL（http(s):// 或 blob:// 或 data:）
 * @param minWidth 最小宽度，默认 720
 * @returns 新 URL + 真实尺寸
 */
export async function enhanceImage(url: string, minWidth = DEFAULT_MIN_WIDTH): Promise<{ url: string; width: number; height: number; enhanced: boolean }> {
  if (!url) return { url, width: 0, height: 0, enhanced: false };

  // 仅在浏览器端执行
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { url, width: 0, height: 0, enhanced: false };
  }

  // CORS 兜底：如果是跨域图，设置 anonymous 让 canvas 能读取
  const img = await loadImage(url);
  const { naturalWidth: w, naturalHeight: h } = img;
  if (w === 0 || h === 0) return { url, width: 0, height: 0, enhanced: false };

  // 尺寸足够：直接返回原 URL
  if (w >= minWidth) {
    return { url, width: w, height: h, enhanced: false };
  }

  // 尺寸不足：按比例放大到 minWidth（保持比例）
  const scale = minWidth / w;
  const targetW = Math.round(w * scale);
  const targetH = Math.round(h * scale);

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { url, width: w, height: h, enhanced: false };

  // 高质量缩放
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, targetW, targetH);

  // 转成 blob URL（PNG 保留最佳质量；JPEG 也可但 PNG 更稳）
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/png', 0.95);
  });
  if (!blob) return { url, width: w, height: h, enhanced: false };

  const newUrl = URL.createObjectURL(blob);
  return { url: newUrl, width: targetW, height: targetH, enhanced: true };
}

/**
 * 加载图片（支持跨域 CORS）
 */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error(`图片加载失败: ${url}`));
    img.src = url;
  });
}

/**
 * 批量处理多张图（用于多参考图场景）
 */
export async function enhanceImages(urls: string[], minWidth = DEFAULT_MIN_WIDTH): Promise<Array<{ url: string; width: number; height: number; enhanced: boolean }>> {
  return Promise.all(urls.filter(Boolean).map((u) => enhanceImage(u, minWidth)));
}

/**
 * 上传 blob URL 到服务端，返回服务端 URL
 * 因为 blob:// 在服务端不可用，必须先上传
 */
export async function uploadBlob(blobUrl: string, fileName = 'enhanced.png'): Promise<string> {
  if (!blobUrl.startsWith('blob:')) return blobUrl;
  const blob = await fetch(blobUrl).then((r) => r.blob());
  const file = new File([blob], fileName, { type: blob.type || 'image/png' });
  const form = new FormData();
  form.append('file', file);
  const r = await fetch('/api/upload/image', {
    method: 'POST',
    body: form,
    credentials: 'include',
  });
  if (!r.ok) throw new Error(`图片上传失败: ${r.status}`);
  const json = await r.json();
  return json.url || json.data?.url || json.path || '';
}
