import { requireAuth, isAdmin, getCurrentUserData } from "./auth.js";
import { renderNavbar, showToast, confirmModal, formatDate } from "./ui-shared.js";
import { REGLEMENT as STATIC_REGLEMENT } from "./reglement-data.js";
import { db } from "./firebase-init.js";
import {
  collection, doc, getDocs, setDoc, addDoc, deleteDoc, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let sections = [];

requireAuth(async () => {
  if (!isAdmin()) { window.location.href = "/reglement.html"; return; }
  renderNavbar("reglement");

  await loadSections();
  loadHistory();

  document.getElementById("publish-btn").addEventListener("click", handlePublish);
  document.getElementById("add-section-btn").addEventListener("click", addSection);
});

// ── Load ──────────────────────────────────────────────────────

async function loadSections() {
  try {
    const snap = await getDocs(query(collection(db, "reglement"), orderBy("order", "asc")));
    if (snap.size > 0) {
      sections = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } else {
      // Seed depuis les données statiques
      sections = STATIC_REGLEMENT.map((s, i) => ({ ...s, order: i, version: 1 }));
    }
  } catch (_) {
    sections = STATIC_REGLEMENT.map((s, i) => ({ ...s, order: i, version: 1 }));
  }
  renderEditor();
}

async function loadHistory() {
  try {
    const snap = await getDocs(query(collection(db, "reglement_history"), orderBy("savedAt", "desc")));
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const countEl = document.getElementById("history-count");
    if (countEl) countEl.textContent = `${list.length} version${list.length !== 1 ? "s" : ""}`;

    document.getElementById("history-list").innerHTML = list.length
      ? list.map(h => `
          <div class="activity-log-item">
            <span class="activity-log-icon">📜</span>
            <div class="activity-log-content">
              <div class="activity-log-action">Version publiée</div>
              <div class="activity-log-by">Par ${esc(h.savedBy || "?")} · ${formatDate(h.savedAt)}</div>
            </div>
          </div>`).join("")
      : `<div style="padding:12px 0;font-size:.82rem;color:var(--text-muted)">Aucune version enregistrée.</div>`;
  } catch (_) {}
}

// ── Render ────────────────────────────────────────────────────

function renderEditor() {
  const container = document.getElementById("reglement-editor");
  container.innerHTML = sections.map((sec, si) => `
    <div class="panel" style="margin-bottom:20px" data-si="${si}">
      <div class="panel-header" style="gap:8px">
        <div style="display:flex;gap:8px;flex:1;align-items:center">
          <input type="color" class="sec-color" value="${sec.color || "#4f86f7"}" style="width:28px;height:28px;border:none;background:none;cursor:pointer;padding:0" />
          <input type="text" class="sec-label form-control" value="${esc(sec.label || "")}" placeholder="Titre de section" style="font-size:.95rem;font-weight:600;flex:1" />
        </div>
        <button class="btn btn-danger btn-sm del-sec-btn" data-si="${si}" style="flex-shrink:0">✕ Section</button>
      </div>
      <div class="panel-body" style="padding:16px 20px">
        <div class="articles-list" data-si="${si}">
          ${(sec.articles || []).map((a, ai) => articleEditor(si, ai, a)).join("")}
        </div>
        <button class="btn btn-secondary btn-sm add-article-btn" data-si="${si}" style="margin-top:10px">+ Article</button>
      </div>
    </div>`).join("");

  container.querySelectorAll(".del-sec-btn").forEach(btn => {
    btn.addEventListener("click", () => deleteSection(+btn.dataset.si));
  });
  container.querySelectorAll(".add-article-btn").forEach(btn => {
    btn.addEventListener("click", () => addArticle(+btn.dataset.si));
  });
  container.querySelectorAll(".del-art-btn").forEach(btn => {
    btn.addEventListener("click", () => deleteArticle(+btn.dataset.si, +btn.dataset.ai));
  });
}

function articleEditor(si, ai, a) {
  return `
    <div class="article-editor-row" data-si="${si}" data-ai="${ai}">
      <div style="flex:1;min-width:0">
        <input type="text" class="art-title form-control" value="${esc(a.title || "")}" placeholder="Titre de l'article" style="margin-bottom:6px;font-weight:600" />
        <textarea class="art-content form-control" placeholder="Contenu…" style="min-height:80px;font-size:.82rem">${esc(a.content || "")}</textarea>
      </div>
      <button class="btn-icon danger del-art-btn" data-si="${si}" data-ai="${ai}" style="flex-shrink:0;align-self:flex-start;margin-top:4px" title="Supprimer">✕</button>
    </div>`;
}

// ── Mutations ─────────────────────────────────────────────────

function collectState() {
  const container = document.getElementById("reglement-editor");
  const panels    = container.querySelectorAll(".panel[data-si]");
  const result    = [];
  panels.forEach((panel, si) => {
    const label  = panel.querySelector(".sec-label")?.value || "";
    const color  = panel.querySelector(".sec-color")?.value || "#4f86f7";
    const artEls = panel.querySelectorAll(".article-editor-row");
    const arts   = [];
    artEls.forEach((row, ai) => {
      const title   = row.querySelector(".art-title")?.value || "";
      const content = row.querySelector(".art-content")?.value || "";
      arts.push({ id: sections[si]?.articles?.[ai]?.id || `art-${Date.now()}-${ai}`, title, content });
    });
    result.push({ ...sections[si], label, color, articles: arts, order: si });
  });
  return result;
}

function addSection() {
  sections = collectState();
  sections.push({ id: `sec-${Date.now()}`, label: "Nouvelle section", color: "#4f86f7", articles: [], order: sections.length, version: 1 });
  renderEditor();
}

function deleteSection(si) {
  sections = collectState();
  sections.splice(si, 1);
  sections.forEach((s, i) => s.order = i);
  renderEditor();
}

function addArticle(si) {
  sections = collectState();
  if (!sections[si]) return;
  sections[si].articles = sections[si].articles || [];
  sections[si].articles.push({ id: `art-${Date.now()}`, title: "", content: "" });
  renderEditor();
}

function deleteArticle(si, ai) {
  sections = collectState();
  sections[si]?.articles?.splice(ai, 1);
  renderEditor();
}

// ── Publish ───────────────────────────────────────────────────

async function handlePublish() {
  const btn      = document.getElementById("publish-btn");
  const userData = getCurrentUserData();
  btn.disabled = true; btn.textContent = "Publication…";

  try {
    const state = collectState();

    // Snapshot vers l'historique
    await addDoc(collection(db, "reglement_history"), {
      sections:  JSON.parse(JSON.stringify(state)),
      savedAt:   serverTimestamp(),
      savedBy:   userData?.displayName || "Admin"
    });

    // Écrire chaque section (upsert)
    for (const sec of state) {
      const version = (sec.version || 1) + 1;
      await setDoc(doc(db, "reglement", sec.id), {
        label:    sec.label,
        color:    sec.color,
        order:    sec.order,
        articles: sec.articles,
        version,
        updatedAt: serverTimestamp(),
        updatedBy: userData?.displayName || "Admin"
      });
    }

    // Supprimer les sections qui n'existent plus
    const snap = await getDocs(collection(db, "reglement"));
    const stateIds = new Set(state.map(s => s.id));
    for (const d of snap.docs) {
      if (!stateIds.has(d.id)) await deleteDoc(d.ref);
    }

    sections = state.map(s => ({ ...s, version: (s.version || 1) + 1 }));
    showToast("Règlement publié et sauvegardé.", "success");
    loadHistory();
  } catch (err) {
    showToast("Erreur lors de la publication.", "error");
    console.error(err);
  } finally {
    btn.disabled = false; btn.textContent = "💾 Publier";
  }
}

function esc(s) {
  return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
