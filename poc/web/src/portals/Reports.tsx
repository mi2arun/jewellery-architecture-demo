import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { C, fmt, card, h3, inp } from '../theme';

// Management Reports portal — READ ONLY. Reads accounts via the Connection
// Router; what it shows depends on what the Mobile Switch app has bound.
export function Reports() {
  const role = 'management' as const;
  const [stores, setStores] = useState<any[]>([]);
  const [store, setStore] = useState('');
  const [bound, setBound] = useState<string>('physical');
  const [report, setReport] = useState<any[]>([]);
  const [recon, setRecon] = useState<any>(null);
  const [audit, setAudit] = useState<any[]>([]);
  const [unmask, setUnmask] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string>('');

  const refresh = useCallback(async () => {
    try {
      const st = await api.routerStatus(role);
      const tgt = st.target;
      setBound(tgt);
      const rep = await api.routedReport(role, store); setReport(rep.rows || []);
      // Reconciliation exposes the personal total, so it belongs to the Logical
      // view only. When bound to Physical, management sees Physical data only.
      setRecon(tgt === 'logical' ? await api.reconciliation(role, store) : null);
      setAudit(await api.audit(role));
      setUpdatedAt(new Date().toLocaleTimeString());
    } catch { /* ignore for poll */ }
  }, [store]);

  useEffect(() => { api.stores(role).then((s) => { setStores(s); if (s[0]) setStore(s[0].id); }); }, []);
  useEffect(() => { refresh(); const t = setInterval(refresh, 3000); return () => clearInterval(t); }, [refresh]);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <section style={{ ...card(), display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <select value={store} onChange={(e) => setStore(e.target.value)} style={inp()}>
          <option value="">All stores</option>
          {stores.map((s) => <option key={s.id} value={s.id}>{s.id} · {s.name}</option>)}
        </select>
        <div style={{ fontSize: 13 }}>
          <span style={{ color: C.muted }}>Reports bound to: </span>
          <b style={{ color: bound === 'logical' ? C.log : C.phys }}>{bound.toUpperCase()} DB</b>
          <span style={{ color: C.muted, fontSize: 11 }}> (set by the Mobile Switch app)</span>
        </div>
        {bound === 'logical' && (
          <label style={{ marginLeft: 'auto', fontSize: 12, color: C.muted, display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={unmask} onChange={(e) => setUnmask(e.target.checked)} /> unmask personal
          </label>
        )}
        <span style={{ color: C.muted, fontSize: 11, marginLeft: bound === 'logical' ? 0 : 'auto' }}>updated {updatedAt}</span>
      </section>

      {recon && bound === 'logical' && (
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

      <section style={card()}>
        <h3 style={{ ...h3(), color: bound === 'logical' ? C.log : C.phys }}>
          {bound === 'logical' ? 'Logical Ledger' : 'Physical Ledger'}
          <span style={{ color: C.muted, fontWeight: 400, fontSize: 12 }}>
            {' '}· reading {bound.toUpperCase()} DB{bound === 'logical' ? ` · personal ${unmask ? 'revealed' : 'masked'}` : ' · official books only'}
          </span>
        </h3>
        <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 8 }}>
          This view runs against whichever DB the Connection Router is bound to. Flip the Mobile Switch and it changes.
        </div>
        <Rows rows={maskRows(report, bound === 'logical', unmask)} />
      </section>

      <section style={card()}>
        <h3 style={h3()}>Audit Log <span style={{ color: C.muted, fontWeight: 400, fontSize: 12 }}>· hash-chained</span></h3>
        <table style={{ width: '100%', fontSize: 11.5, borderCollapse: 'collapse' }}>
          <thead><tr style={{ color: C.muted, textAlign: 'left' }}><th>When</th><th>Role</th><th>Action</th><th>Resource</th><th>Rows</th></tr></thead>
          <tbody>{audit.slice(0, 12).map((a) => (
            <tr key={a.id} style={{ borderTop: `1px solid ${C.line}` }}>
              <td>{new Date(a.ts).toLocaleTimeString()}</td><td>{a.actorRole}</td><td>{a.action}</td><td>{a.resource}</td><td>{a.rowCount}</td>
            </tr>
          ))}</tbody>
        </table>
      </section>
    </div>
  );
}

// Mask personal rows in the Logical view unless explicitly unmasked.
// (Physical rows are never personal, so when bound to Physical this is a no-op.)
function maskRows(rows: any[], isLogical: boolean, unmask: boolean) {
  if (!isLogical || unmask) return rows;
  return rows.map((r) =>
    r.isPersonal
      ? { ...r, memo: 'Personal — •••••', debit: '•••••', credit: '•••••' }
      : r,
  );
}

const Metric = ({ label, value, color }: any) => (
  <div><div style={{ color: C.muted, fontSize: 11 }}>{label}</div><div style={{ fontSize: 20, fontWeight: 800, color }}>₹{fmt(value)}</div></div>
);

function Rows({ rows }: { rows: any[] }) {
  if (!rows?.length) return <div style={{ color: C.muted, fontSize: 13 }}>No entries.</div>;
  return (
    <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
      <thead><tr style={{ color: C.muted, textAlign: 'left' }}><th>Store</th><th>Acct</th><th>Memo</th><th style={{ textAlign: 'right' }}>Dr</th><th style={{ textAlign: 'right' }}>Cr</th></tr></thead>
      <tbody>{rows.map((r, i) => (
        <tr key={i} style={{ borderTop: `1px solid ${C.line}`, background: r.isPersonal ? 'rgba(255,107,139,.08)' : undefined }}>
          <td>{r.storeId}</td><td>{r.accountCode}</td><td>{r.memo}</td><td style={{ textAlign: 'right' }}>{fmt(r.debit)}</td><td style={{ textAlign: 'right' }}>{fmt(r.credit)}</td>
        </tr>
      ))}</tbody>
    </table>
  );
}
