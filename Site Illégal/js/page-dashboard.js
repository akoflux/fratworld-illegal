import { requireAuth } from "./auth.js";
import { subscribeEntries } from "./entries.js";
import { renderNavbar, formatDate, statusClass, statusBadge } from "./ui-shared.js";

let unsubscribe = null;

requireAuth(async () => {
  renderNavbar("dashboard");
  unsubscribe = subscribeEntries(entries => {
    renderStats(entries);
    renderBreakdown(entries);
    renderVotes(entries);
    renderActivity(entries);
  });
  document.getElementById("new-entry-btn").addEventListener("click", () => {
    window.location.href = "/entry-form.html";
  });
});

window.addEventListener("beforeunload", () => { if (unsubscribe) unsubscribe(); });

function renderStats(entries) {
  document.getElementById("stat-total").textContent   = entries.length;
  document.getElementById("stat-valid").textContent   = entries.filter(e => e.status === "Validé").length;
  document.getElementById("stat-refused").textContent = entries.filter(e => e.status === "Refusé").length;
  document.getElementById("stat-debate").textContent  = entries.filter(e => e.status === "En débat").length;
}

function renderBreakdown(entries) {
  const CAT_COLORS = {
    "Position officielle":    "#f97316",
    "Règle tranchée":         "#fb923c",
    "Historique débat":       "#fed7aa",
    "Fiche faction":          "#c084fc",
    "Règle faction":          "#a855f7",
    "Accord inter-faction":   "#7c3aed",
    "Proposition règlement":  "#22c55e",
    "Idée mécanique":         "#4ade80",
    "Ajout serveur (règle, mécanique)": "#86efac",
    "Autre":                  "#6b7280",
    "Décision & position prise":       "#f97316",
    "Historique débat staff":          "#fed7aa"
  };

  const catCounts = {};
  entries.forEach(e => { catCounts[e.category] = (catCounts[e.category] || 0) + 1; });

  const catHtml = Object.entries(catCounts).sort((a,b) => b[1]-a[1]).map(([cat, count]) => `
    <div class="breakdown-item">
      <div class="breakdown-label">
        <div class="breakdown-dot" style="background:${CAT_COLORS[cat] || "#6b7280"}"></div>
        <span>${cat}</span>
      </div>
      <span class="breakdown-count">${count}</span>
    </div>`).join("") || `<div style="padding:14px 18px;color:var(--text-muted);font-size:.82rem">Aucune entrée</div>`;

  document.getElementById("breakdown-cat").innerHTML = catHtml;

  const SECTION_COLORS = { decisions: "#f97316", factions: "#c084fc", propositions: "#22c55e" };
  const SECTION_LABELS = { decisions: "Décisions", factions: "Factions", propositions: "Propositions" };

  const secCounts = { decisions: 0, factions: 0, propositions: 0 };
  entries.forEach(e => {
    const s = e.section || "decisions";
    if (secCounts[s] !== undefined) secCounts[s]++;
  });

  const secHtml = Object.entries(secCounts).map(([s, count]) => `
    <div class="breakdown-item">
      <div class="breakdown-label">
        <div class="breakdown-dot" style="background:${SECTION_COLORS[s]}"></div>
        <span>${SECTION_LABELS[s]}</span>
      </div>
      <span class="breakdown-count">${count}</span>
    </div>`).join("");

  document.getElementById("breakdown-fac").innerHTML = secHtml;
}

const VOTES_NEEDED = 3;

function renderVotes(entries) {
  const container = document.getElementById("votes-list");
  if (!container) return;

  const open = entries.filter(e =>
    e.section === "propositions" &&
    e.status !== "Validé" &&
    e.status !== "Refusé"
  );

  if (!open.length) {
    container.innerHTML = `<div style="padding:18px;text-align:center;color:var(--text-muted);font-size:.82rem">Aucun vote en cours.</div>`;
    return;
  }

  container.innerHTML = open.map(e => {
    const vFor     = (e.votesFor     || []).length;
    const vAgainst = (e.votesAgainst || []).length;
    const pctFor     = Math.min(100, Math.round((vFor     / VOTES_NEEDED) * 100));
    const pctAgainst = Math.min(100, Math.round((vAgainst / VOTES_NEEDED) * 100));

    return `
      <div class="activity-item" style="flex-direction:column;align-items:stretch;gap:8px;cursor:pointer"
           onclick="window.location.href='/entry-detail.html?id=${e.id}&section=propositions'">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div>
            <div class="activity-title">${e.title}</div>
            <div class="activity-meta">${e.category} · ${e.authorName} · ${formatDate(e.createdAt)}</div>
          </div>
          <span style="font-size:.75rem;color:var(--text-muted);white-space:nowrap">${vFor + vAgainst} vote(s)</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px">
          <div class="vote-bar-row" style="font-size:.75rem">
            <span class="vote-bar-label" style="min-width:40px">Pour</span>
            <div class="vote-bar-track" style="flex:1;height:6px">
              <div class="vote-bar-fill vote-for" style="width:${pctFor}%;height:6px"></div>
            </div>
            <span class="vote-bar-count" style="min-width:32px;text-align:right">${vFor}/${VOTES_NEEDED}</span>
          </div>
          <div class="vote-bar-row" style="font-size:.75rem">
            <span class="vote-bar-label" style="min-width:40px">Contre</span>
            <div class="vote-bar-track" style="flex:1;height:6px">
              <div class="vote-bar-fill vote-against" style="width:${pctAgainst}%;height:6px"></div>
            </div>
            <span class="vote-bar-count" style="min-width:32px;text-align:right">${vAgainst}/${VOTES_NEEDED}</span>
          </div>
        </div>
      </div>`;
  }).join("");
}

function renderActivity(entries) {
  const container = document.getElementById("activity-list");
  const recent    = entries.slice(0, 12);

  if (!recent.length) {
    container.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:.82rem">Aucune activité</div>`;
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
      </div>`;
  }).join("");
}
