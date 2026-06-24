import { requireAuth, canEdit } from "./auth.js";
import { getEntry, getEntries, createEntry, updateEntry } from "./entries.js";
import { renderNavbar, showToast, getParam } from "./ui-shared.js";

let editMode    = false;
let entryId     = null;
let originalEntry = null;
let allEntries  = [];

requireAuth(async () => {
  renderNavbar("entries");

  entryId = getParam("id");
  editMode = !!entryId;

  // Charger toutes les entrées pour le champ "remplace"
  allEntries = await getEntries();

  if (editMode) {
    originalEntry = await getEntry(entryId);
    if (!originalEntry) { window.location.href = "/entries.html"; return; }

    // Vérifier les droits avant d'afficher
    if (!canEdit(originalEntry)) {
      showToast("Tu n'as pas le droit de modifier cette entrée.", "error");
      setTimeout(() => window.location.href = `/entry-detail.html?id=${entryId}`, 1200);
      return;
    }

    document.getElementById("page-title").textContent      = "Modifier l'entrée";
    document.getElementById("breadcrumb-action").textContent = "Modifier";
    prefillForm(originalEntry);
  } else {
    document.getElementById("page-title").textContent = "Nouvelle entrée";
  }

  populateReplacesSelect(editMode ? entryId : null);

  document.getElementById("entry-form").addEventListener("submit", handleSubmit);
  document.getElementById("cancel-btn").addEventListener("click", () => {
    window.location.href = editMode ? `/entry-detail.html?id=${entryId}` : "/entries.html";
  });
});

// ── Populate "remplace" select ─────────────────────────────────

function populateReplacesSelect(excludeId) {
  const select = document.getElementById("replaces");
  const options = allEntries
    .filter(e => e.id !== excludeId)
    .map(e => {
      const selected = originalEntry?.replaces === e.id ? "selected" : "";
      return `<option value="${e.id}" ${selected}>${e.title}</option>`;
    }).join("");

  select.innerHTML = `<option value="">— Aucune —</option>` + options;
}

// ── Prefill form for edit ──────────────────────────────────────

function prefillForm(e) {
  document.getElementById("title").value       = e.title       || "";
  document.getElementById("category").value    = e.category    || "";
  document.getElementById("status").value      = e.status      || "";
  document.getElementById("faction").value     = e.faction     || "";
  document.getElementById("description").value = e.description || "";
  // replaces is filled after populateReplacesSelect
}

// ── Submit ─────────────────────────────────────────────────────

async function handleSubmit(e) {
  e.preventDefault();

  const title       = document.getElementById("title").value.trim();
  const category    = document.getElementById("category").value;
  const status      = document.getElementById("status").value;
  const faction     = document.getElementById("faction").value;
  const description = document.getElementById("description").value.trim();
  const replacesId  = document.getElementById("replaces").value;

  // Validation
  if (!title)    { showToast("Le titre est requis.",    "error"); return; }
  if (!category) { showToast("La catégorie est requise.", "error"); return; }
  if (!status)   { showToast("Le statut est requis.",   "error"); return; }
  if (!description) { showToast("La description est requise.", "error"); return; }

  const replacesTitle = replacesId
    ? (allEntries.find(e => e.id === replacesId)?.title || "")
    : "";

  const submitBtn = document.getElementById("submit-btn");
  submitBtn.disabled    = true;
  submitBtn.textContent = editMode ? "Enregistrement…" : "Création…";

  const data = { title, category, status, faction, description, replaces: replacesId, replacesTitle };

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
    submitBtn.disabled    = false;
    submitBtn.textContent = editMode ? "Enregistrer" : "Créer l'entrée";
  }
}
