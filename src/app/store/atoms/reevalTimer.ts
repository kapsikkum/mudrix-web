import { atom, getDefaultStore } from 'jotai';

export const reevalNowAtom = atom(Date.now());

const REEVAL_INTERVAL_MS = 30_000;

const store = getDefaultStore();

setInterval(() => {
  store.set(reevalNowAtom, Date.now());
}, REEVAL_INTERVAL_MS);
