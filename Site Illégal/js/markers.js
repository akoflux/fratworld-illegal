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

export async function createMarker(data) {
  const { uid, name } = authorInfo();
  return addDoc(collection(db, "markers"), {
    lat:         data.lat,
    lng:         data.lng,
    label:       data.label.trim(),
    description: data.description?.trim() || "",
    category:    data.category || "point",
    color:       data.color   || "#f97316",
    authorUid:   uid,
    authorName:  name,
    createdAt:   serverTimestamp()
  });
}

export async function updateMarker(id, data) {
  await updateDoc(doc(db, "markers", id), {
    label:       data.label.trim(),
    description: data.description?.trim() || "",
    category:    data.category || "point",
    color:       data.color   || "#f97316"
  });
}

export async function deleteMarker(id) {
  await deleteDoc(doc(db, "markers", id));
}

export function subscribeMarkers(callback) {
  const q = query(collection(db, "markers"), orderBy("createdAt", "desc"));
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}
