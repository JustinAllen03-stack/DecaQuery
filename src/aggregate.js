import { FAQ_ENTRIES } from './faq';

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
  const all = await medplum.searchResources('Communication', { _count: '1000' });
  const dummyQuestions = all
    .filter((c) => c.about?.some((ref) => ref.reference === `Group/${groupId}`))
    .filter((c) => c.id !== excludeId)
    .map((c) => c.payload?.[0]?.contentString)
    .filter(Boolean);

  const allQuestions = liveTranscript ? [...dummyQuestions, liveTranscript] : dummyQuestions;
  const myIndex = liveTranscript ? allQuestions.length - 1 : null;

  const prompt = `Here are ${allQuestions.length} patient questions from a prediabetes lifestyle seminar, numbered starting at 0:
${allQuestions.map((q, i) => `${i}: ${q}`).join('\n')}

The hosting dietitian's website has an FAQ page with these already-answered
questions:
${FAQ_ENTRIES.map((f) => `- ${f.id}: ${f.question}`).join('\n')}

For each patient question that is clearly and substantially answered by one of
these FAQ entries, record the match. Only match when the FAQ entry genuinely
answers what was asked — a shared topic is not enough. A question that is answered
by an FAQ entry should STILL appear in its cluster's memberIndices as normal
(the clinician may still want to address the theme live); the FAQ match is
additional, not a replacement. Never match flagged questions to FAQ entries —
anything involving medications, symptoms, pregnancy, or disordered eating needs
individual attention, not a self-serve link.

Group these into thematic clusters. For each cluster, write ONE synthesized question
that blends the general shared theme with 1-2 of the most specific, notable details
that actually came up in that cluster's questions — a specific exercise type, food,
timing, condition, etc. Don't flatten it into a fully generic question, and don't
just copy one patient's exact wording either. Aim for general-plus-niche in a single
smooth, natural-sounding question, roughly one sentence long.

Example of the right level of specificity: if a cluster contains questions about
exercise and blood sugar, several of which specifically mention HIIT, write
something like "What are the effects of exercise on my blood glucose if I have high
fasting glucose, like HIIT?" — not the fully generic "What's the best exercise for
blood sugar?" and not narrowed down to only one patient's exact situation either.

Produce between 5 and 8 clusters — never more than 8. Merge closely related
topics rather than splitting hairs: the output is a short list a clinician works
through live, so a handful of broad, well-named themes beats many narrow ones.

Every question index must appear exactly once in the output — in exactly one
cluster's memberIndices, or in flaggedIndices. Do not leave any index unplaced.

Return ONLY valid JSON, no markdown fences, no other text, in this exact shape:
{"clusters":[{"label":"...","synthesizedQuestion":"...","memberIndices":[0,4,7]}],"flaggedIndices":[15,42],"faqMatches":[{"questionIndex":12,"faqId":"sugar-cravings"}]}

flaggedIndices = indices of questions that name a medication, describe a physical
symptom the person is experiencing, mention pregnancy, or suggest self-harm or
disordered eating — regardless of which theme they are otherwise close to. A
flagged question should NOT also appear in any cluster's memberIndices.

flaggedIndices is NOT a catch-all. Do not flag a question merely because it is
vague, unusual, or hard to place. If a question does not clearly meet one of the
four conditions above, put it in the closest cluster even if the fit is loose.`;

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
      max_tokens: 8192,
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
  const flaggedIndices = parsed.flaggedIndices || [];

  // Resolve matches against real entries. A plausible-but-invented faqId is a
  // realistic model failure — drop those rather than render a dead link.
  // Flagged questions never get a link, belt-and-braces with the prompt rule.
  const faqMatches = (parsed.faqMatches || [])
    .map((m) => {
      const entry = FAQ_ENTRIES.find((f) => f.id === m.faqId);
      if (!entry) return null;
      if (flaggedIndices.includes(m.questionIndex)) return null;
      return { questionIndex: m.questionIndex, entry };
    })
    .filter(Boolean);

  let myCluster = null;
  if (myIndex !== null) {
    const amFlagged = flaggedIndices.includes(myIndex);
    myCluster = amFlagged ? 'flagged' : clusters.find((c) => c.memberIndices.includes(myIndex)) || null;
  }

  const myFaqMatch =
    myIndex !== null ? faqMatches.find((m) => m.questionIndex === myIndex)?.entry || null : null;

  return { clusters, flaggedQuestions, faqMatches, myCluster, myFaqMatch };
}
