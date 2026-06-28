import { requireAuth, getCurrentUser, isAdmin, isSpectateur } from "./auth.js";
import { subscribeDossiers, createDossier, voteDossier, archiveDossier, deleteDossier } from "./dossiers.js";
import { loadSettings, getVotesNeeded } from "./settings.js";
import { renderNavbar, showToast, confirmModal, promptReason, formatDate } from "./ui-shared.js";

let allDossiers        = [];
let showArchived       = false;
let unsubscribe        = null;
let VOTES_NEEDED_COUNT = 3;

requireAuth(async () => {
  renderNavbar("dossiers");

  const settings     = await loadSettings();
  VOTES_NEEDED_COUNT = getVotesNeeded(settings);

  const threshEl   = document.getElementById("dossier-threshold");
  const refCountEl = document.getElementById("dossier-ref-count");
  if (threshEl)   threshEl.textContent   = VOTES_NEEDED_COUNT;
  if (refCountEl) refCountEl.textContent = settings.referentCount;

  unsubscribe = subscribeDossiers(dossiers => {
    allDossiers = dossiers;
    renderDossiers();
  });

  if (isSpectateur()) {
    document.getElementById("new-dossier-btn").style.display = "none";
  }

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
  const uid = getCurrentUser()?.uid;

  // Backward compat : anciens docs n'ont que `votes`
  const votesFor     = d.votesFor     || d.votes || [];
  const votesAgainst = d.votesAgainst || [];
  const reasons      = d.votesAgainstReasons || {};

  const countFor     = votesFor.length;
  const countAgainst = votesAgainst.length;

  const hasVotedFor     = votesFor.includes(uid);
  const hasVotedAgainst = votesAgainst.includes(uid);
  const hasVoted        = hasVotedFor || hasVotedAgainst;

  const thresholdReached = countFor >= VOTES_NEEDED_COUNT;
  const admin            = isAdmin();

  // Deadline
  let deadlineHtml    = "";
  let deadlineExpired = false;
  if (d.voteDeadline) {
    const dl = new Date(d.voteDeadline);
    deadlineExpired = dl < new Date();
    const dlStr = dl.toLocaleDateString("fr-FR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    }).replace(",", " à");
    deadlineHtml = `<div class="vote-deadline${deadlineExpired ? " expired" : ""}">
      ⏰ ${deadlineExpired ? "Vote clôturé le" : "Deadline :"} ${dlStr}
    </div>`;
  }

  // Barres de vote
  const pctFor     = Math.min(100, Math.round(countFor     / VOTES_NEEDED_COUNT * 100));
  const pctAgainst = Math.min(100, Math.round(countAgainst / VOTES_NEEDED_COUNT * 100));

  const statusBadge = {
    "En cours":               `<span class="badge badge-debate">En cours</span>`,
    "En attente d'entretien": `<span class="badge badge-valid">En attente d'entretien</span>`,
    "Validé":                 `<span class="badge badge-valid">Validé</span>`,
    "Refusé":                 `<span class="badge badge-refused">Refusé</span>`
  }[d.statut] || `<span class="badge">${d.statut}</span>`;

  // Raisons des votes contre
  const reasonTexts = votesAgainst
    .map(u => reasons[u] ? `<div class="vote-reason-item">👎 <em class="vote-reason-text">"${esc(reasons[u])}"</em></div>` : "")
    .filter(Boolean).join("");
  const reasonsHtml = reasonTexts
    ? `<div class="dossier-against-reasons">${reasonTexts}</div>`
    : "";

  // Boutons de vote (non affiché si archivé, deadline expirée ou spectateur)
  const canVote = !isArchive && !deadlineExpired && !isSpectateur();
  let voteButtonsHtml = "";
  if (canVote) {
    if (!hasVoted) {
      voteButtonsHtml = `
        <div class="vote-btns" style="margin-top:10px">
          <button class="btn vote-btn" onclick="handleVote('${d.id}','for')">👍 Voter Pour</button>
          <button class="btn vote-btn" onclick="handleVote('${d.id}','against')">👎 Voter Contre</button>
        </div>`;
    } else if (hasVotedFor) {
      voteButtonsHtml = `
        <div class="vote-btns" style="margin-top:10px">
          <button class="btn vote-btn vote-btn-active-for" disabled>👍 Voté Pour ✓</button>
          <button class="btn vote-btn" onclick="handleVote('${d.id}','against')">👎 Changer → Contre</button>
        </div>`;
    } else {
      voteButtonsHtml = `
        <div class="vote-btns" style="margin-top:10px">
          <button class="btn vote-btn" onclick="handleVote('${d.id}','for')">👍 Changer → Pour</button>
          <button class="btn vote-btn vote-btn-active-against" disabled>👎 Voté Contre ✓</button>
        </div>`;
    }
  }

  // Boutons admin
  let adminHtml = "";
  if (!isArchive && admin) {
    if (thresholdReached) {
      adminHtml += `
        <button class="btn btn-sm" style="background:var(--s-valid-bg);color:var(--s-valid);border:1px solid var(--s-valid-border)"
          onclick="handleArchive('${d.id}','Validé')">✅ Valider</button>
        <button class="btn btn-sm" style="background:var(--s-refused-bg);color:var(--s-refused);border:1px solid var(--s-refused-border)"
          onclick="handleArchive('${d.id}','Refusé')">❌ Refuser</button>`;
    }
    adminHtml += `<button class="btn-icon danger" title="Supprimer" onclick="handleDeleteDossier('${d.id}','${esc(d.nomGroupe)}')">✕</button>`;
  }

  return `
    <div class="dossier-card ${isArchive ? "archived" : ""}">
      <div class="dossier-header">
        <div>
          <div class="dossier-title">${esc(d.nomGroupe)}</div>
          <div style="font-size:.75rem;color:var(--text-muted);margin-top:3px">
            ${esc(d.typeGroupe)} · Déposé par ${esc(d.authorName)} · ${formatDate(d.createdAt)}
          </div>
        </div>
        ${statusBadge}
      </div>
      <div class="dossier-body">
        ${d.description ? `<div class="dossier-desc">${esc(d.description)}</div>` : ""}
        <a href="${d.lienDossier}" target="_blank" rel="noopener"
           class="btn btn-secondary btn-sm" style="width:fit-content">
          📄 Voir le dossier
        </a>
      </div>

      ${!isArchive ? `
        <div class="vote-section">
          ${deadlineHtml}
          <div class="vote-bars" style="margin-bottom:8px">
            <div class="vote-bar-row">
              <span class="vote-bar-label">👍 Pour</span>
              <div class="vote-bar-track">
                <div class="vote-bar-fill vote-for ${thresholdReached ? "done" : ""}" style="width:${pctFor}%"></div>
              </div>
              <span class="vote-bar-count">${countFor}/${VOTES_NEEDED_COUNT}</span>
            </div>
            <div class="vote-bar-row">
              <span class="vote-bar-label">👎 Contre</span>
              <div class="vote-bar-track">
                <div class="vote-bar-fill vote-against" style="width:${pctAgainst}%"></div>
              </div>
              <span class="vote-bar-count">${countAgainst}</span>
            </div>
          </div>
          ${reasonsHtml}
          ${thresholdReached ? `<div style="font-size:.78rem;color:var(--s-valid);margin-bottom:6px">✓ Seuil atteint — en attente de décision admin</div>` : ""}
          ${voteButtonsHtml}
          ${adminHtml ? `<div class="vote-btns" style="margin-top:8px">${adminHtml}</div>` : ""}
        </div>
      ` : `
        <div class="vote-section" style="font-size:.78rem;color:var(--text-muted)">
          Archivé le ${formatDate(d.archivedAt)} par ${esc(d.archivedBy || "—")}
          · ${countFor} vote(s) pour · ${countAgainst} vote(s) contre
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
  const voteDeadline = document.getElementById("d-deadline")?.value || null;

  if (!nomGroupe || !typeGroupe || !lienDossier) {
    showToast("Remplis tous les champs obligatoires.", "error"); return;
  }

  const btn = document.getElementById("d-submit");
  btn.disabled = true; btn.textContent = "Création…";

  try {
    await createDossier({ nomGroupe, typeGroupe, lienDossier, description, voteDeadline });
    showToast("Dossier créé.", "success");
    closeModal();
  } catch (err) {
    showToast("Erreur lors de la création.", "error"); console.error(err);
  } finally {
    btn.disabled = false; btn.textContent = "Créer le dossier";
  }
}

window.handleVote = async (id, direction) => {
  const d = allDossiers.find(x => x.id === id);
  if (!d) return;

  // Demander la raison avant d'envoyer le vote
  let reason = "";
  if (direction === "against") {
    const result = await promptReason("👎 Voter Contre");
    if (!result.ok) return;
    reason = result.reason;
  }

  try {
    await voteDossier(id, d, direction, reason);
    showToast("Vote enregistré.", "success");
  } catch (err) {
    showToast(err.message || "Erreur lors du vote.", "error"); console.error(err);
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

function esc(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/'/g, "\\'");
}
