import { useEffect } from 'react';
import { FAQ_ENTRIES } from './faq';
import { PRESENTER } from './MeetingShell';

// Renders FAQ_ENTRIES verbatim. No LLM involvement on this page at all.
// `embedded` renders it as a panel tab inside the meeting shell; without it,
// the standalone /?view=faq route still works for direct links.
function FaqPage({ embedded = false, focusId = null }) {
  useEffect(() => {
    // Standalone deep links arrive as /?view=faq#entry-id; embedded ones come
    // in via focusId when a question's FAQ match is clicked.
    const id = focusId || window.location.hash.slice(1);
    if (id) {
      document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }, [focusId]);

  return (
    <div
      style={
        embedded
          ? undefined
          : { padding: 24, maxWidth: 720, margin: '0 auto', fontFamily: 'var(--sans)' }
      }
    >
      <header
        style={{
          borderBottom: `1px solid var(--hairline)`,
          paddingBottom: 10,
          marginBottom: 18,
        }}
      >
        <h1 style={{ fontSize: embedded ? 15 : 24 }}>{PRESENTER}</h1>
        <p style={{ color: 'var(--ink-muted)', fontSize: 13 }}>Frequently Asked Questions</p>
      </header>

      {FAQ_ENTRIES.map((entry) => (
        <div
          key={entry.id}
          id={entry.id}
          style={{
            marginBottom: 20,
            scrollMarginTop: 8,
            padding: focusId === entry.id ? 8 : 0,
            borderRadius: 6,
            background: focusId === entry.id ? 'rgba(79,184,165,0.08)' : 'transparent',
          }}
        >
          <h2 style={{ fontSize: embedded ? 13 : 17, marginBottom: 6 }}>{entry.question}</h2>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--ink-muted)' }}>{entry.answer}</p>
        </div>
      ))}

      {!embedded && (
        <footer style={{ borderTop: '1px solid var(--hairline)', paddingTop: 12, marginTop: 28 }}>
          <a href="/">← Back to the session</a>
        </footer>
      )}
    </div>
  );
}

export default FaqPage;
