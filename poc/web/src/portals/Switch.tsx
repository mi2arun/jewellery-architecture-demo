import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { C } from '../theme';

// Mobile Switch app (simulated device) — ITS ONLY JOB is the Connection Router
// DB-switch. No reports, no transactions. Drives what the Management Reports
// portal reads.
export function SwitchApp() {
  const role = 'management' as const; // the mobile app is an authorized mgmt device
  const [target, setTarget] = useState<string>('physical');
  const [msg, setMsg] = useState('');

  const refresh = useCallback(async () => {
    try { setTarget((await api.routerStatus(role)).target); } catch {}
  }, []);
  useEffect(() => { refresh(); const t = setInterval(refresh, 3000); return () => clearInterval(t); }, [refresh]);

  const flip = async () => {
    const next = target === 'physical' ? 'logical' : 'physical';
    try { const r = await api.routerSwitch(role, next as any); setTarget(r.target); setMsg(`Router bound to ${r.target.toUpperCase()}`); }
    catch (e: any) { setMsg(`Denied: ${e?.body?.message || ''}`); }
  };

  const toLog = target === 'logical';
  return (
    <div style={{ display: 'grid', placeItems: 'center', paddingTop: 24 }}>
      {/* phone frame */}
      <div style={{ width: 320, border: `1px solid ${C.line}`, borderRadius: 28, background: '#0e1626', boxShadow: '0 20px 50px rgba(0,0,0,.5)', padding: 18 }}>
        <div style={{ height: 6, width: 90, background: '#22304d', borderRadius: 6, margin: '0 auto 16px' }} />
        <div style={{ textAlign: 'center', marginBottom: 4, fontSize: 22 }}>📱</div>
        <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 15 }}>Ledger Router</div>
        <div style={{ textAlign: 'center', color: C.muted, fontSize: 11.5, marginBottom: 16 }}>routing-only · MFA session</div>

        <div style={{ background: '#0a1120', border: `1px solid ${C.line}`, borderRadius: 14, padding: 16 }}>
          <div style={{ color: C.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px' }}>Active DB Connection</div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, justifyContent: 'center' }}>
            <span style={{ fontWeight: 800, color: !toLog ? C.phys : C.muted, fontSize: 13 }}>PHYSICAL</span>
            {/* toggle */}
            <div onClick={flip} style={{
              position: 'relative', width: 70, height: 30, borderRadius: 20, cursor: 'pointer',
              background: toLog ? 'linear-gradient(90deg,rgba(176,124,255,.25),rgba(176,124,255,.5))' : 'linear-gradient(90deg,rgba(78,161,255,.5),rgba(78,161,255,.25))',
              border: `1px solid #2a3a5c`, transition: 'background .35s',
            }}>
              <div style={{
                position: 'absolute', top: 2, left: toLog ? 42 : 2, width: 24, height: 24, borderRadius: '50%',
                background: '#e8eefc', display: 'grid', placeItems: 'center', fontSize: 12,
                transition: 'left .35s cubic-bezier(.34,1.4,.64,1)',
              }}>{toLog ? '📒' : '🏛️'}</div>
            </div>
            <span style={{ fontWeight: 800, color: toLog ? C.log : C.muted, fontSize: 13 }}>LOGICAL</span>
          </div>

          <div style={{ textAlign: 'center', marginTop: 14, fontSize: 13 }}>
            <span style={{ color: C.muted }}>Bound to </span>
            <b style={{ color: toLog ? C.log : C.phys }}>{target.toUpperCase()} DB</b>
          </div>

          <button onClick={flip} style={{
            width: '100%', marginTop: 14, padding: 11, borderRadius: 10, border: 'none', cursor: 'pointer',
            fontWeight: 800, fontSize: 13, color: '#1a1405', background: `linear-gradient(135deg, ${C.gold}, #caa13e)`,
          }}>SWITCH CONNECTION</button>
        </div>

        {msg && <div style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: C.gold }}>{msg}</div>}
        <div style={{ textAlign: 'center', marginTop: 14, fontSize: 10.5, color: C.muted, lineHeight: 1.5 }}>
          This device only flips the Connection Router.<br />Open the <b>Management Reports</b> portal to see reports follow this switch.
        </div>
      </div>
    </div>
  );
}
