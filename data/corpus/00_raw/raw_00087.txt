/**
 * 统一时间工具 — 全站唯一时间格式化入口 (Asia/Shanghai)
 *
 * 规范：
 * - 一级 日期类：      formatDate()        → YYYY-MM-DD
 * - 二级 列表/卡片：   formatDateTime()     → YYYY-MM-DD HH:mm
 * - 三级 详情/日志：   formatDateTimeSec()  → YYYY-MM-DD HH:mm:ss
 * - 四级 相对时间：    formatRelative()     → 刚刚 / 3分钟前 / 昨天
 * - 耗时：            formatDuration()     → 1.2s / 3m 25s
 * - 当前时间戳：      nowISO()             → 2025-07-20 14:36:00
 *
 * 禁止全站直接使用 new Date().toLocaleString() / toISOString() 等。
 */

import dayjs from 'dayjs';

/** 日期：YYYY-MM-DD */
export function formatDate(date?: Date | string | number | null): string {
  return dayjs(date || undefined).format('YYYY-MM-DD');
}

/** 日期+时间（列表/卡片用）：YYYY-MM-DD HH:mm */
export function formatDateTime(date?: Date | string | number | null): string {
  return dayjs(date || undefined).format('YYYY-MM-DD HH:mm');
}

/** 日期+时间+秒（详情/日志用）：YYYY-MM-DD HH:mm:ss */
export function formatDateTimeSec(date?: Date | string | number | null): string {
  return dayjs(date || undefined).format('YYYY-MM-DD HH:mm:ss');
}

/** 相对时间：刚刚 / 3分钟前 / 昨天 14:36 / 3天前 → 7天起回退为日期 */
export function formatRelative(date?: Date | string | number | null): string {
  if (!date) return '';
  const now = Date.now();
  const then = dayjs(date).valueOf();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMs < 0) return formatDateTime(date);
  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 1) return `${diffMins}分钟前`;
  if (diffHours < 24) return `今天 ${dayjs(then).format('HH:mm')}`;
  if (diffDays === 1) return `昨天 ${dayjs(then).format('HH:mm')}`;
  if (diffDays < 7) return `${diffDays}天前`;
  if (dayjs(then).year() === dayjs().year()) return dayjs(then).format('MM-DD HH:mm');
  return dayjs(then).format('YYYY-MM-DD');
}

/** 耗时显示：1.2s / 3m25s / 1h12m */
export function formatDuration(ms?: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return `${m}m ${rs}s`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${rm}m`;
}

/** 获取当天日期 YYYY-MM-DD */
export function todayStr(): string {
  return dayjs().format('YYYY-MM-DD');
}

/** 获取当前北京时间完整时间戳 YYYY-MM-DD HH:mm:ss（用于 created_at 等） */
export function nowISO(): string {
  return dayjs().format('YYYY-MM-DD HH:mm:ss');
}
