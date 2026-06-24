import { requireAuth, canEdit } from "./auth.js";
import { getEntry, getHistory, deleteEntry } from "./entries.js";
import {
  renderNavbar, showToast, confirmModal, formatDate,
  statusBadge, catBadge, factionBadge, getParam, showSpinner
} from "./ui-shared.js";

let entry = null;

requireAuth(async () => {
  renderNavbar("entries");
  const id = getParam("id");
  if (!id) { window.location.href = "/entries.html"; return; }

  showSpinner("entry-main");

  try {
    entry = await getEntry(id);
    if (!entry) { window.location.href = "/entries.html"; return; }
    renderEntry(entry);
    loadHistory(id);
  } catch (err) {
    console.error(err);
    showToast("Erreur lors du chargement.", "error");
  }
});

function renderEntry(e) {
  document.title = `${e.title} — FratWorld Staff`;

  // Breadcrumb
  document.getElementById("breadcrumb-title").textContent = e.title;

  // Actions
  const actionsEl = document.getElementById("entry-actions");
  if (canEdit(e)) {
    actionsEl.innerHTML = `
      <a href="/entry-form.html?id=${e.id}" class="btn btn-secondary">✎ Modifier</a>
      <button class="btn btn-danger" id="delete-btn">✕ Supprimer</button>
    `;
    document.getElementById("delete-btn").addEventListener("click", handleDelete);
  }

  // Header
  const replaced = !!e.replacedBy;
  document.getElementById("entry-main").innerHTML = `
    <div class="detail-header">
      <div class="detail-header-left">
        <h1 class="detail-title">${e.title}</h1>
        <div class="detail-meta-row">
          ${statusBadge(e.status, replaced)}
          ${catBadge(e.category)}
          ${factionBadge(e.faction)}
        </div>
      </div>
    </div>

    <!-- Supersession -->
    ${e.replaces ? `
      <div class="detail-card" style="margin-bottom:14px;border-left:3px solid var(--s-debate)">
        <div class="card-content" style="padding:14px 18px;font-size:.85rem;color:var(--text-secondary)">
          ⬆ Cette entrée <strong>remplace</strong> :
          <a href="/entry-detail.html?id=${e.replaces}">${e.replacesTitle || e.replaces}</a>
        </div>
      </div>
    ` : ""}
    ${e.replacedBy ? `
      <div class="detail-card" style="margin-bottom:14px;border-left:3px solid var(--s-replaced)">
        <div class="card-content" style="padding:14px 18px;font-size:.85rem;color:var(--text-muted)">
          ⚠ Cette entrée est <strong>remplacée par</strong> :
          <a href="/entry-detail.html?id=${e.replacedBy}">${e.replacedByTitle || e.replacedBy}</a>
        </div>
      </div>
    ` : ""}

    <!-- Metadata -->
    <div class="detail-card">
      <div class="card-header-bar"><h3>Informations</h3></div>
      <div class="card-content">
        <div class="info-grid">
          <div class="info-item">
            <div class="info-label">Auteur</div>
            <div class="info-value">${e.authorName}</div>
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
            <div class="info-label">Faction</div>
            <div class="info-value">${e.faction || "Aucune"}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Catégorie</div>
            <div class="info-value">${e.category}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Description -->
    <div class="detail-card">
      <div class="card-header-bar"><h3>Description</h3></div>
      <div class="card-content">
        <div class="detail-description">${escapeHtml(e.description)}</div>
      </div>
    </div>

    <!-- History placeholder -->
    <div class="detail-card" id="history-card">
      <div class="card-header-bar">
        <h3>Historique des modifications</h3>
      </div>
      <div id="history-body">
        <div class="spinner-wrap"><div class="spinner"></div></div>
      </div>
    </div>
  `;
}

async function loadHistory(entryId) {
  try {
    const history = await getHistory(entryId);
    const container = document.getElementById("history-body");
    if (!container) return;

    if (!history.length) {
      container.innerHTML = `<div style="padding:18px;text-align:center;color:var(--text-muted);font-size:.82rem">Aucun historique</div>`;
      return;
    }

    const ACTION_LABELS = {
      create: "Création",
      update: "Modification"
    };

    const FIELD_LABELS = {
      title:       "Titre",
      category:    "Catégorie",
      description: "Description",
      status:      "Statut",
      faction:     "Faction",
      replaces:    "Remplace",
      all:         ""
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
      </div>
    `;
  } catch (err) {
    console.error("History error:", err);
  }
}

async function handleDelete() {
  if (!entry) return;
  const ok = await confirmModal(
    "Supprimer l'entrée",
    `Es-tu sûr de vouloir supprimer <strong>${entry.title}</strong> ? Cette action est irréversible.`,
    "Supprimer"
  );
  if (!ok) return;

  try {
    await deleteEntry(entry.id);
    showToast("Entrée supprimée.", "success");
    setTimeout(() => window.location.href = "/entries.html", 800);
  } catch (err) {
    showToast("Erreur lors de la suppression.", "error");
    console.error(err);
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
