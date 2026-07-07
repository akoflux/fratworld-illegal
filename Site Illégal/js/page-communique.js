import { db } from "./firebase-init.js";
import { requireAuth, getCurrentUser, getCurrentUserData } from "./auth.js";
import { getEntry } from "./entries.js";
import { renderNavbar, getParam } from "./ui-shared.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const POSTE_TITLES = {
  "Responsable":                  "Responsable Staff Illégal — FratWorld RP",
  "Co-Responsable":               "Co-Responsable Staff Illégal — FratWorld RP",
  "Gestionnaire Mafia/Cartel":    "Gestionnaire Mafia & Cartel — FratWorld RP",
  "Gestionnaire Groupe Atypique": "Gestionnaire Groupe Atypique — FratWorld RP",
  "Gestionnaire Gang":            "Gestionnaire Gang — FratWorld RP"
};

requireAuth(async () => {
  renderNavbar("communique");

  const userData = getCurrentUserData();
  const name = userData?.displayName || "";
  document.getElementById("c-signataire").value = name;
  syncField("c-signataire", "doc-signataire");

  // Poste → titre signataire depuis Firestore
  try {
    const user = getCurrentUser();
    if (user) {
      const snap = await getDoc(doc(db, "users", user.uid));
      const poste = snap.data()?.poste;
      if (poste && POSTE_TITLES[poste]) {
        document.getElementById("c-titre-signataire").value = POSTE_TITLES[poste];
        syncField("c-titre-signataire", "doc-titre-signataire");
      }
    }
  } catch (_) {}

  // Date du jour par défaut
  document.getElementById("c-date").value = new Date().toISOString().slice(0, 10);
  syncField("c-date", "doc-date", formatDateFr);

  // Gestion type personnalisé
  const typeSelect      = document.getElementById("c-type");
  const typeCustomGroup = document.getElementById("c-type-custom-group");
  const typeCustomInput = document.getElementById("c-type-custom");

  typeSelect.addEventListener("change", () => {
    const isCustom = typeSelect.value === "__custom__";
    typeCustomGroup.style.display = isCustom ? "" : "none";
    if (isCustom) typeCustomInput.focus();
    syncDocType();
  });
  typeCustomInput.addEventListener("input", syncDocType);

  // Pré-remplissage depuis ?from=<id>
  const fromId = getParam("from");
  if (fromId) {
    try {
      const entry = await getEntry(fromId);
      if (entry) {
        document.getElementById("c-titre").value = entry.title;
        document.getElementById("c-corps").value = entry.description;
        if (entry.factions?.length)
          document.getElementById("c-destinataires").value = entry.factions.join(", ");
        if (entry.category === "Règle tranchée" || entry.category === "Position officielle")
          typeSelect.value = "RÈGLE OFFICIELLE";
        else if (entry.category === "Proposition règlement")
          typeSelect.value = "MISE À JOUR RÈGLEMENT";
        updateAllPreviews();
      }
    } catch (_) {}
  }

  // Liaison live champs → aperçu
  bindField("c-titre",            "doc-titre");
  bindField("c-destinataires",    "doc-destinataires");
  bindField("c-corps",            "doc-corps");
  bindField("c-signataire",       "doc-signataire");
  bindField("c-titre-signataire", "doc-titre-signataire");
  bindDate("c-date", "doc-date");
  bindRef("c-ref", "doc-ref");

  updateAllPreviews();
});

function syncDocType() {
  const typeSelect      = document.getElementById("c-type");
  const typeCustomInput = document.getElementById("c-type-custom");
  const dest            = document.getElementById("doc-type");
  if (!dest) return;
  dest.textContent = typeSelect.value === "__custom__"
    ? (typeCustomInput.value.trim().toUpperCase() || "—")
    : typeSelect.value;
}

function bindField(srcId, destId, transform) {
  const src = document.getElementById(srcId);
  if (!src) return;
  src.addEventListener("input", () => syncField(srcId, destId, transform));
}

function bindDate(srcId, destId) {
  const src = document.getElementById(srcId);
  if (!src) return;
  src.addEventListener("input", () => syncField(srcId, destId, formatDateFr));
}

function bindRef(srcId, destId) {
  const src = document.getElementById(srcId);
  if (!src) return;
  src.addEventListener("input", () => {
    const dest = document.getElementById(destId);
    if (!dest) return;
    const val = src.value.trim();
    if (val) { dest.textContent = `Réf. : ${val}`; dest.style.display = ""; }
    else dest.style.display = "none";
  });
}

function syncField(srcId, destId, transform) {
  const src  = document.getElementById(srcId);
  const dest = document.getElementById(destId);
  if (!src || !dest) return;
  const val = src.value || "";
  dest.textContent = transform ? (transform(val) || "—") : (val || "—");
}

function updateAllPreviews() {
  syncDocType();
  syncField("c-titre",            "doc-titre");
  syncField("c-destinataires",    "doc-destinataires");
  syncField("c-corps",            "doc-corps");
  syncField("c-signataire",       "doc-signataire");
  syncField("c-titre-signataire", "doc-titre-signataire");
  syncField("c-date",             "doc-date", formatDateFr);
  const ref  = document.getElementById("c-ref");
  const dest = document.getElementById("doc-ref");
  if (ref && dest) {
    const val = ref.value.trim();
    if (val) { dest.textContent = `Réf. : ${val}`; dest.style.display = ""; }
    else dest.style.display = "none";
  }
}

function formatDateFr(isoDate) {
  if (!isoDate) return "";
  try {
    return new Date(isoDate + "T00:00:00").toLocaleDateString("fr-FR", {
      day: "2-digit", month: "long", year: "numeric"
    });
  } catch (_) { return isoDate; }
}

window.resetForm = () => {
  document.getElementById("c-type").value                   = "COMMUNIQUÉ OFFICIEL";
  document.getElementById("c-type-custom-group").style.display = "none";
  document.getElementById("c-type-custom").value            = "";
  document.getElementById("c-titre").value                  = "";
  document.getElementById("c-destinataires").value          = "";
  document.getElementById("c-ref").value                    = "";
  document.getElementById("c-corps").value                  = "";
  document.getElementById("c-date").value                   = new Date().toISOString().slice(0, 10);
  document.getElementById("c-titre-signataire").value       = "Référent Illégal — FratWorld RP";
  updateAllPreviews();
};

window.exportImage = async () => {
  const btn = document.getElementById("export-btn");
  if (btn) { btn.disabled = true; btn.textContent = "⏳ Export en cours…"; }
  try {
    if (!window.html2canvas) throw new Error("html2canvas non chargé");
    const el     = document.getElementById("communique-doc");
    const canvas = await window.html2canvas(el, {
      scale: 2.5,
      useCORS: true,
      logging: false,
      backgroundColor: "#12141c"
    });
    const link      = document.createElement("a");
    const titreVal  = document.getElementById("c-titre")?.value?.trim() || "communique";
    link.download   = `communique-${titreVal.slice(0, 40).replace(/\s+/g, "-").toLowerCase()}.png`;
    link.href       = canvas.toDataURL("image/png");
    link.click();
  } catch (err) {
    console.error(err);
    alert("Erreur lors de l'export : " + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "📸 Exporter en image"; }
  }
};
