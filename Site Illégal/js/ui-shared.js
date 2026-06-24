import { logout, isAdmin, getCurrentUserData } from "./auth.js";

// ── Navbar ────────────────────────────────────────────────────

export function renderNavbar(activePage) {
  const userData = getCurrentUserData();
  const name     = userData?.displayName || "Référent";
  const role     = userData?.role || "referent";
  const initials = name.slice(0, 2).toUpperCase();

  const links = [
    { href: "/index.html",    label: "Tableau de bord", key: "dashboard", icon: "⬛" },
    { href: "/entries.html",  label: "Entrées",          key: "entries",   icon: "≡" }
  ];

  const navLinksHtml = links.map(l => `
    <a href="${l.href}" class="nav-link ${activePage === l.key ? "active" : ""}">
      <span>${l.icon}</span>${l.label}
    </a>
  `).join("");

  document.getElementById("navbar").innerHTML = `
    <nav class="navbar">
      <a href="/index.html" class="navbar-brand">
        <div class="brand-icon">⚔</div>
        <div class="brand-text">
          <span class="brand-name">FratWorld RP</span>
          <span class="brand-sub">Staff Illégal</span>
        </div>
      </a>
      <div class="navbar-divider"></div>
      <div class="navbar-nav">${navLinksHtml}</div>
      <div class="navbar-right">
        <div class="user-info">
          <div class="user-avatar">${initials}</div>
          <span>${name}</span>
          <span class="role-badge ${role}">${role}</span>
        </div>
        <button id="logout-btn" class="btn btn-secondary btn-sm">Déconnexion</button>
      </div>
    </nav>
  `;

  document.getElementById("logout-btn").addEventListener("click", () => logout());
}

// ── Toast notifications ───────────────────────────────────────

let toastContainer = null;

function getToastContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.id = "toast-container";
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

export function showToast(message, type = "info", duration = 3500) {
  const icons = { success: "✓", error: "✕", info: "ℹ" };
  const container = getToastContainer();

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || icons.info}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(20px)";
    toast.style.transition = "opacity .3s, transform .3s";
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ── Formatters ────────────────────────────────────────────────

export function formatDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("fr-FR", {
    day:   "2-digit",
    month: "2-digit",
    year:  "numeric",
    hour:  "2-digit",
    minute:"2-digit"
  }).replace(",", " à");
}

export function formatDateShort(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("fr-FR", {
    day:   "2-digit",
    month: "2-digit",
    year:  "numeric"
  });
}

// ── Status helpers ────────────────────────────────────────────

export function statusClass(status) {
  if (!status) return "default";
  const map = { "Validé": "valid", "Refusé": "refused", "En débat": "debate" };
  return map[status] || "default";
}

export function statusBadge(status, replaced = false) {
  if (replaced) return `<span class="badge badge-replaced">Remplacée</span>`;
  const cls = statusClass(status);
  return `<span class="badge badge-${cls}">${status}</span>`;
}

export function catBadge(cat) {
  const shorts = {
    "Décision & position prise":          "Décision",
    "Ajout serveur (règle, mécanique)":   "Ajout serveur",
    "Fiche faction":                       "Fiche faction",
    "Historique débat staff":              "Débat staff"
  };
  return `<span class="badge badge-cat">${shorts[cat] || cat}</span>`;
}

export function factionBadge(faction) {
  if (!faction || faction === "Aucune") return "";
  return `<span class="badge badge-faction">${faction}</span>`;
}

// ── Confirm modal ─────────────────────────────────────────────

export function confirmModal(title, body, confirmLabel = "Confirmer") {
  return new Promise(resolve => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal">
        <h3>${title}</h3>
        <p>${body}</p>
        <div class="modal-actions">
          <button class="btn btn-secondary" id="modal-cancel">Annuler</button>
          <button class="btn btn-danger"    id="modal-confirm">${confirmLabel}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector("#modal-cancel").addEventListener("click", () => {
      overlay.remove();
      resolve(false);
    });
    overlay.querySelector("#modal-confirm").addEventListener("click", () => {
      overlay.remove();
      resolve(true);
    });
    overlay.addEventListener("click", e => {
      if (e.target === overlay) { overlay.remove(); resolve(false); }
    });
  });
}

// ── Page loading state ────────────────────────────────────────

export function showSpinner(containerId) {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = `<div class="spinner-wrap"><div class="spinner"></div></div>`;
}

export function showEmpty(containerId, message = "Aucune entrée trouvée.") {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">📭</div>
      <h3>Rien ici</h3>
      <p>${message}</p>
    </div>
  `;
}

// ── URL params ────────────────────────────────────────────────

export function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}
