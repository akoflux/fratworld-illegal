import { db } from "./firebase-init.js";
import { requireAuth, isAdmin } from "./auth.js";
import { renderNavbar } from "./ui-shared.js";
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const POSTE_ORDER = [
  "Responsable",
  "Co-Responsable",
  "Gestionnaire Mafia/Cartel",
  "Gestionnaire Groupe Atypique",
  "Gestionnaire Gang"
];

const POSTE_ICONS = {
  "Responsable":                   "👑",
  "Co-Responsable":                "⭐",
  "Gestionnaire Mafia/Cartel":     "🤵",
  "Gestionnaire Groupe Atypique":  "🏍",
  "Gestionnaire Gang":             "🏴"
};

const POSTE_COLORS = {
  "Responsable":                   "#f97316",
  "Co-Responsable":                "#eab308",
  "Gestionnaire Mafia/Cartel":     "#c084fc",
  "Gestionnaire Groupe Atypique":  "#22d3ee",
  "Gestionnaire Gang":             "#22c55e"
};

requireAuth(async () => {
  renderNavbar("organigramme");

  if (isAdmin()) {
    document.getElementById("admin-link").style.display = "";
  }

  try {
    const q    = query(collection(db, "users"), orderBy("displayName", "asc"));
    const snap = await getDocs(q);
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
  for (const p of POSTE_ORDER) byPoste[p] = [];
  const unassigned = [];

  for (const u of users) {
    if (u.poste && byPoste[u.poste]) byPoste[u.poste].push(u);
    else unassigned.push(u);
  }

  const container = document.getElementById("org-container");

  const hasAnyone = POSTE_ORDER.some(p => byPoste[p].length > 0);
  if (!hasAnyone) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">👥</div>
        <h3>Aucun poste assigné</h3>
        <p>Un admin peut assigner les postes depuis la page <a href="/admin-users.html">Administration</a>.</p>
      </div>`;
    return;
  }

  let html = `<div class="org-tree">`;

  // Niveau 1 : Responsable
  html += orgLevel(byPoste["Responsable"], "Responsable", 0);

  // Niveau 2 : Co-Responsable
  html += orgLevel(byPoste["Co-Responsable"], "Co-Responsable", 1);

  // Niveau 3 : les 3 types de gestionnaires
  const gestPoste = [
    "Gestionnaire Mafia/Cartel",
    "Gestionnaire Groupe Atypique",
    "Gestionnaire Gang"
  ];
  const hasGest = gestPoste.some(p => byPoste[p].length > 0);
  if (hasGest) {
    html += `<div class="org-level org-level-3">`;
    for (const p of gestPoste) {
      html += orgLevelInner(byPoste[p], p);
    }
    html += `</div>`;
  }

  html += `</div>`;

  // Membres sans poste (référents/spectateurs)
  if (unassigned.length) {
    html += `
      <div class="panel" style="margin-top:32px">
        <div class="panel-header"><span class="panel-title">Membres sans poste assigné</span>
          <span style="font-size:.75rem;color:var(--text-muted)">${unassigned.length} personne${unassigned.length>1?"s":""}</span>
        </div>
        <div class="panel-body" style="padding:10px">
          <div style="display:flex;flex-wrap:wrap;gap:8px;padding:8px">
            ${unassigned.map(u => memberChip(u)).join("")}
          </div>
        </div>
      </div>`;
  }

  container.innerHTML = html;
}

function orgLevel(members, poste, depth) {
  if (!members.length && depth > 0) return "";
  const color = POSTE_COLORS[poste] || "#6b7280";
  const icon  = POSTE_ICONS[poste]  || "👤";
  const indent = depth * 32;

  if (!members.length) {
    return `
      <div class="org-row" style="margin-left:${indent}px">
        <div class="org-node org-node-empty" style="border-left:3px solid ${color}40">
          <span class="org-icon">${icon}</span>
          <span class="org-poste" style="color:${color}">${poste}</span>
          <span style="color:var(--text-muted);font-size:.78rem">— Non assigné</span>
        </div>
      </div>`;
  }

  return members.map(u => `
    <div class="org-row" style="margin-left:${indent}px">
      ${depth > 0 ? `<div class="org-connector"></div>` : ""}
      <div class="org-node" style="border-left:3px solid ${color}">
        <div class="org-avatar" style="background:${color}20;color:${color}">${initials(u.displayName)}</div>
        <div class="org-info">
          <div class="org-name">${esc(u.displayName || u.email || "—")}</div>
          <div class="org-poste-label" style="color:${color}">${icon} ${poste}</div>
        </div>
        <span class="role-badge ${u.role}">${u.role}</span>
      </div>
    </div>`).join("");
}

function orgLevelInner(members, poste) {
  const color = POSTE_COLORS[poste] || "#6b7280";
  const icon  = POSTE_ICONS[poste]  || "👤";

  if (!members.length) {
    return `
      <div class="org-gest-block">
        <div class="org-node org-node-empty" style="border-left:3px solid ${color}40">
          <span class="org-icon">${icon}</span>
          <span class="org-poste" style="color:${color}40;font-size:.8rem">${poste}</span>
          <span style="color:var(--text-muted);font-size:.75rem">Non assigné</span>
        </div>
      </div>`;
  }

  return members.map(u => `
    <div class="org-gest-block">
      <div class="org-connector-v"></div>
      <div class="org-node" style="border-left:3px solid ${color}">
        <div class="org-avatar" style="background:${color}20;color:${color}">${initials(u.displayName)}</div>
        <div class="org-info">
          <div class="org-name">${esc(u.displayName || u.email || "—")}</div>
          <div class="org-poste-label" style="color:${color}">${icon} ${poste}</div>
        </div>
        <span class="role-badge ${u.role}">${u.role}</span>
      </div>
    </div>`).join("");
}

function memberChip(u) {
  return `<div style="display:flex;align-items:center;gap:6px;background:var(--bg-surface);border:1px solid var(--border-subtle);border-radius:20px;padding:4px 12px 4px 6px">
    <div style="width:26px;height:26px;border-radius:50%;background:var(--bg-input);display:flex;align-items:center;justify-content:center;font-size:.72rem;font-weight:700;color:var(--text-secondary)">${initials(u.displayName)}</div>
    <span style="font-size:.82rem;color:var(--text-secondary)">${esc(u.displayName || u.email)}</span>
    <span class="role-badge ${u.role}" style="font-size:.65rem;padding:1px 6px">${u.role}</span>
  </div>`;
}

function initials(name) {
  return (name || "?").slice(0, 2).toUpperCase();
}

function esc(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
