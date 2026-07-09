import { db } from "./firebase-init.js";
import { getCurrentUser, getCurrentUserData } from "./auth.js";
import {
  collection, addDoc, getDocs, onSnapshot, query, orderBy, where, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function logActivity(action, details = {}) {
  try {
    const user     = getCurrentUser();
    const userData = getCurrentUserData();
    await addDoc(collection(db, "activityLog"), {
      action, details,
      uid: user?.uid || null,
      by:  userData?.displayName || "Inconnu",
      at:  serverTimestamp()
    });
  } catch (_) {}
}

export async function getRecentActivity(n = 50) {
  const q    = query(collection(db, "activityLog"), orderBy("at", "desc"), limit(n));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Abonnement temps réel — retourne la fonction de désabonnement
export function subscribeActivity(n = 100, callback) {
  const q = query(collection(db, "activityLog"), orderBy("at", "desc"), limit(n));
  return onSnapshot(q,
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() })), null),
    err  => callback(null, err)
  );
}

// Activité d'un utilisateur spécifique (pour l'admin + profil)
// Pas d'orderBy pour éviter l'index composite — tri côté client
export async function getUserActivity(uid, n = 30) {
  const q    = query(collection(db, "activityLog"), where("uid", "==", uid), limit(n));
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.at?.seconds ?? 0) - (a.at?.seconds ?? 0));
}

export const ACTION_META = {
  entry_create:     { icon: "✏️", text: d => `Nouvelle entrée : "${d.title || ""}"` },
  entry_status:     { icon: "🔄", text: d => `Statut → ${d.newStatus}${d.title ? ` · "${d.title}"` : ""}` },
  entry_vote:       { icon: "🗳",  text: d => `Vote ${d.direction === "for" ? "Pour" : d.direction === "against" ? "Contre" : "Abstention"}${d.title ? ` · "${d.title}"` : ""}` },
  dossier_create:   { icon: "📂", text: d => `Dossier créé : "${d.nom || ""}"` },
  dossier_status:   { icon: "📋", text: d => `Dossier "${d.nom || ""}" → ${d.newStatut}` },
  user_create:      { icon: "👤", text: d => `Compte créé : ${d.displayName} (${d.role})` },
  user_delete:      { icon: "🗑️", text: d => `Compte supprimé : ${d.name}` },
  role_change:      { icon: "🎭", text: d => `Rôle → ${d.role}` },
  poste_change:     { icon: "💼", text: d => `Poste → ${d.poste || "Aucun"}` },
  config_save:      { icon: "⚙️", text: d => `Config : ${d.referentCount} référents` },
  announce_publish: { icon: "📢", text: _ => `Annonce publiée` },
  announce_delete:  { icon: "🗑️", text: _ => `Annonce supprimée` },
  user_login:       { icon: "🔑", text: _ => `Connexion` }
};
