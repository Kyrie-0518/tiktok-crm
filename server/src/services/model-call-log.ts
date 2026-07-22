/**
 * 模型调用日志写入工具（备案合规：全链路可追溯）
 */
import getDb from '../db';

interface LogParams {
  userId: number;
  username: string;
  module: 'owen' | 'video' | 'diagnosis' | 'ai_engine';
  modelName: string;
  inputPrompt: string;
  outputContent: string;
  tokensIn?: number;
  tokensOut?: number;
  latencyMs?: number;
  ip?: string;
  userAgent?: string;
  status?: 'success' | 'error';
  errorMessage?: string;
}

export function logModelCall(params: LogParams): void {
  try {
    const db = getDb();
    db.prepare(`
      INSERT INTO model_call_logs (user_id, username, module, model_name, input_prompt, output_content, tokens_in, tokens_out, latency_ms, ip, user_agent, status, error_message, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'))
    `).run(
      params.userId || 0,
      params.username || '',
      params.module,
      params.modelName,
      params.inputPrompt.slice(0, 10000),   // 截断 10K
      params.outputContent.slice(0, 50000),  // 截断 50K
      params.tokensIn || 0,
      params.tokensOut || 0,
      params.latencyMs || 0,
      params.ip || '',
      params.userAgent || '',
      params.status || 'success',
      params.errorMessage || '',
    );
  } catch (e: any) {
    console.error('[model-call-log] 记录失败:', e.message);
  }
}
