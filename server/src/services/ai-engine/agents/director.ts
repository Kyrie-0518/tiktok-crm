// Director Agent — AI导演，生成分镜
import { callLLM, parseJSON } from '../llm';
import { DirectorInput, DirectorOutput, Storyboard } from '../types';

export async function directorAgent(input: DirectorInput): Promise<DirectorOutput> {
  const raw = await callLLM({
    systemPrompt: `你是AI视频导演。根据商品和策略，生成4-5个镜头的分镜脚本。JSON格式：
{"shots":[{"index":1,"scene":"","subject":"","action":"","composition":"","lighting":"","camera":"","duration":3,"transition":"cut"}],"timeline":"总时间线描述"}
每个镜头必须简洁、具体、可执行。`,
    userPrompt: `商品：${input.vision.productType} | 场景：${input.vision.scene.join('、')}
策略：${input.strategy.videoGoal} | 平台：${input.strategy.platform} | ${input.strategy.shootingStyle} | ${input.strategy.pacing}
时长：${input.strategy.duration}秒`,
    temperature: 0.4,
    responseFormat: 'json_object',
  });

  const j = parseJSON(raw);
  const shots = j?.shots || defaultShots(input);
  return {
    storyboard: { shots, timeline: j?.timeline || `${shots.length}镜头·${input.strategy.duration}秒` },
    totalShots: shots.length,
    estimatedDuration: input.strategy.duration,
    rawJson: raw,
  };
}

function defaultShots(input: DirectorInput): Storyboard['shots'] {
  return [
    { index: 1, scene: '产品展示', subject: input.vision.productType, action: '居中展示', composition: '中景', lighting: '柔光', camera: '固定', duration: 3, transition: 'cut' },
    { index: 2, scene: '使用场景', subject: '人物+产品', action: '自然互动', composition: '近景', lighting: '自然光', camera: '跟随', duration: 4, transition: 'dissolve' },
    { index: 3, scene: '卖点特写', subject: '产品细节', action: '镜头推进', composition: '特写', lighting: '侧光', camera: '推近', duration: 3, transition: 'cut' },
    { index: 4, scene: '品牌收尾', subject: 'Logo', action: '淡入', composition: '全景', lighting: '柔和', camera: '拉远', duration: 3, transition: 'fade' },
  ];
}
