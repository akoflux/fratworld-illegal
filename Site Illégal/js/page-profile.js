import { requireAuth, getCurrentUser, getCurrentUserData } from "./auth.js";
import { getEntries } from "./entries.js";
import { db } from "./firebase-init.js";
import {
  renderNavbar, showToast, formatDate, statusBadge, catBadge
} from "./ui-shared.js";
import {
  collection, getDocs, getDoc, setDoc, deleteDoc, doc, query, orderBy, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

requireAuth(async (user, userData) => {
  renderNavbar("profile");

  const uid  = user.uid;
  const name = userData.displayName || user.email;
  const role = userData.role || "referent";

  const [entries, dossierSnap] = await Promise.all([
    getEntries(),
    getDocs(query(collection(db, "dossiers"), orderBy("createdAt", "desc")))
  ]);

  const allDossiers = dossierSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const myEntries   = entries.filter(e => e.authorUid === uid);
  const myVotedFor  = entries.filter(e =>
    (e.votesFor || []).includes(uid) || (e.votesAgainst || []).includes(uid) || (e.votesAbstain || []).includes(uid)
  );
  const myDossiers  = allDossiers.filter(d => d.authorUid === uid);

  renderHeader(name, role, userData.poste, myEntries, myVotedFor, myDossiers);
  renderMyEntries(myEntries);
  renderMyVotes(myVotedFor, uid);
  renderMyDossiers(myDossiers);

  if (role !== "spectateur") {
    loadDelegation(uid, name);
  } else {
    document.getElementById("delegation-panel")?.remove();
  }
});

// ── En-tête ────────────────────────────────────────────────────

function renderHeader(name, role, poste, entries, votes, dossiers) {
  const initials = name.slice(0, 2).toUpperCase();
  const validated = entries.filter(e => e.status === "Validé").length;

  document.getElementById("profile-header").innerHTML = `
    <div class="profile-avatar-lg">${initials}</div>
    <div style="flex:1;min-width:0">
      <div class="profile-meta-name">${esc(name)}</div>
      <div class="profile-meta-role">
        <span class="role-badge ${role}">${role}</span>
        ${poste ? `<span style="margin-left:8px;font-size:.78rem;color:var(--text-muted)">${esc(poste)}</span>` : ""}
      </div>
      <div class="profile-kpis">
        <div class="profile-kpi"><div class="profile-kpi-val">${entries.length}</div><div class="profile-kpi-label">Entrées créées</div></div>
        <div class="profile-kpi"><div class="profile-kpi-val">${validated}</div><div class="profile-kpi-label">Validées</div></div>
        <div class="profile-kpi"><div class="profile-kpi-val">${votes.length}</div><div class="profile-kpi-label">Votes émis</div></div>
        <div class="profile-kpi"><div class="profile-kpi-val">${dossiers.length}</div><div class="profile-kpi-label">Dossiers soumis</div></div>
      </div>
    </div>`;
}

// ── Mes entrées ────────────────────────────────────────────────

function renderMyEntries(entries) {
  const countEl    = document.getElementById("my-entries-count");
  const container  = document.getElementById("my-entries-list");
  countEl.textContent = `${entries.length} entrée${entries.length !== 1 ? "s" : ""}`;

  if (!entries.length) {
    container.innerHTML = `<div style="padding:18px;text-align:center;color:var(--text-muted);font-size:.82rem">Aucune entrée créée.</div>`;
    return;
  }

  container.innerHTML = `<div class="table-wrapper"><table class="entries-table">
    <thead><tr><th>Titre</th><th>Catégorie</th><th>Statut</th><th>Date</th></tr></thead>
    <tbody>${entries.map(e => `
      <tr onclick="window.location.href='/entry-detail.html?id=${e.id}&section=${e.section||'decisions'}'" style="cursor:pointer">
        <td class="table-title">${esc(e.title)}</td>
        <td>${catBadge(e.category)}</td>
        <td>${statusBadge(e.status, !!e.replacedBy)}</td>
        <td style="color:var(--text-muted);font-size:.78rem;white-space:nowrap">${formatDate(e.createdAt)}</td>
      </tr>`).join("")}
    </tbody></table></div>`;
}

// ── Mes votes ──────────────────────────────────────────────────

function renderMyVotes(entries, uid) {
  const countEl   = document.getElementById("my-votes-count");
  const container = document.getElementById("my-votes-list");

  const votes = entries.filter(e => e.section === "propositions");
  countEl.textContent = `${votes.length} vote${votes.length !== 1 ? "s" : ""}`;

  if (!votes.length) {
    container.innerHTML = `<div style="padding:18px;text-align:center;color:var(--text-muted);font-size:.82rem">Aucun vote émis sur des propositions.</div>`;
    return;
  }

  container.innerHTML = `<div class="table-wrapper"><table class="entries-table">
    <thead><tr><th>Proposition</th><th>Statut</th><th>Mon vote</th><th>Date</th></tr></thead>
    <tbody>${votes.map(e => {
      const votedFor     = (e.votesFor     || []).includes(uid);
      const votedAgainst = (e.votesAgainst || []).includes(uid);
      const votedAbstain = (e.votesAbstain || []).includes(uid);
      const voteLabel = votedFor
        ? `<span style="color:var(--s-valid);font-weight:600">👍 Pour</span>`
        : votedAgainst
        ? `<span style="color:var(--s-refused);font-weight:600">👎 Contre</span>`
        : `<span style="color:var(--text-muted)">→ Abstention</span>`;
      return `
        <tr onclick="window.location.href='/entry-detail.html?id=${e.id}&section=propositions'" style="cursor:pointer">
          <td class="table-title">${esc(e.title)}</td>
          <td>${statusBadge(e.status)}</td>
          <td>${voteLabel}</td>
          <td style="color:var(--text-muted);font-size:.78rem;white-space:nowrap">${formatDate(e.createdAt)}</td>
        </tr>`;
    }).join("")}
    </tbody></table></div>`;
}

// ── Mes dossiers ───────────────────────────────────────────────

function renderMyDossiers(dossiers) {
  const countEl   = document.getElementById("my-dossiers-count");
  const container = document.getElementById("my-dossiers-list");
  countEl.textContent = `${dossiers.length} dossier${dossiers.length !== 1 ? "s" : ""}`;

  if (!dossiers.length) {
    container.innerHTML = `<div style="padding:18px;text-align:center;color:var(--text-muted);font-size:.82rem">Aucun dossier soumis.</div>`;
    return;
  }

  container.innerHTML = `<div class="table-wrapper"><table class="entries-table">
    <thead><tr><th>Groupe</th><th>Type</th><th>Statut</th><th>Date</th></tr></thead>
    <tbody>${dossiers.map(d => `
      <tr>
        <td class="table-title">${esc(d.nomGroupe)}</td>
        <td style="font-size:.78rem;color:var(--text-secondary)">${esc(d.typeGroupe)}</td>
        <td><span class="badge badge-cat">${esc(d.statut || "?")}</span></td>
        <td style="color:var(--text-muted);font-size:.78rem;white-space:nowrap">${formatDate(d.createdAt)}</td>
      </tr>`).join("")}
    </tbody></table></div>`;
}

// ── Délégation de vote ────────────────────────────────────────

async function loadDelegation(uid, myName) {
  const body   = document.getElementById("delegation-body");
  const label  = document.getElementById("delegation-status-label");
  if (!body) return;

  try {
    // Ma délégation actuelle
    const myDelegSnap = await getDoc(doc(db, "delegations", uid));
    const myDeleg     = myDelegSnap.exists() ? myDelegSnap.data() : null;

    // Qui m'a délégué ?
    const incomingQ    = query(collection(db, "delegations"), where("delegateTo", "==", uid));
    const incomingSnap = await getDocs(incomingQ);
    const incomingNames = incomingSnap.docs.map(d => d.data().delegateFromName || d.id);

    // Tous les référents (pour le select)
    const usersSnap = await getDocs(collection(db, "users"));
    const referents = usersSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(u => u.id !== uid && u.role !== "spectateur");

    if (myDeleg) {
      label.textContent = `Délégué à ${myDeleg.delegateToName}`;
      label.style.color = "var(--s-valid)";
    } else {
      label.textContent = incomingNames.length ? `${incomingNames.length} délégation(s) reçue(s)` : "Aucune délégation";
    }

    body.innerHTML = `
      ${myDeleg ? `
        <div style="padding:12px 16px;border-radius:var(--r-md);border:1px solid var(--border);background:var(--bg-main);margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:12px">
          <div>
            <div style="font-size:.82rem;color:var(--text-muted);margin-bottom:2px">Vous avez délégué votre vote à</div>
            <div style="font-weight:600">${esc(myDeleg.delegateToName)}</div>
          </div>
          <button id="revoke-deleg-btn" class="btn btn-secondary btn-sm" style="flex-shrink:0">✕ Révoquer</button>
        </div>` : ""}
      ${incomingNames.length ? `
        <div style="font-size:.82rem;color:var(--text-muted);margin-bottom:8px">
          Délégation(s) reçue(s) de : <strong>${incomingNames.join(", ")}</strong>
        </div>` : ""}
      ${!myDeleg ? `
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <label style="font-size:.82rem;color:var(--text-muted);flex-shrink:0">Déléguer mon vote à :</label>
          <select id="deleg-select" class="form-control" style="flex:1;min-width:160px;max-width:260px">
            <option value="">— Choisir un référent —</option>
            ${referents.map(r => `<option value="${r.id}" data-name="${esc(r.displayName || r.email)}">${esc(r.displayName || r.email)}</option>`).join("")}
          </select>
          <button id="save-deleg-btn" class="btn btn-primary btn-sm">Déléguer</button>
        </div>` : ""}`;

    document.getElementById("save-deleg-btn")?.addEventListener("click", async () => {
      const select = document.getElementById("deleg-select");
      const toUid  = select.value;
      const toName = select.options[select.selectedIndex]?.dataset?.name || "";
      if (!toUid) { showToast("Choisis un référent.", "error"); return; }
      try {
        await setDoc(doc(db, "delegations", uid), {
          delegateTo:       toUid,
          delegateToName:   toName,
          delegateFromName: myName,
          delegatedAt:      serverTimestamp()
        });
        showToast(`Vote délégué à ${toName}.`, "success");
        loadDelegation(uid, myName);
      } catch (err) {
        showToast("Erreur.", "error"); console.error(err);
      }
    });

    document.getElementById("revoke-deleg-btn")?.addEventListener("click", async () => {
      try {
        await deleteDoc(doc(db, "delegations", uid));
        showToast("Délégation révoquée.", "success");
        loadDelegation(uid, myName);
      } catch (err) {
        showToast("Erreur.", "error"); console.error(err);
      }
    });

  } catch (err) {
    body.innerHTML = `<div style="color:var(--text-muted);font-size:.82rem">Erreur de chargement.</div>`;
    console.error(err);
  }
}

function esc(s) {
  return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
