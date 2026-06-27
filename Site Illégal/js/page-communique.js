import { requireAuth, getCurrentUserData } from "./auth.js";
import { getEntry } from "./entries.js";
import { renderNavbar, getParam } from "./ui-shared.js";

requireAuth(async () => {
  renderNavbar("communique");

  const userData = getCurrentUserData();
  const name     = userData?.displayName || "";
  document.getElementById("c-signataire").value = name;

  // Date du jour par défaut
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById("c-date").value = today;
  syncField("c-date", "doc-date", formatDateFr);

  // Pré-remplissage depuis une entrée si ?from=<id>
  const fromId = getParam("from");
  if (fromId) {
    try {
      const entry = await getEntry(fromId);
      if (entry) {
        document.getElementById("c-titre").value = entry.title;
        document.getElementById("c-corps").value = entry.description;
        if (entry.factions?.length) {
          document.getElementById("c-destinataires").value = entry.factions.join(", ");
        }
        // Auto-select type selon catégorie
        if (entry.category === "Règle tranchée" || entry.category === "Position officielle") {
          document.getElementById("c-type").value = "RÈGLE OFFICIELLE";
        } else if (entry.category === "Proposition règlement") {
          document.getElementById("c-type").value = "MISE À JOUR RÈGLEMENT";
        }
        updateAllPreviews();
      }
    } catch (_) {}
  }

  // Liaison live de chaque champ
  bindField("c-type",             "doc-type");
  bindField("c-titre",            "doc-titre");
  bindField("c-destinataires",    "doc-destinataires");
  bindField("c-corps",            "doc-corps");
  bindField("c-signataire",       "doc-signataire");
  bindField("c-titre-signataire", "doc-titre-signataire");
  bindDate("c-date", "doc-date");
  bindRef("c-ref", "doc-ref");

  updateAllPreviews();
});

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
    if (val) {
      dest.textContent = `Réf. : ${val}`;
      dest.style.display = "";
    } else {
      dest.style.display = "none";
    }
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
  syncField("c-type",             "doc-type");
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
  document.getElementById("c-type").value             = "COMMUNIQUÉ OFFICIEL";
  document.getElementById("c-titre").value            = "";
  document.getElementById("c-destinataires").value    = "";
  document.getElementById("c-ref").value              = "";
  document.getElementById("c-corps").value            = "";
  document.getElementById("c-date").value             = new Date().toISOString().slice(0, 10);
  document.getElementById("c-titre-signataire").value = "Référent Illégal — FratWorld RP";
  updateAllPreviews();
};
