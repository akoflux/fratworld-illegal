import { requireAuth, isAdmin, getCurrentUser } from "./auth.js";
import { createEvent, deleteEvent, subscribeEvents } from "./agenda.js";
import { subscribeEntries } from "./entries.js";
import { renderNavbar, showToast, confirmModal, escapeHtml } from "./ui-shared.js";

let agendaEvents = [];
let entryDeadlines = [];
let unsubAgenda = null;
let unsubEntries = null;

const TYPE_LABEL = {
  reunion:    "Réunion",
  evenement:  "Événement",
  autre:      "Autre",
  deadline:   "Deadline vote"
};

requireAuth(() => {
  renderNavbar("agenda");

  unsubAgenda  = subscribeEvents(evts => { agendaEvents = evts; renderAgenda(); });
  unsubEntries = subscribeEntries(entries => {
    entryDeadlines = entries
      .filter(e => e.voteDeadline && e.section === "propositions"
                && e.status !== "Validé" && e.status !== "Refusé")
      .map(e => ({
        id:        "dl-" + e.id,
        title:     e.title,
        date:      e.voteDeadline,
        type:      "deadline",
        entryId:   e.id
      }));
    renderAgenda();
  });

  document.getElementById("new-event-btn").addEventListener("click", openModal);
  document.getElementById("agenda-cancel-btn").addEventListener("click", closeModal);
  document.getElementById("agenda-modal-overlay").addEventListener("click", closeModal);
  document.getElementById("agenda-form").addEventListener("submit", handleSubmit);
});

window.addEventListener("beforeunload", () => {
  if (unsubAgenda)  unsubAgenda();
  if (unsubEntries) unsubEntries();
});

// ── Render ────────────────────────────────────────────────────

function renderAgenda() {
  const all = [...agendaEvents, ...entryDeadlines]
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const container = document.getElementById("agenda-container");
  if (!all.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📅</div>
        <h3>Aucun événement</h3>
        <p>Ajoute une réunion, un événement ou une deadline.</p>
      </div>`;
    return;
  }

  // Group by day
  const byDay = {};
  all.forEach(ev => {
    const key = new Date(ev.date).toLocaleDateString("fr-FR", {
      weekday: "long", day: "2-digit", month: "long", year: "numeric"
    });
    if (!byDay[key]) byDay[key] = [];
    byDay[key].push(ev);
  });

  const now = new Date();
  container.innerHTML = Object.entries(byDay).map(([day, evts]) => {
    const dayDate   = new Date(evts[0].date);
    const isPast    = dayDate < now;
    const isToday   = dayDate.toDateString() === now.toDateString();
    return `
      <div class="agenda-day-group ${isPast ? "agenda-past" : ""} ${isToday ? "agenda-today" : ""}">
        <div class="agenda-day-label">
          ${isToday ? "📍 " : ""}${capitalize(day)}
          ${isToday ? `<span class="agenda-today-tag">Aujourd'hui</span>` : ""}
        </div>
        <div class="agenda-events">
          ${evts.map(ev => eventCard(ev)).join("")}
        </div>
      </div>`;
  }).join("");
}

function eventCard(ev) {
  const uid   = getCurrentUser()?.uid;
  const admin = isAdmin();
  const canDel = admin || ev.authorUid === uid;
  const time  = new Date(ev.date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const typeCls = `agenda-type-${ev.type}`;

  const link = ev.type === "deadline" && ev.entryId
    ? `<a href="/entry-detail.html?id=${ev.entryId}&section=propositions" class="agenda-entry-link">→ Voir la proposition</a>`
    : "";

  const delBtn = (canDel && ev.type !== "deadline")
    ? `<button class="btn-icon danger" title="Supprimer" onclick="deleteAgendaEvent('${ev.id}','${escapeHtml(ev.title).replace(/'/g,"\\'")}')">✕</button>`
    : "";

  return `
    <div class="agenda-event-card">
      <div class="agenda-event-time">${time}</div>
      <div class="agenda-event-body">
        <div class="agenda-event-top">
          <span class="agenda-type-badge ${typeCls}">${TYPE_LABEL[ev.type] || ev.type}</span>
          <span class="agenda-event-title">${escapeHtml(ev.title)}</span>
        </div>
        ${ev.description ? `<div class="agenda-event-desc">${escapeHtml(ev.description)}</div>` : ""}
        ${link}
        ${ev.authorName ? `<div class="agenda-event-author">Ajouté par ${escapeHtml(ev.authorName)}</div>` : ""}
      </div>
      ${delBtn}
    </div>`;
}

// ── Modal ─────────────────────────────────────────────────────

function openModal() {
  document.getElementById("agenda-modal").style.display = "";
  document.getElementById("agenda-modal-overlay").style.display = "";
}

function closeModal() {
  document.getElementById("agenda-modal").style.display = "none";
  document.getElementById("agenda-modal-overlay").style.display = "none";
  document.getElementById("agenda-form").reset();
}

async function handleSubmit(ev) {
  ev.preventDefault();
  const data = {
    title:       document.getElementById("a-title").value,
    date:        document.getElementById("a-date").value,
    type:        document.getElementById("a-type").value,
    description: document.getElementById("a-desc").value
  };

  const btn = document.getElementById("agenda-submit-btn");
  btn.disabled = true; btn.textContent = "Ajout…";
  try {
    await createEvent(data);
    showToast("Événement ajouté.", "success");
    closeModal();
  } catch (err) {
    showToast("Erreur.", "error"); console.error(err);
  } finally {
    btn.disabled = false; btn.textContent = "Ajouter";
  }
}

// ── Global handlers ───────────────────────────────────────────

window.deleteAgendaEvent = async (id, title) => {
  const ok = await confirmModal("Supprimer l'événement", `Supprimer <strong>${title}</strong> ?`, "Supprimer");
  if (!ok) return;
  try {
    await deleteEvent(id);
    showToast("Événement supprimé.", "success");
  } catch (err) {
    showToast("Erreur.", "error"); console.error(err);
  }
};

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
