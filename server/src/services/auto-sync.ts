/**
 * 订单自动同步调度器
 * - 每 10 分钟自动拉取所有已启用的 TikTok 店铺的新订单
 * - 启动时立即执行一次
 * - 支持通过 API 查询同步状态和手动触发
 */

import { syncShopOrders } from './order-sync';
import getDb from '../db';

// 同步状态
export interface SyncStatus {
  running: boolean;
  lastRunAt: string | null;
  lastResult: { shop: string; created: number; updated: number; errors: string[] }[] | null;
  nextRunAt: string | null;
  intervalMinutes: number;
}

let syncTimer: ReturnType<typeof setInterval> | null = null;
let currentStatus: SyncStatus = {
  running: false,
  lastRunAt: null,
  lastResult: null,
  nextRunAt: null,
  intervalMinutes: 10,
};

/** 获取当前同步状态 */
export function getSyncStatus(): SyncStatus {
  return { ...currentStatus };
}

/** 立即执行一次全量同步 */
export async function runSyncNow(): Promise<SyncStatus['lastResult']> {
  if (currentStatus.running) {
    console.log('[auto-sync] 上一次同步仍在进行中，跳过');
    return currentStatus.lastResult;
  }

  currentStatus.running = true;
  console.log('[auto-sync] ========== 开始自动同步订单 ==========');

  const db = getDb();
  const shops = db.prepare(`
    SELECT id, name FROM tiktok_shops
    WHERE sync_enabled = 1 AND access_token IS NOT NULL AND access_token != ''
  `).all() as any[];

  if (shops.length === 0) {
    console.log('[auto-sync] 没有已启用同步的店铺，跳过');
    currentStatus.running = false;
    currentStatus.lastRunAt = new Date().toISOString();
    return [];
  }

  const results: SyncStatus['lastResult'] = [];

  for (const shop of shops) {
    try {
      console.log(`[auto-sync] 正在同步店铺: ${shop.name} (id=${shop.id})`);
      const result = await syncShopOrders(shop.id);
      results.push({
        shop: shop.name,
        created: result.created,
        updated: result.updated,
        errors: result.errors,
      });
      console.log(`[auto-sync] 店铺 ${shop.name}: 新增 ${result.created} 单, 更新 ${result.updated} 单${result.errors.length > 0 ? `, 错误 ${result.errors.length} 条` : ''}`);
    } catch (e: any) {
      console.error(`[auto-sync] 店铺 ${shop.name} 同步失败:`, e.message);
      results.push({ shop: shop.name, created: 0, updated: 0, errors: [e.message] });
    }
  }

  currentStatus.running = false;
  currentStatus.lastRunAt = new Date().toISOString();
  currentStatus.lastResult = results;
  currentStatus.nextRunAt = new Date(Date.now() + currentStatus.intervalMinutes * 60 * 1000).toISOString();

  const totalCreated = results.reduce((s, r) => s + r.created, 0);
  const totalUpdated = results.reduce((s, r) => s + r.updated, 0);
  const totalErrors = results.reduce((s, r) => s + r.errors.length, 0);
  console.log(`[auto-sync] ========== 同步完成: ${shops.length} 家店铺, 新增 ${totalCreated} 单, 更新 ${totalUpdated} 单, 错误 ${totalErrors} 条 ==========`);

  return results;
}

/** 启动自动同步调度器 */
export function startAutoSync(intervalMinutes: number = 10): void {
  if (syncTimer) {
    clearInterval(syncTimer);
  }

  const intervalMs = intervalMinutes * 60 * 1000;
  const envInterval = process.env.AUTO_SYNC_INTERVAL_MINUTES;
  if (envInterval) {
    const parsed = parseInt(envInterval, 10);
    if (!isNaN(parsed) && parsed > 0) {
      intervalMinutes = parsed;
      currentStatus.intervalMinutes = parsed;
    }
  }

  // 启动时是否立即执行（可通过环境变量关闭）
  const runOnStart = process.env.AUTO_SYNC_RUN_ON_START !== 'false';

  console.log(`[auto-sync] 自动订单同步已启动，间隔: ${intervalMinutes} 分钟${runOnStart ? '' : '（跳过启动时首次执行）'}`);

  if (runOnStart) {
    // 延迟 5 秒启动，避免和服务器初始化冲突
    setTimeout(() => {
      runSyncNow().catch(e => console.error('[auto-sync] 首次同步失败:', e));
    }, 5000);
  }

  currentStatus.nextRunAt = new Date(Date.now() + (runOnStart ? 5000 : intervalMs)).toISOString();

  syncTimer = setInterval(() => {
    runSyncNow().catch(e => console.error('[auto-sync] 定时同步失败:', e));
  }, intervalMs);
}

/** 停止自动同步调度器 */
export function stopAutoSync(): void {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
    console.log('[auto-sync] 自动订单同步已停止');
  }
}

/** 动态修改同步间隔 */
export function setSyncInterval(minutes: number): void {
  if (minutes < 1) return;
  currentStatus.intervalMinutes = minutes;
  stopAutoSync();
  startAutoSync(minutes);
}
