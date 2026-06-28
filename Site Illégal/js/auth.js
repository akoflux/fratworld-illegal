import { auth, db } from "./firebase-init.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc, getDocs, collection, query, where, documentId } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let _currentUser     = null;
let _currentUserData = null;

export async function login(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function logout() {
  await signOut(auth);
  _currentUser     = null;
  _currentUserData = null;
  window.location.href = "/login.html";
}

// Charge le document Firestore d'un utilisateur.
async function fetchUserData(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

// À appeler sur chaque page protégée.
// callback(user, userData) est appelé une fois l'auth confirmée.
// Si non authentifié ou sans document Firestore → redirection login.
export function requireAuth(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "/login.html";
      return;
    }
    const userData = await fetchUserData(user.uid);
    if (!userData) {
      await signOut(auth);
      window.location.href = "/login.html";
      return;
    }
    _currentUser     = user;
    _currentUserData = userData;
    callback(user, userData);
  });
}

export function getCurrentUser()     { return _currentUser; }
export function getCurrentUserData() { return _currentUserData; }
export function isAdmin()            { return _currentUserData?.role === "admin"; }
export function isSpectateur()       { return _currentUserData?.role === "spectateur"; }
export function isReferentOrAdmin()  { return _currentUserData?.role === "referent" || _currentUserData?.role === "admin"; }

// Peut créer/modifier/supprimer : référent ou admin (jamais spectateur).
export function canCreate()          { return isReferentOrAdmin(); }

// Peut modifier/supprimer une entrée spécifique : admin OU auteur — jamais spectateur.
export function canEdit(entry) {
  if (!_currentUser || isSpectateur()) return false;
  return isAdmin() || _currentUser.uid === entry.authorUid;
}

// Retourne un Map<uid, displayName> pour une liste d'UIDs
export async function getUserNames(uids) {
  const names = new Map();
  if (!uids?.length) return names;
  const unique = [...new Set(uids)].filter(Boolean);
  const chunks = [];
  for (let i = 0; i < unique.length; i += 10) chunks.push(unique.slice(i, i + 10));
  try {
    for (const chunk of chunks) {
      const q    = query(collection(db, "users"), where(documentId(), "in", chunk));
      const snap = await getDocs(q);
      snap.docs.forEach(d => names.set(d.id, d.data().displayName || d.data().email || d.id));
    }
  } catch { /* silent */ }
  return names;
}
