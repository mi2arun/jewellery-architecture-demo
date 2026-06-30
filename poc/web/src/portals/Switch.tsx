import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';

// Mobile Switch app (simulated iOS device) — ITS ONLY JOB is the Connection
// Router DB-switch. Styled as a real native iOS app inside an iPhone frame.
export function SwitchApp() {
  const role = 'management' as const;
  const [target, setTarget] = useState<string>('physical');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [now, setNow] = useState(clock());

  const refresh = useCallback(async () => {
    try { setTarget((await api.routerStatus(role)).target); } catch {}
  }, []);
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000);
    const c = setInterval(() => setNow(clock()), 1000 * 20);
    return () => { clearInterval(t); clearInterval(c); };
  }, [refresh]);

  const setTo = async (next: 'physical' | 'logical') => {
    if (next === target || busy) return;
    setBusy(true);
    try {
      const r = await api.routerSwitch(role, next);
      setTarget(r.target);
      flash(setToast, `Bound to ${r.target === 'logical' ? 'Logical' : 'Physical'} DB`);
    } catch (e: any) {
      flash(setToast, `Denied: ${e?.body?.message || 'error'}`);
    } finally {
      setBusy(false);
    }
  };

  const toLog = target === 'logical';

  return (
    <div style={S.stage}>
      <div style={S.deviceWrap}>
        {/* ===== iPhone frame ===== */}
        <div style={S.phone}>
          <div style={S.bezel}>
            {/* Dynamic Island */}
            <div style={S.island} />

            {/* Status bar */}
            <div style={S.statusBar}>
              <span style={S.statusTime}>{now}</span>
              <span style={S.statusIcons}>
                <span>􀙇</span><Signal /><Wifi /><Battery />
              </span>
            </div>

            {/* ===== App screen ===== */}
            <div style={S.screen}>
              {/* Large title nav */}
              <div style={S.largeTitleWrap}>
                <div style={S.appKicker}>LEDGER ROUTER</div>
                <div style={S.largeTitle}>Connection</div>
                <div style={S.subtle}>Routing-only device · MFA session active</div>
              </div>

              {/* Status pill */}
              <div style={S.statusCardOuter}>
                <div style={{ ...S.statusCard, borderColor: toLog ? IOS.purple : IOS.blue }}>
                  <div style={{ ...S.dbIcon, background: toLog ? withA(IOS.purple, .18) : withA(IOS.blue, .18) }}>
                    {toLog ? '📒' : '🏛️'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={S.statusLabel}>ACTIVE DATABASE</div>
                    <div style={{ ...S.statusValue, color: toLog ? IOS.purple : IOS.blue }}>
                      {toLog ? 'Logical Ledger' : 'Physical Ledger'}
                    </div>
                    <div style={S.statusRegion}>{toLog ? 'Region B · logical_ro' : 'Region A · physical_ro'}</div>
                  </div>
                  <div style={{ ...S.liveDot, background: IOS.green }} />
                </div>
              </div>

              {/* Grouped settings list — segmented selector */}
              <div style={S.groupHeader}>SELECT TARGET</div>
              <div style={S.group}>
                <Row
                  icon="🏛️" label="Physical Ledger" hint="Official books · Region A"
                  selected={!toLog} onClick={() => setTo('physical')} accent={IOS.blue}
                />
                <div style={S.sep} />
                <Row
                  icon="📒" label="Logical Ledger" hint="Complete truth · Region B"
                  selected={toLog} onClick={() => setTo('logical')} accent={IOS.purple}
                />
              </div>

              {/* iOS toggle row */}
              <div style={S.group}>
                <div style={S.toggleRow}>
                  <div>
                    <div style={S.rowLabel}>Bind to Logical</div>
                    <div style={S.rowHint}>{toLog ? 'On · personal data visible' : 'Off · official books only'}</div>
                  </div>
                  <IOSSwitch on={toLog} busy={busy} onToggle={() => setTo(toLog ? 'physical' : 'logical')} />
                </div>
              </div>

              {/* Primary button */}
              <button
                onClick={() => setTo(toLog ? 'physical' : 'logical')}
                disabled={busy}
                style={{ ...S.cta, opacity: busy ? .6 : 1 }}
              >
                {busy ? 'Switching…' : 'Switch Connection'}
              </button>

              <div style={S.footnote}>
                This device only flips the Connection Router.{'\n'}Open <b>Management Reports</b> to see reports follow this switch.
              </div>

              {/* toast */}
              {toast && <div style={S.toast}>{toast}</div>}

              {/* Home indicator */}
              <div style={S.homeBar} />
            </div>
          </div>
          {/* side buttons */}
          <div style={{ ...S.sideBtn, top: 120, left: -3, height: 28 }} />
          <div style={{ ...S.sideBtn, top: 165, left: -3, height: 52 }} />
          <div style={{ ...S.sideBtn, top: 230, left: -3, height: 52 }} />
          <div style={{ ...S.sideBtn, top: 170, right: -3, left: 'auto', height: 76 }} />
        </div>

        <div style={S.caption}>Simulated iOS app · “Ledger Router”</div>
      </div>
    </div>
  );
}

/* ---------- pieces ---------- */

function Row({ icon, label, hint, selected, onClick, accent }: any) {
  return (
    <div onClick={onClick} style={{ ...S.listRow, cursor: 'pointer' }}>
      <div style={{ ...S.rowIcon, background: withA(accent, .16) }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={S.rowLabel}>{label}</div>
        <div style={S.rowHint}>{hint}</div>
      </div>
      {selected && <span style={{ color: accent, fontSize: 17, fontWeight: 700 }}>✓</span>}
    </div>
  );
}

function IOSSwitch({ on, onToggle, busy }: { on: boolean; onToggle: () => void; busy: boolean }) {
  return (
    <div
      onClick={() => !busy && onToggle()}
      style={{
        width: 51, height: 31, borderRadius: 31, cursor: busy ? 'default' : 'pointer',
        background: on ? IOS.green : '#39393d', transition: 'background .25s', position: 'relative',
        flex: '0 0 auto',
      }}
    >
      <div style={{
        position: 'absolute', top: 2, left: on ? 22 : 2, width: 27, height: 27, borderRadius: '50%',
        background: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,.3)', transition: 'left .25s cubic-bezier(.4,1.3,.5,1)',
      }} />
    </div>
  );
}

const Signal = () => (
  <svg width="17" height="11" viewBox="0 0 17 11" fill="#fff"><rect x="0" y="7" width="3" height="4" rx="1"/><rect x="4.5" y="5" width="3" height="6" rx="1"/><rect x="9" y="2.5" width="3" height="8.5" rx="1"/><rect x="13.5" y="0" width="3" height="11" rx="1"/></svg>
);
const Wifi = () => (
  <svg width="16" height="11" viewBox="0 0 16 12" fill="#fff"><path d="M8 2.5c2.6 0 5 1 6.8 2.7l-1.4 1.5A7.6 7.6 0 008 4.5a7.6 7.6 0 00-5.4 2.2L1.2 5.2A9.6 9.6 0 018 2.5zm0 3.4c1.5 0 2.9.6 4 1.6l-1.5 1.5A3.5 3.5 0 008 9a3.5 3.5 0 00-2.5 1L4 8.5a5.6 5.6 0 014-1.6zm0 3.3c.6 0 1.1.2 1.5.6L8 11.4 6.5 9.8c.4-.4.9-.6 1.5-.6z"/></svg>
);
const Battery = () => (
  <svg width="26" height="12" viewBox="0 0 26 12"><rect x="0.5" y="0.5" width="21" height="11" rx="3" fill="none" stroke="#fff" strokeOpacity=".5"/><rect x="2" y="2" width="16" height="8" rx="1.5" fill="#fff"/><rect x="23" y="3.5" width="2" height="5" rx="1" fill="#fff" fillOpacity=".5"/></svg>
);

/* ---------- helpers ---------- */
function clock() {
  const d = new Date();
  let h = d.getHours(); const m = d.getMinutes();
  return `${h % 12 === 0 ? 12 : h % 12}:${m < 10 ? '0' + m : m}`;
}
function flash(set: (s: string) => void, msg: string) {
  set(msg);
  setTimeout(() => set(''), 2200);
}
const withA = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

/* ---------- iOS palette ---------- */
const IOS = {
  blue: '#0a84ff', purple: '#bf5af2', green: '#30d158', label: '#f2f2f7',
  secondary: '#8e8e93', bg: '#000000', card: '#1c1c1e', card2: '#2c2c2e', sep: '#38383a',
};

/* ---------- styles ---------- */
const S: Record<string, React.CSSProperties> = {
  stage: { display: 'grid', placeItems: 'center', paddingTop: 18 },
  deviceWrap: { display: 'grid', placeItems: 'center', gap: 12 },

  phone: {
    position: 'relative', width: 330, height: 680, borderRadius: 54,
    background: 'linear-gradient(145deg,#3a3a3c,#1a1a1c)', padding: 11,
    boxShadow: '0 30px 70px rgba(0,0,0,.6), inset 0 0 2px rgba(255,255,255,.25)',
  },
  bezel: {
    position: 'relative', width: '100%', height: '100%', borderRadius: 44,
    background: IOS.bg, overflow: 'hidden',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", system-ui, sans-serif',
  },
  island: {
    position: 'absolute', top: 11, left: '50%', transform: 'translateX(-50%)',
    width: 108, height: 32, background: '#000', borderRadius: 20, zIndex: 5,
  },
  statusBar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '14px 26px 0', color: '#fff', fontSize: 14, fontWeight: 600,
  },
  statusTime: { fontVariantNumeric: 'tabular-nums', letterSpacing: '.3px' },
  statusIcons: { display: 'flex', alignItems: 'center', gap: 6 },

  screen: { position: 'relative', height: 'calc(100% - 30px)', padding: '6px 18px 0', color: IOS.label, overflowY: 'auto' },

  largeTitleWrap: { padding: '26px 4px 14px' },
  appKicker: { color: IOS.secondary, fontSize: 11, fontWeight: 700, letterSpacing: '1.2px' },
  largeTitle: { fontSize: 34, fontWeight: 800, lineHeight: 1.1, marginTop: 2, letterSpacing: '-.5px' },
  subtle: { color: IOS.secondary, fontSize: 12.5, marginTop: 6 },

  statusCardOuter: { marginTop: 6 },
  statusCard: {
    display: 'flex', alignItems: 'center', gap: 12, background: IOS.card,
    border: '1.5px solid', borderRadius: 18, padding: 14,
  },
  dbIcon: { width: 46, height: 46, borderRadius: 13, display: 'grid', placeItems: 'center', fontSize: 24, flex: '0 0 auto' },
  statusLabel: { color: IOS.secondary, fontSize: 10.5, fontWeight: 700, letterSpacing: '.8px' },
  statusValue: { fontSize: 19, fontWeight: 800, marginTop: 1 },
  statusRegion: { color: IOS.secondary, fontSize: 11.5, marginTop: 2 },
  liveDot: { width: 9, height: 9, borderRadius: '50%', flex: '0 0 auto', boxShadow: '0 0 8px #30d158' },

  groupHeader: { color: IOS.secondary, fontSize: 11.5, fontWeight: 600, letterSpacing: '.4px', margin: '22px 6px 7px' },
  group: { background: IOS.card, borderRadius: 14, overflow: 'hidden', marginBottom: 8 },
  listRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' },
  rowIcon: { width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center', fontSize: 16, flex: '0 0 auto' },
  rowLabel: { fontSize: 15.5, fontWeight: 600 },
  rowHint: { color: IOS.secondary, fontSize: 12, marginTop: 1 },
  sep: { height: 1, background: IOS.sep, marginLeft: 56 },
  toggleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px' },

  cta: {
    width: '100%', marginTop: 10, padding: '14px', borderRadius: 14, border: 'none',
    background: IOS.blue, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'inherit',
  },
  footnote: { color: IOS.secondary, fontSize: 11.5, textAlign: 'center', marginTop: 16, lineHeight: 1.5, whiteSpace: 'pre-line', padding: '0 6px' },

  toast: {
    position: 'absolute', left: 18, right: 18, bottom: 34, background: 'rgba(44,44,46,.96)',
    color: '#fff', textAlign: 'center', padding: '11px 14px', borderRadius: 13, fontSize: 13.5,
    fontWeight: 600, backdropFilter: 'blur(10px)', boxShadow: '0 8px 24px rgba(0,0,0,.5)',
  },
  homeBar: {
    position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
    width: 128, height: 5, background: 'rgba(255,255,255,.6)', borderRadius: 3,
  },

  sideBtn: { position: 'absolute', width: 3, background: '#2a2a2c', borderRadius: 2 },
  caption: { color: '#8b98b8', fontSize: 12 },
};
