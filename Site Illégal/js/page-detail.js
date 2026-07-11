import { requireAuth, canEdit, isAdmin, isSpectateur, getCurrentUser, getCurrentUserData, getUserNames } from "./auth.js";
import { getEntry, getHistory, archiveEntry, voteEntry, togglePin } from "./entries.js";
import { loadSettings, getVotesNeeded } from "./settings.js";
import {
  renderNavbar, showToast, confirmModal, promptReason, formatDate,
  statusBadge, catBadge, factionBadges, normalizeFactions, getParam, showSpinner
} from "./ui-shared.js";

let entry    = null;
let VOTES_NEEDED = 3;

requireAuth(async () => {
  const section = getParam("section") || "decisions";
  renderNavbar(section);

  const id = getParam("id");
  if (!id) { window.location.href = "/entries.html"; return; }

  showSpinner("entry-main");

  try {
    const [e, settings] = await Promise.all([getEntry(id), loadSettings()]);
    VOTES_NEEDED = getVotesNeeded(settings);
    entry = e;
    if (!entry) { window.location.href = "/entries.html"; return; }
    if (entry.section && entry.section !== section) renderNavbar(entry.section);
    renderEntry(entry);
    loadHistory(id);
  } catch (err) {
    console.error(err);
    showToast("Erreur lors du chargement.", "error");
  }
});

function renderEntry(e) {
  document.title = `${e.title} — FratWorld Staff`;
  document.getElementById("breadcrumb-title").textContent = e.title;

  const actionsEl = document.getElementById("entry-actions");
  if (canEdit(e)) {
    const pinLabel = e.pinned ? "Désépingler" : "Épingler";
    actionsEl.innerHTML = `
      <button class="pin-btn ${e.pinned ? "pinned" : ""}" id="pin-btn" title="${pinLabel}">📌 ${pinLabel}</button>
      <a href="/entry-form.html?id=${e.id}&section=${e.section||'decisions'}" class="btn btn-secondary">✎ Modifier</a>
      <button class="btn btn-danger" id="delete-btn">✕ Supprimer</button>
    `;
    document.getElementById("pin-btn").addEventListener("click", handlePin);
    document.getElementById("delete-btn").addEventListener("click", handleDelete);
  }

  const replaced  = !!e.replacedBy;
  const factions  = normalizeFactions(e.factions || e.faction);
  const facHtml   = factionBadges(factions);
  const isPropo   = (e.section === "propositions");

  document.getElementById("entry-main").innerHTML = `
    <div class="detail-header">
      <div class="detail-header-left">
        <h1 class="detail-title">${escapeHtml(e.title)}</h1>
        <div class="detail-meta-row">
          ${statusBadge(e.status, replaced)}
          ${catBadge(e.category)}
          ${facHtml}
          ${e.pinned ? `<span class="pinned-badge">📌 Épinglé</span>` : ""}
        </div>
      </div>
      <div class="detail-actions print-hidden">
        <button class="btn btn-secondary" onclick="window.print()" title="Exporter en PDF">🖨 Exporter PDF</button>
        ${isAdmin() ? `<a href="/communique.html?from=${e.id}" class="btn btn-secondary" title="Créer un communiqué">📄 Communiqué</a>` : ""}
      </div>
    </div>

    ${e.replaces ? `
      <div class="detail-card" style="margin-bottom:14px;border-left:3px solid var(--s-debate)">
        <div class="card-content" style="padding:14px 18px;font-size:.85rem;color:var(--text-secondary)">
          ⬆ Cette entrée <strong>remplace</strong> :
          <a href="/entry-detail.html?id=${e.replaces}&section=${e.section||'decisions'}">${escapeHtml(e.replacesTitle || e.replaces)}</a>
        </div>
      </div>
    ` : ""}
    ${e.replacedBy ? `
      <div class="detail-card" style="margin-bottom:14px;border-left:3px solid var(--s-replaced)">
        <div class="card-content" style="padding:14px 18px;font-size:.85rem;color:var(--text-muted)">
          ⚠ Cette entrée est <strong>remplacée par</strong> :
          <a href="/entry-detail.html?id=${e.replacedBy}&section=${e.section||'decisions'}">${escapeHtml(e.replacedByTitle || e.replacedBy)}</a>
        </div>
      </div>
    ` : ""}

    <div class="detail-card">
      <div class="card-header-bar"><h3>Informations</h3></div>
      <div class="card-content">
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Auteur</div>
            <div class="info-value">${escapeHtml(e.authorName)}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Créée le</div>
            <div class="info-value">${formatDate(e.createdAt)}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Modifiée le</div>
            <div class="info-value">${formatDate(e.updatedAt)}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Statut</div>
            <div class="info-value">${statusBadge(e.status, replaced)}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Factions</div>
            <div class="info-value">${facHtml || "Aucune"}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Catégorie</div>
            <div class="info-value">${escapeHtml(e.category)}</div>
          </div>
          ${Array.isArray(e.tags) && e.tags.length ? `
          <div class="info-item" style="grid-column:1/-1">
            <div class="info-label">Tags</div>
            <div class="info-value" style="display:flex;flex-wrap:wrap;gap:5px;margin-top:2px">
              ${e.tags.map(t => `<span class="tag-chip" style="cursor:default">${escapeHtml(t)}</span>`).join("")}
            </div>
          </div>` : ""}
        </div>
      </div>
    </div>

    ${isPropo && e.documentUrl ? `
      <div class="detail-card" style="border-left:3px solid var(--accent,#c0392b)">
        <div class="card-header-bar"><h3>📎 Document joint</h3></div>
        <div class="card-content" style="padding:14px 18px">
          <a href="${e.documentUrl}" target="_blank" rel="noopener" class="btn btn-primary" style="width:fit-content">
            📄 Consulter le document →
          </a>
        </div>
      </div>
    ` : ""}

    ${e.description ? `
      <div class="detail-card">
        <div class="card-header-bar"><h3>Description</h3></div>
        <div class="card-content">
          <div class="detail-description">${escapeHtml(e.description)}</div>
        </div>
      </div>
    ` : ""}

    ${isPropo ? renderVoteSection(e) : ""}

    <div class="detail-card print-hidden" id="history-card">
      <div class="card-header-bar"><h3>Historique des modifications</h3></div>
      <div id="history-body">
        <div class="spinner-wrap"><div class="spinner"></div></div>
      </div>
    </div>
  `;

  if (isPropo) {
    setupVoteButtons(e);
    loadVoteNames(e);
  }
}

// ── Vote ──────────────────────────────────────────────────────

function renderVoteSection(e) {
  const votesFor     = e.votesFor     || [];
  const votesAgainst = e.votesAgainst || [];
  const votesAbstain = e.votesAbstain || [];

  const uid = getCurrentUser()?.uid;
  const hasVotedFor     = votesFor.includes(uid);
  const hasVotedAgainst = votesAgainst.includes(uid);
  const hasAbstained    = votesAbstain.includes(uid);
  const isClosed = e.status === "Validé" || e.status === "Refusé";

  // Vérification deadline
  let deadlineHtml = "";
  let deadlineExpired = false;
  if (e.voteDeadline) {
    const dl = new Date(e.voteDeadline);
    deadlineExpired = dl < new Date();
    const dlStr = dl.toLocaleDateString("fr-FR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    }).replace(",", " à");
    deadlineHtml = `<div class="vote-deadline ${deadlineExpired ? "expired" : ""}">
      ⏰ ${deadlineExpired ? "Vote clôturé le" : "Deadline :"} ${dlStr}
    </div>`;
  }

  const pctFor     = Math.min(100, Math.round((votesFor.length     / VOTES_NEEDED) * 100));
  const pctAgainst = Math.min(100, Math.round((votesAgainst.length / VOTES_NEEDED) * 100));
  const pctAbstain = votesAbstain.length;
  const canVote    = !isClosed && !deadlineExpired && !isSpectateur();

  return `
    <div class="detail-card vote-card" id="vote-section">
      <div class="card-header-bar">
        <h3>Vote de la proposition</h3>
        <span style="font-size:.78rem;color:var(--text-muted)">${VOTES_NEEDED} votes requis pour validation/refus</span>
      </div>
      <div class="card-content" style="padding:18px">
        ${isClosed ? `<div class="vote-closed-badge ${e.status === 'Validé' ? 'vote-closed-ok' : 'vote-closed-refuse'}">${e.status === 'Validé' ? '✅ Validé' : '❌ Refusé'}</div>` : ""}
        ${deadlineHtml}
        <div class="vote-bars">
          <div class="vote-bar-row">
            <span class="vote-bar-label">Pour</span>
            <div class="vote-bar-track">
              <div class="vote-bar-fill vote-for" style="width:${pctFor}%"></div>
            </div>
            <span class="vote-bar-count">${votesFor.length}/${VOTES_NEEDED}</span>
          </div>
          <div class="vote-bar-row">
            <span class="vote-bar-label">Contre</span>
            <div class="vote-bar-track">
              <div class="vote-bar-fill vote-against" style="width:${pctAgainst}%"></div>
            </div>
            <span class="vote-bar-count">${votesAgainst.length}/${VOTES_NEEDED}</span>
          </div>
        </div>
        ${canVote ? `
          <div class="vote-btns">
            <button id="vote-for-btn" class="btn vote-btn ${hasVotedFor ? 'vote-btn-active-for' : ''}"
              ${hasVotedFor ? "disabled" : ""}>
              👍 Pour ${hasVotedFor ? "✓" : hasVotedAgainst || hasAbstained ? "(changer)" : ""}
            </button>
            <button id="vote-against-btn" class="btn vote-btn ${hasVotedAgainst ? 'vote-btn-active-against' : ''}"
              ${hasVotedAgainst ? "disabled" : ""}>
              👎 Contre ${hasVotedAgainst ? "✓" : hasVotedFor || hasAbstained ? "(changer)" : ""}
            </button>
            <button id="vote-abstain-btn" class="btn vote-btn ${hasAbstained ? 'vote-btn-active-abstain' : ''}"
              ${hasAbstained ? "disabled" : ""}>
              ➖ Abstention ${hasAbstained ? "✓" : hasVotedFor || hasVotedAgainst ? "(changer)" : ""}
            </button>
          </div>
        ` : ""}
        <div class="vote-voters" style="margin-top:10px;font-size:.75rem;color:var(--text-muted)">
          ${votesFor.length || votesAgainst.length || votesAbstain.length
            ? `${votesFor.length} pour · ${votesAgainst.length} contre · ${votesAbstain.length} abstention(s)`
            : "Aucun vote pour l'instant."}
        </div>
        <div id="vote-names-section" class="vote-names-section"></div>
      </div>
    </div>`;
}

async function loadVoteNames(e) {
  const container = document.getElementById("vote-names-section");
  if (!container) return;
  const allUids = [...(e.votesFor || []), ...(e.votesAgainst || []), ...(e.votesAbstain || [])];
  if (!allUids.length) return;

  const names   = await getUserNames(allUids);
  const reasons = e.votesAgainstReasons || {};
  const rows    = [];

  if ((e.votesFor || []).length)
    rows.push(`<div class="vote-name-row">
      <span class="vote-name-label for">👍 Pour</span>
      <span>${e.votesFor.map(u => escapeHtml(names.get(u) || u)).join(", ")}</span>
    </div>`);

  if ((e.votesAgainst || []).length) {
    const items = e.votesAgainst.map(u => {
      const name   = escapeHtml(names.get(u) || u);
      const reason = reasons[u]
        ? `<em class="vote-reason-text"> — "${escapeHtml(reasons[u])}"</em>`
        : "";
      return `<div class="vote-reason-item">${name}${reason}</div>`;
    }).join("");
    rows.push(`<div class="vote-name-row">
      <span class="vote-name-label against">👎 Contre</span>
      <div class="vote-reasons-list">${items}</div>
    </div>`);
  }

  if ((e.votesAbstain || []).length)
    rows.push(`<div class="vote-name-row">
      <span class="vote-name-label abstain">➖ Abstention</span>
      <span>${e.votesAbstain.map(u => escapeHtml(names.get(u) || u)).join(", ")}</span>
    </div>`);

  container.innerHTML = rows.join("");
}

function setupVoteButtons(e) {
  document.getElementById("vote-for-btn")?.addEventListener("click",     () => handleVote(e, "for"));
  document.getElementById("vote-against-btn")?.addEventListener("click", () => handleVote(e, "against"));
  document.getElementById("vote-abstain-btn")?.addEventListener("click", () => handleVote(e, "abstain"));
}

async function handleVote(e, direction) {
  const uid = getCurrentUser()?.uid;
  if (!uid) return;

  const votesFor     = e.votesFor     || [];
  const votesAgainst = e.votesAgainst || [];
  const votesAbstain = e.votesAbstain || [];

  if (direction === "for"     && votesFor.includes(uid))     { showToast("Tu as déjà voté Pour.",        "error"); return; }
  if (direction === "against" && votesAgainst.includes(uid)) { showToast("Tu as déjà voté Contre.",      "error"); return; }
  if (direction === "abstain" && votesAbstain.includes(uid)) { showToast("Tu as déjà voté Abstention.", "error"); return; }

  // Demander une raison avant de désactiver les boutons
  let reason = "";
  if (direction === "against") {
    const result = await promptReason("👎 Voter Contre");
    if (!result.ok) return;
    reason = result.reason;
  }

  const forBtn     = document.getElementById("vote-for-btn");
  const againstBtn = document.getElementById("vote-against-btn");
  const abstainBtn = document.getElementById("vote-abstain-btn");
  [forBtn, againstBtn, abstainBtn].forEach(b => b && (b.disabled = true));

  try {
    entry = await voteEntry(e.id, direction, votesFor, votesAgainst, votesAbstain, reason);
    const voteSection = document.getElementById("vote-section");
    if (voteSection) voteSection.outerHTML = renderVoteSection(entry);
    setupVoteButtons(entry);
    loadVoteNames(entry);
    showToast("Vote enregistré.", "success");
  } catch (err) {
    showToast(err.message || "Erreur lors du vote.", "error");
    console.error(err);
    [forBtn, againstBtn, abstainBtn].forEach(b => b && (b.disabled = false));
  }
}

// ── Pin ───────────────────────────────────────────────────────

async function handlePin() {
  if (!entry) return;
  try {
    await togglePin(entry.id, !!entry.pinned);
    entry.pinned = !entry.pinned;
    const btn = document.getElementById("pin-btn");
    if (btn) {
      const label = entry.pinned ? "Désépingler" : "Épingler";
      btn.textContent = `📌 ${label}`;
      btn.title = label;
      btn.classList.toggle("pinned", entry.pinned);
    }
    showToast(entry.pinned ? "Entrée épinglée." : "Entrée désépinglée.", "success");
  } catch (err) {
    showToast("Erreur.", "error"); console.error(err);
  }
}

// ── History ───────────────────────────────────────────────────

async function loadHistory(entryId) {
  try {
    const history   = await getHistory(entryId);
    const container = document.getElementById("history-body");
    if (!container) return;

    if (!history.length) {
      container.innerHTML = `<div style="padding:18px;text-align:center;color:var(--text-muted);font-size:.82rem">Aucun historique</div>`;
      return;
    }

    const ACTION_LABELS = { create: "Création", update: "Modification" };
    const FIELD_LABELS  = {
      title: "Titre", category: "Catégorie", description: "Description",
      status: "Statut", faction: "Faction", factions: "Factions",
      replaces: "Remplace", all: "", votesFor: "Vote Pour",
      votesAgainst: "Vote Contre", votesAbstain: "Abstention",
      voteDeadline: "Deadline vote"
    };

    container.innerHTML = `
      <div class="history-list">
        ${history.map(h => {
          const changesHtml = h.changes.map(c => {
            if (c.field === "all") return `<div class="history-change">${c.newValue}</div>`;
            const label = FIELD_LABELS[c.field] || c.field;
            return `
              <div class="history-change">
                <span class="field-name">${label}</span> :
                ${c.oldValue ? `<span class="old-val">${c.oldValue}</span> → ` : ""}
                <span class="new-val">${c.newValue}</span>
              </div>
            `;
          }).join("");
          return `
            <div class="history-item">
              <div class="history-icon">${h.action === "create" ? "+" : "✎"}</div>
              <div class="history-content">
                <div class="history-header">
                  <span class="history-author">${h.authorName} — ${ACTION_LABELS[h.action] || h.action}</span>
                  <span class="history-time">${formatDate(h.timestamp)}</span>
                </div>
                <div class="history-changes">${changesHtml}</div>
              </div>
            </div>
          `;
        }).join("")}
      </div>`;
  } catch (err) {
    console.error("History error:", err);
  }
}

// ── Delete ────────────────────────────────────────────────────

async function handleDelete() {
  if (!entry) return;
  const ok = await confirmModal(
    "Archiver l'entrée",
    `Archiver <strong>${escapeHtml(entry.title)}</strong> ? Elle sera masquée par défaut mais restera accessible.`,
    "Archiver"
  );
  if (!ok) return;
  try {
    await archiveEntry(entry.id, entry.title);
    showToast("Entrée archivée.", "success");
    setTimeout(() => window.location.href = `/entries.html?section=${entry.section || "decisions"}`, 800);
  } catch (err) {
    showToast("Erreur lors de l'archivage.", "error");
    console.error(err);
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
