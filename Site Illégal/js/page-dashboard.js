import { requireAuth } from "./auth.js";
import { getEntries } from "./entries.js";
import { renderNavbar, formatDate, statusClass, catBadge, statusBadge } from "./ui-shared.js";

requireAuth(async (user, userData) => {
  renderNavbar("dashboard");
  await loadDashboard();
});

async function loadDashboard() {
  try {
    const entries = await getEntries();
    renderStats(entries);
    renderBreakdown(entries);
    renderActivity(entries);
    renderNewBtn();
  } catch (err) {
    console.error("Dashboard error:", err);
  }
}

function renderStats(entries) {
  const total   = entries.length;
  const valid   = entries.filter(e => e.status === "Validé").length;
  const refused = entries.filter(e => e.status === "Refusé").length;
  const debate  = entries.filter(e => e.status === "En débat").length;

  document.getElementById("stat-total").textContent   = total;
  document.getElementById("stat-valid").textContent   = valid;
  document.getElementById("stat-refused").textContent = refused;
  document.getElementById("stat-debate").textContent  = debate;
}

function renderBreakdown(entries) {
  const CATEGORIES = [
    "Décision & position prise",
    "Ajout serveur (règle, mécanique)",
    "Fiche faction",
    "Historique débat staff"
  ];

  const FACTIONS = ["Cartel", "Mafia", "Groupe atypique", "Gang", "Toutes", "Aucune"];

  const catCounts = {};
  CATEGORIES.forEach(c => catCounts[c] = 0);
  entries.forEach(e => { if (catCounts[e.category] !== undefined) catCounts[e.category]++; });

  const catColors = {
    "Décision & position prise":          "#4f86f7",
    "Ajout serveur (règle, mécanique)":   "#22c55e",
    "Fiche faction":                       "#c084fc",
    "Historique débat staff":              "#f97316"
  };

  const catHtml = CATEGORIES.map(c => `
    <div class="breakdown-item">
      <div class="breakdown-label">
        <div class="breakdown-dot" style="background:${catColors[c]}"></div>
        <span>${c}</span>
      </div>
      <span class="breakdown-count">${catCounts[c]}</span>
    </div>
  `).join("");

  document.getElementById("breakdown-cat").innerHTML = catHtml;

  const facCounts = {};
  FACTIONS.forEach(f => facCounts[f] = 0);
  entries.forEach(e => { if (facCounts[e.faction] !== undefined) facCounts[e.faction]++; });

  const facColors = {
    "Cartel":         "#ef4444",
    "Mafia":          "#f97316",
    "Groupe atypique":"#eab308",
    "Gang":           "#22c55e",
    "Toutes":         "#4f86f7",
    "Aucune":         "#6b7280"
  };

  const facHtml = FACTIONS
    .filter(f => facCounts[f] > 0)
    .map(f => `
      <div class="breakdown-item">
        <div class="breakdown-label">
          <div class="breakdown-dot" style="background:${facColors[f]}"></div>
          <span>${f}</span>
        </div>
        <span class="breakdown-count">${facCounts[f]}</span>
      </div>
    `).join("") || `<div class="breakdown-item" style="color:var(--text-muted);font-size:.82rem">Aucune donnée</div>`;

  document.getElementById("breakdown-fac").innerHTML = facHtml;
}

function renderActivity(entries) {
  const recent = entries.slice(0, 10);
  const container = document.getElementById("activity-list");

  if (!recent.length) {
    container.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:.82rem">Aucune activité récente</div>`;
    return;
  }

  container.innerHTML = recent.map(e => {
    const cls = statusClass(e.status);
    return `
      <div class="activity-item" onclick="window.location.href='/entry-detail.html?id=${e.id}'">
        <div class="activity-dot ${cls}"></div>
        <div class="activity-content">
          <div class="activity-title">${e.title}</div>
          <div class="activity-meta">${e.authorName} · ${e.category} · ${formatDate(e.createdAt)}</div>
        </div>
        ${statusBadge(e.status, !!e.replacedBy)}
      </div>
    `;
  }).join("");
}

function renderNewBtn() {
  document.getElementById("new-entry-btn").addEventListener("click", () => {
    window.location.href = "/entry-form.html";
  });
}
