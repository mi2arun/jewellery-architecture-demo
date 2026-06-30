import { useEffect, useState } from 'react';
import { C } from './theme';
import { Pos } from './portals/Pos';
import { Reports } from './portals/Reports';
import { SwitchApp } from './portals/Switch';

type Route = '' | 'pos' | 'reports' | 'switch';

function useHashRoute(): Route {
  const get = () => (location.hash.replace(/^#\/?/, '') as Route) || '';
  const [route, setRoute] = useState<Route>(get());
  useEffect(() => {
    const on = () => setRoute(get());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

const PORTALS: { key: Route; icon: string; title: string; sub: string; color: string }[] = [
  { key: 'pos', icon: '🧾', title: 'POS / Operations', sub: 'Store staff · create sales & purchases', color: C.gold },
  { key: 'reports', icon: '📊', title: 'Management Reports', sub: 'Read-only accounts · via Connection Router', color: C.log },
  { key: 'switch', icon: '📱', title: 'Mobile Switch', sub: 'Routing-only device · flips the active DB', color: C.phys },
];

export function App() {
  const route = useHashRoute();
  const active = PORTALS.find((p) => p.key === route);

  return (
    <div style={{ background: C.bg, color: C.ink, minHeight: '100vh', fontFamily: 'Segoe UI, system-ui, sans-serif' }}>
      <header style={{ padding: '14px 24px', borderBottom: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', gap: 12 }}>
        <a href="#/" style={{ fontSize: 24, textDecoration: 'none' }}>💎</a>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Dual-Ledger POC — Jewellery Retail</div>
          <div style={{ color: C.muted, fontSize: 12 }}>Separate portals · shared API · two Postgres instances</div>
        </div>
        <nav style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {PORTALS.map((p) => (
            <a key={p.key} href={`#/${p.key}`} style={{
              textDecoration: 'none', padding: '8px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 700,
              color: route === p.key ? '#1a1405' : C.ink,
              background: route === p.key ? `linear-gradient(135deg,${C.gold},#caa13e)` : '#1b2740',
              border: route === p.key ? 'none' : `1px solid #2a3a5c`,
            }}>{p.icon} {p.title}</a>
          ))}
        </nav>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: 20 }}>
        {!active && <Landing />}
        {route === 'pos' && <Pos />}
        {route === 'reports' && <Reports />}
        {route === 'switch' && <SwitchApp />}
      </main>
    </div>
  );
}

function Landing() {
  return (
    <div>
      <div style={{ color: C.muted, fontSize: 13.5, margin: '8px 0 18px', lineHeight: 1.6 }}>
        Three separate apps share one backend and two ledger databases. The POS portal posts transactions;
        the Management Reports portal reads accounts <b>through the Connection Router</b>; the Mobile Switch app
        flips which database that router is bound to.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {PORTALS.map((p) => (
          <a key={p.key} href={`#/${p.key}`} style={{
            textDecoration: 'none', color: C.ink, background: C.panel, border: `1px solid ${C.line}`,
            borderRadius: 14, padding: 20, display: 'block',
          }}>
            <div style={{ fontSize: 30 }}>{p.icon}</div>
            <div style={{ fontWeight: 800, fontSize: 16, marginTop: 8, color: p.color }}>{p.title}</div>
            <div style={{ color: C.muted, fontSize: 12.5, marginTop: 6 }}>{p.sub}</div>
            <div style={{ marginTop: 12, fontSize: 12, color: C.gold }}>Open →</div>
          </a>
        ))}
      </div>
      <div style={{ marginTop: 22, fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
        <b>Demo tip:</b> open <a href="#/reports" style={{ color: C.log }}>Management Reports</a> in one tab and
        <a href="#/switch" style={{ color: C.phys }}> Mobile Switch</a> in another. Flip the switch on the phone and
        watch the routed report in the reports tab change which DB it reads (updates every 3s).
      </div>
    </div>
  );
}
