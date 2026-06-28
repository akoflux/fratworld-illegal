import { db } from "./firebase-init.js";
import { getCurrentUser, getCurrentUserData } from "./auth.js";
import { loadSettings, getVotesNeeded } from "./settings.js";
import { sendDossierNotification } from "./discord.js";
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
  const settings    = await loadSettings();
  const votesNeeded = getVotesNeeded(settings);

  const payload = {
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
  };

  const ref = await addDoc(collection(db, "dossiers"), payload);
  await sendDossierNotification("dossier_create", { id: ref.id, ...payload, authorName: name }, votesNeeded);
  return ref;
}

export async function voteDossier(id, dossier, currentVotes) {
  const { uid } = authorInfo();
  if (currentVotes.includes(uid)) return; // déjà voté

  const settings    = await loadSettings();
  const votesNeeded = getVotesNeeded(settings);
  const newVotes    = [...currentVotes, uid];
  const thresholdReached = newVotes.length >= votesNeeded;

  const updates = {
    votes:     arrayUnion(uid),
    updatedAt: serverTimestamp()
  };
  if (thresholdReached) updates.statut = "En attente d'entretien";

  await updateDoc(doc(db, "dossiers", id), updates);

  if (thresholdReached) {
    await sendDossierNotification(
      "dossier_threshold",
      { id, ...dossier, votes: newVotes, statut: "En attente d'entretien" },
      votesNeeded
    );
  }
}

export async function archiveDossier(id, dossier, decision) {
  const { name } = authorInfo();
  const settings    = await loadSettings();
  const votesNeeded = getVotesNeeded(settings);

  await updateDoc(doc(db, "dossiers", id), {
    statut:     decision, // "Validé" | "Refusé"
    archived:   true,
    archivedAt: serverTimestamp(),
    archivedBy: name,
    updatedAt:  serverTimestamp()
  });

  await sendDossierNotification(
    "dossier_archive",
    { id, ...dossier, statut: decision },
    votesNeeded
  );
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

