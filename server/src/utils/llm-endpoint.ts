/**
 * LLM 调用 URL 解析
 *
 * 智能识别用户填的 URL：
 * - 完整 endpoint（以 /chat/completions 结尾）→ 直接使用
 * - 基础地址（域名 / /v1 / /api/v3 等）→ 自动追加 /chat/completions
 *
 * 兼容两种填法，避免 404。
 */
export function resolveLLMEndpoint(apiBase: string): string {
  const trimmed = apiBase.replace(/\/+$/, '');
  if (trimmed.endsWith('/chat/completions')) return trimmed;
  return `${trimmed}/chat/completions`;
}
