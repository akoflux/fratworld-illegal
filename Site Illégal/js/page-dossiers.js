import { requireAuth, getCurrentUser, isAdmin } from "./auth.js";
import { subscribeDossiers, createDossier, voteDossier, archiveDossier, deleteDossier } from "./dossiers.js";
import { loadSettings, getVotesNeeded } from "./settings.js";
import { renderNavbar, showToast, confirmModal, formatDate } from "./ui-shared.js";

let allDossiers    = [];
let showArchived   = false;
let unsubscribe    = null;
let VOTES_NEEDED_COUNT = 3;

requireAuth(async () => {
  renderNavbar("dossiers");

  const settings     = await loadSettings();
  VOTES_NEEDED_COUNT = getVotesNeeded(settings);

  // Afficher le seuil dans le sous-titre
  const threshEl  = document.getElementById("dossier-threshold");
  const refCountEl = document.getElementById("dossier-ref-count");
  if (threshEl)   threshEl.textContent   = VOTES_NEEDED_COUNT;
  if (refCountEl) refCountEl.textContent = settings.referentCount;

  unsubscribe = subscribeDossiers(dossiers => {
    allDossiers = dossiers;
    renderDossiers();
  });

  document.getElementById("new-dossier-btn").addEventListener("click", () => {
    document.getElementById("dossier-modal").classList.add("open");
  });
  document.getElementById("modal-cancel-btn").addEventListener("click", closeModal);
  document.getElementById("dossier-form").addEventListener("submit", handleCreate);
  document.getElementById("toggle-archived").addEventListener("click", () => {
    showArchived = !showArchived;
    document.getElementById("toggle-archived").textContent = showArchived ? "Masquer l'historique" : "Voir l'historique";
    renderDossiers();
  });
  document.getElementById("dossier-modal-overlay").addEventListener("click", closeModal);
});

window.addEventListener("beforeunload", () => { if (unsubscribe) unsubscribe(); });

function closeModal() {
  document.getElementById("dossier-modal").classList.remove("open");
  document.getElementById("dossier-form").reset();
}

function renderDossiers() {
  const active   = allDossiers.filter(d => !d.archived);
  const archived = allDossiers.filter(d =>  d.archived);

  document.getElementById("active-count").textContent   = active.length;
  document.getElementById("archived-count").textContent = archived.length;

  renderList("dossiers-active",   active,   false);
  if (showArchived) {
    renderList("dossiers-archived", archived, true);
    document.getElementById("archived-section").style.display = "block";
  } else {
    document.getElementById("archived-section").style.display = "none";
  }
}

function renderList(containerId, dossiers, isArchive) {
  const container = document.getElementById(containerId);
  if (!dossiers.length) {
    container.innerHTML = `
      <div class="empty-state" style="padding:40px">
        <div class="empty-icon">${isArchive ? "🗄" : "📂"}</div>
        <h3>${isArchive ? "Aucun dossier archivé" : "Aucun dossier en cours"}</h3>
        <p>${isArchive ? "" : "Crée le premier dossier avec le bouton ci-dessus."}</p>
      </div>`;
    return;
  }

  container.innerHTML = dossiers.map(d => dossierCard(d, isArchive)).join("");
}

function dossierCard(d, isArchive) {
  const uid        = getCurrentUser()?.uid;
  const hasVoted   = d.votes?.includes(uid);
  const voteCount  = d.votes?.length || 0;
  const pct        = Math.min(100, Math.round(voteCount / VOTES_NEEDED_COUNT * 100));
  const done       = voteCount >= VOTES_NEEDED_COUNT;
  const admin      = isAdmin();

  const statusBadge = {
    "En cours":               `<span class="badge badge-debate">En cours</span>`,
    "En attente d'entretien": `<span class="badge badge-valid">En attente d'entretien</span>`,
    "Validé":                 `<span class="badge badge-valid">Validé</span>`,
    "Refusé":                 `<span class="badge badge-refused">Refusé</span>`
  }[d.statut] || `<span class="badge">${d.statut}</span>`;

  return `
    <div class="dossier-card ${isArchive ? "archived" : ""}">
      <div class="dossier-header">
        <div>
          <div class="dossier-title">${d.nomGroupe}</div>
          <div style="font-size:.75rem;color:var(--text-muted);margin-top:3px">
            ${d.typeGroupe} · Déposé par ${d.authorName} · ${formatDate(d.createdAt)}
          </div>
        </div>
        ${statusBadge}
      </div>
      <div class="dossier-body">
        ${d.description ? `<div class="dossier-desc">${d.description}</div>` : ""}
        <a href="${d.lienDossier}" target="_blank" rel="noopener"
           class="btn btn-secondary btn-sm" style="width:fit-content">
          📄 Voir le dossier
        </a>
      </div>
      ${!isArchive ? `
        <div class="vote-section">
          <div class="vote-count">${voteCount}/${VOTES_NEEDED_COUNT} votes</div>
          <div class="vote-bar-wrap">
            <div class="vote-bar-fill ${done ? "done" : ""}" style="width:${pct}%"></div>
          </div>
          ${!done && !hasVoted ? `
            <button class="btn btn-primary btn-sm" onclick="handleVote('${d.id}')">
              Voter pour
            </button>` : ""}
          ${hasVoted && !done ? `<span style="font-size:.78rem;color:var(--text-muted)">Voté ✓</span>` : ""}
          ${done ? `<span style="font-size:.78rem;color:var(--s-valid)">Seuil atteint ✓</span>` : ""}
          ${admin && done ? `
            <button class="btn btn-sm" style="background:var(--s-valid-bg);color:var(--s-valid);border:1px solid var(--s-valid-border)"
              onclick="handleArchive('${d.id}','Validé')">Valider</button>
            <button class="btn btn-sm" style="background:var(--s-refused-bg);color:var(--s-refused);border:1px solid var(--s-refused-border)"
              onclick="handleArchive('${d.id}','Refusé')">Refuser</button>
          ` : ""}
          ${admin ? `
            <button class="btn-icon danger" title="Supprimer" onclick="handleDeleteDossier('${d.id}','${esc(d.nomGroupe)}')">✕</button>
          ` : ""}
        </div>
      ` : `
        <div class="vote-section" style="font-size:.78rem;color:var(--text-muted)">
          Archivé le ${formatDate(d.archivedAt)} par ${d.archivedBy || "—"}
        </div>
      `}
    </div>`;
}

async function handleCreate(ev) {
  ev.preventDefault();
  const nomGroupe   = document.getElementById("d-nom").value.trim();
  const typeGroupe  = document.getElementById("d-type").value;
  const lienDossier = document.getElementById("d-lien").value.trim();
  const description = document.getElementById("d-desc").value.trim();

  if (!nomGroupe || !typeGroupe || !lienDossier) {
    showToast("Remplis tous les champs obligatoires.", "error"); return;
  }

  const btn = document.getElementById("d-submit");
  btn.disabled = true; btn.textContent = "Création…";

  try {
    await createDossier({ nomGroupe, typeGroupe, lienDossier, description });
    showToast("Dossier créé.", "success");
    closeModal();
  } catch (err) {
    showToast("Erreur lors de la création.", "error"); console.error(err);
  } finally {
    btn.disabled = false; btn.textContent = "Créer le dossier";
  }
}

window.handleVote = async (id) => {
  const d = allDossiers.find(x => x.id === id);
  if (!d) return;
  try {
    await voteDossier(id, d, d.votes || []);
    showToast("Vote enregistré.", "success");
  } catch (err) {
    showToast("Erreur lors du vote.", "error"); console.error(err);
  }
};

window.handleArchive = async (id, decision) => {
  const d  = allDossiers.find(x => x.id === id);
  const ok = await confirmModal(
    `${decision} le dossier ?`,
    `Cette action est irréversible. Le dossier sera archivé.`,
    decision
  );
  if (!ok) return;
  try {
    await archiveDossier(id, d, decision);
    showToast(`Dossier ${decision.toLowerCase()}.`, "success");
  } catch (err) {
    showToast("Erreur.", "error"); console.error(err);
  }
};

window.handleDeleteDossier = async (id, nom) => {
  const ok = await confirmModal("Supprimer", `Supprimer définitivement <strong>${nom}</strong> ?`, "Supprimer");
  if (!ok) return;
  try {
    await deleteDossier(id);
    showToast("Dossier supprimé.", "success");
  } catch (err) {
    showToast("Erreur.", "error"); console.error(err);
  }
};

function esc(str) { return String(str).replace(/'/g, "\\'").replace(/"/g, "&quot;"); }
