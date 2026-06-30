// Talk to the API on :3000. Role is sent via x-role header (POC auth).
const BASE = (import.meta as any).env?.VITE_API ?? 'http://localhost:3000';

export type Role = 'employee' | 'management';

async function req(path: string, role: Role, opts: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { 'content-type': 'application/json', 'x-role': role, ...(opts.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, body };
  return body;
}

export const api = {
  stores: (role: Role) => req('/stores', role),
  inventory: (role: Role, store?: string) => req(`/inventory${store ? `?store=${store}` : ''}`, role),
  createTxn: (role: Role, data: any) =>
    req('/transactions', role, { method: 'POST', body: JSON.stringify(data) }),
  physicalLedger: (role: Role, store?: string) =>
    req(`/ledger/physical${store ? `?store=${store}` : ''}`, role),
  logicalLedger: (role: Role, store?: string, unmask?: boolean) =>
    req(`/ledger/logical?${store ? `store=${store}&` : ''}${unmask ? 'unmask=1' : ''}`, role),
  reconciliation: (role: Role, store?: string) =>
    req(`/reconciliation${store ? `?store=${store}` : ''}`, role),
  routerStatus: (role: Role) => req('/router/status', role),
  routerSwitch: (role: Role, target: 'physical' | 'logical') =>
    req('/router/switch', role, { method: 'POST', body: JSON.stringify({ target }) }),
  routedReport: (role: Role, store?: string) =>
    req(`/ledger/report${store ? `?store=${store}` : ''}`, role),
  audit: (role: Role) => req('/audit', role),
};
