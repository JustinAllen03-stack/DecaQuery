import { medplum, ensureLogin } from './medplum';

export const PRACTITIONER_ID = import.meta.env.VITE_PRACTITIONER_ID;
export const GROUP_ID = import.meta.env.VITE_GROUP_ID;

// Shared with the Portal tab's account picker so the panel switcher and the
// portal can never disagree about who "you" are.
export const ACCOUNT_KEY = 'decaquery_portalAccount';

export const PERSONAS = {
  maria: { key: 'maria', id: import.meta.env.VITE_PATIENT_MARIA_ID, name: 'Maria Alvarez' },
  sam: { key: 'sam', id: import.meta.env.VITE_PATIENT_SAM_ID, name: 'Sam Chen' },
};

export function loadAccount() {
  return sessionStorage.getItem(ACCOUNT_KEY) || 'self';
}

export function saveAccount(account) {
  sessionStorage.setItem(ACCOUNT_KEY, account);
}

/**
 * Established vs guest is read from the Patient resource at runtime, never
 * hardcoded — that's what lets Sam's conversion flip his experience live.
 */
export async function isEstablished(patientId) {
  await ensureLogin();
  const patient = await medplum.readResource('Patient', patientId);
  return Boolean(patient.generalPractitioner?.length);
}

export async function convertToPatient(patientId) {
  await ensureLogin();
  const patient = await medplum.readResource('Patient', patientId);
  return medplum.updateResource({
    ...patient,
    generalPractitioner: [{ reference: `Practitioner/${PRACTITIONER_ID}` }],
  });
}

/** Seminar questions for one patient, with any recorded answers attached. */
export async function loadPersonaQuestions(patientId) {
  await ensureLogin();
  const all = await medplum.searchResources('Communication', { _count: '1000' });

  const questions = all.filter(
    (c) =>
      c.subject?.reference === `Patient/${patientId}` &&
      c.about?.some((r) => r.reference === `Group/${GROUP_ID}`)
  );

  return questions.map((q) => ({
    id: q.id,
    text: q.payload?.[0]?.contentString ?? '',
    answers: all
      .filter((c) => c.inResponseTo?.some((r) => r.reference === `Communication/${q.id}`))
      .map((a) => a.payload?.[0]?.contentString ?? '')
      .filter(Boolean),
  }));
}

/** The care thread: messages for this patient that are NOT seminar questions. */
export async function loadThread(patientId) {
  await ensureLogin();
  const all = await medplum.searchResources('Communication', { _count: '1000' });
  return all
    .filter(
      (c) =>
        c.subject?.reference === `Patient/${patientId}` &&
        !c.about?.some((r) => r.reference === `Group/${GROUP_ID}`) &&
        !c.inResponseTo?.length
    )
    .map((c) => ({
      id: c.id,
      text: c.payload?.[0]?.contentString ?? '',
      fromPractitioner: c.sender?.reference === `Practitioner/${PRACTITIONER_ID}`,
    }))
    .reverse();
}

export async function sendFollowUp(patientId, text) {
  await ensureLogin();
  return medplum.createResource({
    resourceType: 'Communication',
    status: 'completed',
    subject: { reference: `Patient/${patientId}` },
    sender: { reference: `Patient/${patientId}` },
    recipient: [{ reference: `Practitioner/${PRACTITIONER_ID}` }],
    // No `about` Group — keeps follow-ups out of the Q&A clustering.
    payload: [{ contentString: text }],
  });
}
