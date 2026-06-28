import { db } from "./firebase-init.js";
import {
  doc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const DEFAULTS = { referentCount: 5 };

let _cache = null;

// Seuil de majorité absolue : ⌈n/2⌉
export function getVotesNeeded(settings) {
  const n = settings?.referentCount ?? DEFAULTS.referentCount;
  return Math.ceil(n / 2);
}

export async function loadSettings() {
  if (_cache) return _cache;
  try {
    const snap = await getDoc(doc(db, "settings", "global"));
    _cache = snap.exists() ? { ...DEFAULTS, ...snap.data() } : { ...DEFAULTS };
  } catch {
    _cache = { ...DEFAULTS };
  }
  return _cache;
}

export async function saveSettings(data) {
  await setDoc(doc(db, "settings", "global"), data, { merge: true });
  _cache = { ..._cache, ...data };
  return _cache;
}

export function invalidateSettingsCache() {
  _cache = null;
}
