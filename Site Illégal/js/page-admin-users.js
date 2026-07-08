import { db } from "./firebase-init.js";
import { FIREBASE_CONFIG } from "../config.js";
import { requireAuth, isAdmin, getCurrentUser, getCurrentUserData } from "./auth.js";
import { loadSettings, saveSettings, getVotesNeeded, invalidateSettingsCache } from "./settings.js";
import { renderNavbar, showToast, confirmModal } from "./ui-shared.js";
import {
  collection, getDocs, getDoc, setDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword,
  updateProfile, signOut as secondarySignOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// App secondaire pour créer des comptes sans déconnecter l'admin courant
const secondaryApp  = getApps().find(a => a.name === "fw-secondary") || initializeApp(FIREBASE_CONFIG, "fw-secondary");
const secondaryAuth = getAuth(secondaryApp);

requireAuth(async () => {
  if (!isAdmin()) {
    window.location.href = "/index.html";
    return;
  }

  renderNavbar("admin");
  loadUsers();
  await initConfig();
  await initAnnouncement();

  document.getElementById("create-user-btn").addEventListener("click", () => {
    document.getElementById("create-panel").style.display = "";
    document.getElementById("create-user-btn").style.display = "none";
  });

  document.getElementById("cancel-create-btn").addEventListener("click", () => {
    document.getElementById("create-panel").style.display = "none";
    document.getElementById("create-user-btn").style.display = "";
    clearForm();
  });

  document.getElementById("confirm-create-btn").addEventListener("click", handleCreateUser);
  document.getElementById("save-config-btn").addEventListener("click", handleSaveConfig);

  const input = document.getElementById("referent-count-input");
  input.addEventListener("input",  updateConfigDisplay);
  document.getElementById("ref-increment").addEventListener("click", () => { input.value = Math.min(20, +input.value + 1); updateConfigDisplay(); });
  document.getElementById("ref-decrement").addEventListener("click", () => { input.value = Math.max(1,  +input.value - 1); updateConfigDisplay(); });
});

// ── Configuration ─────────────────────────────────────────────

async function initConfig() {
  const settings = await loadSettings();
  document.getElementById("referent-count-input").value = settings.referentCount;
  updateConfigDisplay();
}

function updateConfigDisplay() {
  const n        = Math.max(1, Math.min(20, +document.getElementById("referent-count-input").value || 5));
  const needed   = Math.ceil(n / 2);
  document.getElementById("votes-needed-display").textContent  = needed;
  document.getElementById("votes-needed-formula").textContent  = `⌈${n}/2⌉ = ${needed}`;
}

async function handleSaveConfig() {
  const n   = Math.max(1, Math.min(20, +document.getElementById("referent-count-input").value || 5));
  const btn = document.getElementById("save-config-btn");
  btn.disabled = true; btn.textContent = "Sauvegarde…";
  try {
    invalidateSettingsCache();
    await saveSettings({ referentCount: n });
    showToast(`Configuration sauvegardée — seuil : ${Math.ceil(n/2)}/${n} votes.`, "success");
  } catch (err) {
    showToast("Erreur lors de la sauvegarde.", "error");
    console.error(err);
  } finally {
    btn.disabled = false; btn.textContent = "Sauvegarder";
  }
}

// ── Utilisateurs ──────────────────────────────────────────────

async function loadUsers() {
  try {
    const q    = query(collection(db, "users"), orderBy("displayName", "asc"));
    const snap = await getDocs(q);
    const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    document.getElementById("user-count").textContent = `${users.length} utilisateur${users.length !== 1 ? "s" : ""}`;
    renderUserList(users);
  } catch (err) {
    console.error(err);
    showToast("Erreur lors du chargement des utilisateurs.", "error");
  }
}

function renderUserList(users) {
  const container = document.getElementById("user-list");
  const currentUid = getCurrentUser()?.uid;

  if (!users.length) {
    container.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:.82rem">Aucun utilisateur trouvé.</div>`;
    return;
  }

  container.innerHTML = users.map(u => {
    const initials = (u.displayName || u.email || "?").slice(0, 2).toUpperCase();
    const isMe = u.id === currentUid;
    return `
      <div class="user-row">
        <div class="user-row-avatar">${initials}</div>
        <div class="user-row-info">
          <div class="user-row-name">${esc(u.displayName || "—")} ${isMe ? `<span style="font-size:.7rem;color:var(--text-muted)">(toi)</span>` : ""}</div>
          <div class="user-row-email">${esc(u.email || u.id)}</div>
        </div>
        <span class="role-badge ${u.role}">${u.role || "?"}</span>
        ${!isMe ? `
          <select class="user-role-select" data-uid="${u.id}" onchange="handleRoleChange(this)">
            <option value="referent"   ${u.role === "referent"   ? "selected" : ""}>Référent</option>
            <option value="spectateur" ${u.role === "spectateur" ? "selected" : ""}>Spectateur</option>
            <option value="admin"      ${u.role === "admin"      ? "selected" : ""}>Admin</option>
          </select>
          <select class="user-role-select" data-uid="${u.id}" onchange="handlePosteChange(this)"
                  style="min-width:190px;font-size:.75rem">
            <option value=""                          ${!u.poste ? "selected" : ""}>— Aucun poste —</option>
            <option value="Responsable"               ${u.poste === "Responsable"               ? "selected" : ""}>Responsable</option>
            <option value="Co-Responsable"            ${u.poste === "Co-Responsable"            ? "selected" : ""}>Co-Responsable</option>
            <option value="Gestionnaire Mafia/Cartel" ${u.poste === "Gestionnaire Mafia/Cartel" ? "selected" : ""}>Gest. Mafia/Cartel</option>
            <option value="Gestionnaire Groupe Atypique" ${u.poste === "Gestionnaire Groupe Atypique" ? "selected" : ""}>Gest. Atypique</option>
            <option value="Gestionnaire Gang"         ${u.poste === "Gestionnaire Gang"         ? "selected" : ""}>Gest. Gang</option>
          </select>
          <button class="btn btn-danger btn-sm" style="padding:4px 10px;font-size:.78rem"
            onclick="handleDeleteUser('${u.id}','${esc(u.displayName || u.email)}')">✕ Supprimer</button>
        ` : `<div style="width:90px"></div>`}
      </div>`;
  }).join("");
}

window.handleDeleteUser = async (uid, name) => {
  const ok = await confirmModal(
    "Supprimer le compte",
    `Supprimer <strong>${name}</strong> ? Son accès sera immédiatement révoqué. Cette action est irréversible.`,
    "Supprimer"
  );
  if (!ok) return;
  try {
    await deleteDoc(doc(db, "users", uid));
    showToast(`Compte de ${name} supprimé.`, "success");
    loadUsers();
  } catch (err) {
    showToast("Erreur lors de la suppression.", "error");
    console.error(err);
  }
};

window.handlePosteChange = async (select) => {
  const uid   = select.dataset.uid;
  const poste = select.value;
  try {
    await updateDoc(doc(db, "users", uid), { poste: poste || null });
    showToast("Poste mis à jour.", "success");
    loadUsers();
  } catch (err) {
    showToast("Erreur lors du changement de poste.", "error");
    console.error(err);
  }
};

window.handleRoleChange = async (select) => {
  const uid  = select.dataset.uid;
  const role = select.value;
  try {
    await updateDoc(doc(db, "users", uid), { role });
    showToast("Rôle mis à jour.", "success");
    // Recharger pour mettre à jour les badges
    loadUsers();
  } catch (err) {
    showToast("Erreur lors du changement de rôle.", "error");
    console.error(err);
  }
};

async function handleCreateUser() {
  const displayName = document.getElementById("new-displayname").value.trim();
  const email       = document.getElementById("new-email").value.trim();
  const password    = document.getElementById("new-password").value;
  const role        = document.getElementById("new-role").value;

  if (!displayName) { showToast("Le nom d'affichage est requis.", "error"); return; }
  if (!email)        { showToast("L'email est requis.", "error"); return; }
  if (password.length < 8) { showToast("Le mot de passe doit faire au moins 8 caractères.", "error"); return; }

  const btn = document.getElementById("confirm-create-btn");
  btn.disabled = true; btn.textContent = "Création…";

  try {
    // Créer via l'app secondaire (ne déconnecte pas l'admin courant)
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const uid  = cred.user.uid;

    await updateProfile(cred.user, { displayName });
    await secondarySignOut(secondaryAuth);

    // Créer le document Firestore
    await setDoc(doc(db, "users", uid), {
      displayName,
      email,
      role,
      createdAt: serverTimestamp()
    });

    showToast(`Compte créé pour ${displayName}.`, "success");
    clearForm();
    document.getElementById("create-panel").style.display = "none";
    document.getElementById("create-user-btn").style.display = "";
    loadUsers();
  } catch (err) {
    const msg = err.code === "auth/email-already-in-use"
      ? "Cet email est déjà utilisé."
      : err.code === "auth/invalid-email"
      ? "Email invalide."
      : "Erreur lors de la création du compte.";
    showToast(msg, "error");
    console.error(err);
  } finally {
    btn.disabled = false; btn.textContent = "Créer le compte";
  }
}

function clearForm() {
  document.getElementById("new-displayname").value = "";
  document.getElementById("new-email").value       = "";
  document.getElementById("new-password").value    = "";
  document.getElementById("new-role").value        = "referent";
}

// ── Annonces ──────────────────────────────────────────────────

const ANNOUNCE_REF = () => doc(db, "settings", "announcement");

const TYPE_META = {
  info:      { label: "ℹ️ Information",    color: "#3b82f6" },
  warning:   { label: "⚠️ Avertissement",  color: "#f97316" },
  important: { label: "🔴 Important",      color: "#ef4444" }
};

async function initAnnouncement() {
  document.getElementById("announce-publish-btn").addEventListener("click", handlePublishAnnouncement);
  document.getElementById("announce-delete-btn").addEventListener("click", handleDeleteAnnouncement);
  try {
    const snap = await getDoc(ANNOUNCE_REF());
    snap.exists() ? showCurrentAnnouncement(snap.data()) : showNoAnnouncement();
  } catch (_) { showNoAnnouncement(); }
}

function showCurrentAnnouncement(data) {
  const tm = TYPE_META[data.type] || { label: "📢 Annonce", color: "var(--accent)" };
  document.getElementById("announce-current").style.display   = "";
  document.getElementById("announce-sep").style.display       = "";
  document.getElementById("announce-current-badge").innerHTML =
    `<span style="color:${tm.color};font-size:.72rem;font-weight:700">${tm.label}</span>`;
  document.getElementById("announce-current-text").textContent = data.message;

  const parts = [`Par ${data.createdBy || "Admin"}`];
  if (data.imageUrl) parts.push("Image jointe");
  if (data.expiresAt) {
    const exp = data.expiresAt.toDate?.() ?? new Date(data.expiresAt);
    parts.push(`Expire le ${exp.toLocaleDateString("fr-FR", {
      day: "2-digit", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    }).replace(",", " à")}`);
  } else {
    parts.push("Pas d'expiration automatique");
  }
  document.getElementById("announce-current-meta").textContent = parts.join(" · ");
  document.getElementById("announce-status-label").textContent = "1 annonce active";
  document.getElementById("announce-status-label").style.color = "var(--s-valid)";
}

function showNoAnnouncement() {
  document.getElementById("announce-current").style.display = "none";
  document.getElementById("announce-sep").style.display     = "none";
  document.getElementById("announce-status-label").textContent = "Aucune annonce active";
  document.getElementById("announce-status-label").style.color = "var(--text-muted)";
}

async function handlePublishAnnouncement() {
  const message  = document.getElementById("announce-msg").value.trim();
  const type     = document.getElementById("announce-type").value;
  const secs     = parseInt(document.getElementById("announce-duration").value, 10);
  const imageUrl = document.getElementById("announce-image").value.trim() || null;

  if (!message) { showToast("Le message est requis.", "error"); return; }

  const btn = document.getElementById("announce-publish-btn");
  btn.disabled = true; btn.textContent = "Publication…";
  try {
    const userData  = getCurrentUserData();
    const expiresAt = secs > 0 ? new Date(Date.now() + secs * 1000) : null;
    await setDoc(ANNOUNCE_REF(), {
      message, type, imageUrl, expiresAt,
      createdAt: serverTimestamp(),
      createdBy: userData?.displayName || "Admin"
    });
    document.getElementById("announce-msg").value            = "";
    document.getElementById("announce-type").value           = "info";
    document.getElementById("announce-duration").value       = "0";
    document.getElementById("announce-image").value          = "";
    const snap = await getDoc(ANNOUNCE_REF());
    showCurrentAnnouncement(snap.data());
    showToast("Annonce publiée.", "success");
  } catch (err) {
    showToast("Erreur lors de la publication.", "error"); console.error(err);
  } finally {
    btn.disabled = false; btn.textContent = "📢 Publier l'annonce";
  }
}

async function handleDeleteAnnouncement() {
  const ok = await confirmModal(
    "Supprimer l'annonce",
    "L'annonce disparaîtra immédiatement de la page d'accueil pour tous les utilisateurs.",
    "Supprimer"
  );
  if (!ok) return;
  try {
    await deleteDoc(ANNOUNCE_REF());
    showNoAnnouncement();
    showToast("Annonce supprimée.", "success");
  } catch (err) {
    showToast("Erreur lors de la suppression.", "error"); console.error(err);
  }
}

function esc(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
