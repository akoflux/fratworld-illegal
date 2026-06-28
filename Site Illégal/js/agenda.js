import { db } from "./firebase-init.js";
import { getCurrentUser, getCurrentUserData } from "./auth.js";
import {
  collection, doc, addDoc, deleteDoc,
  query, orderBy, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function authorInfo() {
  const user = getCurrentUser();
  const data = getCurrentUserData();
  return { uid: user.uid, name: data.displayName || user.email };
}

export async function createEvent(data) {
  const { uid, name } = authorInfo();
  return addDoc(collection(db, "agenda"), {
    title:       data.title.trim(),
    date:        data.date,
    type:        data.type || "evenement",
    description: data.description?.trim() || "",
    authorUid:   uid,
    authorName:  name,
    createdAt:   serverTimestamp()
  });
}

export async function deleteEvent(id) {
  await deleteDoc(doc(db, "agenda", id));
}

export function subscribeEvents(callback) {
  const q = query(collection(db, "agenda"), orderBy("date", "asc"));
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}
