import { useEffect, useState } from 'react';
import { medplum, ensureLogin } from './medplum';

const GROUP_ID = import.meta.env.VITE_GROUP_ID;

// Staged mock of a meeting environment. Deliberately platform-neutral — this is
// NOT a Zoom App and must never claim to be one in UI copy.
export const PRESENTER = 'Dana Ellison, RD';

/** Real membership of the seminar Group, +1 for the viewer. Never hardcoded —
 *  a banner the underlying Medplum data contradicts is worse than no banner. */
function useAttendeeCount() {
  const [count, setCount] = useState(null);
  useEffect(() => {
    let cancelled = false;
    ensureLogin()
      .then(() => medplum.readResource('Group', GROUP_ID))
      .then((group) => {
        if (!cancelled) setCount((group.member?.length ?? 0) + 1);
      })
      .catch((err) => console.error('Could not read attendee count', err));
    return () => {
      cancelled = true;
    };
  }, []);
  return count;
}

const PARTICIPANTS = [
  { name: 'Maria', hue: 190 },
  { name: 'Sam', hue: 30 },
  { name: 'Priya', hue: 280 },
  { name: 'You', hue: 160, isYou: true },
];

function formatElapsed(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function Tile({ name, hue, isYou, micActive }) {
  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '1px solid var(--hairline)',
        borderRadius: 8,
        padding: 10,
        minWidth: 96,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: '50%',
          background: `hsl(${hue} 30% 32%)`,
          display: 'grid',
          placeItems: 'center',
          fontWeight: 600,
          fontSize: 14,
        }}
      >
        {name[0]}
      </div>
      <div style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ color: isYou ? 'var(--ink)' : 'var(--ink-muted)' }}>{name}</span>
        <span
          title={micActive ? 'Speaking' : 'Muted'}
          style={{ color: micActive ? 'var(--accent-care)' : 'var(--ink-muted)' }}
        >
          {micActive ? '🎙' : '🔇'}
        </span>
      </div>
    </div>
  );
}

function MeetingShell({ role, recorder, panelTab, setPanelTab, account, setAccount, children }) {
  const [elapsed, setElapsed] = useState(0);
  const attending = useAttendeeCount();
  const isRecording = recorder.recStatus === 'recording';

  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  function switchRole() {
    const next = role === 'clinician' ? 'patient' : 'clinician';
    window.location.search = `?view=${next}`;
  }

  const tabStyle = (active) => ({
    flex: 1,
    background: 'none',
    border: 'none',
    borderRadius: 0,
    borderBottom: `2px solid ${active ? 'var(--accent-care)' : 'transparent'}`,
    color: active ? 'var(--ink)' : 'var(--ink-muted)',
    fontWeight: active ? 600 : 400,
    padding: '10px 0',
    transition: 'border-color 160ms ease, color 160ms ease',
  });

  return (
    <div className="shell">
      {/* ---------------- meeting region ---------------- */}
      <section
        style={{
          background: 'var(--bg-meeting)',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 18px',
            borderBottom: '1px solid var(--hairline)',
            fontSize: 13,
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
            <span style={{ color: 'var(--flag)' }}>●</span>
            Prediabetes Lifestyle Seminar
          </span>
          <span style={{ color: 'var(--ink-muted)', display: 'flex', gap: 16, alignItems: 'center' }}>
            <span>{formatElapsed(elapsed)}</span>
            <span>{attending === null ? '…' : attending} attending</span>
            {/* Demo/ops control. Navigates for real — the URL parameter stays
                the single source of truth so two tabs can hold two roles. */}
            <button
              onClick={switchRole}
              title="Switch this tab's role (reloads)"
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                fontSize: 12,
                color: 'var(--ink-muted)',
                textDecoration: 'underline',
              }}
            >
              {role === 'clinician' ? 'Patient view' : 'Clinician view'}
            </button>
          </span>
        </header>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            padding: 18,
          }}
        >
          <div
            className="speaking"
            style={{
              flex: 1,
              minHeight: 0,
              background: 'var(--surface-card)',
              borderRadius: 12,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: '50%',
                  background: 'hsl(170 28% 30%)',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 28,
                  fontWeight: 600,
                  margin: '0 auto 10px',
                }}
              >
                D
              </div>
              <div style={{ fontWeight: 600 }}>{PRESENTER}</div>
              <div style={{ color: 'var(--ink-muted)', fontSize: 13 }}>Presenting</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {PARTICIPANTS.map((p) => (
              <Tile key={p.name} {...p} micActive={p.isYou && isRecording} />
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button
              onClick={recorder.toggleRecording}
              title={isRecording ? 'Stop and use what you said' : 'Ask a question by voice'}
              style={
                isRecording
                  ? { borderColor: 'var(--accent-care)', color: 'var(--accent-care)' }
                  : undefined
              }
            >
              {isRecording ? '⏹ Stop' : '🎤 Mic'}
            </button>
            <button title="Camera (not wired up in this demo)" disabled>
              📷 Camera
            </button>
            <button title="Leave (not wired up in this demo)" disabled>
              Leave
            </button>
          </div>
        </div>
      </section>

      {/* ---------------- DecaQuery panel ---------------- */}
      <aside
        style={{
          background: 'var(--bg-panel)',
          borderLeft: '1px solid var(--hairline)',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        <div
          style={{
            padding: '12px 16px 0',
            borderBottom: '1px solid var(--hairline)',
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
            DecaQuery
            <span style={{ color: 'var(--ink-muted)', fontWeight: 400 }}>
              {' '}
              · {role === 'clinician' ? 'Clinician' : 'Attendee'}
            </span>
          </div>
          <div style={{ display: 'flex' }}>
            <button style={tabStyle(panelTab === 'qa')} onClick={() => setPanelTab('qa')}>
              Q&amp;A
            </button>
            <button style={tabStyle(panelTab === 'faq')} onClick={() => setPanelTab('faq')}>
              FAQ
            </button>
            <button style={tabStyle(panelTab === 'portal')} onClick={() => setPanelTab('portal')}>
              Portal
            </button>
          </div>
        </div>

        {/* Demo lens over the two seeded personas. Sets the same selection the
            Portal's account picker uses. Patient side only — the shell header
            already has the clinician/patient role switcher. */}
        {role === 'patient' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderBottom: '1px solid var(--hairline)',
              fontSize: 12,
              color: 'var(--ink-muted)',
            }}
          >
            <span>Viewing as:</span>
            <div style={{ display: 'flex', border: '1px solid var(--hairline)', borderRadius: 6 }}>
              {[
                { key: 'maria', label: 'Clinic patient' },
                { key: 'sam', label: 'Guest' },
              ].map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setAccount(opt.key)}
                  style={{
                    border: 'none',
                    borderRadius: 0,
                    padding: '3px 9px',
                    fontSize: 12,
                    background: account === opt.key ? 'var(--surface-card)' : 'transparent',
                    color: account === opt.key ? 'var(--ink)' : 'var(--ink-muted)',
                    fontWeight: account === opt.key ? 600 : 400,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {account !== 'maria' && account !== 'sam' && <span>You (live session)</span>}
            {(account === 'maria' || account === 'sam') && (
              <button
                onClick={() => setAccount('self')}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  fontSize: 12,
                  color: 'var(--ink-muted)',
                  textDecoration: 'underline',
                }}
              >
                back to you
              </button>
            )}
          </div>
        )}

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16 }}>{children}</div>
      </aside>
    </div>
  );
}

export default MeetingShell;
