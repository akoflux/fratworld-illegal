import { requireAuth, canEdit, isSpectateur } from "./auth.js";
import { getEntry, getEntries, createEntry, updateEntry } from "./entries.js";
import { getFactionNames } from "./factions-list.js";
import { renderNavbar, showToast, getParam, normalizeFactions } from "./ui-shared.js";

let editMode      = false;
let entryId       = null;
let originalEntry = null;
let allEntries    = [];
let currentTags   = [];

const SECTION_PARAM = getParam("section") || "decisions";

const CATS_BY_SECTION = {
  decisions:    ["Position officielle", "Règle tranchée", "Historique débat"],
  factions:     ["Fiche faction", "Règle faction", "Accord inter-faction"],
  propositions: ["Proposition règlement", "Idée mécanique", "Ajout serveur (règle, mécanique)", "Autre"]
};

const FACTIONS_FALLBACK = ["Cartel", "Mafia", "MC / Groupe atypique", "Gang", "Indépendant", "Toutes"];

// ── Templates ─────────────────────────────────────────────────
const TEMPLATES = [
  {
    label: "📌 Position officielle",
    section: "decisions", category: "Position officielle", status: "Validé",
    title: "Position officielle — ",
    description: "Le staff illégal a tranché la position suivante :\n\n• \n• \n\nContexte : "
  },
  {
    label: "📝 Proposition de règlement",
    section: "propositions", category: "Proposition règlement", status: "En attente",
    title: "Proposition — ",
    description: "Je propose la règle/modification suivante :\n\nJustification :\n\nImpact attendu :\n\nExceptions éventuelles :"
  },
  {
    label: "📐 Règle tranchée",
    section: "decisions", category: "Règle tranchée", status: "Validé",
    title: "Règle — ",
    description: "Règle applicable immédiatement :\n\n• \n• \n\nSanctions en cas de non-respect :"
  },
  {
    label: "🏴 Fiche faction",
    section: "factions", category: "Fiche faction", status: "Validé",
    title: "Fiche — ",
    description: "Nom : \nType : \nLead : \nCo-Lead : \nActivité principale : \nZone d'influence : \n\nAccords :\n• \n\nContraintes RP :\n• "
  }
];

requireAuth(async () => {
  if (isSpectateur()) { window.location.href = "/entries.html"; return; }

  renderNavbar(SECTION_PARAM);

  entryId  = getParam("id");
  editMode = !!entryId;

  let factionNames = FACTIONS_FALLBACK;
  try {
    const fromFirestore = await getFactionNames();
    if (fromFirestore.length) {
      factionNames = fromFirestore.includes("Toutes") ? fromFirestore : [...fromFirestore, "Toutes"];
    }
  } catch(_) { factionNames = FACTIONS_FALLBACK; }

  allEntries = await getEntries();

  if (editMode) {
    originalEntry = await getEntry(entryId);
    if (!originalEntry) { window.location.href = "/entries.html"; return; }
    if (!canEdit(originalEntry)) {
      showToast("Tu n'as pas les droits pour modifier cette entrée.", "error");
      setTimeout(() => window.location.href = `/entry-detail.html?id=${entryId}`, 1200);
      return;
    }
    document.getElementById("page-title").textContent       = "Modifier l'entrée";
    document.getElementById("breadcrumb-action").textContent = "Modifier";
    document.getElementById("submit-btn").textContent        = "Enregistrer";
  }

  const section = editMode ? (originalEntry.section || SECTION_PARAM) : SECTION_PARAM;
  renderNavbar(section);
  buildCategorySelect(section);
  buildFactionCheckboxes(
    editMode ? normalizeFactions(originalEntry.factions || originalEntry.faction) : [],
    factionNames
  );
  buildReplacesSelect(editMode ? entryId : null);
  toggleDeadlineField(section);
  buildTagsInput();
  injectTemplateBar();

  if (editMode) prefillForm(originalEntry);

  document.getElementById("entry-form").addEventListener("submit", handleSubmit);
  document.getElementById("cancel-btn").addEventListener("click", () => {
    window.location.href = editMode ? `/entry-detail.html?id=${entryId}` : "/entries.html";
  });
});

// ── Templates ─────────────────────────────────────────────────

function injectTemplateBar() {
  if (editMode) return;
  const form = document.getElementById("entry-form");
  const bar = document.createElement("div");
  bar.className = "template-bar";
  bar.innerHTML = `
    <span class="template-bar-label">Modèle :</span>
    ${TEMPLATES.map((t, i) => `
      <button type="button" class="btn btn-secondary btn-sm template-btn" data-idx="${i}">${t.label}</button>
    `).join("")}`;
  form.prepend(bar);
  bar.querySelectorAll(".template-btn").forEach(btn => {
    btn.addEventListener("click", () => applyTemplate(TEMPLATES[+btn.dataset.idx]));
  });
}

function applyTemplate(tpl) {
  const sectionEl = document.getElementById("section-input");
  const section   = tpl.section || sectionEl.value;
  sectionEl.value = section;
  buildCategorySelect(section);
  renderNavbar(section);
  toggleDeadlineField(section);

  document.getElementById("title").value       = tpl.title;
  document.getElementById("description").value = tpl.description;
  document.getElementById("status").value      = tpl.status || "";

  const catOpt = document.querySelector(`#category option[value="${tpl.category}"]`);
  if (catOpt) catOpt.selected = true;

  document.getElementById("title").focus();
  showToast(`Modèle "${tpl.label}" appliqué.`, "success");
}

// ── Tags ──────────────────────────────────────────────────────

function buildTagsInput() {
  const input = document.getElementById("tags-input");
  if (!input) return;

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input.value);
    } else if (e.key === "Backspace" && !input.value && currentTags.length) {
      removeTag(currentTags[currentTags.length - 1]);
    }
  });
  input.addEventListener("blur", () => addTag(input.value));
}

function addTag(raw) {
  const tag = raw.trim().replace(/,+$/, "").trim().toLowerCase();
  const input = document.getElementById("tags-input");
  if (!tag || currentTags.includes(tag) || currentTags.length >= 8) {
    if (input) input.value = "";
    return;
  }
  currentTags.push(tag);
  renderTagChips();
  if (input) input.value = "";
}

function removeTag(tag) {
  currentTags = currentTags.filter(t => t !== tag);
  renderTagChips();
}

function renderTagChips() {
  const container = document.getElementById("tags-chips");
  if (!container) return;
  container.innerHTML = currentTags.map(t =>
    `<span class="tag-chip" data-tag="${t}">${t} <span class="tag-chip-x">×</span></span>`
  ).join("");
  container.querySelectorAll(".tag-chip").forEach(chip => {
    chip.addEventListener("click", () => removeTag(chip.dataset.tag));
  });
}

// ── Deadline ──────────────────────────────────────────────────

function toggleDeadlineField(section) {
  const isPropo = section === "propositions";
  const group   = document.getElementById("deadline-group");
  const docGrp  = document.getElementById("document-url-group");
  if (group)  group.style.display  = isPropo ? "" : "none";
  if (docGrp) docGrp.style.display = isPropo ? "" : "none";

  const label = document.getElementById("description-label");
  const hint  = document.getElementById("description-hint");
  if (label) label.innerHTML = isPropo
    ? `Contenu <span style="color:var(--text-muted);font-weight:400">(optionnel si doc joint)</span>`
    : `Contenu <span class="required">*</span>`;
  if (hint) hint.style.display = isPropo ? "" : "none";
}

function buildCategorySelect(section) {
  const select = document.getElementById("category");
  const cats   = CATS_BY_SECTION[section] || CATS_BY_SECTION.decisions;
  select.innerHTML = `<option value="">— Sélectionner —</option>` +
    cats.map(c => `<option value="${c}">${c}</option>`).join("");
  document.getElementById("section-input").value = section;
}

function buildFactionCheckboxes(selected = [], list = FACTIONS_FALLBACK) {
  const wrap = document.getElementById("faction-checkboxes");
  wrap.innerHTML = list.map(f => `
    <label class="faction-check">
      <input type="checkbox" name="factions" value="${f}" ${selected.includes(f) ? "checked" : ""} />
      ${f}
    </label>`).join("");
}

function buildReplacesSelect(excludeId) {
  const select = document.getElementById("replaces");
  const opts   = allEntries
    .filter(e => e.id !== excludeId)
    .map(e => {
      const sel = originalEntry?.replaces === e.id ? "selected" : "";
      return `<option value="${e.id}" ${sel}>${e.title}</option>`;
    }).join("");
  select.innerHTML = `<option value="">— Aucune —</option>` + opts;
}

function prefillForm(e) {
  document.getElementById("title").value       = e.title       || "";
  document.getElementById("status").value      = e.status      || "";
  document.getElementById("description").value = e.description || "";

  if (e.voteDeadline) {
    const dlField = document.getElementById("vote-deadline");
    if (dlField) dlField.value = e.voteDeadline;
  }
  if (e.documentUrl) {
    const docField = document.getElementById("document-url");
    if (docField) docField.value = e.documentUrl;
  }
  if (Array.isArray(e.tags) && e.tags.length) {
    currentTags = [...e.tags];
    renderTagChips();
  }

  if (e.category) {
    const opt = document.querySelector(`#category option[value="${e.category}"]`);
    if (opt) opt.selected = true;
    else {
      const extra = document.createElement("option");
      extra.value = e.category; extra.textContent = e.category; extra.selected = true;
      document.getElementById("category").appendChild(extra);
    }
  }
}

async function handleSubmit(ev) {
  ev.preventDefault();

  const title       = document.getElementById("title").value.trim();
  const section     = document.getElementById("section-input").value;
  const category    = document.getElementById("category").value;
  const status      = document.getElementById("status").value;
  const description = document.getElementById("description").value.trim();
  const replacesId  = document.getElementById("replaces").value;
  const factions    = [...document.querySelectorAll('input[name="factions"]:checked')].map(cb => cb.value);
  const voteDeadline = section === "propositions"
    ? (document.getElementById("vote-deadline")?.value || null)
    : null;
  const documentUrl = section === "propositions"
    ? (document.getElementById("document-url")?.value?.trim() || null)
    : null;

  // Flush any pending tag
  addTag(document.getElementById("tags-input")?.value || "");

  if (!title)    { showToast("Le titre est requis.", "error"); return; }
  if (!category) { showToast("La catégorie est requise.", "error"); return; }
  if (!status)   { showToast("Le statut est requis.", "error"); return; }
  if (section === "propositions") {
    if (!description && !documentUrl) {
      showToast("Remplis la description ou ajoute un document joint.", "error"); return;
    }
  } else {
    if (!description) { showToast("La description est requise.", "error"); return; }
  }

  const replacesTitle = replacesId ? (allEntries.find(e => e.id === replacesId)?.title || "") : "";

  const btn = document.getElementById("submit-btn");
  btn.disabled = true;
  btn.textContent = "Enregistrement…";

  const data = {
    title, section, category, status, description, factions,
    replaces: replacesId, replacesTitle, voteDeadline, documentUrl,
    tags: [...currentTags]
  };

  try {
    if (editMode) {
      await updateEntry(entryId, data, originalEntry);
      showToast("Entrée mise à jour.", "success");
      setTimeout(() => window.location.href = `/entry-detail.html?id=${entryId}`, 800);
    } else {
      const newId = await createEntry(data);
      showToast("Entrée créée.", "success");
      setTimeout(() => window.location.href = `/entry-detail.html?id=${newId}`, 800);
    }
  } catch (err) {
    showToast("Erreur lors de l'enregistrement.", "error");
    console.error(err);
    btn.disabled = false;
    btn.textContent = editMode ? "Enregistrer" : "Créer l'entrée";
  }
}
