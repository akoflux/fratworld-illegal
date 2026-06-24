import { requireAuth } from "./auth.js";
import { renderNavbar } from "./ui-shared.js";
import { REGLEMENT } from "./reglement-data.js";

requireAuth(() => {
  renderNavbar("reglement");
  renderAll();

  const searchEl = document.getElementById("reglement-search");
  searchEl.addEventListener("input", () => {
    const q = searchEl.value.trim();
    if (q.length < 2) { renderAll(); return; }
    search(q);
  });
});

// ── Render ────────────────────────────────────────────────────

function renderAll() {
  document.getElementById("reglement-results").textContent = "";
  const container = document.getElementById("reglement-sections");
  container.innerHTML = REGLEMENT.map(sec => sectionHtml(sec, null)).join("");
}

function search(query) {
  const q = query.toLowerCase();
  let totalMatches = 0;

  const html = REGLEMENT.map(sec => {
    const matchingArticles = sec.articles.filter(a =>
      a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q)
    );
    totalMatches += matchingArticles.length;
    if (!matchingArticles.length) return "";
    return sectionHtml({ ...sec, articles: matchingArticles }, q);
  }).join("");

  document.getElementById("reglement-sections").innerHTML =
    html || `<div class="empty-state"><div class="empty-icon">🔍</div><h3>Aucun résultat</h3><p>Modifie ta recherche.</p></div>`;

  document.getElementById("reglement-results").textContent =
    totalMatches ? `${totalMatches} article${totalMatches > 1 ? "s" : ""} trouvé${totalMatches > 1 ? "s" : ""}` : "";
}

function sectionHtml(sec, query) {
  return `
    <div class="reglement-section-block">
      <div class="reglement-section-title" style="color:${sec.color}">
        <span style="width:8px;height:8px;border-radius:50%;background:${sec.color};display:inline-block;flex-shrink:0"></span>
        ${sec.label}
      </div>
      ${sec.articles.map(a => articleHtml(a, query)).join("")}
    </div>`;
}

function articleHtml(article, query) {
  const title   = query ? highlight(article.title,   query) : escHtml(article.title);
  const content = query ? highlight(article.content, query) : escHtml(article.content);
  return `
    <div class="reglement-article">
      <div class="reglement-article-title">${title}</div>
      <div class="reglement-article-content">${content}</div>
    </div>`;
}

function highlight(text, query) {
  const escaped = escHtml(text);
  const re      = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, "gi");
  return escaped.replace(re, `<mark class="hl">$1</mark>`);
}

function escHtml(str) {
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
