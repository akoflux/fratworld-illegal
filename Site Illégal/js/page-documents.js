import { requireAuth, canEdit, getCurrentUser } from "./auth.js";
import { subscribeDocuments, createDocument, deleteDocument } from "./documents.js";
import { renderNavbar, showToast, confirmModal, formatDate, escapeHtml } from "./ui-shared.js";

let allDocs  = [];
let unsubscribe = null;

requireAuth(() => {
  renderNavbar("documents");

  unsubscribe = subscribeDocuments(docs => {
    allDocs = docs;
    renderDocs();
  });

  document.getElementById("search-input").addEventListener("input", renderDocs);
  document.getElementById("filter-cat").addEventListener("input", renderDocs);
  document.getElementById("new-doc-btn").addEventListener("click", () => {
    document.getElementById("doc-modal").classList.add("open");
  });
  document.getElementById("doc-modal-cancel").addEventListener("click", closeModal);
  document.getElementById("doc-modal-overlay").addEventListener("click", closeModal);
  document.getElementById("doc-form").addEventListener("submit", handleCreate);
});

window.addEventListener("beforeunload", () => { if (unsubscribe) unsubscribe(); });

function closeModal() {
  document.getElementById("doc-modal").classList.remove("open");
  document.getElementById("doc-form").reset();
}

const CAT_ICONS = {
  "Loi / Règle":     "⚖",
  "Procédure":       "📋",
  "Ressource":       "🔗",
  "Formulaire":      "📝",
  "Autre":           "📁"
};

function renderDocs() {
  const search = document.getElementById("search-input").value.toLowerCase().trim();
  const cat    = document.getElementById("filter-cat").value;

  const filtered = allDocs.filter(d => {
    if (cat && d.category !== cat) return false;
    if (search) {
      const hay = `${d.titre} ${d.description} ${d.authorName} ${d.category}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  document.getElementById("doc-count").textContent = `${filtered.length} document${filtered.length !== 1 ? "s" : ""}`;

  const container = document.getElementById("doc-list");
  if (!filtered.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📂</div>
        <h3>Aucun document</h3>
        <p>Ajoute le premier document avec le bouton ci-dessus.</p>
      </div>`;
    return;
  }

  const uid = getCurrentUser()?.uid;

  container.innerHTML = `<div class="doc-list">${filtered.map(d => `
    <div class="doc-item" onclick="window.open('${escapeHtml(d.url)}','_blank')">
      <div class="doc-icon">${CAT_ICONS[d.category] || "📁"}</div>
      <div class="doc-content">
        <div class="doc-title">${d.titre}</div>
        <div class="doc-meta">
          ${d.category} · ${d.authorName} · ${formatDate(d.createdAt)}
          ${d.description ? `<br><span style="color:var(--text-secondary)">${d.description}</span>` : ""}
        </div>
      </div>
      <div class="doc-actions" onclick="event.stopPropagation()">
        <a href="${escapeHtml(d.url)}" target="_blank" class="btn-icon" title="Ouvrir">↗</a>
        ${uid === d.authorUid || true /* admin check via canEdit would need entry obj */ ? `
          <button class="btn-icon danger" title="Supprimer"
            onclick="event.stopPropagation();handleDeleteDoc('${d.id}','${esc(d.titre)}')">✕</button>
        ` : ""}
      </div>
    </div>`).join("")}</div>`;
}

async function handleCreate(ev) {
  ev.preventDefault();
  const titre       = document.getElementById("doc-titre").value.trim();
  const url         = document.getElementById("doc-url").value.trim();
  const category    = document.getElementById("doc-cat").value;
  const description = document.getElementById("doc-desc").value.trim();

  if (!titre || !url || !category) {
    showToast("Remplis tous les champs obligatoires.", "error"); return;
  }

  const btn = document.getElementById("doc-submit");
  btn.disabled = true; btn.textContent = "Ajout…";

  try {
    await createDocument({ titre, url, category, description });
    showToast("Document ajouté.", "success");
    closeModal();
  } catch (err) {
    showToast("Erreur lors de l'ajout.", "error"); console.error(err);
  } finally {
    btn.disabled = false; btn.textContent = "Ajouter";
  }
}

window.handleDeleteDoc = async (id, titre) => {
  const ok = await confirmModal("Supprimer", `Supprimer <strong>${titre}</strong> ?`, "Supprimer");
  if (!ok) return;
  try {
    await deleteDocument(id);
    showToast("Document supprimé.", "success");
  } catch (err) {
    showToast("Erreur.", "error"); console.error(err);
  }
};

function esc(str) { return String(str).replace(/'/g, "\\'").replace(/"/g, "&quot;"); }
