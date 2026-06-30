export const C = {
  bg: '#0b0f1a', panel: '#121a2b', line: '#1f2c45', ink: '#e8eefc', muted: '#8b98b8',
  gold: '#e4b95b', phys: '#4ea1ff', log: '#b07cff', pers: '#ff6b8b', ok: '#37d3a0',
};

export const fmt = (n: any) =>
  n === '•••••' || n == null ? n ?? '' : Number(n).toLocaleString('en-IN');

export const card = () => ({
  background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: 16,
});
export const h3 = () => ({ margin: '0 0 12px', fontSize: 15 });
export const inp = () => ({
  background: '#1b2740', color: C.ink, border: '1px solid #2a3a5c',
  borderRadius: 8, padding: '8px 10px', fontSize: 13,
});
export const btn = (active: boolean) => ({
  background: active ? `linear-gradient(135deg, ${C.gold}, #caa13e)` : '#1b2740',
  color: active ? '#1a1405' : C.ink, border: active ? 'none' : '1px solid #2a3a5c',
  borderRadius: 8, padding: '9px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
});
