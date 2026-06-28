import { db } from "./firebase-init.js";
import { getCurrentUser, getCurrentUserData } from "./auth.js";
import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDoc,
  onSnapshot, query, orderBy, serverTimestamp, getDocs, arrayUnion
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function authorInfo() {
  const user     = getCurrentUser();
  const userData = getCurrentUserData();
  return { uid: user.uid, name: userData.displayName || user.email };
}

export async function createFaction(data) {
  const { uid, name } = authorInfo();
  return addDoc(collection(db, "factions"), {
    nom:            data.nom.trim(),
    type:           data.type,
    statut:         data.statut || "Actif",
    lead:           data.lead.trim(),
    coLead:         data.coLead.trim(),
    business:       data.business.trim(),
    notes:          data.notes?.trim() || "",
    dernierContact: data.dernierContact || null,
    actif:          true,
    leadHistory:    [],
    authorUid:      uid,
    authorName:     name,
    createdAt:      serverTimestamp(),
    updatedAt:      serverTimestamp(),
    updatedBy:      name
  });
}

export async function updateFaction(id, data) {
  const { name } = authorInfo();

  // Récupère l'ancienne version pour détecter les changements de lead
  const oldSnap = await getDoc(doc(db, "factions", id));
  const old     = oldSnap.exists() ? oldSnap.data() : {};

  const update = {
    nom:            data.nom.trim(),
    type:           data.type,
    statut:         data.statut || "Actif",
    lead:           data.lead.trim(),
    coLead:         data.coLead.trim(),
    business:       data.business.trim(),
    notes:          data.notes?.trim() || "",
    dernierContact: data.dernierContact || null,
    updatedAt:      serverTimestamp(),
    updatedBy:      name
  };

  const leadChanged   = data.lead.trim()   !== (old.lead   || "");
  const coLeadChanged = data.coLead.trim() !== (old.coLead || "");

  if (leadChanged || coLeadChanged) {
    const historyEntry = {
      date:    new Date().toISOString(),
      by:      name,
      changes: []
    };
    if (leadChanged)   historyEntry.changes.push({ champ: "Lead",    avant: old.lead   || "—", apres: data.lead.trim()   });
    if (coLeadChanged) historyEntry.changes.push({ champ: "Co-Lead", avant: old.coLead || "—", apres: data.coLead.trim() });
    update.leadHistory = arrayUnion(historyEntry);
  }

  await updateDoc(doc(db, "factions", id), update);
}

export async function deleteFaction(id) {
  await deleteDoc(doc(db, "factions", id));
}

// onSnapshot avec gestion d'erreur
export function subscribeFactions(callback) {
  const q = query(collection(db, "factions"), orderBy("nom", "asc"));
  return onSnapshot(
    q,
    snap => { callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))); },
    err  => { console.error("subscribeFactions:", err.message); callback([]); }
  );
}

// getDocs (one-shot) avec fallback silencieux
export async function getFactionNames() {
  try {
    const q    = query(collection(db, "factions"), orderBy("nom", "asc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data().nom);
  } catch (err) {
    console.warn("getFactionNames fallback:", err.message);
    return [];
  }
}

// Retourne [{id, nom, type}] pour les selects relation/agenda
export async function getFactionList() {
  try {
    const q    = query(collection(db, "factions"), orderBy("nom", "asc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, nom: d.data().nom, type: d.data().type }));
  } catch (err) {
    console.warn("getFactionList fallback:", err.message);
    return [];
  }
}
