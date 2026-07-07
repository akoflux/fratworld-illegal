import { requireAuth, isAdmin, isSpectateur, getCurrentUserData } from "./auth.js";
import { renderNavbar, showToast, confirmModal, formatDate, getParam } from "./ui-shared.js";
import { subscribeMembres, addMembre, updateMembre, deleteMembre, exportMembresCSV } from "./membres.js";
import { subscribeFactions } from "./factions-list.js";

const factionId = getParam("id");

let currentFaction = null;
let allMembres     = [];
let editingMembreId = null;
let unsubFactions  = null;
let unsubMembres   = null;

const TYPE_COLORS = {
  "Gang":                 "#22c55e",
  "Mafia":                "#f97316",
  "Cartel":               "#ef4444",
  "MC / Groupe atypique": "#c084fc",
  "Indépendant":          "#6b7280"
};

requireAuth(() => {
  if (!factionId) { window.location.href = "/factions.html"; return; }

  renderNavbar("factions");

  // Charge la faction via le flux temps réel des factions
  unsubFactions = subscribeFactions(factions => {
    currentFaction = factions.find(f => f.id === factionId) || null;
    if (!currentFaction) { window.location.href = "/factions.html"; return; }
    renderFactionInfo(currentFaction);
  });

  // Membres temps réel
  unsubMembres = subscribeMembres(factionId, membres => {
    allMembres = membres;
    renderMembres(membres);
    document.getElementById("membre-count").textContent =
      membres.length ? `— ${membres.length} membre${membres.length > 1 ? "s" : ""}` : "";
  });

  // Boutons actions
  if (!isSpectateur()) {
    document.getElementById("membre-actions").innerHTML = `
      <button id="export-csv-btn" class="btn btn-secondary btn-sm">📥 Export CSV</button>
      <button id="add-membre-btn" class="btn btn-primary btn-sm">+ Ajouter</button>`;
    document.getElementById("add-membre-btn").addEventListener("click", () => openModal(null));
    document.getElementById("export-csv-btn").addEventListener("click", () => {
      if (!allMembres.length) { showToast("Aucun membre à exporter.", "error"); return; }
      exportMembresCSV(allMembres, currentFaction?.nom || "faction");
    });
  } else {
    document.getElementById("membre-actions").innerHTML = `
      <button id="export-csv-btn" class="btn btn-secondary btn-sm">📥 Export CSV</button>`;
    document.getElementById("export-csv-btn").addEventListener("click", () => {
      if (!allMembres.length) { showToast("Aucun membre à exporter.", "error"); return; }
      exportMembresCSV(allMembres, currentFaction?.nom || "faction");
    });
  }

  document.getElementById("membre-cancel-btn").addEventListener("click", closeModal);
  document.getElementById("membre-modal-overlay").addEventListener("click", closeModal);
  document.getElementById("membre-form").addEventListener("submit", handleSubmit);
});

window.addEventListener("beforeunload", () => {
  if (unsubFactions) unsubFactions();
  if (unsubMembres)  unsubMembres();
});

// ── Faction info ──────────────────────────────────────────────

function renderFactionInfo(f) {
  const color = TYPE_COLORS[f.type] || "#6b7280";

  document.getElementById("faction-nom").textContent = f.nom;
  document.getElementById("faction-meta").innerHTML  =
    `<span class="badge" style="background:${color}20;color:${color};border-color:${color}40">${f.type}</span>
     &nbsp;·&nbsp; ${f.statut || "Actif"}`;
  document.title = `${f.nom} — FratWorld Staff`;

  document.getElementById("faction-info-body").innerHTML = `
    <div class="info-grid" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr))">
      <div class="info-item">
        <div class="info-label">Lead</div>
        <div class="info-value">${esc(f.lead) || "—"}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Co-Lead</div>
        <div class="info-value">${esc(f.coLead) || "—"}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Business / Activité</div>
        <div class="info-value" style="color:var(--text-secondary)">${esc(f.business) || "—"}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Dernier contact</div>
        <div class="info-value" style="color:var(--text-secondary);font-size:.82rem">
          ${f.dernierContact ? new Date(f.dernierContact).toLocaleDateString("fr-FR") : "—"}
        </div>
      </div>
      ${f.notes ? `
      <div class="info-item" style="grid-column:1/-1">
        <div class="info-label">Notes internes</div>
        <div class="faction-notes">${esc(f.notes)}</div>
      </div>` : ""}
    </div>`;
}

// ── Membres ───────────────────────────────────────────────────

function roleBadge(role) {
  const cfg = {
    "Chef":      { bg: "#eab30820", color: "#eab308", label: "Chef"      },
    "Sous-chef": { bg: "#94a3b820", color: "#94a3b8", label: "Sous-chef" },
    "Membre":    { bg: "#6b728020", color: "#9ca3af", label: "Membre"    }
  }[role] || { bg: "#6b728020", color: "#9ca3af", label: role };
  return `<span class="badge" style="background:${cfg.bg};color:${cfg.color};border-color:${cfg.color}40">${cfg.label}</span>`;
}

function statutBadge(statut) {
  const cfg = {
    "Actif":   { bg: "#22c55e20", color: "#22c55e" },
    "Inactif": { bg: "#f9731620", color: "#f97316" },
    "Banni":   { bg: "#ef444420", color: "#ef4444" }
  }[statut] || { bg: "#6b728020", color: "#9ca3af" };
  return `<span class="badge" style="background:${cfg.bg};color:${cfg.color};border-color:${cfg.color}40">${statut}</span>`;
}

function renderMembres(membres) {
  const body = document.getElementById("membres-body");
  if (!membres.length) {
    body.innerHTML = `
      <div class="empty-state" style="padding:40px">
        <div class="empty-icon">👥</div>
        <h3>Aucun membre enregistré</h3>
        <p>${isSpectateur() ? "Aucun membre n'a encore été ajouté." : "Ajoute le premier membre avec le bouton ci-dessus."}</p>
      </div>`;
    return;
  }

  const canEdit = !isSpectateur();

  body.innerHTML = `
    <div class="membre-table-wrap">
      <table class="membre-table">
        <thead>
          <tr>
            <th>Rôle</th>
            <th>Pseudo</th>
            <th>ID CFX</th>
            <th>ID Joueur</th>
            <th>Statut</th>
            ${canEdit ? "<th></th>" : ""}
          </tr>
        </thead>
        <tbody>
          ${membres.map(m => `
            <tr>
              <td>${roleBadge(m.role)}</td>
              <td class="membre-pseudo">${esc(m.pseudo)}</td>
              <td class="membre-id">${esc(m.idCFX) || "—"}</td>
              <td class="membre-id">${esc(m.idJoueur) || "—"}</td>
              <td>${statutBadge(m.statut)}</td>
              ${canEdit ? `
                <td style="text-align:right;white-space:nowrap">
                  <button class="btn-icon" title="Modifier" onclick="openEditMembre('${m.id}')">✎</button>
                  <button class="btn-icon danger" title="Supprimer" onclick="handleDeleteMembre('${m.id}','${esc(m.pseudo)}')">✕</button>
                </td>` : ""}
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>`;
}

// ── Modal ─────────────────────────────────────────────────────

function openModal(membre) {
  editingMembreId = membre ? membre.id : null;

  document.getElementById("membre-modal-title").textContent   = membre ? "Modifier le membre" : "Ajouter un membre";
  document.getElementById("membre-submit-btn").textContent    = membre ? "Enregistrer" : "Ajouter";
  document.getElementById("m-pseudo").value  = membre?.pseudo    || "";
  document.getElementById("m-cfx").value     = membre?.idCFX     || "";
  document.getElementById("m-joueur").value  = membre?.idJoueur  || "";
  document.getElementById("m-role").value    = membre?.role      || "Membre";
  document.getElementById("m-statut").value  = membre?.statut    || "Actif";

  document.getElementById("membre-modal").style.display         = "block";
  document.getElementById("membre-modal-overlay").style.display = "flex";
  document.getElementById("m-pseudo").focus();
}

function closeModal() {
  document.getElementById("membre-modal").style.display         = "none";
  document.getElementById("membre-modal-overlay").style.display = "none";
  document.getElementById("membre-form").reset();
  editingMembreId = null;
}

async function handleSubmit(ev) {
  ev.preventDefault();
  const data = {
    pseudo:   document.getElementById("m-pseudo").value,
    idCFX:    document.getElementById("m-cfx").value,
    idJoueur: document.getElementById("m-joueur").value,
    role:     document.getElementById("m-role").value,
    statut:   document.getElementById("m-statut").value
  };

  const btn = document.getElementById("membre-submit-btn");
  btn.disabled = true; btn.textContent = "Enregistrement…";

  try {
    if (editingMembreId) {
      await updateMembre(factionId, editingMembreId, data);
      showToast("Membre mis à jour.", "success");
    } else {
      await addMembre(factionId, data);
      showToast("Membre ajouté.", "success");
    }
    closeModal();
  } catch (err) {
    showToast("Erreur.", "error"); console.error(err);
  } finally {
    btn.disabled = false;
    btn.textContent = editingMembreId ? "Enregistrer" : "Ajouter";
  }
}

// ── Global handlers ───────────────────────────────────────────

window.openEditMembre = (id) => {
  const m = allMembres.find(x => x.id === id);
  if (m) openModal(m);
};

window.handleDeleteMembre = async (id, pseudo) => {
  const ok = await confirmModal("Supprimer le membre", `Supprimer <strong>${pseudo}</strong> de la faction ?`, "Supprimer");
  if (!ok) return;
  try {
    await deleteMembre(factionId, id);
    showToast("Membre supprimé.", "success");
  } catch (err) {
    showToast("Erreur.", "error"); console.error(err);
  }
};

function esc(s) {
  if (!s) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "\\'");
}
