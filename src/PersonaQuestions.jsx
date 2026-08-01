import { useEffect, useState } from 'react';
import { PERSONAS, isEstablished, loadPersonaQuestions } from './personas';
import { PRESENTER } from './MeetingShell';

/**
 * Read-only seminar history for a seeded persona. The live voice flow writes to
 * the "yourself" identity, never to a persona — this is a viewing lens.
 *
 * Answers rendered here are `payload` text from seeded Communication resources,
 * verbatim. No LLM-generated text is ever shown as an answer.
 */
function PersonaQuestions({ personaKey, onOpenPortal }) {
  const persona = PERSONAS[personaKey];
  const [questions, setQuestions] = useState([]);
  const [established, setEstablished] = useState(false);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    Promise.all([loadPersonaQuestions(persona.id), isEstablished(persona.id)])
      .then(([qs, est]) => {
        if (cancelled) return;
        setQuestions(qs);
        setEstablished(est);
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
  }, [persona.id]);

  if (status === 'loading') {
    return <p style={{ color: 'var(--ink-muted)', fontSize: 13 }}>Loading {persona.name}'s questions…</p>;
  }
  if (status === 'error') {
    return <p style={{ color: 'var(--flag)', fontSize: 13 }}>Couldn't load: {error}</p>;
  }

  return (
    <div>
      <h3 style={{ fontSize: 13, marginBottom: 8 }}>
        {persona.name}'s questions from this seminar
      </h3>

      {questions.length === 0 && (
        <p style={{ color: 'var(--ink-muted)', fontSize: 13 }}>No questions on file.</p>
      )}

      {questions.map((q) => (
        <div
          key={q.id}
          className="q-card resolved"
          style={{
            background: 'var(--surface-card)',
            border: '1px solid var(--hairline)',
            borderRadius: 8,
            padding: 10,
            marginBottom: 8,
          }}
        >
          <p style={{ fontSize: 13 }}>"{q.text}"</p>

          {/* Established: the question is material for their next session. */}
          {established && (
            <p style={{ fontSize: 12, color: 'var(--accent-care)', marginTop: 6 }}>
              Saved to your file with {PRESENTER} — flagged to discuss at your next session.
            </p>
          )}

          {/* Recorded answers — verbatim from the Communication payload. */}
          {q.answers.map((answer, i) => (
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
              <p style={{ fontSize: 13, marginTop: 4, lineHeight: 1.5 }}>{answer}</p>
            </div>
          ))}
        </div>
      ))}

      {!established && questions.length > 0 && (
        <p style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 12 }}>
          You're viewing this as a webinar guest.{' '}
          <button
            onClick={onOpenPortal}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: 'var(--accent-care)',
              textDecoration: 'underline',
              fontSize: 12,
            }}
          >
            Join the clinic
          </button>{' '}
          to discuss these with Dana directly.
        </p>
      )}
    </div>
  );
}

export default PersonaQuestions;
