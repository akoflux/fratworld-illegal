import { db } from "./firebase-init.js";
import { getCurrentUser, getCurrentUserData } from "./auth.js";
import {
  collection, doc, addDoc, deleteDoc, onSnapshot,
  query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function authorInfo() {
  const user     = getCurrentUser();
  const userData = getCurrentUserData();
  return { uid: user.uid, name: userData.displayName || user.email };
}

export async function createDocument(data) {
  const { uid, name } = authorInfo();
  return addDoc(collection(db, "documents"), {
    titre:       data.titre.trim(),
    url:         data.url.trim(),
    description: data.description.trim(),
    category:    data.category,
    authorUid:   uid,
    authorName:  name,
    createdAt:   serverTimestamp()
  });
}

export async function deleteDocument(id) {
  await deleteDoc(doc(db, "documents", id));
}

export function subscribeDocuments(callback) {
  const q = query(collection(db, "documents"), orderBy("createdAt", "desc"));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}
