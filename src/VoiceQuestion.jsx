import { useEffect, useState } from 'react';
import { medplum, ensureLogin } from './medplum';
import { runAggregation } from './aggregate';

const GROUP_ID = import.meta.env.VITE_GROUP_ID;

// A card sweeps only if it resolved just now — not every time the panel
// remounts on a tab switch. Data-driven so it survives StrictMode's double
// render without replaying or being suppressed.
const SWEEP_WINDOW_MS = 1200;

function VoiceQuestion({ recorder, onOpenFaq }) {
  const { recStatus, transcript, setTranscript, startRecording, stopRecording, reset } = recorder;

  const [name, setName] = useState('');

  const [patientId, setPatientId] = useState(() => {
    return sessionStorage.getItem('decaquery_patientId') || null;
  });

  // [{ id, text, status, myCluster, faqMatch, rank, totalThemes, resolvedAt }]
  const [myQuestions, setMyQuestions] = useState(() => {
    try {
      const saved = sessionStorage.getItem('decaquery_myQuestions');
      const parsed = saved ? JSON.parse(saved) : [];
      // An entry saved mid-flight comes back as 'aggregating' with no in-flight
      // call to finish it — that would pin isBusy true and lock the UI forever.
      return parsed.map((q) => (q.status === 'aggregating' ? { ...q, status: 'error' } : q));
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (patientId) sessionStorage.setItem('decaquery_patientId', patientId);
  }, [patientId]);

  useEffect(() => {
    sessionStorage.setItem('decaquery_myQuestions', JSON.stringify(myQuestions));
  }, [myQuestions]);

  function resetSession() {
    sessionStorage.removeItem('decaquery_patientId');
    sessionStorage.removeItem('decaquery_myQuestions');
    setPatientId(null);
    setMyQuestions([]);
  }

  // Serialize submissions — one aggregation call at a time.
  const isBusy = myQuestions.some((q) => q.status === 'aggregating');

  function markQuestion(tempId, patch) {
    setMyQuestions((prev) => prev.map((q) => (q.id === tempId ? { ...q, ...patch } : q)));
  }

  async function submitQuestion() {
    if (!transcript.trim()) return;
    const questionText = transcript.trim();
    const tempId = crypto.randomUUID();

    setMyQuestions((prev) => [...prev, { id: tempId, text: questionText, status: 'aggregating' }]);
    reset(); // clear transcript + recorder UI so they can ask again right away

    // Save first. If this throws, the question was never persisted — say so
    // rather than claiming it's saved, and clear 'aggregating' so isBusy
    // doesn't leave the UI permanently locked.
    let communication;
    try {
      await ensureLogin();

      let currentPatientId = patientId;
      if (!currentPatientId) {
        const patient = await medplum.createResource({
          resourceType: 'Patient',
          name: [{ text: name || 'Anonymous voice patient' }],
        });
        currentPatientId = patient.id;
        setPatientId(currentPatientId);
      }

      communication = await medplum.createResource({
        resourceType: 'Communication',
        status: 'completed',
        subject: { reference: `Patient/${currentPatientId}` },
        about: [{ reference: `Group/${GROUP_ID}` }],
        payload: [{ contentString: questionText }],
      });
    } catch (err) {
      console.error(err);
      markQuestion(tempId, { status: 'save-error' });
      return;
    }

    try {
      // excludeId: this question is already in Medplum, so without it the
      // fetched copy and the appended live transcript both count.
      const result = await runAggregation(medplum, GROUP_ID, questionText, communication.id);
      const sorted = [...result.clusters].sort((a, b) => b.patientCount - a.patientCount);
      // Reference equality is deliberate — runAggregation's .find() returns an
      // entry of this same array, so findIndex still locates it after sorting a copy.
      const rank =
        result.myCluster && result.myCluster !== 'flagged'
          ? sorted.findIndex((c) => c === result.myCluster) + 1
          : null;

      markQuestion(tempId, {
        status: 'done',
        myCluster: result.myCluster,
        faqMatch: result.myFaqMatch,
        rank,
        totalThemes: sorted.length,
        resolvedAt: Date.now(),
      });
    } catch (err) {
      console.error(err);
      markQuestion(tempId, { status: 'error' });
    }
  }

  return (
    <div>
      <h2 style={{ fontSize: 15, marginBottom: 10 }}>Ask a question</h2>

      {patientId ? (
        <p style={{ marginBottom: 10, fontSize: 13, color: 'var(--ink-muted)' }}>
          Asking as <strong style={{ color: 'var(--ink)' }}>{name || 'Anonymous voice patient'}</strong>
        </p>
      ) : (
        <input
          placeholder="Your name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ width: '100%', marginBottom: 10 }}
        />
      )}

      {recStatus !== 'recording' ? (
        <button onClick={startRecording} disabled={isBusy}>
          🎤 Start speaking
        </button>
      ) : (
        <button onClick={stopRecording} style={{ borderColor: 'var(--accent-care)' }}>
          ⏹ Stop
        </button>
      )}

      {isBusy && (
        <p style={{ color: 'var(--ink-muted)', fontSize: 12, marginTop: 8 }}>
          Finishing your last question first…
        </p>
      )}

      {recStatus === 'error' && (
        <p style={{ color: 'var(--flag)', fontSize: 13, marginTop: 8 }}>
          Mic or connection issue — type your question instead:
        </p>
      )}

      {(recStatus === 'error' || recStatus === 'done') && (
        <>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Your question will appear here — edit if needed"
            style={{ width: '100%', minHeight: 70, marginTop: 10 }}
          />
          <button onClick={submitQuestion} disabled={!transcript.trim()}>
            Submit question
          </button>
        </>
      )}

      {recStatus === 'recording' && (
        <p style={{ marginTop: 10, color: 'var(--ink-muted)', fontStyle: 'italic' }}>
          {transcript || 'Listening…'}
        </p>
      )}

      <div style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: 13, marginBottom: 8 }}>Your questions this session</h3>
        {myQuestions.length === 0 && (
          <p style={{ color: 'var(--ink-muted)', fontSize: 13 }}>Nothing submitted yet.</p>
        )}
        {(myQuestions.length > 0 || patientId) && (
          <button onClick={resetSession} style={{ fontSize: 12, marginBottom: 10, padding: '4px 8px' }}>
            Reset session (rehearsal)
          </button>
        )}

        {myQuestions.map((q) => {
          const resolved = q.status === 'done';
          const justResolved = resolved && Date.now() - (q.resolvedAt || 0) < SWEEP_WINDOW_MS;
          return (
            <div
              key={q.id}
              className={`q-card${resolved ? ' resolved' : ''}${justResolved ? ' sweep' : ''}`}
              style={{
                background: 'var(--surface-card)',
                border: '1px solid var(--hairline)',
                borderRadius: 8,
                padding: 10,
                marginBottom: 8,
              }}
            >
              <p style={{ fontSize: 13 }}>"{q.text}"</p>

              {q.status === 'aggregating' && (
                <p style={{ color: 'var(--ink-muted)', fontSize: 12, marginTop: 6 }}>
                  Finding your theme…
                </p>
              )}

              {q.status === 'save-error' && (
                <p style={{ color: 'var(--flag)', fontSize: 12, marginTop: 6 }}>
                  Couldn't save this one — please try asking it again.
                </p>
              )}

              {q.status === 'error' && (
                <p style={{ color: 'var(--flag)', fontSize: 12, marginTop: 6 }}>
                  Couldn't process this one — it's still saved, just not grouped yet.
                </p>
              )}

              {resolved && q.faqMatch && (
                <div
                  style={{
                    border: '1px solid var(--accent-care)',
                    borderRadius: 6,
                    padding: 8,
                    margin: '8px 0',
                    background: 'rgba(79,184,165,0.08)',
                  }}
                >
                  <p style={{ fontSize: 12 }}>
                    ✓ Your dietitian has already answered this on their website:
                  </p>
                  <button
                    onClick={() => onOpenFaq(q.faqMatch.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '4px 0 0',
                      color: 'var(--accent-care)',
                      textAlign: 'left',
                      fontSize: 13,
                      textDecoration: 'underline',
                    }}
                  >
                    {q.faqMatch.question}
                  </button>
                </div>
              )}

              {resolved && q.myCluster === 'flagged' && (
                <p style={{ color: 'var(--flag)', fontSize: 12, marginTop: 6 }}>
                  Flagged for individual attention — the clinician will address this directly,
                  not as part of the group Q&amp;A order.
                </p>
              )}

              {resolved && q.myCluster && q.myCluster !== 'flagged' && (
                <p style={{ fontSize: 12, marginTop: 6, color: 'var(--ink-muted)' }}>
                  Grouped as:{' '}
                  <em style={{ color: 'var(--ink)' }}>"{q.myCluster.synthesizedQuestion}"</em>
                  <br />
                  Theme {q.rank} of {q.totalThemes} right now, by volume — this can shift as
                  more questions come in before Q&amp;A.
                </p>
              )}

              {resolved && !q.myCluster && (
                <p style={{ fontSize: 12, marginTop: 6, color: 'var(--ink-muted)' }}>
                  Didn't cluster neatly this round.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default VoiceQuestion;
