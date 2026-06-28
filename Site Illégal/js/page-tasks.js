import { requireAuth, isAdmin, isSpectateur, getCurrentUser } from "./auth.js";
import { createTask, updateTaskStatus, deleteTask, subscribeTasks } from "./tasks.js";
import { renderNavbar, showToast, confirmModal, formatDateShort, escapeHtml } from "./ui-shared.js";
import {
  collection, getDocs, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./firebase-init.js";

let allTasks   = [];
let allUsers   = [];
let unsubscribe = null;

const COLUMNS = [
  { key: "a_faire",    label: "À faire",     cls: "col-todo"    },
  { key: "en_cours",   label: "En cours",    cls: "col-doing"   },
  { key: "termine",    label: "Terminé",     cls: "col-done"    }
];

const PRIORITY_BADGE = {
  haute:    `<span class="task-priority high">🔴 Haute</span>`,
  normale:  `<span class="task-priority mid">🟡 Normale</span>`,
  basse:    `<span class="task-priority low">🟢 Basse</span>`
};

requireAuth(async () => {
  renderNavbar("tasks");
  await loadUsers();
  renderBoard([]);

  unsubscribe = subscribeTasks(tasks => {
    allTasks = tasks;
    renderBoard(tasks);
    document.getElementById("task-count").textContent =
      `${tasks.length} tâche${tasks.length !== 1 ? "s" : ""}`;
  });

  if (isSpectateur()) {
    document.getElementById("new-task-btn").style.display = "none";
  }
  document.getElementById("new-task-btn").addEventListener("click", openModal);
  document.getElementById("task-cancel-btn").addEventListener("click", closeModal);
  document.getElementById("task-modal-overlay").addEventListener("click", closeModal);
  document.getElementById("task-form").addEventListener("submit", handleSubmit);
});

window.addEventListener("beforeunload", () => { if (unsubscribe) unsubscribe(); });

// ── Users ─────────────────────────────────────────────────────

async function loadUsers() {
  try {
    const q    = query(collection(db, "users"), orderBy("displayName", "asc"));
    const snap = await getDocs(q);
    allUsers   = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const sel  = document.getElementById("t-assignee");
    sel.innerHTML = `<option value="">Tous</option>` +
      allUsers.map(u => `<option value="${u.id}">${escapeHtml(u.displayName || u.email)}</option>`).join("");
  } catch { /* silent */ }
}

// ── Board ─────────────────────────────────────────────────────

function renderBoard(tasks) {
  const board = document.getElementById("task-board");
  board.innerHTML = COLUMNS.map(col => {
    const items = tasks.filter(t => t.status === col.key);
    return `
      <div class="kanban-col ${col.cls}">
        <div class="kanban-col-header">
          <span class="kanban-col-title">${col.label}</span>
          <span class="kanban-col-count">${items.length}</span>
        </div>
        <div class="kanban-cards" id="col-${col.key}">
          ${items.map(t => taskCard(t)).join("") ||
            `<div class="kanban-empty">Aucune tâche</div>`}
        </div>
      </div>`;
  }).join("");
}

function taskCard(t) {
  const uid  = getCurrentUser()?.uid;
  const mine = t.authorUid === uid || t.assignedToUid === uid;
  const admin = isAdmin();
  const due  = t.dueDate ? formatDateShort(t.dueDate) : null;
  const overdue = t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "termine";

  const spectateur = isSpectateur();
  const moveOpts = spectateur ? "" : COLUMNS.filter(c => c.key !== t.status)
    .map(c => `<button class="task-move-btn" onclick="moveTask('${t.id}','${c.key}')">${c.label}</button>`)
    .join("");

  return `
    <div class="kanban-card ${overdue ? "overdue" : ""}">
      <div class="kanban-card-top">
        ${PRIORITY_BADGE[t.priority] || ""}
        ${due ? `<span class="kanban-due ${overdue ? "overdue-badge" : ""}">⏰ ${due}</span>` : ""}
      </div>
      <div class="kanban-card-title">${escapeHtml(t.title)}</div>
      ${t.description ? `<div class="kanban-card-desc">${escapeHtml(t.description)}</div>` : ""}
      <div class="kanban-card-meta">
        <span>👤 ${escapeHtml(t.assignedToName || "Tous")}</span>
        <span style="color:var(--text-muted)">par ${escapeHtml(t.authorName)}</span>
      </div>
      ${!spectateur ? `
      <div class="kanban-card-actions">
        <div class="task-move-group">${moveOpts}</div>
        ${(admin || mine) ? `<button class="btn-icon danger" title="Supprimer" onclick="deleteTaskCard('${t.id}','${escapeHtml(t.title).replace(/'/g,"\\'")}')">✕</button>` : ""}
      </div>` : ""}
    </div>`;
}

// ── Modal ─────────────────────────────────────────────────────

function openModal() {
  document.getElementById("task-modal").style.display = "";
  document.getElementById("task-modal-overlay").style.display = "";
}

function closeModal() {
  document.getElementById("task-modal").style.display = "none";
  document.getElementById("task-modal-overlay").style.display = "none";
  document.getElementById("task-form").reset();
}

async function handleSubmit(ev) {
  ev.preventDefault();
  const assigneeId = document.getElementById("t-assignee").value;
  const user = allUsers.find(u => u.id === assigneeId);
  const data = {
    title:          document.getElementById("t-title").value,
    description:    document.getElementById("t-desc").value,
    assignedToUid:  assigneeId  || null,
    assignedToName: user?.displayName || user?.email || "Tous",
    priority:       document.getElementById("t-priority").value,
    dueDate:        document.getElementById("t-due").value || null
  };

  const btn = document.getElementById("task-submit-btn");
  btn.disabled = true; btn.textContent = "Création…";
  try {
    await createTask(data);
    showToast("Tâche créée.", "success");
    closeModal();
  } catch (err) {
    showToast("Erreur lors de la création.", "error"); console.error(err);
  } finally {
    btn.disabled = false; btn.textContent = "Créer";
  }
}

// ── Global handlers ───────────────────────────────────────────

window.moveTask = async (id, status) => {
  try {
    await updateTaskStatus(id, status);
    showToast("Statut mis à jour.", "success");
  } catch (err) {
    showToast("Erreur.", "error"); console.error(err);
  }
};

window.deleteTaskCard = async (id, title) => {
  const ok = await confirmModal("Supprimer la tâche", `Supprimer <strong>${title}</strong> ?`, "Supprimer");
  if (!ok) return;
  try {
    await deleteTask(id);
    showToast("Tâche supprimée.", "success");
  } catch (err) {
    showToast("Erreur.", "error"); console.error(err);
  }
};
