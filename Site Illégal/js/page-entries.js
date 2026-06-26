import { requireAuth, canEdit } from "./auth.js";
import { subscribeEntries, deleteEntry } from "./entries.js";
import {
  renderNavbar, showToast, confirmModal, formatDate,
  statusClass, statusBadge, catBadge, factionBadges, normalizeFactions, showSpinner
} from "./ui-shared.js";

// section = "decisions" | "factions" | "propositions"
// Récupéré depuis l'URL ou défaut "decisions"
const SECTION_KEY  = new URLSearchParams(window.location.search).get("section") || "decisions";
const SECTION_MAP  = { decisions: "Décisions", factions: "Factions", propositions: "Propositions & Dossiers" };

let allEntries = [];
let viewMode   = localStorage.getItem("fw-view") || "cards";
let unsubscribe = null;

requireAuth(async () => {
  renderNavbar(SECTION_KEY);
  setupViewToggle();
  setSectionTab(SECTION_KEY);
  showSpinner("entries-container");

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
      const s = btn.dataset.section;
      window.location.href = `/entries.html?section=${s}`;
    });
  });

  ["filter-cat", "filter-status", "filter-factions", "search-input"].forEach(id => {
    document.getElementById(id)?.addEventListener("input", renderEntries);
  });

  setupViewToggle();
});

// ── View toggle ───────────────────────────────────────────────

function setupViewToggle() {
  const btnCards = document.getElementById("btn-view-cards");
  const btnTable = document.getElementById("btn-view-table");
  if (!btnCards) return;

  btnCards.classList.toggle("active", viewMode === "cards");
  btnTable.classList.toggle("active", viewMode === "table");

  btnCards.addEventListener("click", () => {
    viewMode = "cards"; localStorage.setItem("fw-view", "cards");
    btnCards.classList.add("active"); btnTable.classList.remove("active");
    renderEntries();
  });
  btnTable.addEventListener("click", () => {
    viewMode = "table"; localStorage.setItem("fw-view", "table");
    btnTable.classList.add("active"); btnCards.classList.remove("active");
    renderEntries();
  });
}

// ── Filter + section ─────────────────────────────────────────

function getSectionForEntry(e) {
  if (e.section) return e.section;
  const catMap = {
    "Fiche faction":                       "factions",
    "Règle faction":                       "factions",
    "Accord inter-faction":                "factions",
    "Proposition règlement":               "propositions",
    "Idée mécanique":                      "propositions",
    "Ajout serveur (règle, mécanique)":    "propositions",
    "Autre":                               "propositions"
  };
  return catMap[e.category] || "decisions";
}

function filteredEntries() {
  const cat     = document.getElementById("filter-cat")?.value     || "";
  const status  = document.getElementById("filter-status")?.value  || "";
  const faction = document.getElementById("filter-factions")?.value || "";
  const search  = (document.getElementById("search-input")?.value  || "").toLowerCase().trim();

  return allEntries.filter(e => {
    if (getSectionForEntry(e) !== SECTION_KEY) return false;
    if (cat    && e.category !== cat)           return false;
    if (status && e.status   !== status)        return false;
    if (faction) {
      const facs = normalizeFactions(e.factions || e.faction);
      if (!facs.includes(faction) && !facs.includes("Toutes")) return false;
    }
    if (search) {
      const hay = `${e.title} ${e.description} ${e.authorName} ${e.category}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
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

  if (viewMode === "cards") renderCards(entries, container);
  else                      renderTable(entries, container);
}

function renderCards(entries, container) {
  const html = entries.map(e => {
    const cls      = statusClass(e.status);
    const replaced = !!e.replacedBy;
    const facHtml  = factionBadges(e.factions || e.faction);
    return `
      <div class="entry-card ${replaced ? "is-replaced" : ""}"
           onclick="window.location.href='/entry-detail.html?id=${e.id}'">
        <div class="card-status-bar ${cls}"></div>
        <div class="card-body">
          <div class="card-header">
            <div class="card-title">${e.title}</div>
            ${statusBadge(e.status, replaced)}
          </div>
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
              <button class="btn-icon" title="Modifier"
                onclick="event.stopPropagation();window.location.href='/entry-form.html?id=${e.id}'">✎</button>
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
          onclick="window.location.href='/entry-detail.html?id=${e.id}'">
        <td class="table-title">${e.title}${replaced ? `<small>Remplacée</small>` : ""}</td>
        <td>${catBadge(e.category)}</td>
        <td>${statusBadge(e.status, replaced)}</td>
        <td>${facHtml || `<span style="color:var(--text-muted)">—</span>`}</td>
        <td style="color:var(--text-secondary);font-size:.8rem">${e.authorName}</td>
        <td style="color:var(--text-muted);font-size:.78rem;white-space:nowrap">${formatDate(e.createdAt)}</td>
        <td class="table-actions" onclick="event.stopPropagation()">
          ${canEdit(e) ? `
            <button class="btn-icon" onclick="window.location.href='/entry-form.html?id=${e.id}'">✎</button>
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

window.handleDelete = async (id, title) => {
  const ok = await confirmModal(
    "Supprimer l'entrée",
    `Es-tu sûr de vouloir supprimer <strong>${title}</strong> ?`,
    "Supprimer"
  );
  if (!ok) return;
  try {
    await deleteEntry(id);
    showToast("Entrée supprimée.", "success");
  } catch (err) {
    showToast("Erreur lors de la suppression.", "error");
    console.error(err);
  }
};

function esc(str) {
  return String(str).replace(/'/g, "\\'").replace(/"/g, "&quot;");
}
