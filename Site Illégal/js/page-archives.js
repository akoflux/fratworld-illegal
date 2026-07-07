import { db } from "./firebase-init.js";
import { requireAuth } from "./auth.js";
import { renderNavbar, formatDate } from "./ui-shared.js";
import {
  collection, getDocs, query, orderBy, where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let allItems  = [];
let activeType = "all";
let searchVal  = "";
let sortMode   = "date-desc";

requireAuth(async () => {
  renderNavbar("archives");

  await loadAllArchives();

  document.getElementById("search-input").addEventListener("input", e => {
    searchVal = e.target.value.toLowerCase();
    render();
  });
  document.getElementById("sort-select").addEventListener("change", e => {
    sortMode = e.target.value;
    render();
  });
  document.querySelectorAll(".section-tab[data-type]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".section-tab[data-type]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeType = btn.dataset.type;
      render();
    });
  });
});

async function loadAllArchives() {
  const container = document.getElementById("archives-container");
  try {
    const [entriesSnap, dossiersSnap] = await Promise.all([
      getDocs(query(collection(db, "entries"), orderBy("updatedAt", "desc"))),
      getDocs(query(collection(db, "dossiers"), orderBy("updatedAt", "desc")))
    ]);

    const entries = entriesSnap.docs
      .map(d => ({ id: d.id, _kind: "entry", ...d.data() }))
      .filter(e => e.status === "Archivée" || e.section === "propositions" && (e.status === "Validé" || e.status === "Refusé"));

    const dossiers = dossiersSnap.docs
      .map(d => ({ id: d.id, _kind: "dossier", ...d.data() }))
      .filter(d => d.archived);

    allItems = [...entries, ...dossiers];
    render();
  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠</div><h3>Erreur de chargement</h3></div>`;
  }
}

function render() {
  let items = allItems.slice();

  // Filtre par type
  if (activeType !== "all") {
    items = items.filter(i => {
      if (activeType === "dossiers")     return i._kind === "dossier";
      if (activeType === "decisions")    return i._kind === "entry" && i.section !== "propositions";
      if (activeType === "propositions") return i._kind === "entry" && i.section === "propositions";
      return true;
    });
  }

  // Filtre recherche
  if (searchVal) {
    items = items.filter(i => {
      const text = [i.title, i.nomGroupe, i.authorName, i.category, i.statut, i.status, i.typeGroupe]
        .filter(Boolean).join(" ").toLowerCase();
      return text.includes(searchVal);
    });
  }

  // Tri
  items.sort((a, b) => {
    const dateA = tsToMs(a.updatedAt ?? a.archivedAt ?? a.createdAt);
    const dateB = tsToMs(b.updatedAt ?? b.archivedAt ?? b.createdAt);
    if (sortMode === "date-asc")  return dateA - dateB;
    if (sortMode === "alpha")     return (a.title || a.nomGroupe || "").localeCompare(b.title || b.nomGroupe || "");
    return dateB - dateA; // date-desc
  });

  document.getElementById("archive-count").textContent =
    `${items.length} élément${items.length !== 1 ? "s" : ""} archivé${items.length !== 1 ? "s" : ""}`;

  const container = document.getElementById("archives-container");
  if (!items.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🗄</div>
        <h3>Aucune archive</h3>
        <p>Aucun élément archivé ne correspond aux filtres sélectionnés.</p>
      </div>`;
    return;
  }

  container.innerHTML = items.map(i =>
    i._kind === "dossier" ? dossierArchiveCard(i) : entryArchiveCard(i)
  ).join("");
}

function entryArchiveCard(e) {
  const isPropo = e.section === "propositions";
  const statusColor = {
    "Archivée": "var(--text-muted)",
    "Validé":   "var(--s-valid)",
    "Refusé":   "var(--s-refused)"
  }[e.status] || "var(--text-muted)";

  const sectionLabel = { decisions: "Décision", propositions: "Proposition", factions: "Faction" }[e.section] || e.section;

  return `
    <div class="detail-card" style="margin-bottom:12px">
      <div class="card-header-bar">
        <div style="flex:1">
          <div style="font-size:.95rem;font-weight:700;color:var(--text-primary)">
            <a href="/entry-detail.html?id=${e.id}&section=${e.section || 'decisions'}"
               style="color:inherit;text-decoration:none">${esc(e.title)}</a>
          </div>
          <div style="font-size:.74rem;color:var(--text-muted);margin-top:3px">
            ${sectionLabel} · ${esc(e.category || "—")} · ${esc(e.authorName || "—")} · ${formatDate(e.updatedAt)}
          </div>
        </div>
        <span style="font-size:.8rem;font-weight:700;color:${statusColor}">${e.status}</span>
      </div>
      ${e.description ? `
        <div class="card-content" style="padding:10px 18px">
          <div style="font-size:.82rem;color:var(--text-secondary);line-height:1.5;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${esc(e.description)}</div>
        </div>` : ""}
    </div>`;
}

function dossierArchiveCard(d) {
  const statutColor = d.statut === "Faction créée" ? "var(--s-valid)"
    : d.statut === "Refusé" ? "var(--s-refused)" : "var(--text-muted)";

  const votesFor     = (d.votesFor || d.votes || []).length;
  const votesAgainst = (d.votesAgainst || []).length;

  return `
    <div class="detail-card" style="margin-bottom:12px">
      <div class="card-header-bar">
        <div style="flex:1">
          <div style="font-size:.95rem;font-weight:700;color:var(--text-primary)">${esc(d.nomGroupe)}</div>
          <div style="font-size:.74rem;color:var(--text-muted);margin-top:3px">
            Dossier · ${esc(d.typeGroupe)} · ${esc(d.authorName || "—")} · ${formatDate(d.archivedAt || d.updatedAt)}
          </div>
          ${d.contactName ? `<div style="font-size:.74rem;color:var(--text-secondary)">👤 ${esc(d.contactName)}${d.contactDiscord ? ` · ${esc(d.contactDiscord)}` : ""}</div>` : ""}
        </div>
        <span style="font-size:.8rem;font-weight:700;color:${statutColor}">${d.statut}</span>
      </div>
      <div class="card-content" style="padding:10px 18px">
        <div style="font-size:.78rem;color:var(--text-muted)">
          ${votesFor} vote(s) pour · ${votesAgainst} vote(s) contre
          ${d.refusalReason ? `<span style="color:var(--s-refused);margin-left:8px">· Motif : <em>${esc(d.refusalReason)}</em></span>` : ""}
        </div>
        <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
          <a href="${d.lienDossier}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm">📄 Dossier</a>
          ${d.factionId ? `<a href="/faction-detail.html?id=${d.factionId}" class="btn btn-secondary btn-sm">🏴 Faction créée</a>` : ""}
        </div>
      </div>
    </div>`;
}

function tsToMs(ts) {
  if (!ts) return 0;
  if (ts.seconds) return ts.seconds * 1000;
  return new Date(ts).getTime();
}

function esc(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
