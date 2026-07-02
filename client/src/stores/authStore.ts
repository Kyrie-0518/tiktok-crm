import { create } from 'zustand';

export type RoleKey = 'developer' | 'manager' | 'staff';

// Role hierarchy: higher number = more permissions
export const ROLE_ORDER: Record<string, number> = { staff: 0, manager: 1, developer: 2 };

interface AuthState {
  token: string | null;
  username: string | null;
  displayName: string | null;
  permissions: Record<string, string>;
  roleName: string | null;
  roleKey: RoleKey | null;
  tokenExpireAt: number | null;
  setAuth: (token: string, username: string, permissions?: Record<string, string>, roleName?: string, roleKey?: string, tokenExpireAt?: number, displayName?: string) => void;
  logout: () => void;
  isTokenValid: () => boolean;
}

// 从 JWT 中解析过期时间
function parseTokenExpireAt(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

// 检查 Token 是否有效
function checkTokenValid(token: string | null): boolean {
  if (!token) return false;
  const expireAt = parseTokenExpireAt(token);
  if (!expireAt) return true;
  return Date.now() < expireAt;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem('erp_token'),
  username: localStorage.getItem('erp_username'),
  displayName: localStorage.getItem('erp_display_name'),
  permissions: JSON.parse(localStorage.getItem('erp_permissions') || '{}'),
  roleName: localStorage.getItem('erp_role_name'),
  roleKey: (localStorage.getItem('erp_role_key') as RoleKey) || null,
  tokenExpireAt: (() => {
    const token = localStorage.getItem('erp_token');
    return token ? parseTokenExpireAt(token) : null;
  })(),

  setAuth: (token, username, permissions = {}, roleName = '', roleKey = 'staff', tokenExpireAt?, displayName?) => {
    const expireAt = tokenExpireAt || parseTokenExpireAt(token);
    localStorage.setItem('erp_token', token);
    localStorage.setItem('erp_username', username);
    if (displayName) localStorage.setItem('erp_display_name', displayName);
    localStorage.setItem('erp_permissions', JSON.stringify(permissions));
    localStorage.setItem('erp_role_name', roleName);
    localStorage.setItem('erp_role_key', roleKey);
    if (expireAt) localStorage.setItem('erp_token_expire_at', expireAt.toString());
    set({ token, username, displayName: displayName || null, permissions, roleName, roleKey: roleKey as RoleKey, tokenExpireAt: expireAt });
  },

  logout: () => {
    localStorage.clear();
    set({ token: null, username: null, displayName: null, permissions: {}, roleName: null, roleKey: null, tokenExpireAt: null });
  },

  isTokenValid: () => {
    const state = get();
    if (!state.token) return false;
    return checkTokenValid(state.token);
  },
}));

// Utility hooks
export function useIsDeveloper() {
  return useAuthStore((s) => s.roleKey === 'developer');
}

export function useIsManager() {
  return useAuthStore((s) => s.roleKey === 'developer' || s.roleKey === 'manager');
}

export function useHasMinRole(minRole: RoleKey) {
  return useAuthStore((s) => (ROLE_ORDER[s.roleKey || 'staff'] || 0) >= (ROLE_ORDER[minRole] || 0));
}

export function hasMinRole(roleKey: string | null, minRole: RoleKey): boolean {
  return (ROLE_ORDER[roleKey || 'staff'] || 0) >= (ROLE_ORDER[minRole] || 0);
}

// Check if user has at least the required permission level for a module
export function useHasPerm(moduleKey: string, level: 'read' | 'edit' = 'read'): boolean {
  return useAuthStore((s) => {
    if (s.roleKey === 'developer') return true;
    const perm = s.permissions[moduleKey];
    if (level === 'edit') return perm === 'edit';
    return perm === 'read' || perm === 'edit';
  });
}
