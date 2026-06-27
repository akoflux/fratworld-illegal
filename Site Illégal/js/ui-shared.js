import { logout, getCurrentUserData, isAdmin } from "./auth.js";

// ── Navbar ────────────────────────────────────────────────────

const NAV_LINKS = [
  { href: "/index.html",        label: "Accueil",     key: "dashboard"  },
  { href: "/entries.html",      label: "Décisions",   key: "decisions"  },
  { href: "/factions.html",     label: "Factions",    key: "factions"   },
  { href: "/entries.html?section=propositions", label: "Propositions", key: "propositions" },
  { href: "/documents.html",    label: "Documents",   key: "documents"  },
  { href: "/reglement.html",    label: "Règlement",   key: "reglement"  },
  { href: "/search.html",       label: "Recherche",   key: "search"     },
  { href: "/communique.html",   label: "Communiqué",  key: "communique" },
  { href: "/admin-users.html",  label: "Admin",       key: "admin", adminOnly: true }
];

export function renderNavbar(activePage) {
  const userData  = getCurrentUserData();
  const name      = userData?.displayName || "Référent";
  const role      = userData?.role || "referent";
  const initials  = name.slice(0, 2).toUpperCase();
  const adminUser = role === "admin";

  const visibleLinks = NAV_LINKS.filter(l => !l.adminOnly || adminUser);

  const linksHtml       = visibleLinks.map(l => `
    <a href="${l.href}" class="nav-link ${activePage === l.key ? "active" : ""}">${l.label}</a>
  `).join("");

  const mobileLinksHtml = visibleLinks.map(l => `
    <a href="${l.href}" class="nav-link ${activePage === l.key ? "active" : ""}"
       style="font-size:.9rem;padding:9px 12px">${l.label}</a>
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
      <div class="navbar-nav" id="nav-links">${linksHtml}</div>

      <div class="navbar-right">
        <div class="user-info">
          <div class="user-avatar">${initials}</div>
          <span style="display:none" class="user-name-text">${name}</span>
          <span class="role-badge ${role}">${role}</span>
        </div>
        <button id="logout-btn" class="btn btn-secondary btn-sm">Quitter</button>
        <button class="nav-hamburger" id="hamburger-btn">☰</button>
      </div>
    </nav>

    <div class="nav-mobile-overlay" id="mobile-overlay"></div>
    <div class="nav-mobile-panel" id="mobile-panel">
      ${mobileLinksHtml}
      <hr style="border-color:var(--border-subtle);margin:6px 0">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0">
        <span style="font-size:.82rem;color:var(--text-secondary)">${name} · <span class="role-badge ${role}">${role}</span></span>
        <button id="logout-btn-mobile" class="btn btn-secondary btn-sm">Déconnexion</button>
      </div>
    </div>
  `;

  document.getElementById("logout-btn").addEventListener("click", () => logout());

  const hamburger = document.getElementById("hamburger-btn");
  const panel     = document.getElementById("mobile-panel");
  const overlay   = document.getElementById("mobile-overlay");
  const logoutMob = document.getElementById("logout-btn-mobile");

  function toggleMenu(open) {
    panel.classList.toggle("open", open);
    overlay.classList.toggle("open", open);
  }

  hamburger.addEventListener("click", () => toggleMenu(!panel.classList.contains("open")));
  overlay.addEventListener("click",   () => toggleMenu(false));
  logoutMob?.addEventListener("click", () => logout());
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
  const icons     = { success: "✓", error: "✕", info: "ℹ" };
  const container = getToastContainer();
  const toast     = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || icons.info}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity   = "0";
    toast.style.transform = "translateX(20px)";
    toast.style.transition= "opacity .3s, transform .3s";
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ── Formatters ────────────────────────────────────────────────

export function formatDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  }).replace(",", " à");
}

export function formatDateShort(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ── Status helpers ────────────────────────────────────────────

export function statusClass(status) {
  const map = {
    "Validé":     "valid",
    "Refusé":     "refused",
    "En débat":   "debate",
    "En attente": "pending",
    "Archivée":   "archived"
  };
  return map[status] || "default";
}

export function statusBadge(status, replaced = false) {
  if (replaced) return `<span class="badge badge-replaced">Remplacée</span>`;
  const cls = statusClass(status);
  return `<span class="badge badge-${cls}">${status}</span>`;
}

export function catBadge(cat) {
  return `<span class="badge badge-cat">${cat}</span>`;
}

// Accepte un string ou un array
export function factionBadges(factions) {
  const list = normalizeFactions(factions);
  if (!list.length || (list.length === 1 && list[0] === "Aucune")) return "";
  return list.map(f => `<span class="badge badge-faction">${f}</span>`).join(" ");
}

// Normalise l'ancien champ `faction` (string) vers array
export function normalizeFactions(factions) {
  if (Array.isArray(factions)) return factions.filter(Boolean);
  if (factions && factions !== "Aucune") return [factions];
  return [];
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
      </div>`;
    document.body.appendChild(overlay);

    overlay.querySelector("#modal-cancel").addEventListener("click",  () => { overlay.remove(); resolve(false); });
    overlay.querySelector("#modal-confirm").addEventListener("click", () => { overlay.remove(); resolve(true); });
    overlay.addEventListener("click", e => { if (e.target === overlay) { overlay.remove(); resolve(false); } });
  });
}

export function showSpinner(containerId) {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = `<div class="spinner-wrap"><div class="spinner"></div></div>`;
}

export function showEmpty(containerId, message = "Aucun résultat.") {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">📭</div>
      <h3>Rien ici</h3>
      <p>${message}</p>
    </div>`;
}

export function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

export function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
