import { callLLM, parseJSON } from '../llm';
import type { StrategyOutput, VisionOutput, AgentContext } from '../types';

/**
 * ② Creative Strategy Agent（创意策略）
 * 决定视频的拍法、节奏、风格、平台适配
 */
export async function strategyAgent(ctx: AgentContext & { vision: VisionOutput; userPrompt: string }): Promise<StrategyOutput> {
  const systemPrompt = `你是短视频创意策略专家。根据商品属性和用户需求，制定视频创作策略。
输出 JSON 格式：
{
  "videoGoal": "视频目标",
  "platform": "TikTok/Shopee/Lazada/通用",
  "pacing": "快节奏/中等/慢节奏",
  "style": "现代商业/生活化/电影感/科技感",
  "duration": 15,
  "cta": "行动号召",
  "shootingStyle": "真人+产品/纯产品/动画",
  "shotRhythm": "拍摄节奏描述"
}`;

  try {
    const raw = await callLLM({
      systemPrompt,
      userPrompt: `商品信息：\n${JSON.stringify(ctx.vision, null, 2)}\n\n用户需求：${ctx.userPrompt}\n\n请输出创意策略 JSON，不要附加任何解释。`,
      temperature: 0.3,
      maxTokens: 1024,
      responseFormat: 'json_object',
    });
    return parseJSON(raw) || {
      videoGoal: '产品展示',
      platform: 'TikTok',
      pacing: '快节奏',
      style: '现代商业',
      duration: 15,
      cta: '立即购买',
      shootingStyle: '真人+产品',
      shotRhythm: '前3秒抓眼球→中段展示卖点→结尾CTA',
    };
  } catch {
    return {
      videoGoal: '产品展示',
      platform: 'TikTok',
      pacing: '快节奏',
      style: '现代商业',
      duration: 15,
      cta: '立即购买',
      shootingStyle: '真人+产品',
      shotRhythm: '前3秒抓眼球→中段展示卖点→结尾CTA',
    };
  }
}
