import { requireAuth, isAdmin, isSpectateur, getCurrentUser } from "./auth.js";
import { createRelation, deleteRelation, subscribeRelations } from "./relations.js";
import { getFactionList } from "./factions-list.js";
import { renderNavbar, showToast, confirmModal, formatDateShort, escapeHtml } from "./ui-shared.js";

let allRelations = [];
let allFactions  = [];
let unsubscribe  = null;

const TYPE_CONFIG = {
  Alliance:    { color: "#22c55e", icon: "🤝" },
  Conflit:     { color: "#ef4444", icon: "⚔️" },
  Neutralité:  { color: "#6b7280", icon: "⚖️" },
  Accord:      { color: "#f97316", icon: "📜" }
};

requireAuth(async () => {
  renderNavbar("relations");

  allFactions = await getFactionList();
  populateFactionFilters();
  populateFactionSelects();

  unsubscribe = subscribeRelations(rels => {
    allRelations = rels;
    applyFilters();
    updateCount();
  });

  if (isSpectateur()) {
    document.getElementById("new-relation-btn").style.display = "none";
  }
  document.getElementById("new-relation-btn").addEventListener("click", openModal);
  document.getElementById("rel-cancel-btn").addEventListener("click", closeModal);
  document.getElementById("rel-modal-overlay").addEventListener("click", closeModal);
  document.getElementById("rel-form").addEventListener("submit", handleSubmit);

  document.getElementById("filter-rel-type").addEventListener("change", applyFilters);
  document.getElementById("filter-rel-faction").addEventListener("change", applyFilters);
});

window.addEventListener("beforeunload", () => { if (unsubscribe) unsubscribe(); });

// ── Factions ──────────────────────────────────────────────────

function populateFactionFilters() {
  const sel = document.getElementById("filter-rel-faction");
  allFactions.forEach(f => {
    const opt = document.createElement("option");
    opt.value = f.id; opt.textContent = f.nom;
    sel.appendChild(opt);
  });
}

function populateFactionSelects() {
  const opts = allFactions.map(f =>
    `<option value="${f.id}" data-nom="${escapeHtml(f.nom)}">${escapeHtml(f.nom)}</option>`
  ).join("");
  document.getElementById("r-faction1").innerHTML = `<option value="">— Sélectionner —</option>` + opts;
  document.getElementById("r-faction2").innerHTML = `<option value="">— Sélectionner —</option>` + opts;
}

// ── Render ────────────────────────────────────────────────────

function applyFilters() {
  const typeFilter    = document.getElementById("filter-rel-type").value;
  const factionFilter = document.getElementById("filter-rel-faction").value;

  const filtered = allRelations.filter(r => {
    if (typeFilter    && r.type !== typeFilter) return false;
    if (factionFilter && r.faction1Id !== factionFilter && r.faction2Id !== factionFilter) return false;
    return true;
  });

  renderRelations(filtered);
}

function updateCount() {
  document.getElementById("relation-count").textContent =
    `${allRelations.length} relation${allRelations.length !== 1 ? "s" : ""}`;
}

function renderRelations(relations) {
  const container = document.getElementById("relations-container");
  if (!relations.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🤝</div>
        <h3>Aucune relation enregistrée</h3>
        <p>Ajoute une relation entre deux factions ci-dessus.</p>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="relations-grid">
      ${relations.map(r => relationCard(r)).join("")}
    </div>`;
}

function relationCard(r) {
  const cfg    = TYPE_CONFIG[r.type] || { color: "#6b7280", icon: "•" };
  const uid    = getCurrentUser()?.uid;
  const admin  = isAdmin();
  const canDel = admin || r.authorUid === uid;

  return `
    <div class="relation-card" style="border-left:4px solid ${cfg.color}">
      <div class="relation-card-header">
        <span class="relation-type-icon">${cfg.icon}</span>
        <div class="relation-factions">
          <span class="relation-faction-name">${escapeHtml(r.faction1Name)}</span>
          <span class="relation-sep" style="color:${cfg.color}">—</span>
          <span class="relation-faction-name">${escapeHtml(r.faction2Name)}</span>
        </div>
        <span class="relation-type-badge" style="background:${cfg.color}20;color:${cfg.color};border:1px solid ${cfg.color}40">${r.type}</span>
        ${canDel ? `<button class="btn-icon danger" title="Supprimer" onclick="deleteRelationCard('${r.id}','${escapeHtml(r.faction1Name + " / " + r.faction2Name).replace(/'/g,"\\'")}')">✕</button>` : ""}
      </div>
      ${r.description ? `<div class="relation-desc">${escapeHtml(r.description)}</div>` : ""}
      <div class="relation-meta">
        ${r.since ? `<span>Depuis le ${new Date(r.since).toLocaleDateString("fr-FR")}</span>` : ""}
        <span>· Par ${escapeHtml(r.authorName)}</span>
      </div>
    </div>`;
}

// ── Modal ─────────────────────────────────────────────────────

function openModal() {
  document.getElementById("rel-modal").style.display = "";
  document.getElementById("rel-modal-overlay").style.display = "";
}

function closeModal() {
  document.getElementById("rel-modal").style.display = "none";
  document.getElementById("rel-modal-overlay").style.display = "none";
  document.getElementById("rel-form").reset();
}

async function handleSubmit(ev) {
  ev.preventDefault();
  const f1sel = document.getElementById("r-faction1");
  const f2sel = document.getElementById("r-faction2");
  const f1id  = f1sel.value;
  const f2id  = f2sel.value;

  if (!f1id || !f2id) { showToast("Sélectionne deux factions.", "error"); return; }
  if (f1id === f2id)  { showToast("Les deux factions doivent être différentes.", "error"); return; }

  const data = {
    faction1Id:   f1id,
    faction1Name: f1sel.selectedOptions[0]?.dataset.nom || f1sel.selectedOptions[0]?.text || "",
    faction2Id:   f2id,
    faction2Name: f2sel.selectedOptions[0]?.dataset.nom || f2sel.selectedOptions[0]?.text || "",
    type:         document.getElementById("r-type").value,
    since:        document.getElementById("r-since").value || new Date().toISOString().slice(0, 10),
    description:  document.getElementById("r-desc").value
  };

  const btn = document.getElementById("rel-submit-btn");
  btn.disabled = true; btn.textContent = "Enregistrement…";
  try {
    await createRelation(data);
    showToast("Relation enregistrée.", "success");
    closeModal();
  } catch (err) {
    showToast("Erreur.", "error"); console.error(err);
  } finally {
    btn.disabled = false; btn.textContent = "Enregistrer";
  }
}

// ── Global handlers ───────────────────────────────────────────

window.deleteRelationCard = async (id, label) => {
  const ok = await confirmModal("Supprimer la relation", `Supprimer <strong>${label}</strong> ?`, "Supprimer");
  if (!ok) return;
  try {
    await deleteRelation(id);
    showToast("Relation supprimée.", "success");
  } catch (err) {
    showToast("Erreur.", "error"); console.error(err);
  }
};
