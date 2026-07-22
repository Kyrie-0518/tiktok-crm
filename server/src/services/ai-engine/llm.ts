// AI Engine LLM 调用层 — 复用系统 ai_channels 表
import axios from 'axios';
import getDb from '../../db';
import { logModelCall } from '../model-call-log';

interface LLMCallOptions {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json_object';
}

export async function callLLM(opts: LLMCallOptions): Promise<string> {
  let apiKey = '';
  let apiUrl = '';
  let model = opts.model || 'deepseek-chat';

  try {
    const db = getDb();
    const c = db.prepare("SELECT * FROM ai_channels WHERE is_default=1 AND status='enabled' AND api_key!='' ORDER BY priority LIMIT 1").get() as any;
    if (c) { apiUrl = c.api_base; apiKey = c.api_key; model = c.model || model; }
  } catch {}

  if (!apiKey) {
    console.warn('[AI Engine] No AI channel — using mock');
    return mock(opts);
  }

  try {
    const r = await axios.post(apiUrl, {
      model, messages: [{ role: 'system', content: opts.systemPrompt }, { role: 'user', content: opts.userPrompt }],
      temperature: opts.temperature ?? 0.3, max_tokens: opts.maxTokens ?? 2048,
      response_format: opts.responseFormat ? { type: opts.responseFormat } : undefined,
    }, { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 60000 });
    return r.data.choices?.[0]?.message?.content || '';
  } catch (e: any) { throw e; }
}

function mock(opts: LLMCallOptions): string {
  const s = opts.systemPrompt;
  if (s.includes('商品理解')) return '{"category":"通用","productType":"商品","brand":"","material":[],"color":[],"style":"简约","targetAudience":"泛人群","sellingPoints":["品质好","性价比高"],"scene":["室内"],"visualTags":["产品展示","自然光"]}';
  if (s.includes('创意策略')) return '{"videoGoal":"产品展示转化","platform":"TikTok","pacing":"快节奏","style":"现代商业","duration":15,"cta":"立即购买","shootingStyle":"真人+产品","shotRhythm":"前3秒抓眼球→中段展示→结尾CTA"}';
  if (s.includes('导演')) return '{"shots":[{"index":1,"scene":"产品展示","subject":"商品","action":"居中展示","composition":"中景","lighting":"柔光","camera":"固定","duration":3,"transition":"cut"},{"index":2,"scene":"使用场景","subject":"人物+产品","action":"自然互动","composition":"近景","lighting":"自然光","camera":"跟随","duration":4,"transition":"dissolve"},{"index":3,"scene":"卖点特写","subject":"产品细节","action":"镜头推进","composition":"特写","lighting":"侧光","camera":"推近","duration":3,"transition":"cut"},{"index":4,"scene":"品牌收尾","subject":"Logo","action":"淡入","composition":"全景","lighting":"柔和","camera":"拉远","duration":3,"transition":"fade"}],"timeline":"4镜头·15秒"}';
  if (s.includes('Prompt工程')) return '{"shotPrompts":[{"index":1,"prompt":"Product centered, soft studio lighting, clean background, 360° rotation showcase, commercial quality, 8K","negativePrompt":"blurry, low quality","parameters":{}}],"finalPrompt":"Product centered, soft studio lighting, clean background, 360° rotation showcase, commercial quality, 8K"}';
  if (s.includes('优化')) return `{"optimizedPrompt":"${opts.userPrompt.slice(0, 80)}..., Natural Motion, Stable Camera, Commercial Quality, 8K","negativePrompt":"blurry, low quality, distorted, watermark"}`;
  if (s.includes('质量评估')) return '{"score":85,"productCompleteness":85,"personConsistency":80,"shotFluency":82,"brandVisibility":75,"sellingPointCoverage":88,"overallImpression":84,"needsRetry":false,"suggestions":[]}';
  return '{}';
}

export function parseJSON(text: string): any {
  let c = text.trim();
  const m = c.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (m) c = m[1];
  try { return JSON.parse(c); } catch { return null; }
}
