import { db } from "./firebase-init.js";
import { getCurrentUser, getCurrentUserData } from "./auth.js";
import { loadSettings, getVotesNeeded } from "./settings.js";
import { sendDossierNotification } from "./discord.js";
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, query, orderBy, onSnapshot, serverTimestamp,
  arrayUnion, arrayRemove, deleteField, getDoc
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
    nomGroupe:           data.nomGroupe.trim(),
    typeGroupe:          data.typeGroupe,
    lienDossier:         data.lienDossier.trim(),
    description:         data.description?.trim() || "",
    contactName:         data.contactName?.trim()  || "",
    contactDiscord:      data.contactDiscord?.trim() || "",
    votes:               [],       // legacy field — conservé pour compat
    votesFor:            [],
    votesAgainst:        [],
    votesAgainstReasons: {},
    voteDeadline:        data.voteDeadline || null,
    statut:              "En attente d'étude",
    archived:            false,
    authorUid:           uid,
    authorName:          name,
    createdAt:           serverTimestamp(),
    updatedAt:           serverTimestamp()
  };

  const ref = await addDoc(collection(db, "dossiers"), payload);
  await sendDossierNotification("dossier_create", { id: ref.id, ...payload, authorName: name }, votesNeeded);
  return ref;
}

export async function voteDossier(id, dossier, direction, reason = "") {
  const { uid } = authorInfo();

  // Backward compat : anciens docs n'ont que `votes` (= votesFor)
  const votesFor     = dossier.votesFor     || dossier.votes || [];
  const votesAgainst = dossier.votesAgainst || [];

  // Vérification deadline
  if (dossier.voteDeadline) {
    if (new Date(dossier.voteDeadline) < new Date()) {
      throw new Error("Le vote est clôturé (deadline dépassée).");
    }
  }

  const hadVotedFor     = votesFor.includes(uid);
  const hadVotedAgainst = votesAgainst.includes(uid);

  // Déjà dans la même direction → no-op
  if (direction === "for"     && hadVotedFor)     return;
  if (direction === "against" && hadVotedAgainst) return;

  const settings    = await loadSettings();
  const votesNeeded = getVotesNeeded(settings);

  const updates = { updatedAt: serverTimestamp() };

  if (direction === "for") {
    updates.votesFor = arrayUnion(uid);
    if (hadVotedAgainst) {
      updates.votesAgainst = arrayRemove(uid);
      updates[`votesAgainstReasons.${uid}`] = deleteField();
    }
  } else {
    // against
    updates.votesAgainst = arrayUnion(uid);
    if (hadVotedFor) updates.votesFor = arrayRemove(uid);
    if (reason) updates[`votesAgainstReasons.${uid}`] = reason;
  }

  // Calcul du nouveau compte Pour après le vote
  const newForCount = direction === "for"
    ? (hadVotedFor   ? votesFor.length : votesFor.length + 1)
    : (hadVotedFor   ? votesFor.length - 1 : votesFor.length);

  // Seuil atteint seulement si on franchit pour la première fois
  const wasAtThreshold = votesFor.length >= votesNeeded;
  const nowAtThreshold = newForCount    >= votesNeeded;
  const thresholdJustReached = nowAtThreshold && !wasAtThreshold;

  if (thresholdJustReached) updates.statut = "En attente d'entretien";


  await updateDoc(doc(db, "dossiers", id), updates);

  if (thresholdJustReached) {
    await sendDossierNotification(
      "dossier_threshold",
      {
        id, ...dossier,
        votesFor:    direction === "for" ? [...votesFor, uid] : votesFor.filter(u => u !== uid),
        votesAgainst: direction === "against" ? [...votesAgainst, uid] : votesAgainst.filter(u => u !== uid),
        statut: "En attente d'entretien"
      },
      votesNeeded
    );
  }
}

// Valider l'entretien → En attente d'installation
export async function validerEntretien(id) {
  await updateDoc(doc(db, "dossiers", id), {
    statut:    "En attente d'installation",
    updatedAt: serverTimestamp()
  });
}

// Valider l'installation → Faction créée + création automatique de la faction
export async function validerInstallation(id, dossier) {
  const { uid, name } = authorInfo();

  // Créer la faction dans Firestore
  const factionRef = await addDoc(collection(db, "factions"), {
    nom:            dossier.nomGroupe,
    type:           dossier.typeGroupe,
    statut:         "Actif",
    lead:           dossier.contactName || "",
    coLead:         "",
    business:       "",
    notes:          `Faction créée depuis dossier de candidature.`,
    dernierContact: null,
    actif:          true,
    leadHistory:    [],
    authorUid:      uid,
    authorName:     name,
    createdAt:      serverTimestamp(),
    updatedAt:      serverTimestamp(),
    updatedBy:      name
  });

  await updateDoc(doc(db, "dossiers", id), {
    statut:     "Faction créée",
    archived:   true,
    archivedAt: serverTimestamp(),
    archivedBy: name,
    factionId:  factionRef.id,
    updatedAt:  serverTimestamp()
  });

  const settings    = await loadSettings();
  const votesNeeded = getVotesNeeded(settings);
  await sendDossierNotification("dossier_archive", { id, ...dossier, statut: "Faction créée" }, votesNeeded);

  return factionRef.id;
}

// Refuser un dossier à n'importe quelle étape
export async function refuserDossier(id, dossier, reason) {
  const { name } = authorInfo();
  const settings    = await loadSettings();
  const votesNeeded = getVotesNeeded(settings);

  await updateDoc(doc(db, "dossiers", id), {
    statut:        "Refusé",
    archived:      true,
    archivedAt:    serverTimestamp(),
    archivedBy:    name,
    refusalReason: reason || "",
    updatedAt:     serverTimestamp()
  });

  await sendDossierNotification("dossier_archive", { id, ...dossier, statut: "Refusé" }, votesNeeded);
}

// Legacy — conservé pour compat éventuelle
export async function archiveDossier(id, dossier, decision) {
  if (decision === "Refusé") return refuserDossier(id, dossier, "");
  return validerInstallation(id, dossier);
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
