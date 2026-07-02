import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import getDb from '../db';

// JWT Secret: 首次启动时随机生成UUID存入settings表
let _JWT_SECRET: string | null = null;

function getJwtSecret(db: any): string {
  if (_JWT_SECRET) return _JWT_SECRET;
  
  const row = db.prepare("SELECT value FROM settings WHERE key = 'jwt_secret'").get() as any;
  if (row) {
    try {
      const parsed = JSON.parse(row.value);
      if (parsed && typeof parsed === 'string') {
        _JWT_SECRET = parsed;
        return _JWT_SECRET;
      }
    } catch {}
  }
  
  // 首次启动：生成随机UUID
  const newSecret = randomUUID();
  db.prepare("INSERT INTO settings (key, value) VALUES ('jwt_secret', ?)").run(JSON.stringify(newSecret));
  _JWT_SECRET = newSecret;
  console.log('[Security] JWT密钥已自动生成并存入数据库');
  return _JWT_SECRET;
}

export function getJwtSecretSync(): string {
  const db = getDb();
  return getJwtSecret(db);
}

export interface JwtPayload {
  userId: number;
  username: string;
  roleKey?: string;
}

// 扩展 Express Request 类型，消除所有路由文件的 req.user TS 报错
declare module 'express' {
  interface Request {
    user?: JwtPayload;
  }
}

export function signToken(payload: JwtPayload): string {
  const db = getDb();
  return jwt.sign(payload, getJwtSecret(db), { expiresIn: '7d' });
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录' });
  }
  try {
    const token = header.slice(7);
    const db = getDb();
    const decoded = jwt.verify(token, getJwtSecret(db)) as JwtPayload;
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: '登录已过期' });
  }
}

export default authMiddleware;
