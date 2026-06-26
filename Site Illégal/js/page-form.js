import { requireAuth, canEdit } from "./auth.js";
import { getEntry, getEntries, createEntry, updateEntry } from "./entries.js";
import { getFactionNames } from "./factions-list.js";
import { renderNavbar, showToast, getParam, normalizeFactions } from "./ui-shared.js";

let editMode      = false;
let entryId       = null;
let originalEntry = null;
let allEntries    = [];

const SECTION_PARAM = getParam("section") || "decisions";

const CATS_BY_SECTION = {
  decisions:    ["Position officielle", "Règle tranchée", "Historique débat"],
  factions:     ["Fiche faction", "Règle faction", "Accord inter-faction"],
  propositions: ["Proposition règlement", "Idée mécanique", "Ajout serveur (règle, mécanique)", "Autre"]
};

const FACTIONS_FALLBACK = ["Cartel", "Mafia", "MC / Groupe atypique", "Gang", "Indépendant", "Toutes"];

requireAuth(async () => {
  renderNavbar(SECTION_PARAM);

  entryId  = getParam("id");
  editMode = !!entryId;

  let factionNames = FACTIONS_FALLBACK;
  try {
    const fromFirestore = await getFactionNames();
    if (fromFirestore.length) {
      // Garde "Toutes" toujours disponible en dernière option
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
  // Re-render navbar with correct section (important en mode édition)
  renderNavbar(section);
  buildCategorySelect(section);
  buildFactionCheckboxes(
    editMode ? normalizeFactions(originalEntry.factions || originalEntry.faction) : [],
    factionNames
  );
  buildReplacesSelect(editMode ? entryId : null);

  if (editMode) prefillForm(originalEntry);

  document.getElementById("entry-form").addEventListener("submit", handleSubmit);
  document.getElementById("cancel-btn").addEventListener("click", () => {
    window.location.href = editMode ? `/entry-detail.html?id=${entryId}` : "/entries.html";
  });
});

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

  if (!title)    { showToast("Le titre est requis.", "error"); return; }
  if (!category) { showToast("La catégorie est requise.", "error"); return; }
  if (!status)   { showToast("Le statut est requis.", "error"); return; }
  if (!description) { showToast("La description est requise.", "error"); return; }

  const replacesTitle = replacesId ? (allEntries.find(e => e.id === replacesId)?.title || "") : "";

  const btn = document.getElementById("submit-btn");
  btn.disabled = true;
  btn.textContent = "Enregistrement…";

  const data = { title, section, category, status, description, factions, replaces: replacesId, replacesTitle };

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
