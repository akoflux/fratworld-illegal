import { requireAuth, getCurrentUser, isAdmin, isSpectateur } from "./auth.js";
import {
  subscribeDossiers, createDossier, voteDossier,
  changerStatutDossier, deleteDossier
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

  document.getElementById("dossier-form").addEventListener("submit", handleCreate);
  document.getElementById("toggle-archived").addEventListener("click", () => {
    showArchived = !showArchived;
    document.getElementById("toggle-archived").textContent = showArchived ? "Masquer l'historique" : "Voir l'historique";
    renderDossiers();
  });

  // Installation modal form
  document.getElementById("installation-form")?.addEventListener("submit", handleInstallationSubmit);
});

window.addEventListener("beforeunload", () => { if (unsubscribe) unsubscribe(); });

// ── Statuts ───────────────────────────────────────────────────

const STATUS_BADGE = {
  "En attente d'étude":        `<span class="badge badge-debate">En attente d'étude</span>`,
  "En attente d'entretien":    `<span class="badge badge-valid">En attente d'entretien</span>`,
  "En attente d'installation": `<span class="badge" style="background:rgba(96,165,250,.15);color:#60a5fa;border:1px solid rgba(96,165,250,.3)">En attente d'installation</span>`,
  "Installation faite":        `<span class="badge badge-valid">✅ Installation faite</span>`,
  "Faction créée":             `<span class="badge badge-valid">✅ Faction créée</span>`,
  "Refusé":                    `<span class="badge badge-refused">Refusé</span>`,
  "En cours":                  `<span class="badge badge-debate">En cours</span>`
};

const STATUS_PICK_OPTS = [
  { value: "En attente d'étude",        label: "⏳ En attente d'étude",         cls: "" },
  { value: "En attente d'entretien",    label: "📅 En attente d'entretien",     cls: "" },
  { value: "En attente d'installation", label: "🔧 En attente d'installation",  cls: "" },
  { value: "Installation faite",        label: "✅ Installation faite",          cls: "success" },
  { value: "Refusé",                    label: "❌ Refuser (archiver)",           cls: "danger" }
];

// ── Render ────────────────────────────────────────────────────

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

  const votesFor     = d.votesFor     || d.votes || [];
  const votesAgainst = d.votesAgainst || [];
  const reasons      = d.votesAgainstReasons || {};

  const countFor     = votesFor.length;
  const countAgainst = votesAgainst.length;
  const hasVotedFor     = votesFor.includes(uid);
  const hasVotedAgainst = votesAgainst.includes(uid);
  const hasVoted        = hasVotedFor || hasVotedAgainst;

  const statut   = d.statut || "En attente d'étude";
  const isUrgent = !isArchive && (statut === "En attente d'étude" || statut === "En cours");
  const canChange = !isArchive && !isSpectateur();

  // Badge statut : cliquable ou statique
  const badgeInner = STATUS_BADGE[statut] || `<span class="badge">${statut}</span>`;
  const statusHtml = canChange
    ? `<button class="dossier-status-btn" onclick="openStatusPicker('${d.id}',event)" title="Changer le statut">
         ${badgeInner}
         <span class="dossier-status-caret">▾</span>
       </button>`
    : badgeInner;

  // Deadline
  let deadlineHtml = "";
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

  const reasonTexts = votesAgainst
    .map(u => reasons[u] ? `<div class="vote-reason-item">👎 <em class="vote-reason-text">"${esc(reasons[u])}"</em></div>` : "")
    .filter(Boolean).join("");
  const reasonsHtml = reasonTexts ? `<div class="dossier-against-reasons">${reasonTexts}</div>` : "";

  // Boutons de vote (uniquement en attente d'étude)
  const canVote = !isArchive && !deadlineExpired && !isSpectateur()
    && (statut === "En attente d'étude" || statut === "En cours");
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

  // Bouton suppression (admin seulement)
  const deleteBtn = isAdmin() && !isArchive
    ? `<div style="display:flex;justify-content:flex-end;margin-top:8px">
         <button class="btn-icon danger" title="Supprimer" onclick="handleDeleteDossier('${d.id}')">✕</button>
       </div>`
    : "";

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
          ${thresholdReached ? `<div style="font-size:.78rem;color:var(--s-valid);margin-bottom:6px">✓ Seuil atteint — avancez via le badge de statut</div>` : ""}
        ` : `<div style="font-size:.78rem;color:var(--text-muted);margin-bottom:8px">
          Votes : ${countFor} pour · ${countAgainst} contre
        </div>`}
        ${voteButtonsHtml}
        ${deleteBtn}
      </div>`;
  } else {
    voteSection = `
      <div class="vote-section" style="font-size:.78rem;color:var(--text-muted)">
        Archivé le ${formatDate(d.archivedAt)} · ${esc(d.archivedBy || "—")}
        · ${countFor} vote(s) pour · ${countAgainst} vote(s) contre
        ${d.refusalReason ? `<div style="margin-top:6px;color:var(--s-refused)">Motif : <em>${esc(d.refusalReason)}</em></div>` : ""}
        ${d.factionId ? `<div style="margin-top:4px"><a href="/faction-detail.html?id=${d.factionId}" class="btn btn-sm btn-secondary" style="font-size:.75rem">🏴 Voir la faction</a></div>` : ""}
      </div>`;
  }

  return `
    <div class="dossier-card ${isArchive ? "archived" : ""} ${isUrgent ? "dossier-card-urgent" : ""}">
      <div class="dossier-header">
        <div>
          <div class="dossier-title">${esc(d.nomGroupe)}</div>
          <div style="font-size:.75rem;color:var(--text-muted);margin-top:3px">
            ${esc(d.typeGroupe)} · Déposé par ${esc(d.authorName)} · ${formatDate(d.createdAt)}
          </div>
          ${d.contactName ? `<div style="font-size:.75rem;color:var(--text-secondary);margin-top:2px">
            👤 ${esc(d.contactName)}${d.contactDiscord ? ` · ${esc(d.contactDiscord)}` : ""}
          </div>` : ""}
          ${isUrgent ? `<span class="dossier-urgent-badge">⚡ Vote urgent</span>` : ""}
        </div>
        ${statusHtml}
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

// ── Status picker ─────────────────────────────────────────────

window.openStatusPicker = function(id, event) {
  event.stopPropagation();

  const d = allDossiers.find(x => x.id === id);
  if (!d) return;
  const currentStatut = d.statut || "En attente d'étude";

  const picker = document.getElementById("status-picker");
  const rect   = event.currentTarget.getBoundingClientRect();

  picker.innerHTML = STATUS_PICK_OPTS
    .filter(o => o.value !== currentStatut)
    .map(o => `<button class="status-pick-btn ${o.cls}" data-statut="${o.value}" data-id="${id}">
      ${o.label}
    </button>`)
    .join("");

  picker.querySelectorAll(".status-pick-btn").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      window.closeStatusPicker();
      window.handlePickStatus(btn.dataset.id, btn.dataset.statut);
    });
  });

  // Positionnement : évite de sortir du viewport
  const pickerW = 250;
  let left = rect.left;
  if (left + pickerW > window.innerWidth - 8) left = window.innerWidth - pickerW - 8;

  picker.style.top     = (rect.bottom + 4) + "px";
  picker.style.left    = left + "px";
  picker.style.display = "block";

  setTimeout(() => {
    document.addEventListener("click", window.closeStatusPicker, { once: true });
  }, 0);
};

window.closeStatusPicker = function() {
  const p = document.getElementById("status-picker");
  if (p) p.style.display = "none";
};

window.handlePickStatus = async (id, newStatut) => {
  const d = allDossiers.find(x => x.id === id);
  if (!d) return;

  if (newStatut === "Refusé") {
    const result = await promptReason("❌ Motif de refus", "Ex : Manque de cohérence RP, groupe déjà existant…");
    if (!result.ok) return;
    try {
      await changerStatutDossier(id, d, "Refusé", { reason: result.reason });
      showToast("Dossier refusé et archivé.", "success");
    } catch (err) {
      showToast("Erreur.", "error"); console.error(err);
    }
    return;
  }

  if (newStatut === "Installation faite") {
    openInstallationModal(id, d);
    return;
  }

  const ok = await confirmModal(
    "Modifier le statut",
    `Passer ce dossier en <strong>${newStatut}</strong> ?`,
    "Confirmer"
  );
  if (!ok) return;

  try {
    await changerStatutDossier(id, d, newStatut, {});
    showToast("Statut mis à jour.", "success");
  } catch (err) {
    showToast("Erreur.", "error"); console.error(err);
  }
};

// ── Modal installation faction ────────────────────────────────

let installId      = null;
let installDossier = null;

function openInstallationModal(id, dossier) {
  installId      = id;
  installDossier = dossier;

  const nomEl = document.getElementById("inst-nom-groupe");
  if (nomEl) nomEl.textContent = dossier.nomGroupe;

  document.getElementById("inst-lead").value     = dossier.contactName || "";
  document.getElementById("inst-colead").value   = "";
  document.getElementById("inst-business").value = "";
  document.getElementById("inst-notes").value    = "";

  document.getElementById("installation-modal").style.display   = "block";
  document.getElementById("installation-overlay").style.display = "block";
}

window.cancelInstallation = function() {
  document.getElementById("installation-modal").style.display   = "none";
  document.getElementById("installation-overlay").style.display = "none";
};

async function handleInstallationSubmit(ev) {
  ev.preventDefault();

  const lead     = document.getElementById("inst-lead").value.trim();
  const coLead   = document.getElementById("inst-colead").value.trim();
  const business = document.getElementById("inst-business").value.trim();
  const notes    = document.getElementById("inst-notes").value.trim();

  window.cancelInstallation();

  const id      = installId;
  const dossier = installDossier;

  try {
    const factionId = await changerStatutDossier(id, dossier, "Installation faite", {
      lead, coLead, business, notes
    });
    showToast(
      factionId
        ? `Faction créée ! <a href="/faction-detail.html?id=${factionId}" style="color:#22c55e;text-decoration:underline">Voir la faction →</a>`
        : "Faction créée.",
      "success"
    );
  } catch (err) {
    showToast("Erreur lors de la création de la faction.", "error"); console.error(err);
  }
}

// ── Votes ─────────────────────────────────────────────────────

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

// ── Création dossier ──────────────────────────────────────────

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
  const refused  = allDossiers.filter(d => d.statut === "Refusé" && d.archived);
  const nomLower = nomGroupe.toLowerCase();
  const match    = refused.find(d =>
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
    // Fermer le modal création
    document.getElementById("dossier-modal").style.display   = "none";
    document.getElementById("dossier-modal-overlay").style.display = "none";
    document.getElementById("dossier-form").reset();
  } catch (err) {
    showToast("Erreur lors de la création.", "error"); console.error(err);
  } finally {
    btn.disabled = false; btn.textContent = "Créer le dossier";
  }
}

// ── Suppression ───────────────────────────────────────────────

window.handleDeleteDossier = async (id) => {
  const d   = allDossiers.find(x => x.id === id);
  const nom = d?.nomGroupe || id;
  const ok  = await confirmModal("Supprimer", `Supprimer définitivement <strong>${esc(nom)}</strong> ?`, "Supprimer");
  if (!ok) return;
  try {
    await deleteDossier(id);
    showToast("Dossier supprimé.", "success");
  } catch (err) {
    showToast("Erreur.", "error"); console.error(err);
  }
};

// ── Utilitaire ────────────────────────────────────────────────

function esc(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
