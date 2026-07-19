// AI Engine 全链路类型定义
export interface VisionInput {
  productImage: string;
  productName: string;
  productDescription?: string;
  category?: string;
}

export interface VisionOutput {
  category: string;
  productType: string;
  brand: string;
  material: string[];
  color: string[];
  style: string;
  targetAudience: string;
  sellingPoints: string[];
  scene: string[];
  visualTags: string[];
  rawJson: string;
}

export interface StrategyInput {
  vision: VisionOutput;
  userPrompt?: string;
  template?: string;
  platform?: string;
  duration?: number;
}

export interface StrategyOutput {
  videoGoal: string;
  platform: string;
  pacing: string;
  style: string;
  duration: number;
  cta: string;
  shootingStyle: string;
  shotRhythm: string;
  rawJson: string;
}

export interface Storyboard {
  shots: Array<{
    index: number;
    scene: string;
    subject: string;
    action: string;
    composition: string;
    lighting: string;
    camera: string;
    duration: number;
    transition: string;
  }>;
  timeline: string;
}

export interface DirectorInput {
  vision: VisionOutput;
  strategy: StrategyOutput;
}

export interface DirectorOutput {
  storyboard: Storyboard;
  totalShots: number;
  estimatedDuration: number;
  rawJson: string;
}

export interface PromptEngineInput {
  director: DirectorOutput;
  vision: VisionOutput;
}

export interface PromptEngineOutput {
  shotPrompts: Array<{ index: number; prompt: string; negativePrompt: string; parameters: Record<string, any> }>;
  finalPrompt: string;
  rawJson: string;
}

export interface OptimizerInput {
  promptEngine: PromptEngineOutput;
  model: string;
}

export interface OptimizerOutput {
  optimizedPrompts: Array<{ index: number; prompt: string; negativePrompt: string }>;
  adapterName: string;
  rawJson: string;
}

export interface AdapterInput {
  optimizer: OptimizerOutput;
  model: string;
  resolution: string;
  aspectRatio: string;
  duration: number;
  count: number;
}

export interface AdapterOutput {
  generateParams: Record<string, any>;
  modelName: string;
  estimatedTokens: number;
}

export interface QualityInput {
  videoUrl?: string;
  vision: VisionOutput;
  strategy: StrategyOutput;
  director: DirectorOutput;
  promptEngine: PromptEngineOutput;
}

export interface QualityOutput {
  score: number;
  dimensions: {
    productCompleteness: number;
    personConsistency: number;
    shotFluency: number;
    brandVisibility: number;
    sellingPointCoverage: number;
    overallImpression: number;
  };
  needsRetry: boolean;
  suggestions: string[];
  rawJson: string;
}

export interface VideoTaskContext {
  taskId: string;
  productId?: number;
  productImage?: string;
  productName?: string;
  productDescription?: string;
  userPrompt: string;
  template?: string;
  model: string;
  resolution: string;
  aspectRatio: string;
  duration: number;
  count: number;
  createdAt: string;
}

export interface PipelineResult {
  taskId: string;
  status: 'running' | 'completed' | 'failed' | 'retrying';
  steps: PipelineStep[];
  videoId?: number;
  videoUrl?: string;
  qualityScore?: number;
  error?: string;
  totalTokens: number;
  totalTime: number;
}

export interface PipelineStep {
  agent: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  input?: any;
  output?: any;
  startTime?: number;
  endTime?: number;
  tokens?: number;
  error?: string;
}
