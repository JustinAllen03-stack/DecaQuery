const ANTHROPIC_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

/**
 * Cluster the group's questions into themes via the Anthropic API.
 *
 * @param medplum        an already-authenticated MedplumClient
 * @param groupId        the demo cohort Group id
 * @param liveTranscript if set, appended as the caller's own question so we can
 *                       report which cluster it landed in
 * @param excludeId      Communication id to drop from the fetched set — pass the
 *                       resource you just created, otherwise the live transcript
 *                       is counted twice (once fetched, once appended)
 */
export async function runAggregation(medplum, groupId, liveTranscript = null, excludeId = null) {
  if (!ANTHROPIC_KEY) {
    throw new Error('Missing VITE_ANTHROPIC_API_KEY in .env');
  }

  // NOTE: `about` is not a valid FHIR search parameter on Communication — the
  // Medplum server rejects `Communication?about=Group/x` with "Unknown search
  // parameter". Fetch and filter on the reference here instead.
  const all = await medplum.searchResources('Communication', { _count: '100' });
  const dummyQuestions = all
    .filter((c) => c.about?.some((ref) => ref.reference === `Group/${groupId}`))
    .filter((c) => c.id !== excludeId)
    .map((c) => c.payload?.[0]?.contentString)
    .filter(Boolean);

  const allQuestions = liveTranscript ? [...dummyQuestions, liveTranscript] : dummyQuestions;
  const myIndex = liveTranscript ? allQuestions.length - 1 : null;

  const prompt = `Here are ${allQuestions.length} patient questions from a prediabetes lifestyle seminar, numbered starting at 0:
${allQuestions.map((q, i) => `${i}: ${q}`).join('\n')}

Group these into thematic clusters. For each cluster, write ONE synthesized question
that represents the shared underlying concern of everyone in that cluster — don't
just copy one patient's exact wording, write a single clear question covering the
theme.

Return ONLY valid JSON, no markdown fences, no other text, in this exact shape:
{"clusters":[{"label":"...","synthesizedQuestion":"...","memberIndices":[0,4,7]}],"flaggedIndices":[15,42]}

flaggedIndices = indices of any question mentioning medications, symptoms,
pregnancy, or self-harm/disordered eating, regardless of which theme it's otherwise
close to. A flagged question should NOT also appear in any cluster's memberIndices.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text = data.content[0].text.replace(/```json|```/g, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    // A 200 with unparseable content is a different bug from a failed call —
    // say which one it was instead of surfacing a bare SyntaxError.
    throw new Error(`Anthropic returned non-JSON content: ${text.slice(0, 200)}`);
  }

  const clusters = parsed.clusters.map((c) => ({ ...c, patientCount: c.memberIndices.length }));
  const flaggedQuestions = (parsed.flaggedIndices || []).map((i) => allQuestions[i]);

  let myCluster = null;
  if (myIndex !== null) {
    const amFlagged = (parsed.flaggedIndices || []).includes(myIndex);
    myCluster = amFlagged ? 'flagged' : clusters.find((c) => c.memberIndices.includes(myIndex)) || null;
  }

  return { clusters, flaggedQuestions, myCluster };
}
