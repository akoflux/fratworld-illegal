import { requireAuth, canEdit } from "./auth.js";
import { subscribeEntries, archiveEntry, togglePin } from "./entries.js";
import { loadSettings, getVotesNeeded } from "./settings.js";
import {
  renderNavbar, showToast, confirmModal, formatDate,
  statusClass, statusBadge, catBadge, factionBadges, normalizeFactions, showSpinner
} from "./ui-shared.js";

const SECTION_KEY  = new URLSearchParams(window.location.search).get("section") || "decisions";
const SECTION_MAP  = { decisions: "Décisions", factions: "Factions", propositions: "Propositions & Dossiers" };

let allEntries   = [];
let viewMode     = localStorage.getItem("fw-view") || "cards";
let showArchived = false;
let unsubscribe  = null;
let VOTES_NEEDED = 3;

requireAuth(async () => {
  renderNavbar(SECTION_KEY);
  setupViewToggle();
  setupArchivedToggle();
  setSectionTab(SECTION_KEY);
  showSpinner("entries-container");

  const settings = await loadSettings();
  VOTES_NEEDED   = getVotesNeeded(settings);

  unsubscribe = subscribeEntries(entries => {
    allEntries = entries;
    renderEntries();
  });
});

window.addEventListener("beforeunload", () => { if (unsubscribe) unsubscribe(); });

// ── Section tabs ──────────────────────────────────────────────

function setSectionTab(key) {
  document.querySelectorAll(".section-tab").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.section === key);
  });
  document.getElementById("section-label").textContent = SECTION_MAP[key] || key;
  document.getElementById("new-entry-btn").href = `/entry-form.html?section=${key}`;
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".section-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      window.location.href = `/entries.html?section=${btn.dataset.section}`;
    });
  });

  ["filter-cat", "filter-status", "filter-factions", "search-input"].forEach(id => {
    document.getElementById(id)?.addEventListener("input", renderEntries);
  });

  setupViewToggle();
  setupArchivedToggle();
});

// ── View toggle ───────────────────────────────────────────────

function setupViewToggle() {
  const btnCards  = document.getElementById("btn-view-cards");
  const btnTable  = document.getElementById("btn-view-table");
  const btnKanban = document.getElementById("btn-view-kanban");
  if (!btnCards) return;

  const setActive = mode => {
    btnCards.classList.toggle("active",  mode === "cards");
    btnTable.classList.toggle("active",  mode === "table");
    btnKanban.classList.toggle("active", mode === "kanban");
  };

  setActive(viewMode);

  btnCards.addEventListener("click", () => {
    viewMode = "cards"; localStorage.setItem("fw-view", "cards");
    setActive("cards"); renderEntries();
  });
  btnTable.addEventListener("click", () => {
    viewMode = "table"; localStorage.setItem("fw-view", "table");
    setActive("table"); renderEntries();
  });
  btnKanban.addEventListener("click", () => {
    viewMode = "kanban"; localStorage.setItem("fw-view", "kanban");
    setActive("kanban"); renderEntries();
  });
}

// ── Archived toggle ───────────────────────────────────────────

function setupArchivedToggle() {
  const btn = document.getElementById("archived-toggle");
  if (!btn) return;
  btn.classList.toggle("active", showArchived);
  btn.addEventListener("click", () => {
    showArchived = !showArchived;
    btn.classList.toggle("active", showArchived);
    renderEntries();
  });
}

// ── Filter + section ─────────────────────────────────────────

function getSectionForEntry(e) {
  if (e.section) return e.section;
  const catMap = {
    "Fiche faction":                    "factions",
    "Règle faction":                    "factions",
    "Accord inter-faction":             "factions",
    "Proposition règlement":            "propositions",
    "Idée mécanique":                   "propositions",
    "Ajout serveur (règle, mécanique)": "propositions",
    "Autre":                            "propositions"
  };
  return catMap[e.category] || "decisions";
}

function filteredEntries() {
  const cat     = document.getElementById("filter-cat")?.value     || "";
  const status  = document.getElementById("filter-status")?.value  || "";
  const faction = document.getElementById("filter-factions")?.value || "";
  const search  = (document.getElementById("search-input")?.value  || "").toLowerCase().trim();

  return allEntries
    .filter(e => {
      if (getSectionForEntry(e) !== SECTION_KEY) return false;
      // Archivées masquées par défaut sauf si toggle actif ou filtre statut explicite
      if (!showArchived && e.status === "Archivée" && !status) return false;
      if (cat    && e.category !== cat)   return false;
      if (status && e.status   !== status) return false;
      if (faction) {
        const facs = normalizeFactions(e.factions || e.faction);
        if (!facs.includes(faction) && !facs.includes("Toutes")) return false;
      }
      if (search) {
        const hay = `${e.title} ${e.description} ${e.authorName} ${e.category}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    })
    // Épinglées en premier
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return 0;
    });
}

// ── Render ────────────────────────────────────────────────────

function renderEntries() {
  const entries   = filteredEntries();
  const container = document.getElementById("entries-container");
  document.getElementById("entries-count").textContent =
    `${entries.length} entrée${entries.length !== 1 ? "s" : ""}`;

  if (!entries.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <h3>Aucun résultat</h3>
        <p>Modifie les filtres ou crée une nouvelle entrée.</p>
      </div>`;
    return;
  }

  if (viewMode === "table")  renderTable(entries, container);
  else if (viewMode === "kanban") renderKanban(entries, container);
  else                       renderCards(entries, container);
}

function renderCards(entries, container) {
  const html = entries.map(e => {
    const cls      = statusClass(e.status);
    const replaced = !!e.replacedBy;
    const facHtml  = factionBadges(e.factions || e.faction);
    const pinHtml  = e.pinned ? `<span class="pinned-badge">📌 Épinglé</span>` : "";
    return `
      <div class="entry-card ${replaced ? "is-replaced" : ""}"
           onclick="window.location.href='/entry-detail.html?id=${e.id}&section=${SECTION_KEY}'">
        <div class="card-status-bar ${cls}"></div>
        <div class="card-body">
          <div class="card-header">
            <div class="card-title">${e.title}</div>
            ${statusBadge(e.status, replaced)}
          </div>
          ${pinHtml ? `<div style="margin-bottom:4px">${pinHtml}</div>` : ""}
          <p class="card-desc">${e.description}</p>
          <div class="card-tags">
            ${catBadge(e.category)}
            ${facHtml}
          </div>
        </div>
        <div class="card-footer">
          <div class="card-meta">
            <span>✎ ${e.authorName}</span>
            <span>·</span>
            <span>${formatDate(e.createdAt)}</span>
            ${SECTION_KEY === "propositions" ? `<span>·</span><span style="color:#22c55e">👍${(e.votesFor||[]).length}</span><span style="color:#ef4444">👎${(e.votesAgainst||[]).length}</span>` : ""}
          </div>
          <div class="card-actions" onclick="event.stopPropagation()">
            ${canEdit(e) ? `
              <button class="pin-btn ${e.pinned ? "pinned" : ""}" title="${e.pinned ? "Désépingler" : "Épingler"}"
                onclick="event.stopPropagation();handlePin('${e.id}',${!!e.pinned})">📌</button>
              <button class="btn-icon" title="Modifier"
                onclick="event.stopPropagation();window.location.href='/entry-form.html?id=${e.id}&section=${SECTION_KEY}'">✎</button>
              <button class="btn-icon danger" title="Supprimer"
                onclick="event.stopPropagation();handleDelete('${e.id}','${esc(e.title)}')">✕</button>
            ` : ""}
          </div>
        </div>
      </div>`;
  }).join("");
  container.innerHTML = `<div class="cards-grid">${html}</div>`;
}

function renderTable(entries, container) {
  const rows = entries.map(e => {
    const replaced = !!e.replacedBy;
    const facHtml  = factionBadges(e.factions || e.faction);
    return `
      <tr class="${replaced ? "is-replaced" : ""}"
          onclick="window.location.href='/entry-detail.html?id=${e.id}&section=${SECTION_KEY}'">
        <td class="table-title">
          ${e.pinned ? "📌 " : ""}${e.title}${replaced ? `<small>Remplacée</small>` : ""}
        </td>
        <td>${catBadge(e.category)}</td>
        <td>${statusBadge(e.status, replaced)}</td>
        <td>${facHtml || `<span style="color:var(--text-muted)">—</span>`}</td>
        <td style="color:var(--text-secondary);font-size:.8rem">${e.authorName}</td>
        <td style="color:var(--text-muted);font-size:.78rem;white-space:nowrap">${formatDate(e.createdAt)}</td>
        <td class="table-actions" onclick="event.stopPropagation()">
          ${canEdit(e) ? `
            <button class="pin-btn ${e.pinned ? "pinned" : ""}" title="${e.pinned ? "Désépingler" : "Épingler"}"
              onclick="handlePin('${e.id}',${!!e.pinned})">📌</button>
            <button class="btn-icon" onclick="window.location.href='/entry-form.html?id=${e.id}&section=${SECTION_KEY}'">✎</button>
            <button class="btn-icon danger" onclick="handleDelete('${e.id}','${esc(e.title)}')">✕</button>
          ` : ""}
        </td>
      </tr>`;
  }).join("");

  container.innerHTML = `
    <div class="table-wrapper">
      <table class="entries-table">
        <thead>
          <tr>
            <th>Titre</th><th>Catégorie</th><th>Statut</th>
            <th>Factions</th><th>Auteur</th><th>Date</th><th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function renderKanban(entries, container) {
  const cols = {
    pending: { label: "En cours", cls: "pending", entries: [] },
    valid:   { label: "Validé",   cls: "valid",   entries: [] },
    refused: { label: "Refusé",   cls: "refused",  entries: [] }
  };

  entries.forEach(e => {
    if (e.status === "Validé")   cols.valid.entries.push(e);
    else if (e.status === "Refusé") cols.refused.entries.push(e);
    else if (e.status !== "Archivée") cols.pending.entries.push(e);
  });

  const colsHtml = Object.entries(cols).map(([key, col]) => {
    const cards = col.entries.map(e => {
      const vFor     = (e.votesFor     || []).length;
      const vAgainst = (e.votesAgainst || []).length;
      const isPropo  = e.section === "propositions";
      const pctFor   = Math.min(100, Math.round((vFor / VOTES_NEEDED) * 100));
      return `
        <div class="kanban-card" onclick="window.location.href='/entry-detail.html?id=${e.id}&section=${SECTION_KEY}'">
          ${e.pinned ? `<div class="pinned-badge" style="margin-bottom:5px;font-size:.6rem">📌 Épinglé</div>` : ""}
          <div class="kanban-card-title">${e.title}</div>
          <div class="kanban-card-meta">
            ${catBadge(e.category)}
            <span>· ${e.authorName}</span>
          </div>
          ${isPropo ? `
            <div class="kanban-vote-row">
              <span style="color:#22c55e">👍${vFor}</span>
              <span style="color:#ef4444">👎${vAgainst}</span>
              <div class="vote-bar-track" style="flex:1;height:4px">
                <div class="vote-bar-fill vote-for" style="width:${pctFor}%;height:4px"></div>
              </div>
            </div>` : ""}
        </div>`;
    }).join("") || `<div style="padding:12px;text-align:center;font-size:.78rem;color:var(--text-muted)">Aucune</div>`;

    return `
      <div class="kanban-col col-${key}">
        <div class="kanban-col-header">
          <span class="kanban-col-title ${key}">${col.label}</span>
          <span class="kanban-col-count ${key}">${col.entries.length}</span>
        </div>
        <div class="kanban-cards">${cards}</div>
      </div>`;
  }).join("");

  container.innerHTML = `<div class="kanban-board">${colsHtml}</div>`;
}

// ── Actions ───────────────────────────────────────────────────

window.handlePin = async (id, currentlyPinned) => {
  try {
    await togglePin(id, currentlyPinned);
    showToast(currentlyPinned ? "Entrée désépinglée." : "Entrée épinglée.", "success");
  } catch (err) {
    showToast("Erreur.", "error"); console.error(err);
  }
};

window.handleDelete = async (id, title) => {
  const ok = await confirmModal(
    "Archiver l'entrée",
    `Archiver <strong>${title}</strong> ? Elle sera masquée par défaut mais restera accessible via le toggle Archivées.`,
    "Archiver"
  );
  if (!ok) return;
  try {
    await archiveEntry(id);
    showToast("Entrée archivée.", "success");
  } catch (err) {
    showToast("Erreur lors de l'archivage.", "error");
    console.error(err);
  }
};

function esc(str) {
  return String(str).replace(/'/g, "\\'").replace(/"/g, "&quot;");
}
