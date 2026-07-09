import { requireAuth, isAdmin, isSpectateur, getCurrentUserData } from "./auth.js";
import { renderNavbar, showToast, confirmModal, formatDate, getParam } from "./ui-shared.js";
import { subscribeMembres, addMembre, updateMembre, deleteMembre, exportMembresCSV } from "./membres.js";
import {
  subscribeFactions, updateFaction,
  addFactionEvent, deleteFactionEvent, subscribeFactionEvents
} from "./factions-list.js";
import { subscribeEntries } from "./entries.js";

const factionId = getParam("id");

let currentFaction  = null;
let allMembres      = [];
let allEntries      = [];
let editingMembreId = null;
let unsubFactions   = null;
let unsubMembres    = null;
let unsubEntries    = null;
let unsubEvents     = null;

const TYPE_COLORS = {
  "Gang":                 "#22c55e",
  "Mafia":                "#f97316",
  "Cartel":               "#ef4444",
  "MC / Groupe atypique": "#c084fc",
  "Indépendant":          "#6b7280"
};

const RELATION_META = {
  "Allié":     { color: "#22c55e", icon: "🤝" },
  "Neutre":    { color: "#6b7280", icon: "⚖️" },
  "Surveillé": { color: "#eab308", icon: "👁" },
  "Hostile":   { color: "#ef4444", icon: "⚠️" }
};

requireAuth(() => {
  if (!factionId) { window.location.href = "/factions.html"; return; }

  renderNavbar("factions");

  unsubFactions = subscribeFactions(factions => {
    currentFaction = factions.find(f => f.id === factionId) || null;
    if (!currentFaction) { window.location.href = "/factions.html"; return; }
    renderFactionInfo(currentFaction);
    if (!isSpectateur()) {
      const hdr = document.getElementById("faction-header-actions");
      if (hdr && !hdr.querySelector("#edit-faction-btn")) {
        const btn = document.createElement("button");
        btn.id = "edit-faction-btn"; btn.className = "btn btn-secondary btn-sm";
        btn.textContent = "✎ Modifier";
        btn.addEventListener("click", openFactionModal);
        hdr.appendChild(btn);
      }
    }
  });

  unsubMembres = subscribeMembres(factionId, membres => {
    allMembres = membres;
    renderMembres(membres);
    document.getElementById("membre-count").textContent =
      membres.length ? `— ${membres.length} membre${membres.length > 1 ? "s" : ""}` : "";
  });

  unsubEntries = subscribeEntries(entries => {
    allEntries = entries;
    if (currentFaction) renderFactionEntries(entries, currentFaction.nom);
  });

  unsubEvents = subscribeFactionEvents(factionId, events => {
    renderTimeline(events);
  });

  if (!isSpectateur()) {
    document.getElementById("add-event-btn").style.display = "";
    document.getElementById("add-event-btn").addEventListener("click", openEventModal);
  }

  // Membre actions
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

  document.getElementById("faction-modal-cancel").addEventListener("click", closeFactionModal);
  document.getElementById("faction-modal-overlay").addEventListener("click", closeFactionModal);
  document.getElementById("faction-info-form").addEventListener("submit", handleFactionSubmit);

  document.getElementById("event-modal-cancel").addEventListener("click", closeEventModal);
  document.getElementById("event-modal-overlay").addEventListener("click", closeEventModal);
  document.getElementById("event-form").addEventListener("submit", handleEventSubmit);
});

window.addEventListener("beforeunload", () => {
  if (unsubFactions) unsubFactions();
  if (unsubMembres)  unsubMembres();
  if (unsubEntries)  unsubEntries();
  if (unsubEvents)   unsubEvents();
});

// ── Faction info ──────────────────────────────────────────────

function renderFactionInfo(f) {
  const color   = TYPE_COLORS[f.type] || "#6b7280";
  const relMeta = RELATION_META[f.statutRelation];

  document.getElementById("faction-nom").textContent = f.nom;
  document.getElementById("faction-meta").innerHTML  =
    `<span class="badge" style="background:${color}20;color:${color};border-color:${color}40">${f.type}</span>
     &nbsp;·&nbsp; ${f.statut || "Actif"}
     ${relMeta ? `&nbsp;·&nbsp; <span style="color:${relMeta.color}">${relMeta.icon} ${f.statutRelation}</span>` : ""}`;
  document.title = `${f.nom} — FratWorld Staff`;

  const adminOnly = isAdmin() && f.notesConfidentielles
    ? `<div class="info-item" style="grid-column:1/-1">
        <div class="info-label" style="color:var(--s-refused)">🔒 Notes confidentielles</div>
        <div class="faction-notes" style="border-color:#ef444440;background:#ef444408">${esc(f.notesConfidentielles)}</div>
      </div>` : "";

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
          ${f.dernierContact ? new Date(f.dernierContact + "T00:00:00").toLocaleDateString("fr-FR") : "—"}
        </div>
      </div>
      ${f.telephoneRP ? `
      <div class="info-item">
        <div class="info-label">Téléphone RP</div>
        <div class="info-value">${esc(f.telephoneRP)}</div>
      </div>` : ""}
      ${f.notes ? `
      <div class="info-item" style="grid-column:1/-1">
        <div class="info-label">Notes internes</div>
        <div class="faction-notes">${esc(f.notes)}</div>
      </div>` : ""}
      ${adminOnly}
    </div>`;
}

// ── Faction dashboard — entrées liées ────────────────────────

function renderFactionEntries(entries, factionName) {
  const linked  = entries.filter(e => Array.isArray(e.factions) && e.factions.includes(factionName));
  const countEl = document.getElementById("faction-entries-count");
  const body    = document.getElementById("faction-entries-body");

  countEl.textContent = `${linked.length} entrée${linked.length !== 1 ? "s" : ""}`;

  if (!linked.length) {
    body.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:.82rem">Aucune entrée liée à cette faction.</div>`;
    return;
  }

  const stats = {
    "Validé":     linked.filter(e => e.status === "Validé").length,
    "Refusé":     linked.filter(e => e.status === "Refusé").length,
    "En débat":   linked.filter(e => e.status === "En débat").length,
    "En attente": linked.filter(e => e.status === "En attente").length
  };

  const statHtml = Object.entries(stats)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `<span class="faction-stat-chip">${v} ${k}</span>`)
    .join("");

  const listHtml = linked.slice(0, 10).map(e => `
    <div class="faction-entry-row" onclick="window.location.href='/entry-detail.html?id=${e.id}&section=${e.section || "decisions"}'" style="cursor:pointer">
      <div class="faction-entry-title">${esc(e.title)}</div>
      <div class="faction-entry-meta">${esc(e.category || "")} · ${esc(e.status)}</div>
    </div>`).join("");

  body.innerHTML = `
    <div style="padding:12px 20px;display:flex;flex-wrap:wrap;gap:8px;border-bottom:1px solid var(--border)">${statHtml}</div>
    <div>${listHtml}</div>
    ${linked.length > 10 ? `<div style="padding:10px 20px;font-size:.78rem;color:var(--text-muted)">${linked.length - 10} entrée(s) supplémentaire(s) non affichée(s).</div>` : ""}`;
}

// ── Timeline ──────────────────────────────────────────────────

function renderTimeline(events) {
  const countEl = document.getElementById("timeline-count");
  const body    = document.getElementById("timeline-body");

  countEl.textContent = `${events.length} événement${events.length !== 1 ? "s" : ""}`;

  if (!events.length) {
    body.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:.82rem">Aucun événement enregistré.</div>`;
    return;
  }

  body.innerHTML = `<div class="timeline-list">${events.map(ev => `
    <div class="timeline-item" data-id="${ev.id}">
      <div class="timeline-dot"></div>
      <div class="timeline-content">
        <div class="timeline-date">${ev.date ? new Date(ev.date + "T00:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) : "—"}</div>
        <div class="timeline-title">${esc(ev.title)}</div>
        ${ev.description ? `<div class="timeline-desc">${esc(ev.description)}</div>` : ""}
        <div class="timeline-by">Ajouté par ${esc(ev.createdBy || "?")} · ${formatDate(ev.createdAt)}</div>
        ${!isSpectateur() ? `<button class="btn-icon danger timeline-del" title="Supprimer" onclick="handleDeleteEvent('${ev.id}')">✕</button>` : ""}
      </div>
    </div>`).join("")}
  </div>`;
}

// ── Event modal ───────────────────────────────────────────────

function openEventModal() {
  document.getElementById("ev-title").value = "";
  document.getElementById("ev-date").value  = new Date().toISOString().slice(0, 10);
  document.getElementById("ev-desc").value  = "";
  document.getElementById("event-modal").style.display         = "block";
  document.getElementById("event-modal-overlay").style.display = "flex";
  document.getElementById("ev-title").focus();
}

function closeEventModal() {
  document.getElementById("event-modal").style.display         = "none";
  document.getElementById("event-modal-overlay").style.display = "none";
}

async function handleEventSubmit(ev) {
  ev.preventDefault();
  const title = document.getElementById("ev-title").value.trim();
  const date  = document.getElementById("ev-date").value;
  const desc  = document.getElementById("ev-desc").value.trim();
  if (!title) { showToast("Le titre est requis.", "error"); return; }

  const btn = document.getElementById("event-modal-submit");
  btn.disabled = true; btn.textContent = "Ajout…";
  try {
    await addFactionEvent(factionId, { title, date, description: desc });
    showToast("Événement ajouté.", "success");
    closeEventModal();
  } catch (err) {
    showToast("Erreur.", "error"); console.error(err);
  } finally {
    btn.disabled = false; btn.textContent = "Ajouter";
  }
}

window.handleDeleteEvent = async (eventId) => {
  const ok = await confirmModal("Supprimer l'événement", "Supprimer cet événement de la timeline ?", "Supprimer");
  if (!ok) return;
  try {
    await deleteFactionEvent(factionId, eventId);
    showToast("Événement supprimé.", "success");
  } catch (err) {
    showToast("Erreur.", "error"); console.error(err);
  }
};

// ── Faction info modal (Point 14) ─────────────────────────────

function openFactionModal() {
  if (!currentFaction) return;
  const f = currentFaction;
  document.getElementById("fi-nom").value       = f.nom      || "";
  document.getElementById("fi-type").value      = f.type     || "Gang";
  document.getElementById("fi-lead").value      = f.lead     || "";
  document.getElementById("fi-colead").value    = f.coLead   || "";
  document.getElementById("fi-business").value  = f.business || "";
  document.getElementById("fi-statut").value    = f.statut   || "Actif";
  document.getElementById("fi-tel").value       = f.telephoneRP      || "";
  document.getElementById("fi-relation").value  = f.statutRelation   || "";
  document.getElementById("fi-contact").value   = f.dernierContact   || "";
  document.getElementById("fi-notes").value     = f.notes             || "";
  document.getElementById("fi-notes-conf").value = f.notesConfidentielles || "";

  document.getElementById("faction-info-modal").style.display    = "block";
  document.getElementById("faction-modal-overlay").style.display = "flex";
  document.getElementById("fi-nom").focus();
}

function closeFactionModal() {
  document.getElementById("faction-info-modal").style.display    = "none";
  document.getElementById("faction-modal-overlay").style.display = "none";
}

async function handleFactionSubmit(ev) {
  ev.preventDefault();
  if (!currentFaction) return;

  const data = {
    nom:                  document.getElementById("fi-nom").value,
    type:                 document.getElementById("fi-type").value,
    lead:                 document.getElementById("fi-lead").value,
    coLead:               document.getElementById("fi-colead").value,
    business:             document.getElementById("fi-business").value,
    statut:               document.getElementById("fi-statut").value,
    telephoneRP:          document.getElementById("fi-tel").value,
    statutRelation:       document.getElementById("fi-relation").value,
    dernierContact:       document.getElementById("fi-contact").value,
    notes:                document.getElementById("fi-notes").value,
    notesConfidentielles: document.getElementById("fi-notes-conf").value
  };

  const btn = document.getElementById("faction-modal-submit");
  btn.disabled = true; btn.textContent = "Enregistrement…";
  try {
    await updateFaction(currentFaction.id, data);
    showToast("Faction mise à jour.", "success");
    closeFactionModal();
  } catch (err) {
    showToast("Erreur.", "error"); console.error(err);
  } finally {
    btn.disabled = false; btn.textContent = "Enregistrer";
  }
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
  const body    = document.getElementById("membres-body");
  const canEdit = !isSpectateur();

  if (!membres.length) {
    body.innerHTML = `
      <div class="empty-state" style="padding:40px">
        <div class="empty-icon">👥</div>
        <h3>Aucun membre enregistré</h3>
        <p>${isSpectateur() ? "Aucun membre n'a encore été ajouté." : "Ajoute le premier membre avec le bouton ci-dessus."}</p>
      </div>`;
    return;
  }

  body.innerHTML = `
    <div class="membre-table-wrap">
      <table class="membre-table">
        <thead>
          <tr>
            <th>Rôle</th><th>Pseudo</th><th>ID CFX</th><th>ID Joueur</th><th>Statut</th>
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

// ── Membre modal ──────────────────────────────────────────────

function openModal(membre) {
  editingMembreId = membre ? membre.id : null;
  document.getElementById("membre-modal-title").textContent = membre ? "Modifier le membre" : "Ajouter un membre";
  document.getElementById("membre-submit-btn").textContent  = membre ? "Enregistrer" : "Ajouter";
  document.getElementById("m-pseudo").value  = membre?.pseudo   || "";
  document.getElementById("m-cfx").value     = membre?.idCFX    || "";
  document.getElementById("m-joueur").value  = membre?.idJoueur || "";
  document.getElementById("m-role").value    = membre?.role     || "Membre";
  document.getElementById("m-statut").value  = membre?.statut   || "Actif";
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
