import { db } from "./firebase-init.js";
import { getCurrentUser, getCurrentUserData } from "./auth.js";
import { sendDiscordNotification } from "./discord.js";
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDoc, getDocs, query, orderBy, onSnapshot, serverTimestamp, arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function authorInfo() {
  const user     = getCurrentUser();
  const userData = getCurrentUserData();
  return { uid: user.uid, name: userData.displayName || user.email };
}

async function addHistory(entryId, action, changes) {
  const { uid, name } = authorInfo();
  await addDoc(collection(db, "entries", entryId, "history"), {
    action, authorUid: uid, authorName: name, changes, timestamp: serverTimestamp()
  });
}

export async function createEntry(data) {
  const { uid, name } = authorInfo();

  const payload = {
    title:          data.title.trim(),
    section:        data.section,
    category:       data.category,
    description:    data.description.trim(),
    status:         data.status,
    factions:       data.factions || [],
    replacedBy:      null,
    replacedByTitle: null,
    replaces:        data.replaces      || null,
    replacesTitle:   data.replacesTitle || null,
    authorUid:  uid,
    authorName: name,
    createdAt:  serverTimestamp(),
    updatedAt:  serverTimestamp()
  };

  const ref = await addDoc(collection(db, "entries"), payload);
  await addHistory(ref.id, "create", [{ field: "all", oldValue: null, newValue: "Entrée créée" }]);

  if (data.replaces) {
    await updateDoc(doc(db, "entries", data.replaces), {
      replacedBy: ref.id, replacedByTitle: data.title.trim(), updatedAt: serverTimestamp()
    });
  }

  await sendDiscordNotification("create", { ...payload, id: ref.id });
  return ref.id;
}

export async function updateEntry(id, data, original) {
  const { uid, name } = authorInfo();

  const TRACKED = ["title", "section", "category", "description", "status", "replaces"];
  const changes = TRACKED
    .filter(f => String(data[f] ?? "") !== String(original[f] ?? ""))
    .map(f => ({ field: f, oldValue: original[f] ?? null, newValue: data[f] ?? null }));

  const factionsChanged = JSON.stringify(data.factions) !== JSON.stringify(original.factions || []);
  if (factionsChanged) {
    changes.push({ field: "factions", oldValue: (original.factions || []).join(", "), newValue: data.factions.join(", ") });
  }

  const payload = {
    title:         data.title.trim(),
    section:       data.section,
    category:      data.category,
    description:   data.description.trim(),
    status:        data.status,
    factions:      data.factions || [],
    replaces:      data.replaces      || null,
    replacesTitle: data.replacesTitle || null,
    updatedAt:     serverTimestamp()
  };

  await updateDoc(doc(db, "entries", id), payload);
  if (changes.length) await addHistory(id, "update", changes);

  if (data.replaces && data.replaces !== original.replaces) {
    await updateDoc(doc(db, "entries", data.replaces), {
      replacedBy: id, replacedByTitle: data.title.trim(), updatedAt: serverTimestamp()
    });
  }
  if (!data.replaces && original.replaces) {
    await updateDoc(doc(db, "entries", original.replaces), {
      replacedBy: null, replacedByTitle: null, updatedAt: serverTimestamp()
    });
  }

  const statusChanged = changes.find(c => c.field === "status");
  if (statusChanged) {
    await sendDiscordNotification("status_change", { ...payload, id, authorName: name });
  }
}

export async function deleteEntry(id) {
  await deleteDoc(doc(db, "entries", id));
}

export async function getEntry(id) {
  const snap = await getDoc(doc(db, "entries", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function getEntries() {
  const q    = query(collection(db, "entries"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Temps réel — appelle callback(entries[]) à chaque changement.
// Retourne la fonction de désabonnement.
export function subscribeEntries(callback) {
  const q = query(collection(db, "entries"), orderBy("createdAt", "desc"));
  return onSnapshot(q, snap => {
    const entries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(entries);
  });
}

const VOTES_NEEDED = 3;

export async function voteEntry(id, direction, currentFor, currentAgainst) {
  const { uid, name } = authorInfo();

  const hadVotedFor     = currentFor.includes(uid);
  const hadVotedAgainst = currentAgainst.includes(uid);

  const update = { updatedAt: serverTimestamp() };
  if (direction === "for") {
    update.votesFor = arrayUnion(uid);
    if (hadVotedAgainst) update.votesAgainst = arrayRemove(uid);
  } else {
    update.votesAgainst = arrayUnion(uid);
    if (hadVotedFor) update.votesFor = arrayRemove(uid);
  }

  // Recalcul des comptes après changement éventuel de camp
  const newForCount = direction === "for"
    ? (hadVotedFor ? currentFor.length : currentFor.length + 1)
    : (hadVotedFor ? currentFor.length - 1 : currentFor.length);
  const newAgainstCount = direction === "against"
    ? (hadVotedAgainst ? currentAgainst.length : currentAgainst.length + 1)
    : (hadVotedAgainst ? currentAgainst.length - 1 : currentAgainst.length);

  let finalStatus = null;
  if (newForCount >= VOTES_NEEDED) {
    update.status = "Validé";
    finalStatus   = "Validé";
  } else if (newAgainstCount >= VOTES_NEEDED) {
    update.status = "Refusé";
    finalStatus   = "Refusé";
  }

  await updateDoc(doc(db, "entries", id), update);
  await addHistory(id, "update", [{
    field: direction === "for" ? "votesFor" : "votesAgainst",
    oldValue: null,
    newValue: `${name} a voté ${direction === "for" ? "Pour" : "Contre"}`
  }]);

  if (finalStatus) {
    const snap = await getDoc(doc(db, "entries", id));
    const full = { id: snap.id, ...snap.data() };
    await sendDiscordNotification("vote_result", { ...full, authorName: name });
  }

  const snap = await getDoc(doc(db, "entries", id));
  return { id: snap.id, ...snap.data() };
}

export async function getHistory(entryId) {
  const q    = query(collection(db, "entries", entryId, "history"), orderBy("timestamp", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
