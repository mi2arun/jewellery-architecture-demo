import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { C, fmt, card, h3, inp, btn } from '../theme';

// POS / Operations portal — store staff create transactions. Read role = employee.
export function Pos() {
  const role = 'employee' as const;
  const [stores, setStores] = useState<any[]>([]);
  const [store, setStore] = useState('');
  const [inventory, setInventory] = useState<any[]>([]);
  const [physical, setPhysical] = useState<any[]>([]);
  const [msg, setMsg] = useState('');

  const [type, setType] = useState('SALE');
  const [amount, setAmount] = useState('50000');
  const [isPersonal, setIsPersonal] = useState(false);
  const [party, setParty] = useState('Walk-in');
  const [sku, setSku] = useState('');

  const refresh = useCallback(async () => {
    try { setInventory(await api.inventory(role, store)); } catch { setInventory([]); }
    try { setPhysical(await api.physicalLedger(role, store)); } catch { setPhysical([]); }
  }, [store]);

  useEffect(() => { api.stores(role).then((s) => { setStores(s); if (s[0]) setStore(s[0].id); }); }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const submit = async () => {
    setMsg('');
    try {
      const r = await api.createTxn(role, { storeId: store, type, amount: Number(amount), isPersonal, party, sku: sku || undefined });
      setMsg(`✓ Posted ${r.txnId.slice(0, 8)} — ${r.isPersonal ? 'PERSONAL (Logical only)' : 'Physical written + Logical via outbox'}`);
      setTimeout(refresh, 1300);
    } catch (e: any) { setMsg(`Error: ${e?.body?.message || 'failed'}`); }
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <section style={card()}>
        <h3 style={h3()}>New Transaction <span style={{ color: C.muted, fontWeight: 400, fontSize: 12 }}>· store counter</span></h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={store} onChange={(e) => setStore(e.target.value)} style={inp()}>
            {stores.map((s) => <option key={s.id} value={s.id}>{s.id} · {s.name}</option>)}
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)} style={inp()}><option>SALE</option><option>PURCHASE</option></select>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} style={{ ...inp(), width: 110 }} placeholder="amount" />
          <input value={party} onChange={(e) => setParty(e.target.value)} style={{ ...inp(), width: 130 }} placeholder="party" />
          <input value={sku} onChange={(e) => setSku(e.target.value)} style={{ ...inp(), width: 130 }} placeholder="sku (optional)" />
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', color: isPersonal ? C.pers : C.muted, fontWeight: 700, fontSize: 13 }}>
            <input type="checkbox" checked={isPersonal} onChange={(e) => setIsPersonal(e.target.checked)} /> PERSONAL
          </label>
          <button onClick={submit} style={btn(true)}>Post</button>
        </div>
        {msg && <div style={{ marginTop: 10, fontSize: 13, color: C.gold }}>{msg}</div>}
        <div style={{ marginTop: 8, fontSize: 11.5, color: C.muted }}>
          POS staff only see the official Physical book below. The Logical ledger &amp; reports are in the Management portal.
        </div>
      </section>

      <section style={card()}>
        <h3 style={{ ...h3(), color: C.phys }}>Physical Ledger <span style={{ color: C.muted, fontWeight: 400, fontSize: 12 }}>· official books (all staff)</span></h3>
        <Rows rows={physical} />
      </section>

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
  );
}

function Rows({ rows }: { rows: any[] }) {
  if (!rows?.length) return <div style={{ color: C.muted, fontSize: 13, marginTop: 8 }}>No entries.</div>;
  return (
    <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', marginTop: 8 }}>
      <thead><tr style={{ color: C.muted, textAlign: 'left' }}><th>Store</th><th>Acct</th><th>Memo</th><th style={{ textAlign: 'right' }}>Dr</th><th style={{ textAlign: 'right' }}>Cr</th></tr></thead>
      <tbody>{rows.map((r, i) => (
        <tr key={i} style={{ borderTop: `1px solid ${C.line}` }}><td>{r.storeId}</td><td>{r.accountCode}</td><td>{r.memo}</td><td style={{ textAlign: 'right' }}>{fmt(r.debit)}</td><td style={{ textAlign: 'right' }}>{fmt(r.credit)}</td></tr>
      ))}</tbody>
    </table>
  );
}
