import { db } from "./firebase-init.js";
import { getCurrentUser, getCurrentUserData } from "./auth.js";
import { sendDiscordNotification } from "./discord.js";
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDoc, getDocs, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ── Helpers ──────────────────────────────────────────────────

function authorInfo() {
  const user     = getCurrentUser();
  const userData = getCurrentUserData();
  return {
    uid:  user.uid,
    name: userData.displayName || user.email
  };
}

async function addHistory(entryId, action, changes) {
  const { uid, name } = authorInfo();
  await addDoc(collection(db, "entries", entryId, "history"), {
    action,
    authorUid:  uid,
    authorName: name,
    changes,
    timestamp: serverTimestamp()
  });
}

// ── CRUD ─────────────────────────────────────────────────────

export async function createEntry(data) {
  const { uid, name } = authorInfo();

  const payload = {
    title:          data.title.trim(),
    category:       data.category,
    description:    data.description.trim(),
    status:         data.status,
    faction:        data.faction || "Aucune",
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

  await addHistory(ref.id, "create", [
    { field: "all", oldValue: null, newValue: "Entrée créée" }
  ]);

  // Mettre à jour l'entrée remplacée (lien bidirectionnel).
  if (data.replaces) {
    await updateDoc(doc(db, "entries", data.replaces), {
      replacedBy:      ref.id,
      replacedByTitle: data.title.trim(),
      updatedAt:       serverTimestamp()
    });
  }

  await sendDiscordNotification("create", { ...payload, id: ref.id });

  return ref.id;
}

export async function updateEntry(id, data, original) {
  const { uid, name } = authorInfo();

  const TRACKED = ["title", "category", "description", "status", "faction", "replaces"];
  const changes = TRACKED
    .filter(f => String(data[f] ?? "") !== String(original[f] ?? ""))
    .map(f => ({ field: f, oldValue: original[f] ?? null, newValue: data[f] ?? null }));

  const payload = {
    title:          data.title.trim(),
    category:       data.category,
    description:    data.description.trim(),
    status:         data.status,
    faction:        data.faction || "Aucune",
    replaces:        data.replaces      || null,
    replacesTitle:   data.replacesTitle || null,
    updatedAt:       serverTimestamp()
  };

  await updateDoc(doc(db, "entries", id), payload);

  if (changes.length) {
    await addHistory(id, "update", changes);
  }

  // Mettre à jour le lien de supersession si changé.
  if (data.replaces && data.replaces !== original.replaces) {
    await updateDoc(doc(db, "entries", data.replaces), {
      replacedBy:      id,
      replacedByTitle: data.title.trim(),
      updatedAt:       serverTimestamp()
    });
  }
  // Retirer le lien sur l'ancienne entrée remplacée si on délie.
  if (!data.replaces && original.replaces) {
    await updateDoc(doc(db, "entries", original.replaces), {
      replacedBy:      null,
      replacedByTitle: null,
      updatedAt:       serverTimestamp()
    });
  }

  const statusChanged = changes.find(c => c.field === "status");
  if (statusChanged) {
    const fullEntry = { ...payload, id, authorName: name };
    await sendDiscordNotification("status_change", fullEntry);
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

export async function getHistory(entryId) {
  const q    = query(collection(db, "entries", entryId, "history"), orderBy("timestamp", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
