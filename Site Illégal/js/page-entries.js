import { requireAuth } from "./auth.js";
import { canEdit } from "./auth.js";
import { getEntries, deleteEntry } from "./entries.js";
import {
  renderNavbar, showToast, confirmModal, formatDate,
  statusClass, statusBadge, catBadge, factionBadge, showSpinner
} from "./ui-shared.js";

let allEntries = [];
let viewMode   = localStorage.getItem("fw-view") || "cards";

requireAuth(async () => {
  renderNavbar("entries");
  setupViewToggle();
  showSpinner("entries-container");
  allEntries = await getEntries();
  renderEntries();
  setupFilters();
});

// ── View toggle ───────────────────────────────────────────────

function setupViewToggle() {
  const btnCards = document.getElementById("btn-view-cards");
  const btnTable = document.getElementById("btn-view-table");

  btnCards.classList.toggle("active", viewMode === "cards");
  btnTable.classList.toggle("active", viewMode === "table");

  btnCards.addEventListener("click", () => {
    viewMode = "cards";
    localStorage.setItem("fw-view", "cards");
    btnCards.classList.add("active");
    btnTable.classList.remove("active");
    renderEntries();
  });

  btnTable.addEventListener("click", () => {
    viewMode = "table";
    localStorage.setItem("fw-view", "table");
    btnTable.classList.add("active");
    btnCards.classList.remove("active");
    renderEntries();
  });
}

// ── Filters ───────────────────────────────────────────────────

function setupFilters() {
  ["filter-cat", "filter-status", "filter-faction", "search-input"].forEach(id => {
    document.getElementById(id).addEventListener("input", renderEntries);
  });
}

function filteredEntries() {
  const cat     = document.getElementById("filter-cat").value;
  const status  = document.getElementById("filter-status").value;
  const faction = document.getElementById("filter-faction").value;
  const search  = document.getElementById("search-input").value.toLowerCase().trim();

  return allEntries.filter(e => {
    if (cat     && e.category !== cat)      return false;
    if (status  && e.status   !== status)   return false;
    if (faction && e.faction  !== faction)  return false;
    if (search) {
      const hay = `${e.title} ${e.description} ${e.authorName} ${e.category} ${e.faction}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });
}

// ── Render ────────────────────────────────────────────────────

function renderEntries() {
  const entries   = filteredEntries();
  const container = document.getElementById("entries-container");

  document.getElementById("entries-count").textContent = `${entries.length} entrée${entries.length !== 1 ? "s" : ""}`;

  if (!entries.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <h3>Aucun résultat</h3>
        <p>Modifie les filtres ou effectue une recherche différente.</p>
      </div>`;
    return;
  }

  if (viewMode === "cards") renderCards(entries, container);
  else                      renderTable(entries, container);
}

// ── Cards view ────────────────────────────────────────────────

function renderCards(entries, container) {
  const html = entries.map(e => {
    const cls      = statusClass(e.status);
    const replaced = !!e.replacedBy;
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
            ${factionBadge(e.faction)}
          </div>
        </div>
        <div class="card-footer">
          <div class="card-meta">
            <span>✎ ${e.authorName}</span>
            <span>·</span>
            <span>${formatDate(e.createdAt)}</span>
          </div>
          <div class="card-actions" onclick="event.stopPropagation()">
            ${canEdit(e) ? `
              <button class="btn-icon" title="Modifier"
                onclick="event.stopPropagation();window.location.href='/entry-form.html?id=${e.id}'">✎</button>
              <button class="btn-icon danger" title="Supprimer"
                onclick="event.stopPropagation();handleDelete('${e.id}','${escapeAttr(e.title)}')">✕</button>
            ` : ""}
          </div>
        </div>
      </div>
    `;
  }).join("");

  container.innerHTML = `<div class="cards-grid">${html}</div>`;
}

// ── Table view ────────────────────────────────────────────────

function renderTable(entries, container) {
  const rows = entries.map(e => {
    const replaced = !!e.replacedBy;
    return `
      <tr class="${replaced ? "is-replaced" : ""}"
          onclick="window.location.href='/entry-detail.html?id=${e.id}'">
        <td class="table-title">
          ${e.title}
          ${replaced ? `<small>Remplacée</small>` : ""}
        </td>
        <td>${catBadge(e.category)}</td>
        <td>${statusBadge(e.status, replaced)}</td>
        <td>${factionBadge(e.faction) || `<span style="color:var(--text-muted)">—</span>`}</td>
        <td style="color:var(--text-secondary);font-size:.8rem">${e.authorName}</td>
        <td style="color:var(--text-muted);font-size:.78rem;white-space:nowrap">${formatDate(e.createdAt)}</td>
        <td class="table-actions" onclick="event.stopPropagation()">
          ${canEdit(e) ? `
            <button class="btn-icon" title="Modifier"
              onclick="window.location.href='/entry-form.html?id=${e.id}'">✎</button>
            <button class="btn-icon danger" title="Supprimer"
              onclick="handleDelete('${e.id}','${escapeAttr(e.title)}')">✕</button>
          ` : ""}
        </td>
      </tr>
    `;
  }).join("");

  container.innerHTML = `
    <div class="table-wrapper">
      <table class="entries-table">
        <thead>
          <tr>
            <th>Titre</th>
            <th>Catégorie</th>
            <th>Statut</th>
            <th>Faction</th>
            <th>Auteur</th>
            <th>Date</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

// ── Delete ────────────────────────────────────────────────────

window.handleDelete = async (id, title) => {
  const ok = await confirmModal(
    "Supprimer l'entrée",
    `Es-tu sûr de vouloir supprimer <strong>${title}</strong> ? Cette action est irréversible.`,
    "Supprimer"
  );
  if (!ok) return;

  try {
    await deleteEntry(id);
    allEntries = allEntries.filter(e => e.id !== id);
    renderEntries();
    showToast("Entrée supprimée.", "success");
  } catch (err) {
    showToast("Erreur lors de la suppression.", "error");
    console.error(err);
  }
};

function escapeAttr(str) {
  return String(str).replace(/'/g, "\\'").replace(/"/g, "&quot;");
}
