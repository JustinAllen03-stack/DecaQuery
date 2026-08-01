import { useState } from 'react';
import { medplum, ensureLogin } from './medplum';
import { runAggregation } from './aggregate';

const GROUP_ID = import.meta.env.VITE_GROUP_ID;

function ClinicianView() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [raw, setRaw] = useState([]);
  const [error, setError] = useState(null);

  async function aggregate() {
    setLoading(true);
    setError(null);
    try {
      await ensureLogin();
      const res = await runAggregation(medplum, GROUP_ID);
      setResult(res);
    } catch (err) {
      console.error(err);
      setError(err.message);
    }
    setLoading(false);
  }

  async function loadRaw() {
    if (!showRaw && raw.length === 0) {
      try {
        await ensureLogin();
        const all = await medplum.searchResources('Communication', { _count: '1000' });
        setRaw(all.filter((c) => c.about?.some((ref) => ref.reference === `Group/${GROUP_ID}`)));
      } catch (err) {
        console.error(err);
        setError(err.message);
      }
    }
    setShowRaw(!showRaw);
  }

  return (
    <div>
      <h2 style={{ fontSize: 15, marginBottom: 10 }}>Themes</h2>
      <button onClick={aggregate} disabled={loading}>
        {loading ? 'Aggregating…' : 'Aggregate Questions'}
      </button>
      {loading && (
        <p style={{ color: 'var(--ink-muted)', fontSize: 12, marginTop: 8 }}>
          Clustering questions — this takes a few seconds.
        </p>
      )}
      {error && (
        <p style={{ color: 'var(--flag)', fontSize: 13, marginTop: 8 }}>Error: {error}</p>
      )}

      {result && (
        <>
          {[...result.clusters]
            .sort((a, b) => b.patientCount - a.patientCount)
            .map((c, i) => {
              // FAQ-matched questions stay in the cluster and its count — the
              // deflection is a faster path for patients, not a smaller theme.
              const covered = (result.faqMatches || []).filter((m) =>
                c.memberIndices.includes(m.questionIndex)
              ).length;
              return (
                <div
                  key={i}
                  className="q-card resolved"
                  style={{
                    background: 'var(--surface-card)',
                    border: '1px solid var(--hairline)',
                    borderRadius: 8,
                    padding: 12,
                    margin: '10px 0',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    {c.label}{' '}
                    <span style={{ color: 'var(--ink-muted)', fontWeight: 400 }}>
                      — {c.patientCount} patients
                    </span>
                  </div>
                  <p style={{ fontStyle: 'italic', fontSize: 13, marginTop: 6 }}>
                    "{c.synthesizedQuestion}"
                  </p>
                  {covered > 0 && (
                    <p style={{ fontSize: 12, color: 'var(--accent-care)', marginTop: 6 }}>
                      {covered} of these already covered by your FAQ
                    </p>
                  )}
                </div>
              );
            })}

          <h3 style={{ color: 'var(--flag)', fontSize: 13, marginTop: 18 }}>Flagged</h3>
          {result.flaggedQuestions.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--ink-muted)' }}>None in this batch.</p>
          ) : (
            result.flaggedQuestions.map((q, i) => (
              <p key={i} style={{ color: 'var(--flag)', fontSize: 13, marginTop: 6 }}>
                ⚠ {q}
              </p>
            ))
          )}
        </>
      )}

      <button
        onClick={loadRaw}
        style={{ marginTop: 20, fontSize: 12, padding: '4px 8px' }}
      >
        {showRaw ? 'Hide' : 'Show'} raw questions (debug)
      </button>
      {showRaw && (
        <ol style={{ lineHeight: 1.6, fontSize: 12, color: 'var(--ink-muted)', paddingLeft: 18 }}>
          {raw.map((c) => (
            <li key={c.id}>
              {c.payload?.[0]?.contentString ?? <em>(no text)</em>}
              <span style={{ opacity: 0.7 }}> — {c.subject?.reference ?? 'no subject'}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default ClinicianView;
