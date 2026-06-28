import { requireAuth, isAdmin, getCurrentUser } from "./auth.js";
import { createMarker, deleteMarker, subscribeMarkers } from "./markers.js";
import { renderNavbar, showToast, confirmModal, escapeHtml } from "./ui-shared.js";

// ── Config carte ──────────────────────────────────────────────
// L'image GTA est projetée sur un système de coordonnées simple.
// On fixe des bounds qui correspondent aux dimensions de l'image.
const MAP_IMG  = "/image/carte-satellite-gta-5.jpg";
const IMG_W    = 4096;  // largeur image (ajusté si nécessaire)
const IMG_H    = 4096;  // hauteur image

// Bounds en coordonnées Leaflet (y inversé car l'image a l'origine en haut-gauche)
const BOUNDS = [[0, 0], [IMG_H, IMG_W]];

const CAT_CONFIG = {
  territoire: { emoji: "🏴", label: "Territoire" },
  planque:    { emoji: "🏠", label: "Planque"    },
  deal:       { emoji: "💊", label: "Deal"        },
  evenement:  { emoji: "⚡", label: "Événement"  },
  danger:     { emoji: "⚠️", label: "Danger"     },
  point:      { emoji: "📍", label: "Point"       }
};

let map          = null;
let placing      = false;
let pendingLatLng = null;
let leafletMarkers = {};   // id → L.marker
let allMarkersData = [];
let unsubscribe  = null;

requireAuth(() => {
  renderNavbar("map");

  initMap();

  unsubscribe = subscribeMarkers(markers => {
    allMarkersData = markers;
    syncMarkers(markers);
    document.getElementById("marker-count").textContent =
      `${markers.length} marqueur${markers.length !== 1 ? "s" : ""}`;
  });

  document.getElementById("btn-view").addEventListener("click",  () => setMode(false));
  document.getElementById("btn-place").addEventListener("click", () => setMode(true));
  document.getElementById("marker-cancel-btn").addEventListener("click", closeModal);
  document.getElementById("marker-modal-overlay").addEventListener("click", closeModal);
  document.getElementById("marker-form").addEventListener("submit", handleSubmit);

  renderLegend();
});

window.addEventListener("beforeunload", () => { if (unsubscribe) unsubscribe(); });

// ── Leaflet init ──────────────────────────────────────────────

function initMap() {
  map = L.map("map", {
    crs:             L.CRS.Simple,
    minZoom:         -3,
    maxZoom:         2,
    zoomSnap:        0.5,
    attributionControl: false
  });

  L.imageOverlay(MAP_IMG, BOUNDS).addTo(map);
  map.fitBounds(BOUNDS);

  map.on("click", onMapClick);
}

// ── Mode placement ────────────────────────────────────────────

function setMode(active) {
  placing = active;
  document.getElementById("btn-view").classList.toggle("active",  !active);
  document.getElementById("btn-place").classList.toggle("active",  active);
  document.getElementById("map").classList.toggle("placing-mode",  active);
  document.getElementById("map-hint").classList.toggle("visible",  active);
}

function onMapClick(e) {
  if (!placing) return;
  pendingLatLng = e.latlng;
  openModal();
}

// ── Sync marqueurs Firestore ──────────────────────────────────

function syncMarkers(markers) {
  // Supprimer les marqueurs retirés
  const ids = new Set(markers.map(m => m.id));
  Object.keys(leafletMarkers).forEach(id => {
    if (!ids.has(id)) { leafletMarkers[id].remove(); delete leafletMarkers[id]; }
  });

  // Ajouter/mettre à jour
  markers.forEach(m => {
    if (leafletMarkers[m.id]) {
      // Met à jour le popup si déjà présent
      leafletMarkers[m.id].setPopupContent(buildPopup(m));
    } else {
      const icon   = buildIcon(m);
      const marker = L.marker([m.lat, m.lng], { icon }).addTo(map);
      marker.bindPopup(buildPopup(m), { maxWidth: 280 });
      leafletMarkers[m.id] = marker;
    }
  });
}

// ── Icon SVG ──────────────────────────────────────────────────

function buildIcon(m) {
  const cfg   = CAT_CONFIG[m.category] || CAT_CONFIG.point;
  const color = m.color || "#f97316";
  const html  = `
    <div class="map-marker-icon" style="background:${color}">
      <div class="map-marker-inner">${cfg.emoji}</div>
    </div>`;
  return L.divIcon({
    html,
    className:  "",
    iconSize:   [28, 28],
    iconAnchor: [14, 28],
    popupAnchor:[0, -30]
  });
}

// ── Popup HTML ────────────────────────────────────────────────

function buildPopup(m) {
  const cfg   = CAT_CONFIG[m.category] || CAT_CONFIG.point;
  const color = m.color || "#f97316";
  const uid   = getCurrentUser()?.uid;
  const canDel = isAdmin() || m.authorUid === uid;

  return `
    <div style="min-width:200px">
      <div class="popup-title">${escapeHtml(m.label)}</div>
      <span class="popup-cat" style="background:${color}20;color:${color};border:1px solid ${color}40">
        ${cfg.emoji} ${cfg.label}
      </span>
      ${m.description ? `<div class="popup-desc">${escapeHtml(m.description)}</div>` : ""}
      <div class="popup-meta">Ajouté par ${escapeHtml(m.authorName)}</div>
      ${canDel ? `
        <div class="popup-actions">
          <button class="btn btn-danger btn-sm" onclick="deleteMarkerById('${m.id}','${escapeHtml(m.label).replace(/'/g,"\\'")}')">✕ Supprimer</button>
        </div>` : ""}
    </div>`;
}

// ── Légende ───────────────────────────────────────────────────

function renderLegend() {
  const colors = {
    territoire: "#c084fc",
    planque:    "#3b82f6",
    deal:       "#22c55e",
    evenement:  "#eab308",
    danger:     "#ef4444",
    point:      "#f97316"
  };
  const container = document.getElementById("map-legend");
  container.innerHTML = Object.entries(CAT_CONFIG).map(([key, cfg]) => `
    <div class="legend-item">
      <div class="legend-dot" style="background:${colors[key]}"></div>
      <span>${cfg.label}</span>
    </div>`).join("");
}

// ── Modal ─────────────────────────────────────────────────────

function openModal() {
  document.getElementById("marker-modal").style.display = "";
  document.getElementById("marker-modal-overlay").style.display = "";
  document.getElementById("marker-form").reset();
  document.getElementById("m-color").value = "#f97316";
}

function closeModal() {
  document.getElementById("marker-modal").style.display = "none";
  document.getElementById("marker-modal-overlay").style.display = "none";
  pendingLatLng = null;
}

async function handleSubmit(ev) {
  ev.preventDefault();
  if (!pendingLatLng) return;

  const data = {
    lat:         pendingLatLng.lat,
    lng:         pendingLatLng.lng,
    label:       document.getElementById("m-label").value,
    category:    document.getElementById("m-category").value,
    color:       document.getElementById("m-color").value,
    description: document.getElementById("m-desc").value
  };

  const btn = document.getElementById("marker-submit-btn");
  btn.disabled = true; btn.textContent = "Placement…";
  try {
    await createMarker(data);
    showToast("Marqueur placé.", "success");
    closeModal();
    setMode(false);
  } catch (err) {
    showToast("Erreur lors du placement.", "error"); console.error(err);
  } finally {
    btn.disabled = false; btn.textContent = "Placer";
  }
}

// ── Global (appelé depuis le popup) ───────────────────────────

window.deleteMarkerById = async (id, label) => {
  const ok = await confirmModal("Supprimer le marqueur", `Supprimer <strong>${label}</strong> ?`, "Supprimer");
  if (!ok) return;
  try {
    await deleteMarker(id);
    showToast("Marqueur supprimé.", "success");
  } catch (err) {
    showToast("Erreur.", "error"); console.error(err);
  }
};
