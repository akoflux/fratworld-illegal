import { db } from "./firebase-init.js";
import { getCurrentUser, getCurrentUserData } from "./auth.js";
import { loadSettings, getVotesNeeded } from "./settings.js";
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, query, orderBy, onSnapshot, serverTimestamp, arrayUnion
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function authorInfo() {
  const user     = getCurrentUser();
  const userData = getCurrentUserData();
  return { uid: user.uid, name: userData.displayName || user.email };
}

export async function createDossier(data) {
  const { uid, name } = authorInfo();
  return addDoc(collection(db, "dossiers"), {
    nomGroupe:   data.nomGroupe.trim(),
    typeGroupe:  data.typeGroupe,
    lienDossier: data.lienDossier.trim(),
    description: data.description.trim(),
    votes:       [],
    statut:      "En cours",
    archived:    false,
    authorUid:   uid,
    authorName:  name,
    createdAt:   serverTimestamp(),
    updatedAt:   serverTimestamp()
  });
}

export async function voteDossier(id, currentVotes) {
  const { uid } = authorInfo();
  if (currentVotes.includes(uid)) return; // déjà voté

  const settings    = await loadSettings();
  const votesNeeded = getVotesNeeded(settings);
  const newVotes    = [...currentVotes, uid];
  const updates     = {
    votes:    arrayUnion(uid),
    updatedAt: serverTimestamp()
  };

  if (newVotes.length >= votesNeeded) {
    updates.statut = "En attente d'entretien";
  }

  await updateDoc(doc(db, "dossiers", id), updates);
}

export async function archiveDossier(id, decision) {
  const { uid, name } = authorInfo();
  await updateDoc(doc(db, "dossiers", id), {
    statut:     decision, // "Validé" | "Refusé"
    archived:   true,
    archivedAt: serverTimestamp(),
    archivedBy: name,
    updatedAt:  serverTimestamp()
  });
}

export async function deleteDossier(id) {
  await deleteDoc(doc(db, "dossiers", id));
}

// Temps réel
export function subscribeDossiers(callback) {
  const q = query(collection(db, "dossiers"), orderBy("createdAt", "desc"));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

