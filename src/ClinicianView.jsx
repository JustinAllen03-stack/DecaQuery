import { useState } from 'react';
import { MedplumClient } from '@medplum/core';
import { runAggregation } from './aggregate';

const medplum = new MedplumClient({ fetch: fetch.bind(window) });
const CLIENT_ID = import.meta.env.VITE_MEDPLUM_CLIENT_ID;
const CLIENT_SECRET = import.meta.env.VITE_MEDPLUM_CLIENT_SECRET;
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
      await medplum.startClientLogin(CLIENT_ID, CLIENT_SECRET);
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
        await medplum.startClientLogin(CLIENT_ID, CLIENT_SECRET);
        const all = await medplum.searchResources('Communication', { _count: '100' });
        setRaw(
          all.filter((c) => c.about?.some((ref) => ref.reference === `Group/${GROUP_ID}`))
        );
      } catch (err) {
        console.error(err);
        setError(err.message);
      }
    }
    setShowRaw(!showRaw);
  }

  return (
    <div style={{ padding: 20, maxWidth: 700, margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2>Themes</h2>
      <button onClick={aggregate} disabled={loading}>
        {loading ? 'Aggregating…' : 'Aggregate Questions'}
      </button>
      {loading && <p><em>Clustering questions — this takes a few seconds.</em></p>}
      {error && <p style={{ color: '#b00020' }}>Error: {error}</p>}

      {result && (
        <>
          {[...result.clusters]
            .sort((a, b) => b.patientCount - a.patientCount)
            .map((c, i) => (
              <div key={i} style={{ border: '1px solid #444', borderRadius: 8, padding: 12, margin: '10px 0' }}>
                <strong>{c.label}</strong> — {c.patientCount} patients
                <p style={{ fontStyle: 'italic' }}>"{c.synthesizedQuestion}"</p>
              </div>
            ))}
          <h3 style={{ color: '#c66' }}>Flagged</h3>
          {result.flaggedQuestions.length === 0 ? (
            <p>None in this batch.</p>
          ) : (
            result.flaggedQuestions.map((q, i) => <p key={i} style={{ color: '#c66' }}>⚠ {q}</p>)
          )}
        </>
      )}

      <button onClick={loadRaw} style={{ marginTop: 20, fontSize: 12 }}>
        {showRaw ? 'Hide' : 'Show'} raw questions (debug)
      </button>
      {showRaw && (
        <ol style={{ lineHeight: 1.6, fontSize: 13, color: '#666' }}>
          {raw.map((c) => (
            <li key={c.id}>
              {c.payload?.[0]?.contentString ?? <em>(no text)</em>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default ClinicianView;
