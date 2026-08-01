import { MedplumClient } from '@medplum/core';

export const medplum = new MedplumClient({ fetch: fetch.bind(window) });

const CLIENT_ID = import.meta.env.VITE_MEDPLUM_CLIENT_ID;
const CLIENT_SECRET = import.meta.env.VITE_MEDPLUM_CLIENT_SECRET;

let loginPromise = null;

/** One shared login for the whole page instead of one per component. */
export function ensureLogin() {
  if (!loginPromise) {
    loginPromise = medplum.startClientLogin(CLIENT_ID, CLIENT_SECRET).catch((err) => {
      loginPromise = null; // let a later call retry rather than caching the failure
      throw err;
    });
  }
  return loginPromise;
}
