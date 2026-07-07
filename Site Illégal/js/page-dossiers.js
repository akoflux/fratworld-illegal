import { requireAuth, getCurrentUser, isAdmin, isSpectateur } from "./auth.js";
import {
  subscribeDossiers, createDossier, voteDossier,
  validerEntretien, validerInstallation, refuserDossier, setDossierStatut, deleteDossier
} from "./dossiers.js";
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

// Statut → badge HTML
const STATUS_BADGE = {
  "En attente d'étude":        `<span class="badge badge-debate">En attente d'étude</span>`,
  "En attente d'entretien":    `<span class="badge badge-valid">En attente d'entretien</span>`,
  "En attente d'installation": `<span class="badge" style="background:rgba(96,165,250,.15);color:#60a5fa;border:1px solid rgba(96,165,250,.3)">En attente d'installation</span>`,
  "Faction créée":             `<span class="badge badge-valid">✅ Faction créée</span>`,
  "Refusé":                    `<span class="badge badge-refused">Refusé</span>`,
  "En cours":                  `<span class="badge badge-debate">En cours</span>` // legacy
};

function dossierCard(d, isArchive) {
  const uid = getCurrentUser()?.uid;

  const votesFor     = d.votesFor     || d.votes || [];
  const votesAgainst = d.votesAgainst || [];
  const reasons      = d.votesAgainstReasons || {};

  const countFor     = votesFor.length;
  const countAgainst = votesAgainst.length;

  const hasVotedFor     = votesFor.includes(uid);
  const hasVotedAgainst = votesAgainst.includes(uid);
  const hasVoted        = hasVotedFor || hasVotedAgainst;

  const admin     = isAdmin();
  const statut    = d.statut || "En attente d'étude";
  const statusBadge = STATUS_BADGE[statut] || `<span class="badge">${statut}</span>`;

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
  const thresholdReached = countFor >= VOTES_NEEDED_COUNT;

  // Raisons des votes contre
  const reasonTexts = votesAgainst
    .map(u => reasons[u] ? `<div class="vote-reason-item">👎 <em class="vote-reason-text">"${esc(reasons[u])}"</em></div>` : "")
    .filter(Boolean).join("");
  const reasonsHtml = reasonTexts
    ? `<div class="dossier-against-reasons">${reasonTexts}</div>`
    : "";

  // Boutons de vote (seulement pour "En attente d'étude")
  const canVote = !isArchive && !deadlineExpired && !isSpectateur() && statut === "En attente d'étude";
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

  // Boutons admin selon l'étape du workflow
  let adminHtml = "";
  if (!isArchive && admin) {
    if (statut === "En attente d'entretien") {
      adminHtml = `
        <button class="btn btn-sm" style="background:var(--s-valid-bg);color:var(--s-valid);border:1px solid var(--s-valid-border)"
          onclick="handleValiderEntretien('${d.id}')">✅ Valider l'entretien</button>
        <button class="btn btn-sm" style="background:var(--s-refused-bg);color:var(--s-refused);border:1px solid var(--s-refused-border)"
          onclick="handleRefuser('${d.id}')">❌ Refuser</button>`;
    } else if (statut === "En attente d'installation") {
      adminHtml = `
        <button class="btn btn-sm" style="background:var(--s-valid-bg);color:var(--s-valid);border:1px solid var(--s-valid-border)"
          onclick="handleValiderInstallation('${d.id}')">🏴 Créer la faction</button>
        <button class="btn btn-sm" style="background:var(--s-refused-bg);color:var(--s-refused);border:1px solid var(--s-refused-border)"
          onclick="handleRefuser('${d.id}')">❌ Refuser</button>`;
    }
    adminHtml += `<button class="btn-icon danger" title="Supprimer" onclick="handleDeleteDossier('${d.id}','${esc(d.nomGroupe)}')">✕</button>`;
  }

  // Section vote complète ou résumé archive
  let voteSection = "";
  if (!isArchive) {
    const showVoteBars = statut === "En attente d'étude" || statut === "En cours";
    voteSection = `
      <div class="vote-section">
        ${deadlineHtml}
        ${showVoteBars ? `
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
          ${thresholdReached ? `<div style="font-size:.78rem;color:var(--s-valid);margin-bottom:6px">✓ Seuil atteint</div>` : ""}
        ` : `<div style="font-size:.78rem;color:var(--text-muted);margin-bottom:8px">
          Votes : ${countFor} pour · ${countAgainst} contre
        </div>`}
        ${voteButtonsHtml}
        ${adminHtml ? `<div class="vote-btns" style="margin-top:8px">${adminHtml}</div>` : ""}
        ${!isSpectateur() ? manualControlHtml(d.id, statut) : ""}
      </div>`;
  } else {
    voteSection = `
      <div class="vote-section" style="font-size:.78rem;color:var(--text-muted)">
        Archivé le ${formatDate(d.archivedAt)} par ${esc(d.archivedBy || "—")}
        · ${countFor} vote(s) pour · ${countAgainst} vote(s) contre
        ${d.refusalReason ? `<div style="margin-top:6px;color:var(--s-refused)">Motif : <em>${esc(d.refusalReason)}</em></div>` : ""}
        ${d.factionId ? `<div style="margin-top:4px"><a href="/faction-detail.html?id=${d.factionId}" class="btn btn-sm btn-secondary" style="font-size:.75rem">🏴 Voir la faction</a></div>` : ""}
      </div>`;
  }

  return `
    <div class="dossier-card ${isArchive ? "archived" : ""}">
      <div class="dossier-header">
        <div>
          <div class="dossier-title">${esc(d.nomGroupe)}</div>
          <div style="font-size:.75rem;color:var(--text-muted);margin-top:3px">
            ${esc(d.typeGroupe)} · Déposé par ${esc(d.authorName)} · ${formatDate(d.createdAt)}
          </div>
          ${d.contactName ? `<div style="font-size:.75rem;color:var(--text-secondary);margin-top:2px">
            👤 ${esc(d.contactName)}${d.contactDiscord ? ` · ${esc(d.contactDiscord)}` : ""}
          </div>` : ""}
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
      ${voteSection}
    </div>`;
}

async function handleCreate(ev) {
  ev.preventDefault();
  const nomGroupe      = document.getElementById("d-nom").value.trim();
  const typeGroupe     = document.getElementById("d-type").value;
  const lienDossier    = document.getElementById("d-lien").value.trim();
  const description    = document.getElementById("d-desc").value.trim();
  const voteDeadline   = document.getElementById("d-deadline")?.value || null;
  const contactName    = document.getElementById("d-contact-name").value.trim();
  const contactDiscord = document.getElementById("d-contact-discord").value.trim();

  if (!nomGroupe || !typeGroupe || !lienDossier || !contactName) {
    showToast("Remplis tous les champs obligatoires.", "error"); return;
  }

  // Détection re-soumission
  const refused = allDossiers.filter(d => d.statut === "Refusé" && d.archived);
  const nomLower = nomGroupe.toLowerCase();
  const match = refused.find(d =>
    d.nomGroupe?.toLowerCase() === nomLower ||
    (contactDiscord && d.contactDiscord && d.contactDiscord.toLowerCase() === contactDiscord.toLowerCase())
  );
  if (match) {
    const warning = `
      ⚠️ Ce groupe ou ce contact a déjà été refusé.<br>
      <strong>Motif :</strong> ${match.refusalReason || "Non précisé"}<br>
      <strong>Refusé le :</strong> ${formatDate(match.archivedAt)}<br><br>
      Veux-tu quand même créer ce dossier ?`;
    const ok = await confirmModal("Dossier déjà refusé", warning, "Créer quand même");
    if (!ok) return;
  }

  const btn = document.getElementById("d-submit");
  btn.disabled = true; btn.textContent = "Création…";

  try {
    await createDossier({ nomGroupe, typeGroupe, lienDossier, description, voteDeadline, contactName, contactDiscord });
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

window.handleValiderEntretien = async (id) => {
  const ok = await confirmModal("Valider l'entretien ?", "Le dossier passera en <strong>En attente d'installation</strong>.", "Valider");
  if (!ok) return;
  try {
    await validerEntretien(id);
    showToast("Entretien validé.", "success");
  } catch (err) {
    showToast("Erreur.", "error"); console.error(err);
  }
};

window.handleValiderInstallation = async (id) => {
  const d  = allDossiers.find(x => x.id === id);
  if (!d) return;
  const ok = await confirmModal(
    "Créer la faction ?",
    `La faction <strong>${esc(d.nomGroupe)}</strong> sera automatiquement créée dans l'onglet Factions.`,
    "Créer la faction"
  );
  if (!ok) return;
  try {
    const factionId = await validerInstallation(id, d);
    showToast(`Faction créée ! <a href="/faction-detail.html?id=${factionId}" style="color:#22c55e;text-decoration:underline">Voir la faction →</a>`, "success");
  } catch (err) {
    showToast("Erreur.", "error"); console.error(err);
  }
};

window.handleRefuser = async (id) => {
  const d = allDossiers.find(x => x.id === id);
  if (!d) return;
  const result = await promptReason("❌ Motif de refus", "Ex : Manque de cohérence RP, groupe déjà existant…");
  if (!result.ok) return;
  try {
    await refuserDossier(id, d, result.reason);
    showToast("Dossier refusé et archivé.", "success");
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

const ALL_STATUTS = [
  "En attente d'étude",
  "En attente d'entretien",
  "En attente d'installation"
];

function manualControlHtml(id, currentStatut) {
  const targets = ALL_STATUTS.filter(s => s !== currentStatut);
  return `
    <details class="manual-ctrl" style="margin-top:10px">
      <summary>⚙ Contrôle manuel (admin)</summary>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">
        ${targets.map(s => `
          <button class="btn btn-sm" style="font-size:.75rem;background:var(--bg-surface)"
            onclick="handleSetStatut('${id}','${s}')">
            Passer à : <em>${s}</em>
          </button>`).join("")}
        <button class="btn btn-sm" style="font-size:.75rem;background:var(--s-refused-bg);color:var(--s-refused)"
          onclick="handleRefuser('${id}')">
          ❌ Refuser (archiver)
        </button>
      </div>
    </details>`;
}

window.handleSetStatut = async (id, statut) => {
  const ok = await confirmModal(
    "Modifier le statut manuellement",
    `Passer ce dossier en <strong>${statut}</strong> ?<br><small style="color:var(--text-muted)">Cette action ignore le workflow automatique.</small>`,
    "Confirmer"
  );
  if (!ok) return;
  try {
    await setDossierStatut(id, statut);
    showToast("Statut mis à jour.", "success");
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
