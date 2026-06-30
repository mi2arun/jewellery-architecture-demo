import { useEffect, useState, useCallback } from 'react';
import { api, Role } from './api';

const C = {
  bg: '#0b0f1a', panel: '#121a2b', line: '#1f2c45', ink: '#e8eefc', muted: '#8b98b8',
  gold: '#e4b95b', phys: '#4ea1ff', log: '#b07cff', pers: '#ff6b8b', ok: '#37d3a0',
};

export function App() {
  const [role, setRole] = useState<Role>('management');
  const [stores, setStores] = useState<any[]>([]);
  const [store, setStore] = useState<string>('');
  const [phys, setPhys] = useState<any[]>([]);
  const [log, setLog] = useState<any[]>([]);
  const [logErr, setLogErr] = useState<string>('');
  const [recon, setRecon] = useState<any>(null);
  const [inventory, setInventory] = useState<any[]>([]);
  const [routerTarget, setRouterTarget] = useState<string>('physical');
  const [unmask, setUnmask] = useState(false);
  const [msg, setMsg] = useState<string>('');

  // form
  const [type, setType] = useState('SALE');
  const [amount, setAmount] = useState('50000');
  const [isPersonal, setIsPersonal] = useState(false);
  const [party, setParty] = useState('Walk-in');

  const refresh = useCallback(async () => {
    setLogErr('');
    try { setPhys(await api.physicalLedger(role, store)); } catch { setPhys([]); }
    try { setInventory(await api.inventory(role, store)); } catch { setInventory([]); }
    try { setRouterTarget((await api.routerStatus(role)).target); } catch {}
    if (role === 'management') {
      try { setLog(await api.logicalLedger(role, store, unmask)); } catch (e: any) { setLog([]); setLogErr(e?.body?.message || 'error'); }
      try { setRecon(await api.reconciliation(role, store)); } catch { setRecon(null); }
    } else {
      setLog([]); setRecon(null);
      setLogErr('403 — Logical ledger is restricted to management');
    }
  }, [role, store, unmask]);

  useEffect(() => { api.stores('employee').then((s) => { setStores(s); if (!store && s[0]) setStore(s[0].id); }); }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const submit = async () => {
    setMsg('');
    try {
      const r = await api.createTxn(role, { storeId: store, type, amount: Number(amount), isPersonal, party });
      setMsg(`Posted txn ${r.txnId.slice(0, 8)} · ${r.isPersonal ? 'PERSONAL → Logical only' : 'Physical written + Logical via outbox'}`);
      setTimeout(refresh, 1300); // give the outbox worker a moment
    } catch (e: any) {
      setMsg(`Error: ${e?.body?.message || 'failed'}`);
    }
  };

  const doSwitch = async (target: 'physical' | 'logical') => {
    try { const r = await api.routerSwitch(role, target); setRouterTarget(r.target); setMsg(`Router bound to ${r.target.toUpperCase()}`); }
    catch (e: any) { setMsg(`Switch denied: ${e?.body?.message || ''}`); }
  };

  return (
    <div style={{ background: C.bg, color: C.ink, minHeight: '100vh', fontFamily: 'Segoe UI, system-ui, sans-serif' }}>
      <header style={{ padding: '16px 24px', borderBottom: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 26 }}>💎</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 17 }}>Dual-Ledger POC — Jewellery Retail</div>
          <div style={{ color: C.muted, fontSize: 12.5 }}>Physical (Region A) · Logical (Region B) · personal routing · Connection Router DB-switch</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ color: C.muted, fontSize: 13 }}>Role:</span>
          {(['employee', 'management'] as Role[]).map((r) => (
            <button key={r} onClick={() => setRole(r)} style={btn(role === r)}>{r}</button>
          ))}
        </div>
      </header>

      <div style={{ maxWidth: 1180, margin: '0 auto', padding: 20, display: 'grid', gap: 16 }}>
        {/* form + router row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16 }}>
          <section style={card()}>
            <h3 style={h3()}>Create Transaction</h3>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <select value={store} onChange={(e) => setStore(e.target.value)} style={inp()}>
                {stores.map((s) => <option key={s.id} value={s.id}>{s.id} · {s.name}</option>)}
              </select>
              <select value={type} onChange={(e) => setType(e.target.value)} style={inp()}>
                <option>SALE</option><option>PURCHASE</option>
              </select>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} style={{ ...inp(), width: 110 }} placeholder="amount" />
              <input value={party} onChange={(e) => setParty(e.target.value)} style={{ ...inp(), width: 130 }} placeholder="party" />
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', color: isPersonal ? C.pers : C.muted, fontWeight: 700, fontSize: 13 }}>
                <input type="checkbox" checked={isPersonal} onChange={(e) => setIsPersonal(e.target.checked)} /> PERSONAL
              </label>
              <button onClick={submit} style={btn(true)}>Post</button>
            </div>
            {msg && <div style={{ marginTop: 10, fontSize: 13, color: C.gold }}>{msg}</div>}
          </section>

          <section style={card()}>
            <h3 style={h3()}>Connection Router <span style={{ color: C.muted, fontWeight: 400, fontSize: 12 }}>(management DB-switch)</span></h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 13, color: C.muted }}>Bound to:</span>
              <span style={{ fontWeight: 800, color: routerTarget === 'logical' ? C.log : C.phys }}>{routerTarget.toUpperCase()}</span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button onClick={() => doSwitch('physical')} style={btn(routerTarget === 'physical')}>Physical</button>
                <button onClick={() => doSwitch('logical')} style={btn(routerTarget === 'logical')}>Logical</button>
              </div>
            </div>
            <div style={{ marginTop: 8, fontSize: 11.5, color: C.muted }}>
              The routed management report runs against whichever DB is bound. Employees cannot switch.
            </div>
          </section>
        </div>

        {/* reconciliation */}
        {recon && (
          <section style={card()}>
            <h3 style={h3()}>Reconciliation {store && <span style={{ color: C.muted, fontWeight: 400, fontSize: 12 }}>· {store}</span>}</h3>
            <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
              <Metric label="Physical" value={recon.physicalTotal} color={C.phys} />
              <span style={{ fontSize: 20, color: C.muted }}>+</span>
              <Metric label="Personal" value={recon.personalTotal} color={C.pers} />
              <span style={{ fontSize: 20, color: C.muted }}>=</span>
              <Metric label="Logical" value={recon.logicalTotal} color={C.log} />
              <span style={{ marginLeft: 'auto', fontWeight: 700, color: recon.identityHolds ? C.ok : C.pers }}>
                {recon.identityHolds ? '✓ identity holds' : '✗ mismatch'}
              </span>
            </div>
          </section>
        )}

        {/* ledgers side by side */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Ledger title="Physical Ledger" subtitle="official books · all staff" color={C.phys} rows={phys} />
          <section style={card()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h3 style={{ ...h3(), margin: 0, color: C.log }}>Logical Ledger</h3>
              <span style={{ color: C.muted, fontSize: 12 }}>complete truth · management only</span>
              {role === 'management' && (
                <label style={{ marginLeft: 'auto', fontSize: 12, color: C.muted, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="checkbox" checked={unmask} onChange={(e) => setUnmask(e.target.checked)} /> unmask personal
                </label>
              )}
            </div>
            {logErr ? (
              <div style={{ marginTop: 12, padding: 14, border: `1px solid ${C.pers}`, borderRadius: 8, color: C.pers, fontSize: 13 }}>
                🔒 {logErr}
              </div>
            ) : (
              <Rows rows={log} />
            )}
          </section>
        </div>

        {/* inventory */}
        <section style={card()}>
          <h3 style={h3()}>Inventory</h3>
          <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse' }}>
            <thead><tr style={{ color: C.muted, textAlign: 'left' }}><th>Store</th><th>SKU</th><th>Metal</th><th>Purity</th><th>Wt(g)</th><th>Qty</th></tr></thead>
            <tbody>{inventory.map((i) => (
              <tr key={i.id} style={{ borderTop: `1px solid ${C.line}` }}><td>{i.storeId}</td><td>{i.sku}</td><td>{i.metal}</td><td>{i.purity}</td><td>{String(i.weightG)}</td><td>{i.qty}</td></tr>
            ))}</tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

function Ledger({ title, subtitle, color, rows }: any) {
  return (
    <section style={card()}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h3 style={{ ...h3(), margin: 0, color }}>{title}</h3>
        <span style={{ color: C.muted, fontSize: 12 }}>{subtitle}</span>
      </div>
      <Rows rows={rows} />
    </section>
  );
}

function Rows({ rows }: { rows: any[] }) {
  if (!rows?.length) return <div style={{ color: C.muted, fontSize: 13, marginTop: 12 }}>No entries.</div>;
  return (
    <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', marginTop: 8 }}>
      <thead><tr style={{ color: C.muted, textAlign: 'left' }}><th>Store</th><th>Acct</th><th>Memo</th><th style={{ textAlign: 'right' }}>Dr</th><th style={{ textAlign: 'right' }}>Cr</th></tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} style={{ borderTop: `1px solid ${C.line}`, background: r.isPersonal ? 'rgba(255,107,139,.08)' : undefined }}>
            <td>{r.storeId}</td><td>{r.accountCode}</td><td>{r.memo}</td>
            <td style={{ textAlign: 'right' }}>{fmt(r.debit)}</td><td style={{ textAlign: 'right' }}>{fmt(r.credit)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const Metric = ({ label, value, color }: any) => (
  <div><div style={{ color: C.muted, fontSize: 11 }}>{label}</div><div style={{ fontSize: 20, fontWeight: 800, color }}>₹{fmt(value)}</div></div>
);

const fmt = (n: any) => (n === '•••••' || n == null ? n ?? '' : Number(n).toLocaleString('en-IN'));
const card = () => ({ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: 16 });
const h3 = () => ({ margin: '0 0 12px', fontSize: 15 });
const inp = () => ({ background: '#1b2740', color: C.ink, border: `1px solid #2a3a5c`, borderRadius: 8, padding: '8px 10px', fontSize: 13 });
const btn = (active: boolean) => ({
  background: active ? `linear-gradient(135deg, ${C.gold}, #caa13e)` : '#1b2740',
  color: active ? '#1a1405' : C.ink, border: active ? 'none' : '1px solid #2a3a5c',
  borderRadius: 8, padding: '8px 13px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
});
