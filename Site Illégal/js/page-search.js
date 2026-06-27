import { requireAuth } from "./auth.js";
import { getEntries } from "./entries.js";
import { renderNavbar, statusBadge, catBadge, factionBadges, normalizeFactions, formatDate, escapeHtml } from "./ui-shared.js";

let allEntries = [];

requireAuth(async () => {
  renderNavbar("search");

  allEntries = await getEntries();

  const input = document.getElementById("global-search");
  const params = new URLSearchParams(window.location.search);
  const q = params.get("q") || "";
  if (q) { input.value = q; doSearch(q); }

  input.addEventListener("input", () => doSearch(input.value));
  input.focus();
});

const SECTION_LABELS = { decisions: "Décisions", factions: "Factions", propositions: "Propositions" };

function doSearch(raw) {
  const q = raw.trim().toLowerCase();
  const hint = document.getElementById("search-hint");
  const container = document.getElementById("search-results");

  if (q.length < 2) {
    hint.textContent = "Tape au moins 2 caractères pour lancer la recherche.";
    container.innerHTML = "";
    return;
  }

  const results = allEntries.filter(e => {
    const hay = `${e.title} ${e.description} ${e.authorName} ${e.category} ${(e.factions||[]).join(" ")}`.toLowerCase();
    return hay.includes(q);
  });

  hint.textContent = `${results.length} résultat${results.length !== 1 ? "s" : ""} pour "${raw.trim()}"`;

  if (!results.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <h3>Aucun résultat</h3>
        <p>Essaie un autre terme ou vérifie l'orthographe.</p>
      </div>`;
    return;
  }

  // Grouper par section
  const grouped = {};
  results.forEach(e => {
    const s = e.section || "decisions";
    if (!grouped[s]) grouped[s] = [];
    grouped[s].push(e);
  });

  const ORDER = ["decisions", "factions", "propositions"];
  const html = ORDER.filter(s => grouped[s]).map(s => {
    const sectionHtml = grouped[s].map(e => {
      const replaced = !!e.replacedBy;
      const facHtml  = factionBadges(normalizeFactions(e.factions || e.faction));
      const desc = highlight(e.description?.slice(0, 100) + (e.description?.length > 100 ? "…" : ""), q);
      const title = highlight(e.title, q);
      return `
        <div class="search-result-item"
             onclick="window.location.href='/entry-detail.html?id=${e.id}&section=${s}'">
          <div class="search-result-content">
            <div class="search-result-title">${title}</div>
            <div class="search-result-desc">${desc}</div>
            <div class="search-result-meta">
              ${statusBadge(e.status, replaced)}
              ${catBadge(e.category)}
              ${facHtml}
              <span>· ${e.authorName}</span>
              <span>· ${formatDate(e.createdAt)}</span>
            </div>
          </div>
        </div>`;
    }).join("");

    return `
      <div class="search-results-section">
        <div class="search-results-section-title">${SECTION_LABELS[s] || s} (${grouped[s].length})</div>
        ${sectionHtml}
      </div>`;
  }).join("");

  container.innerHTML = html;
}

function highlight(text, q) {
  if (!text || !q) return escapeHtml(text);
  const escaped = escapeHtml(text);
  const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  return escaped.replace(re, `<mark class="hl">$1</mark>`);
}
