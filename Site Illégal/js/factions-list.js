import { db } from "./firebase-init.js";
import { getCurrentUser, getCurrentUserData } from "./auth.js";
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function authorInfo() {
  const user     = getCurrentUser();
  const userData = getCurrentUserData();
  return { uid: user.uid, name: userData.displayName || user.email };
}

export async function createFaction(data) {
  const { uid, name } = authorInfo();
  return addDoc(collection(db, "factions"), {
    nom:      data.nom.trim(),
    type:     data.type,
    lead:     data.lead.trim(),
    coLead:   data.coLead.trim(),
    business: data.business.trim(),
    actif:    true,
    authorUid:  uid,
    authorName: name,
    createdAt:  serverTimestamp(),
    updatedAt:  serverTimestamp(),
    updatedBy:  name
  });
}

export async function updateFaction(id, data) {
  const { name } = authorInfo();
  await updateDoc(doc(db, "factions", id), {
    nom:      data.nom.trim(),
    type:     data.type,
    lead:     data.lead.trim(),
    coLead:   data.coLead.trim(),
    business: data.business.trim(),
    updatedAt: serverTimestamp(),
    updatedBy: name
  });
}

export async function deleteFaction(id) {
  await deleteDoc(doc(db, "factions", id));
}

export function subscribeFactions(callback) {
  const q = query(collection(db, "factions"), orderBy("nom", "asc"));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export async function getFactionNames() {
  return new Promise(resolve => {
    const unsub = subscribeFactions(factions => {
      unsub();
      resolve(factions.map(f => f.nom));
    });
  });
}
