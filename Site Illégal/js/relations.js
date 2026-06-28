import { db } from "./firebase-init.js";
import { getCurrentUser, getCurrentUserData } from "./auth.js";
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  query, orderBy, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function authorInfo() {
  const user = getCurrentUser();
  const data = getCurrentUserData();
  return { uid: user.uid, name: data.displayName || user.email };
}

export async function createRelation(data) {
  const { uid, name } = authorInfo();
  return addDoc(collection(db, "relations"), {
    faction1Id:   data.faction1Id,
    faction1Name: data.faction1Name,
    faction2Id:   data.faction2Id,
    faction2Name: data.faction2Name,
    type:         data.type,
    description:  data.description?.trim() || "",
    since:        data.since || new Date().toISOString().slice(0, 10),
    authorUid:    uid,
    authorName:   name,
    createdAt:    serverTimestamp(),
    updatedAt:    serverTimestamp()
  });
}

export async function updateRelation(id, data) {
  await updateDoc(doc(db, "relations", id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteRelation(id) {
  await deleteDoc(doc(db, "relations", id));
}

export function subscribeRelations(callback) {
  const q = query(collection(db, "relations"), orderBy("createdAt", "desc"));
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}
