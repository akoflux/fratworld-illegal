import { db } from "./firebase-init.js";
import { getCurrentUser, getCurrentUserData } from "./auth.js";
import { sendDiscordNotification } from "./discord.js";
import { loadSettings, getVotesNeeded } from "./settings.js";
import { logActivity } from "./activity.js";
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDoc, getDocs, query, orderBy, where, onSnapshot, serverTimestamp, arrayUnion, arrayRemove, deleteField
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
    pinned:         false,
    replacedBy:      null,
    replacedByTitle: null,
    replaces:        data.replaces      || null,
    replacesTitle:   data.replacesTitle || null,
    voteDeadline:    data.voteDeadline  || null,
    documentUrl:     data.documentUrl   || null,
    tags:            data.tags          || [],
    authorUid:  uid,
    authorName: name,
    createdAt:  serverTimestamp(),
    updatedAt:  serverTimestamp()
  };

  const ref = await addDoc(collection(db, "entries"), payload);
  await addHistory(ref.id, "create", [{ field: "all", oldValue: null, newValue: "Entrée créée" }]);
  logActivity("entry_create", { entryId: ref.id, title: payload.title });

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

  const TRACKED = ["title", "section", "category", "description", "status", "replaces", "voteDeadline", "tags"];
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
    voteDeadline:  data.voteDeadline  || null,
    documentUrl:   data.documentUrl   || null,
    tags:          data.tags          || [],
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
    logActivity("entry_status", { entryId: id, title: payload.title, oldStatus: statusChanged.oldValue, newStatus: payload.status });
  }
}

export async function deleteEntry(id) {
  await deleteDoc(doc(db, "entries", id));
}

export async function archiveEntry(id) {
  await updateDoc(doc(db, "entries", id), {
    status: "Archivée",
    updatedAt: serverTimestamp()
  });
}

export async function markDeadlineReminderSent(id) {
  await updateDoc(doc(db, "entries", id), { deadlineReminderSent: true });
}

export async function togglePin(id, currentlyPinned) {
  await updateDoc(doc(db, "entries", id), {
    pinned: !currentlyPinned,
    updatedAt: serverTimestamp()
  });
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
export function subscribeEntries(callback) {
  const q = query(collection(db, "entries"), orderBy("createdAt", "desc"));
  return onSnapshot(q, snap => {
    const entries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(entries);
  });
}

export async function voteEntry(id, direction, currentFor, currentAgainst, currentAbstain, reason = "") {
  const { uid, name } = authorInfo();

  currentFor     = currentFor     || [];
  currentAgainst = currentAgainst || [];
  currentAbstain = currentAbstain || [];

  const settings    = await loadSettings();
  const VOTES_NEEDED = getVotesNeeded(settings);

  // Vérification deadline
  const snap0 = await getDoc(doc(db, "entries", id));
  const entryData = snap0.data();
  if (entryData?.voteDeadline) {
    const deadline = new Date(entryData.voteDeadline);
    if (deadline < new Date()) {
      throw new Error("Le vote est clôturé (deadline dépassée).");
    }
  }

  const hadVotedFor     = currentFor.includes(uid);
  const hadVotedAgainst = currentAgainst.includes(uid);
  const hadAbstained    = currentAbstain.includes(uid);

  const update = { updatedAt: serverTimestamp() };

  if (direction === "for") {
    update.votesFor = arrayUnion(uid);
    if (hadVotedAgainst) {
      update.votesAgainst = arrayRemove(uid);
      update[`votesAgainstReasons.${uid}`] = deleteField();
    }
    if (hadAbstained) update.votesAbstain = arrayRemove(uid);
  } else if (direction === "against") {
    update.votesAgainst = arrayUnion(uid);
    if (hadVotedFor)  update.votesFor    = arrayRemove(uid);
    if (hadAbstained) update.votesAbstain = arrayRemove(uid);
    if (reason) update[`votesAgainstReasons.${uid}`] = reason;
  } else {
    // abstain
    update.votesAbstain = arrayUnion(uid);
    if (hadVotedFor)     update.votesFor     = arrayRemove(uid);
    if (hadVotedAgainst) {
      update.votesAgainst = arrayRemove(uid);
      update[`votesAgainstReasons.${uid}`] = deleteField();
    }
  }

  // Recalcul des comptes
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

  // Appliquer la délégation : si d'autres référents ont délégué leur vote à uid
  try {
    const delegQ    = query(collection(db, "delegations"), where("delegateTo", "==", uid));
    const delegSnap = await getDocs(delegQ);
    for (const d of delegSnap.docs) {
      const delegUid = d.id;
      // Ne pas voter en doublon si le délégant a déjà voté
      const alreadyVoted = currentFor.includes(delegUid) || currentAgainst.includes(delegUid) || currentAbstain.includes(delegUid);
      if (!alreadyVoted) {
        const delegUpdate = { updatedAt: serverTimestamp() };
        if (direction === "for")     delegUpdate.votesFor     = arrayUnion(delegUid);
        else if (direction === "against") delegUpdate.votesAgainst = arrayUnion(delegUid);
        else                          delegUpdate.votesAbstain = arrayUnion(delegUid);
        await updateDoc(doc(db, "entries", id), delegUpdate);
      }
    }
  } catch (_) { /* délégation silencieuse */ }

  await updateDoc(doc(db, "entries", id), update);
  await addHistory(id, "update", [{
    field: direction === "for" ? "votesFor" : direction === "against" ? "votesAgainst" : "votesAbstain",
    oldValue: null,
    newValue: `${name} a voté ${direction === "for" ? "Pour" : direction === "against" ? "Contre" : "Abstention"}`
  }]);
  logActivity("entry_vote", { entryId: id, title: entryData.title || "", direction });

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
