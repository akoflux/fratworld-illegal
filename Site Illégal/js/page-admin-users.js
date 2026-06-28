import { db } from "./firebase-init.js";
import { FIREBASE_CONFIG } from "../config.js";
import { requireAuth, isAdmin, getCurrentUser } from "./auth.js";
import { loadSettings, saveSettings, getVotesNeeded, invalidateSettingsCache } from "./settings.js";
import { renderNavbar, showToast, confirmModal } from "./ui-shared.js";
import {
  collection, getDocs, setDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy
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
            <option value="referent" ${u.role === "referent" ? "selected" : ""}>Référent</option>
            <option value="admin"    ${u.role === "admin"    ? "selected" : ""}>Admin</option>
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

function esc(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
