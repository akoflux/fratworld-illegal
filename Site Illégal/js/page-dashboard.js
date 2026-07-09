import { requireAuth, isSpectateur } from "./auth.js";
import { subscribeEntries, markDeadlineReminderSent } from "./entries.js";
import { loadSettings, getVotesNeeded } from "./settings.js";
import { sendDiscordNotification } from "./discord.js";
import { renderNavbar, formatDate, statusClass, statusBadge, setDeadlineBadge } from "./ui-shared.js";
import { db } from "./firebase-init.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let unsubscribe  = null;
let VOTES_NEEDED = 3;

requireAuth(async () => {
  renderNavbar("dashboard");
  loadAnnouncement();
  const settings = await loadSettings();
  VOTES_NEEDED   = getVotesNeeded(settings);
  unsubscribe    = subscribeEntries(entries => {
    renderStats(entries);
    renderBreakdown(entries);
    renderPinned(entries);
    renderVotes(entries);
    renderActivity(entries);
    renderWeeklyStats(entries);
    checkDeadlines(entries);
  });
  if (isSpectateur()) {
    const btn = document.getElementById("new-entry-btn");
    if (btn) btn.style.display = "none";
  } else {
    document.getElementById("new-entry-btn").addEventListener("click", () => {
      window.location.href = "/entry-form.html";
    });
  }
});

window.addEventListener("beforeunload", () => { if (unsubscribe) unsubscribe(); });

// ── Annonce ───────────────────────────────────────────────────

async function loadAnnouncement() {
  try {
    const snap = await getDoc(doc(db, "settings", "announcement"));
    if (!snap.exists()) return;
    const data = snap.data();

    if (data.expiresAt) {
      const exp = data.expiresAt.toDate?.() ?? new Date(data.expiresAt);
      if (exp < new Date()) return;
    }

    const key = `fw-announce-${data.createdAt?.seconds ?? 0}`;
    if (sessionStorage.getItem(key)) return;

    renderAnnouncement(data, key);
  } catch (_) {}
}

function renderAnnouncement(data, dismissKey) {
  const banner = document.getElementById("announce-banner");
  if (!banner) return;

  const ICONS = { info: "ℹ️", warning: "⚠️", important: "🔴" };
  const icon  = ICONS[data.type] || "📢";

  const leftHtml = data.imageUrl
    ? `<img src="${escAttr(data.imageUrl)}" class="announce-banner-img" alt=""
         onerror="this.style.display='none'" />`
    : `<span class="announce-banner-icon">${icon}</span>`;

  const metaParts = [`Publié par ${esc(data.createdBy || "Admin")}`];
  if (data.expiresAt) {
    const exp    = data.expiresAt.toDate?.() ?? new Date(data.expiresAt);
    const expStr = exp.toLocaleDateString("fr-FR", {
      day: "2-digit", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    }).replace(",", " à");
    metaParts.push(`Expire le ${expStr}`);
  }

  banner.className    = `announce-banner ${data.type || "info"}`;
  banner.style.display = "flex";
  banner.innerHTML    = `
    ${leftHtml}
    <div class="announce-banner-body">
      <div class="announce-banner-text">${icon} ${esc(data.message)}</div>
      <div class="announce-banner-meta">${metaParts.join(" · ")}</div>
    </div>
    <button class="announce-banner-close" title="Masquer pour cette session"
      onclick="dismissAnnouncement('${escAttr(dismissKey)}')">✕</button>`;
}

window.dismissAnnouncement = (key) => {
  sessionStorage.setItem(key, "1");
  const banner = document.getElementById("announce-banner");
  if (!banner) return;
  banner.style.transition = "opacity .2s ease, transform .2s ease";
  banner.style.opacity    = "0";
  banner.style.transform  = "translateY(-6px)";
  setTimeout(() => { banner.style.display = "none"; }, 210);
};

function esc(s)     { return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function escAttr(s) { return String(s || "").replace(/"/g,"&quot;").replace(/'/g,"&#39;"); }

function renderStats(entries) {
  document.getElementById("stat-total").textContent   = entries.length;
  document.getElementById("stat-valid").textContent   = entries.filter(e => e.status === "Validé").length;
  document.getElementById("stat-refused").textContent = entries.filter(e => e.status === "Refusé").length;
  document.getElementById("stat-debate").textContent  = entries.filter(e => e.status === "En débat" || e.status === "En attente").length;
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
    "Autre":                  "#6b7280"
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

function renderPinned(entries) {
  const container = document.getElementById("pinned-list");
  const panel     = document.getElementById("pinned-panel");
  if (!container) return;

  const pinned = entries.filter(e => e.pinned);

  if (!pinned.length) {
    panel.style.display = "none";
    return;
  }

  panel.style.display = "";
  container.innerHTML = pinned.map(e => {
    const cls = statusClass(e.status);
    return `
      <div class="activity-item" onclick="window.location.href='/entry-detail.html?id=${e.id}&section=${e.section||'decisions'}'">
        <div class="activity-dot ${cls}"></div>
        <div class="activity-content">
          <div class="activity-title">📌 ${e.title}</div>
          <div class="activity-meta">${e.authorName} · ${e.category} · ${formatDate(e.createdAt)}</div>
        </div>
        ${statusBadge(e.status, !!e.replacedBy)}
      </div>`;
  }).join("");
}

function renderVotes(entries) {
  const container = document.getElementById("votes-list");
  if (!container) return;

  const open = entries.filter(e =>
    e.section === "propositions" &&
    e.status !== "Validé" &&
    e.status !== "Refusé" &&
    e.status !== "Archivée"
  );

  if (!open.length) {
    container.innerHTML = `<div style="padding:18px;text-align:center;color:var(--text-muted);font-size:.82rem">Aucun vote en cours.</div>`;
    return;
  }

  container.innerHTML = open.map(e => {
    const vFor     = (e.votesFor     || []).length;
    const vAgainst = (e.votesAgainst || []).length;
    const vAbstain = (e.votesAbstain || []).length;
    const pctFor     = Math.min(100, Math.round((vFor     / VOTES_NEEDED) * 100));
    const pctAgainst = Math.min(100, Math.round((vAgainst / VOTES_NEEDED) * 100));

    let deadlineHtml = "";
    if (e.voteDeadline) {
      const dl = new Date(e.voteDeadline);
      const expired = dl < new Date();
      const dlStr = dl.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
      deadlineHtml = `<span class="vote-deadline ${expired ? "expired" : ""}" style="font-size:.7rem;padding:2px 8px">⏰ ${dlStr}</span>`;
    }

    return `
      <div class="activity-item" style="flex-direction:column;align-items:stretch;gap:8px;cursor:pointer"
           onclick="window.location.href='/entry-detail.html?id=${e.id}&section=propositions'">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
          <div>
            <div class="activity-title">${e.title}</div>
            <div class="activity-meta">${e.category} · ${e.authorName} · ${formatDate(e.createdAt)}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
            <span style="font-size:.75rem;color:var(--text-muted);white-space:nowrap">${vFor + vAgainst + vAbstain} vote(s)</span>
            ${deadlineHtml}
          </div>
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
          ${vAbstain ? `<div style="font-size:.7rem;color:var(--text-muted)">${vAbstain} abstention(s)</div>` : ""}
        </div>
      </div>`;
  }).join("");
}

// ── Deadlines ─────────────────────────────────────────────────

const _sentThisSession = new Set();

async function checkDeadlines(entries) {
  const now    = new Date();
  const h24    = 24 * 60 * 60 * 1000;
  const urgent = entries.filter(e =>
    e.section === "propositions" &&
    e.status !== "Validé" && e.status !== "Refusé" &&
    e.voteDeadline &&
    !e.deadlineReminderSent &&
    new Date(e.voteDeadline) > now &&
    new Date(e.voteDeadline) - now <= h24
  );

  setDeadlineBadge(urgent.length);

  for (const entry of urgent) {
    if (_sentThisSession.has(entry.id)) continue;
    _sentThisSession.add(entry.id);
    try {
      await sendDiscordNotification("deadline_reminder", entry);
      await markDeadlineReminderSent(entry.id);
    } catch (err) {
      console.error("Deadline reminder error:", err);
    }
  }
}

// ── Stats hebdomadaires ───────────────────────────────────────

function renderWeeklyStats(entries) {
  const container = document.getElementById("stats-chart");
  if (!container) return;

  const WEEKS = 8;
  const now   = new Date();

  // Construire les 8 semaines (lundi → dimanche)
  const weeks = [];
  for (let i = WEEKS - 1; i >= 0; i--) {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay() - i * 7 + 1); // lundi
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    const label = start.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
    weeks.push({ start, end, label, count: 0 });
  }

  // Compter les entrées créées par semaine
  entries.forEach(e => {
    const d = e.createdAt?.toDate?.() ?? (e.createdAt ? new Date(e.createdAt) : null);
    if (!d) return;
    for (const w of weeks) {
      if (d >= w.start && d <= w.end) { w.count++; break; }
    }
  });

  const maxCount = Math.max(...weeks.map(w => w.count), 1);
  const totalThisWeek = weeks[WEEKS - 1].count;
  const totalLastWeek = weeks[WEEKS - 2].count;

  const barsHtml = weeks.map(w => {
    const pct = Math.round((w.count / maxCount) * 100);
    return `
      <div class="stats-chart-col">
        <div class="stats-chart-count">${w.count || ""}</div>
        <div class="stats-chart-bar ${w.count > 0 ? "filled" : ""}" style="height:${Math.max(pct, 2)}%"></div>
        <div class="stats-chart-label">${w.label}</div>
      </div>`;
  }).join("");

  const trend = totalThisWeek > totalLastWeek
    ? `<span style="color:var(--s-valid)">▲ ${totalThisWeek - totalLastWeek} vs semaine préc.</span>`
    : totalThisWeek < totalLastWeek
    ? `<span style="color:var(--s-refused)">▼ ${totalLastWeek - totalThisWeek} vs semaine préc.</span>`
    : `<span style="color:var(--text-muted)">= identique à la semaine préc.</span>`;

  container.innerHTML = `
    <div class="stats-chart-wrap">${barsHtml}</div>
    <div class="stats-legend">
      <div class="stats-legend-item">
        <div class="stats-legend-dot" style="background:var(--accent)"></div>
        Cette semaine : <strong>${totalThisWeek} entrée${totalThisWeek !== 1 ? "s" : ""}</strong>
      </div>
      <div class="stats-legend-item">${trend}</div>
      <div class="stats-legend-item" style="color:var(--text-muted)">Total 8 sem. : ${entries.length > 0 ? weeks.reduce((s,w) => s+w.count,0) : 0}</div>
    </div>`;
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
      <div class="activity-item" onclick="window.location.href='/entry-detail.html?id=${e.id}&section=${e.section||'decisions'}'">
        <div class="activity-dot ${cls}"></div>
        <div class="activity-content">
          <div class="activity-title">${e.pinned ? "📌 " : ""}${e.title}</div>
          <div class="activity-meta">${e.authorName} · ${e.category} · ${formatDate(e.createdAt)}</div>
        </div>
        ${statusBadge(e.status, !!e.replacedBy)}
      </div>`;
  }).join("");
}
