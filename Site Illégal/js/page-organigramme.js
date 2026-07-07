import { db } from "./firebase-init.js";
import { requireAuth, isAdmin } from "./auth.js";
import { renderNavbar } from "./ui-shared.js";
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const HIERARCHY = [
  { poste: "Responsable",               icon: "👑", color: "#f97316", label: "Responsable" },
  { poste: "Co-Responsable",            icon: "⭐", color: "#eab308", label: "Co-Responsable" }
];
const GEST_LEVEL = [
  { poste: "Gestionnaire Mafia/Cartel",    icon: "🤵", color: "#c084fc", label: "Mafia / Cartel" },
  { poste: "Gestionnaire Groupe Atypique", icon: "🏍", color: "#22d3ee", label: "Groupe Atypique" },
  { poste: "Gestionnaire Gang",            icon: "🏴", color: "#22c55e", label: "Gang" }
];

requireAuth(async () => {
  renderNavbar("organigramme");

  if (isAdmin()) {
    document.getElementById("admin-link").style.display = "";
  }

  try {
    const q     = query(collection(db, "users"), orderBy("displayName", "asc"));
    const snap  = await getDocs(q);
    const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderOrg(users);
  } catch (err) {
    console.error(err);
    document.getElementById("org-container").innerHTML =
      `<div class="empty-state"><div class="empty-icon">⚠</div><h3>Erreur de chargement</h3></div>`;
  }
});

function renderOrg(users) {
  const byPoste = {};
  const unassigned = [];

  for (const u of users) {
    if (u.poste) {
      byPoste[u.poste] = byPoste[u.poste] || [];
      byPoste[u.poste].push(u);
    } else {
      unassigned.push(u);
    }
  }

  const container = document.getElementById("org-container");
  const hasAnyone = [...HIERARCHY, ...GEST_LEVEL].some(p => (byPoste[p.poste] || []).length > 0);

  if (!hasAnyone) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">👥</div>
        <h3>Aucun poste assigné</h3>
        <p>Un admin peut assigner les postes depuis la page <a href="/admin-users.html">Administration</a>.</p>
      </div>`;
    return;
  }

  let html = `<div class="orgchart">`;

  // Niveaux 1 & 2 (Responsable, Co-Responsable)
  for (let i = 0; i < HIERARCHY.length; i++) {
    const { poste, icon, color, label } = HIERARCHY[i];
    const members = byPoste[poste] || [];

    html += `<div class="orgchart-row">`;
    if (!members.length) {
      html += orgNodeEmpty(icon, color, label);
    } else {
      html += members.map(u => orgNodeFull(u, icon, color, label)).join(`<div class="orgchart-peer-sep"></div>`);
    }
    html += `</div>`;

    // Séparateur vertical sauf après le dernier niveau sup
    if (i < HIERARCHY.length - 1 || GEST_LEVEL.some(g => (byPoste[g.poste]||[]).length > 0)) {
      html += `<div class="orgchart-vline"></div>`;
    }
  }

  // Séparateur horizontal avant les gestionnaires
  const gestHasAny = GEST_LEVEL.some(g => (byPoste[g.poste] || []).length > 0);
  if (gestHasAny) {
    html += `<div class="orgchart-hbar"></div>`;
  }

  // Niveau 3 — Gestionnaires (3 colonnes)
  html += `<div class="orgchart-gest-row">`;
  for (const { poste, icon, color, label } of GEST_LEVEL) {
    const members = byPoste[poste] || [];
    html += `<div class="orgchart-gest-col">`;
    html += `<div class="orgchart-vline-sm"></div>`;
    if (!members.length) {
      html += orgNodeEmpty(icon, color, label, true);
    } else {
      html += members.map(u => orgNodeFull(u, icon, color, label, true)).join(`<div style="height:8px"></div>`);
    }
    html += `</div>`;
  }
  html += `</div>`;

  html += `</div>`; // end orgchart

  // Membres sans poste
  if (unassigned.length) {
    html += `
      <div class="panel" style="margin-top:36px">
        <div class="panel-header">
          <span class="panel-title">Membres staff sans poste assigné</span>
          <span style="font-size:.75rem;color:var(--text-muted)">${unassigned.length} personne${unassigned.length > 1 ? "s" : ""}</span>
        </div>
        <div class="panel-body" style="padding:16px">
          <div style="display:flex;flex-wrap:wrap;gap:8px">
            ${unassigned.map(u => memberChip(u)).join("")}
          </div>
        </div>
      </div>`;
  }

  container.innerHTML = html;
}

function orgNodeFull(u, icon, color, label, small = false) {
  const size = small ? "orgchart-card-sm" : "orgchart-card";
  return `
    <div class="${size}" style="border-top:3px solid ${color}">
      <div class="orgchart-avatar" style="background:${color}22;color:${color}">${initials(u.displayName)}</div>
      <div class="orgchart-info">
        <div class="orgchart-name">${esc(u.displayName || u.email || "—")}</div>
        <div class="orgchart-poste" style="color:${color}">${icon} ${label}</div>
        <span class="role-badge ${u.role}" style="margin-top:6px;display:inline-block">${u.role}</span>
      </div>
    </div>`;
}

function orgNodeEmpty(icon, color, label, small = false) {
  const size = small ? "orgchart-card-sm" : "orgchart-card";
  return `
    <div class="${size} orgchart-card-empty" style="border-top:2px dashed ${color}40">
      <div class="orgchart-avatar" style="background:${color}10;color:${color}40">${icon}</div>
      <div class="orgchart-info">
        <div class="orgchart-name" style="color:var(--text-muted)">Non assigné</div>
        <div class="orgchart-poste" style="color:${color}60">${label}</div>
      </div>
    </div>`;
}

function memberChip(u) {
  return `
    <div style="display:flex;align-items:center;gap:7px;background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:20px;padding:5px 14px 5px 7px">
      <div style="width:28px;height:28px;border-radius:50%;background:var(--bg-input);display:flex;align-items:center;justify-content:center;font-size:.72rem;font-weight:700;color:var(--text-secondary)">${initials(u.displayName)}</div>
      <span style="font-size:.83rem;color:var(--text-secondary)">${esc(u.displayName || u.email)}</span>
      <span class="role-badge ${u.role}" style="font-size:.65rem;padding:1px 6px">${u.role}</span>
    </div>`;
}

function initials(name) { return (name || "?").slice(0, 2).toUpperCase(); }
function esc(s)         { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
