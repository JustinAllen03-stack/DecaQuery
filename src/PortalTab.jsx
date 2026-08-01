import { useEffect, useState } from 'react';
import {
  PERSONAS,
  convertToPatient,
  isEstablished,
  loadPersonaQuestions,
  loadThread,
  sendFollowUp,
} from './personas';
import { PRESENTER } from './MeetingShell';

const CLINIC = 'Northline Nutrition';

function AccountPicker({ onPick }) {
  const liveId = sessionStorage.getItem('decaquery_patientId');
  const card = {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: 10,
    marginBottom: 8,
  };
  return (
    <div>
      <h3 style={{ fontSize: 13, marginBottom: 4 }}>Demo accounts</h3>
      <p style={{ fontSize: 12, color: 'var(--ink-muted)', marginBottom: 10 }}>
        Simulated accounts over real FHIR data — no login in this demo.
      </p>
      <button style={card} onClick={() => onPick('maria')}>
        <strong>Maria Alvarez</strong>
        <br />
        <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>Clinic patient</span>
      </button>
      <button style={card} onClick={() => onPick('sam')}>
        <strong>Sam Chen</strong>
        <br />
        <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>Webinar guest</span>
      </button>
      <button style={card} onClick={() => onPick('self')} disabled={!liveId}>
        <strong>Continue as yourself</strong>
        <br />
        <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>
          {liveId ? 'This session — webinar guest' : 'Ask a question first to create this identity'}
        </span>
      </button>
    </div>
  );
}

function PortalTab({ account, setAccount }) {
  const [established, setEstablished] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [thread, setThread] = useState([]);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [justConverted, setJustConverted] = useState(false);

  const persona = PERSONAS[account];
  const liveId = sessionStorage.getItem('decaquery_patientId');
  const patientId = persona ? persona.id : liveId;
  const displayName = persona ? persona.name : 'You';

  useEffect(() => {
    if (account === 'none' || !patientId) return;
    let cancelled = false;
    setStatus('loading');
    Promise.all([isEstablished(patientId), loadPersonaQuestions(patientId), loadThread(patientId)])
      .then(([est, qs, th]) => {
        if (cancelled) return;
        setEstablished(est);
        setQuestions(qs);
        setThread(th);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        console.error(err);
        setError(err.message);
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [patientId, account]);

  if (!account || account === 'none' || !patientId) {
    return <AccountPicker onPick={setAccount} />;
  }

  async function doConvert() {
    try {
      await convertToPatient(patientId);
      setEstablished(true);
      setJustConverted(true);
      setConfirming(false);
      setThread(await loadThread(patientId));
    } catch (err) {
      console.error(err);
      setError(err.message);
    }
  }

  async function send() {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    // Optimistic — the resource is created right after.
    setThread((prev) => [{ id: crypto.randomUUID(), text, fromPractitioner: false }, ...prev]);
    try {
      await sendFollowUp(patientId, text);
    } catch (err) {
      console.error(err);
      setError(err.message);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: 14 }}>{displayName}</h3>
        <button
          onClick={() => setAccount('none')}
          style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, color: 'var(--ink-muted)', textDecoration: 'underline' }}
        >
          Switch account
        </button>
      </div>

      <span
        className={justConverted ? 'q-card resolved sweep' : undefined}
        style={{
          display: 'inline-block',
          marginTop: 6,
          padding: '3px 8px',
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 600,
          color: established ? 'var(--accent-care)' : 'var(--ink-muted)',
          border: `1px solid ${established ? 'var(--accent-care)' : 'var(--hairline)'}`,
        }}
      >
        {established ? `Patient of ${CLINIC}` : 'Webinar guest'}
      </span>

      {status === 'loading' && (
        <p style={{ color: 'var(--ink-muted)', fontSize: 13, marginTop: 10 }}>Loading…</p>
      )}
      {error && <p style={{ color: 'var(--flag)', fontSize: 13, marginTop: 10 }}>{error}</p>}

      {status === 'ready' && (
        <>
          <h4 style={{ fontSize: 12, marginTop: 18, color: 'var(--ink-muted)' }}>
            Your questions from this seminar
          </h4>
          {questions.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--ink-muted)' }}>No questions on file.</p>
          )}
          {questions.map((q) => (
            <div
              key={q.id}
              style={{
                background: 'var(--surface-card)',
                border: '1px solid var(--hairline)',
                borderRadius: 8,
                padding: 10,
                marginTop: 8,
              }}
            >
              <p style={{ fontSize: 13 }}>"{q.text}"</p>
              {q.answers.map((a, i) => (
                <div
                  key={i}
                  style={{
                    border: '1px solid var(--accent-care)',
                    borderRadius: 6,
                    padding: 8,
                    marginTop: 8,
                    background: 'rgba(79,184,165,0.08)',
                  }}
                >
                  <p style={{ fontSize: 11, color: 'var(--accent-care)', fontWeight: 600 }}>
                    {PRESENTER} — recorded answer
                  </p>
                  <p style={{ fontSize: 13, marginTop: 4, lineHeight: 1.5 }}>{a}</p>
                </div>
              ))}
              {established && (
                <p style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 6 }}>
                  Want to go deeper on this?{' '}
                  <button
                    onClick={() => setDraft(`About my question "${q.text}" — `)}
                    style={{ background: 'none', border: 'none', padding: 0, color: 'var(--accent-care)', textDecoration: 'underline', fontSize: 12 }}
                  >
                    Ask Dana directly.
                  </button>
                </p>
              )}
            </div>
          ))}

          {established ? (
            <>
              <h4 style={{ fontSize: 12, marginTop: 20, color: 'var(--ink-muted)' }}>
                Your thread with {PRESENTER}
              </h4>
              {thread.length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--ink-muted)' }}>No messages yet.</p>
              )}
              {thread.map((m) => (
                <div
                  key={m.id}
                  style={{
                    background: m.fromPractitioner ? 'rgba(79,184,165,0.08)' : 'var(--surface-card)',
                    border: '1px solid var(--hairline)',
                    borderRadius: 8,
                    padding: 8,
                    marginTop: 6,
                  }}
                >
                  <p style={{ fontSize: 11, color: 'var(--ink-muted)', fontWeight: 600 }}>
                    {m.fromPractitioner ? PRESENTER : displayName}
                  </p>
                  <p style={{ fontSize: 13, marginTop: 3, lineHeight: 1.5 }}>{m.text}</p>
                </div>
              ))}

              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={`Message ${PRESENTER}…`}
                style={{ width: '100%', minHeight: 60, marginTop: 10 }}
              />
              <button onClick={send} disabled={!draft.trim()}>
                Send to {PRESENTER}
              </button>
            </>
          ) : (
            <div
              style={{
                border: '1px solid var(--accent-care)',
                borderRadius: 8,
                padding: 12,
                marginTop: 20,
                background: 'rgba(79,184,165,0.08)',
              }}
            >
              <p style={{ fontSize: 13 }}>
                Your questions are saved. To discuss them with {PRESENTER}, join {CLINIC} as a
                patient.
              </p>
              {confirming ? (
                <>
                  <p style={{ fontSize: 12, color: 'var(--ink-muted)', margin: '8px 0' }}>
                    This connects your seminar questions to an ongoing care relationship with{' '}
                    {PRESENTER}.
                  </p>
                  <button onClick={doConvert} style={{ borderColor: 'var(--accent-care)' }}>
                    Confirm
                  </button>{' '}
                  <button onClick={() => setConfirming(false)}>Cancel</button>
                </>
              ) : (
                <button onClick={() => setConfirming(true)} style={{ marginTop: 8, borderColor: 'var(--accent-care)' }}>
                  Join the clinic
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default PortalTab;
