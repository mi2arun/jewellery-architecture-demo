import { Request } from 'express';

export type Role = 'employee' | 'management';

/** POC auth: role conveyed via the `x-role` header. Defaults to employee. */
export function roleOf(req: Request): Role {
  const r = (req.headers['x-role'] as string)?.toLowerCase();
  return r === 'management' ? 'management' : 'employee';
}
