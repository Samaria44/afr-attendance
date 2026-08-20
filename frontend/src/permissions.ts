import type { AuthUser } from './auth';

const PERMISSIONS: Record<string, string[]> = {
  'face:detect':            ['admin', 'operator', 'viewer'],
  'face:recognize':         ['admin', 'operator', 'viewer'],
  'face:view_log':          ['admin', 'operator', 'viewer'],
  'face:view_employees':    ['admin', 'operator', 'viewer'],
  'face:register_employee': ['admin', 'operator'],
  'face:delete_employee':   ['admin'],
  'auth:view_users':        ['admin'],
  'auth:create_user':       ['admin'],
  'auth:delete_user':       ['admin'],
};

export function can(user: AuthUser | null, permission: string): boolean {
  if (!user) return false;
  return PERMISSIONS[permission]?.includes(user.role) ?? false;
}
