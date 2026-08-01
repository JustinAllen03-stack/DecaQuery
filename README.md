# DecaQuery — group-visit question aggregator

Hackathon demo (sponsor: Medplum). Patients submit questions before a group
session; instead of a dietitian answering 1–3 questions that help 1–3 people,
the questions are clustered by theme so a handful of answers cover everyone.

Two tabs:

- **Patient** — speak a question (Deepgram real-time transcription), submit it as
  a FHIR `Communication`, and see which theme it got grouped into.
- **Clinician** — cluster every question in the cohort into themes, each with a
  synthesized composite question and a patient count, plus a Flagged list for
  anything touching medications, symptoms, pregnancy, or disordered eating.

## Setup

```bash
npm install
cp .env.example .env   # then fill in the five values
npm run dev
```

Requires Node ≥ 20.6.

| Variable | Where it comes from |
|---|---|
| `VITE_MEDPLUM_CLIENT_ID` / `VITE_MEDPLUM_CLIENT_SECRET` | Medplum project admin panel |
| `VITE_GROUP_ID` | The `Group` resource holding the demo cohort |
| `VITE_DEEPGRAM_API_KEY` | Deepgram console |
| `VITE_ANTHROPIC_API_KEY` | Anthropic console |

## Notes

**Don't deploy this as-is.** Every `VITE_`-prefixed variable is inlined into the
production bundle and served to the browser, including the Medplum client secret.
That's an accepted tradeoff for a local hackathon demo; a real deployment needs a
server-side proxy holding the credentials, and Medplum user login (PKCE) instead
of a client secret.

**`about` is not a searchable FHIR parameter on `Communication`.** The server
rejects `Communication?about=Group/x` with `Unknown search parameter`, so the
Group filter is applied client-side after fetching. Fine at demo scale; a real
implementation would link questions to the cohort via `category` or a `meta.tag`
that the server actually indexes.

## Stack

React 19 + Vite, `@medplum/core` for FHIR, Deepgram's streaming WebSocket API for
speech-to-text (no SDK — native `WebSocket` + `MediaRecorder`), Anthropic API for
clustering.
