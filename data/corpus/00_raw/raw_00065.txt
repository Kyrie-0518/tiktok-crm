// Prompt Engine — 生成 Prompt
import { callLLM, parseJSON } from '../llm';
import { PromptEngineInput, PromptEngineOutput } from '../types';

export async function promptEngine(input: PromptEngineInput): Promise<PromptEngineOutput> {
  const raw = await callLLM({
    systemPrompt: `你是Prompt工程专家。根据分镜脚本生成每个镜头的Prompt。JSON格式：
{"shotPrompts":[{"index":1,"prompt":"","negativePrompt":"","parameters":{}}],"finalPrompt":"拼接后的完整Prompt"}
Prompt必须包含：主体、动作、构图、光线、风格、色彩。用英文。`,
    userPrompt: `商品：${input.vision.productType} | 卖点：${input.vision.sellingPoints.join('、')}
风格：${input.vision.style} | 标签：${input.vision.visualTags.join('、')}
分镜：${JSON.stringify(input.director.storyboard.shots)}`,
    temperature: 0.4,
    responseFormat: 'json_object',
  });

  const j = parseJSON(raw);
  const shotPrompts = j?.shotPrompts || [];
  const finalPrompt = j?.finalPrompt || shotPrompts.map((s: any) => s.prompt).join('\n');
  return { shotPrompts, finalPrompt, rawJson: raw };
}
