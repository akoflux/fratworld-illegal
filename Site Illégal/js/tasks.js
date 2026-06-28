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

export async function createTask(data) {
  const { uid, name } = authorInfo();
  return addDoc(collection(db, "tasks"), {
    title:          data.title.trim(),
    description:    data.description?.trim() || "",
    assignedToUid:  data.assignedToUid  || null,
    assignedToName: data.assignedToName || "Tous",
    priority:       data.priority       || "normale",
    status:         "a_faire",
    dueDate:        data.dueDate        || null,
    authorUid:      uid,
    authorName:     name,
    createdAt:      serverTimestamp(),
    updatedAt:      serverTimestamp()
  });
}

export async function updateTaskStatus(id, status) {
  await updateDoc(doc(db, "tasks", id), { status, updatedAt: serverTimestamp() });
}

export async function updateTask(id, data) {
  await updateDoc(doc(db, "tasks", id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteTask(id) {
  await deleteDoc(doc(db, "tasks", id));
}

export function subscribeTasks(callback) {
  const q = query(collection(db, "tasks"), orderBy("createdAt", "desc"));
  return onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}
