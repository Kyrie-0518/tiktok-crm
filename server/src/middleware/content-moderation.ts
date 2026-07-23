/**
 * 智能内容安全检测中间件 v2
 * - 关键词 + 正则模式 + 变体绕过 三层检测
 * - 3 次累计暂停 / 管理员解禁 / 永久封禁
 */
import { Request, Response, NextFunction } from 'express';
import getDb from '../db';

const CATEGORIES = [
  {
    name: '违法违规', keywords: ['走私','贩毒','洗钱','逃税','偷渡','诈骗','传销','假币','枪支','弹药','赌博','赌场','博彩','彩票','六合彩','毒品','吸毒','大麻','海洛因','冰毒','摇头丸','k粉','鸦片','罂粟','嫖娼','卖淫','招嫖'],
    patterns: [/\b(代购|出售)\s*(毒品|枪支|弹药|迷药)/, /\b(在线|真人)\s*(赌场|赌博|博彩)/, /\b(买|卖|订购)\s*(毒品|大麻|冰毒|海洛因)/i],
  },
  {
    name: '政治敏感', keywords: ['颠覆','分裂','恐怖','暴恐','极端','煽动','动乱','叛乱','政变','暴动'],
    patterns: [/\b(颠覆|推翻)\s*(国家|政府|政权)/, /\b(独立|分裂)\s*(国家|领土)/, /\b(恐怖|暴恐)\s*(组织|分子|袭击)/],
  },
  {
    name: '色情低俗', keywords: ['色情','淫秽','裸体','性交','约炮','黄色','成人','艳照','裸聊','一夜情','性服务','嫖','妓','人兽','恋童'],
    patterns: [/\b(同城|附近)\s*(约|交友).*(炮|一夜)/, /\b(成人|激情|黄色)\s*(视频|网站|直播)/, /\b(裸|脱衣|露点)\s*(聊|播|表演)/, /\b(援交|包养)\b/],
  },
  {
    name: '暴力血腥', keywords: ['杀人','自杀','暴力','血腥','虐待','自残','割腕','跳楼','砍人','碎尸','肢解','虐杀','屠杀'],
    patterns: [/\b(杀|砍|捅|炸)\s*(死|伤|人)/, /\b(如何|方法)\s*(自杀|杀人)/, /\b(虐|殴打)\s*(儿童|老人|动物)/],
  },
  {
    name: '虚假欺诈', keywords: ['刷单','刷评','虚假','造假','仿冒','假冒','山寨','假货','刷粉','刷赞','刷量','买粉','买赞','水军','薅羊毛','撸羊毛','套现','代刷','刷手','刷客','伪造数据','证书伪造'],
    patterns: [/\b(刷|买|代)\s*(单|粉|赞|评|好评|销量|评论|播放)/, /\b(日入|日赚|月入)\s*\d{2,}[万亿k]/, /\b(加微信|扫码|加QQ)\s*\d{5,}/, /\b(全套|定制|代办)\s*(证书|发票|执照)/],
  },
  {
    name: '隐私安全', keywords: ['黑客','木马','病毒','盗号','撞库','人肉搜索','身份证号','银行卡号','密码破解'],
    patterns: [/\b(免费|破解)\s*(软件|VIP|会员)/, /\b(出售|买卖)\s*(账号|个人信息|数据|隐私)/],
  },
];

const EVASION_PATTERNS = [/shu[a4]d[a4]n/i, /d[a4]ir[a3]n/i, /(刷|shua)[\s\.\-\*\_]+(单|dan)/i];

interface ViolationRecord { user_id: number; username: string; input: string; matched_terms: string[]; categories: string[]; module: string; ip: string; }

export function detectViolation(text: string): { matched: string[]; categories: string[] } {
  if (!text) return { matched: [], categories: [] };
  const result: string[] = []; const cats = new Set<string>();
  const normalized = text.toLowerCase();
  for (const cat of CATEGORIES) {
    for (const kw of cat.keywords) { if (text.includes(kw)) { result.push(kw); cats.add(cat.name); } }
    for (const pat of cat.patterns) { if (pat.test(text) || pat.test(normalized)) { result.push(`[${cat.name}]`); cats.add(cat.name); break; } }
  }
  for (const pat of EVASION_PATTERNS) { if (pat.test(normalized)) { result.push('[变体绕过]'); cats.add('变体绕过'); break; } }
  return { matched: result.slice(0, 10), categories: Array.from(cats) };
}

export function recordViolation(rec: ViolationRecord): { suspended: boolean; count: number } {
  let suspended = false; let newCount = 0;
  try {
    const db = getDb();
    db.prepare(`INSERT INTO audit_logs (user_id,username,action,method,path,status,ip,detail,created_at) VALUES (?,?,?,'POST','/api/violation',403,?,?,datetime('now','localtime'))`).run(
      rec.user_id, rec.username, `违禁词拦截-${rec.module}`, rec.ip, JSON.stringify({ input: rec.input.slice(0, 200), matched: rec.matched_terms, categories: rec.categories, module: rec.module }));
    const today = new Date().toISOString().slice(0, 10);
    const exist = db.prepare('SELECT id, violation_count FROM user_violations WHERE user_id=? AND date=?').get(rec.user_id, today) as any;
    if (exist) { db.prepare('UPDATE user_violations SET violation_count=violation_count+1 WHERE id=?').run(exist.id); newCount = (exist.violation_count||0)+1; }
    else { db.prepare('INSERT INTO user_violations(user_id,date,violation_count) VALUES(?,?,1)').run(rec.user_id, today); newCount = 1; }
    if (newCount >= 3) { db.prepare("UPDATE users SET ai_suspended=1, ai_suspended_at=datetime('now','localtime'), ai_suspend_reason=? WHERE id=?").run(`${rec.categories.join('、')} — 累计${newCount}次`, rec.user_id); suspended = true; }
  } catch (e: any) { console.error('[moderation]', e.message); }
  return { suspended, count: newCount };
}

export function unbanUser(userId: number): void { getDb().prepare("UPDATE users SET ai_suspended=0, ai_suspended_at=NULL, ai_suspend_reason='' WHERE id=?").run(userId); }
export function permanentBanUser(userId: number, reason: string): void { getDb().prepare("UPDATE users SET ai_suspended=1, ai_suspended_at=datetime('now','localtime'), ai_suspend_reason=? WHERE id=?").run(`永久封禁: ${reason}`, userId); }
export function getViolationUsers(): any[] { return getDb().prepare("SELECT u.id,u.username,u.ai_suspended,u.ai_suspended_at,u.ai_suspend_reason,(SELECT SUM(violation_count) FROM user_violations WHERE user_id=u.id) as total FROM users u WHERE u.ai_suspended=1 OR u.id IN (SELECT DISTINCT user_id FROM user_violations) ORDER BY total DESC").all(); }
export function getViolationDetail(userId: number): any { return { violations: getDb().prepare('SELECT * FROM user_violations WHERE user_id=? ORDER BY date DESC LIMIT 30').all(userId), logs: getDb().prepare("SELECT * FROM audit_logs WHERE user_id=? AND action LIKE '%违禁词%' ORDER BY id DESC LIMIT 50").all(userId) }; }

export function moderationMiddleware(module: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as any).user?.userId?.toString();
    if (userId) { const u = getDb().prepare('SELECT ai_suspended FROM users WHERE id=?').get(userId) as any; if (u?.ai_suspended) { return res.status(403).json({ error: 'AI 功能已暂停', reason: '累计违规输入超过 3 次。请联系管理员复核后恢复。', code: 'AI_SUSPENDED' }); } }
    const texts: string[] = [];
    if (req.body?.query) texts.push(req.body.query); if (req.body?.userPrompt) texts.push(req.body.userPrompt);
    if (req.body?.prompt) texts.push(req.body.prompt); if (req.body?.content) texts.push(req.body.content);
    for (const text of texts) {
      const r = detectViolation(text); if (r.matched.length > 0) {
        if (userId) recordViolation({ user_id: parseInt(userId), username: (req as any).user?.username||'unknown', input:text, matched_terms: r.matched, categories: r.categories, module, ip: req.ip||req.socket.remoteAddress||'' });
        return res.status(403).json({ error:'输入内容包含违规信息，已被系统拦截', code:'CONTENT_BLOCKED', categories: r.categories, hint:'请修改输入后重试。累计 3 次违规将暂停 AI 功能。' });
      }
    }
    next();
  };
}
