import { db } from "./firebase-init.js";
import { getCurrentUser, getCurrentUserData } from "./auth.js";
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  query, orderBy, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

function authorInfo() {
  const user     = getCurrentUser();
  const userData = getCurrentUserData();
  return { uid: user.uid, name: userData.displayName || user.email };
}

export async function addMembre(factionId, data) {
  const { uid, name } = authorInfo();
  return await addDoc(collection(db, "factions", factionId, "membres"), {
    pseudo:     data.pseudo.trim(),
    idCFX:      data.idCFX?.trim()    || "",
    idJoueur:   data.idJoueur?.trim() || "",
    statut:     data.statut  || "Actif",
    role:       data.role    || "Membre",
    addedAt:    serverTimestamp(),
    addedBy:    name,
    addedByUid: uid
  });
}

export async function updateMembre(factionId, membreId, data) {
  await updateDoc(doc(db, "factions", factionId, "membres", membreId), {
    pseudo:   data.pseudo.trim(),
    idCFX:    data.idCFX?.trim()    || "",
    idJoueur: data.idJoueur?.trim() || "",
    statut:   data.statut,
    role:     data.role
  });
}

export async function deleteMembre(factionId, membreId) {
  await deleteDoc(doc(db, "factions", factionId, "membres", membreId));
}

export function subscribeMembres(factionId, callback) {
  const q = query(
    collection(db, "factions", factionId, "membres"),
    orderBy("addedAt", "asc")
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export function exportMembresCSV(membres, factionName) {
  const BOM    = "﻿";
  const header = "Pseudo,ID CFX,ID Joueur,Rôle,Statut\n";
  const rows   = membres.map(m => {
    const q = (s) => `"${(s || "").replace(/"/g, '""')}"`;
    return [q(m.pseudo), q(m.idCFX), q(m.idJoueur), q(m.role), q(m.statut)].join(",");
  }).join("\n");

  const blob = new Blob([BOM + header + rows], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `membres-${factionName.replace(/[^a-z0-9]/gi, "-")}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
