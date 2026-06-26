import { requireAuth, isAdmin } from "./auth.js";
import { subscribeFactions, createFaction, updateFaction, deleteFaction } from "./factions-list.js";
import { renderNavbar, showToast, confirmModal, formatDate } from "./ui-shared.js";

let allFactions = [];
let editingId   = null;
let unsubscribe = null;

const TYPE_COLORS = {
  "Gang":             "#22c55e",
  "Mafia":            "#f97316",
  "Cartel":           "#ef4444",
  "MC / Groupe atypique": "#c084fc",
  "Indépendant":      "#6b7280"
};

requireAuth(() => {
  renderNavbar("factions");

  unsubscribe = subscribeFactions(factions => {
    allFactions = factions;
    renderFactions();
  });

  document.getElementById("new-faction-btn").addEventListener("click", () => openModal(null));
  document.getElementById("faction-form-cancel").addEventListener("click", closeModal);
  document.getElementById("faction-form").addEventListener("submit", handleSubmit);
  document.getElementById("modal-overlay").addEventListener("click", closeModal);
});

window.addEventListener("beforeunload", () => { if (unsubscribe) unsubscribe(); });

// ── Render ────────────────────────────────────────────────────

function renderFactions() {
  const container = document.getElementById("factions-grid");
  document.getElementById("faction-count").textContent = `${allFactions.length} faction${allFactions.length !== 1 ? "s" : ""}`;

  if (!allFactions.length) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">🏴</div>
        <h3>Aucune faction enregistrée</h3>
        <p>Crée la première faction avec le bouton ci-dessus.</p>
      </div>`;
    return;
  }

  container.innerHTML = allFactions.map(f => factionCard(f)).join("");
}

function factionCard(f) {
  const color = TYPE_COLORS[f.type] || "#6b7280";
  const admin = isAdmin();
  return `
    <div class="detail-card" style="border-left: 3px solid ${color}; cursor:default">
      <div class="card-header-bar" style="padding:14px 18px">
        <div style="flex:1">
          <div style="font-size:1rem;font-weight:800;color:var(--text-primary)">${f.nom}</div>
          <span class="badge" style="background:${color}20;color:${color};border-color:${color}40;margin-top:4px">${f.type}</span>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn-icon" title="Modifier" onclick="openEditModal('${f.id}')">✎</button>
          ${admin ? `<button class="btn-icon danger" title="Supprimer" onclick="handleDeleteFaction('${f.id}','${esc(f.nom)}')">✕</button>` : ""}
        </div>
      </div>
      <div class="card-content" style="padding:14px 18px">
        <div class="info-grid" style="grid-template-columns:1fr 1fr">
          <div class="info-item">
            <div class="info-label">Lead</div>
            <div class="info-value">${f.lead || "—"}</div>
          </div>
          <div class="info-item">
            <div class="info-label">Co-Lead</div>
            <div class="info-value">${f.coLead || "—"}</div>
          </div>
          <div class="info-item" style="grid-column:1/-1">
            <div class="info-label">Business / Activité</div>
            <div class="info-value" style="color:var(--text-secondary);font-weight:400">${f.business || "—"}</div>
          </div>
          <div class="info-item" style="grid-column:1/-1">
            <div class="info-label">Mis à jour</div>
            <div class="info-value" style="color:var(--text-muted);font-size:.78rem">${formatDate(f.updatedAt)} par ${f.updatedBy || f.authorName || "—"}</div>
          </div>
        </div>
      </div>
    </div>`;
}

// ── Modal ─────────────────────────────────────────────────────

window.openEditModal = (id) => openModal(allFactions.find(f => f.id === id));

function openModal(faction) {
  editingId = faction ? faction.id : null;
  document.getElementById("modal-title").textContent = faction ? "Modifier la faction" : "Nouvelle faction";
  document.getElementById("faction-submit").textContent = faction ? "Enregistrer" : "Créer";

  document.getElementById("f-nom").value      = faction?.nom      || "";
  document.getElementById("f-type").value     = faction?.type     || "";
  document.getElementById("f-lead").value     = faction?.lead     || "";
  document.getElementById("f-colead").value   = faction?.coLead   || "";
  document.getElementById("f-business").value = faction?.business || "";

  document.getElementById("faction-modal").style.display = "flex";
  document.getElementById("modal-overlay").style.display = "flex";
}

function closeModal() {
  document.getElementById("faction-modal").style.display = "none";
  document.getElementById("modal-overlay").style.display = "none";
  document.getElementById("faction-form").reset();
  editingId = null;
}

async function handleSubmit(ev) {
  ev.preventDefault();
  const data = {
    nom:      document.getElementById("f-nom").value,
    type:     document.getElementById("f-type").value,
    lead:     document.getElementById("f-lead").value,
    coLead:   document.getElementById("f-colead").value,
    business: document.getElementById("f-business").value
  };

  if (!data.nom || !data.type) { showToast("Nom et type obligatoires.", "error"); return; }

  const btn = document.getElementById("faction-submit");
  btn.disabled = true; btn.textContent = "Enregistrement…";

  try {
    if (editingId) {
      await updateFaction(editingId, data);
      showToast("Faction mise à jour.", "success");
    } else {
      await createFaction(data);
      showToast("Faction créée.", "success");
    }
    closeModal();
  } catch (err) {
    showToast("Erreur.", "error"); console.error(err);
  } finally {
    btn.disabled = false;
    btn.textContent = editingId ? "Enregistrer" : "Créer";
  }
}

window.handleDeleteFaction = async (id, nom) => {
  const ok = await confirmModal("Supprimer", `Supprimer <strong>${nom}</strong> ?`, "Supprimer");
  if (!ok) return;
  try {
    await deleteFaction(id);
    showToast("Faction supprimée.", "success");
  } catch (err) {
    showToast("Erreur.", "error"); console.error(err);
  }
};

function esc(s) { return String(s).replace(/'/g, "\\'").replace(/"/g, "&quot;"); }
