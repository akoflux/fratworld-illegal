import { requireAuth } from "./auth.js";
import { renderNavbar } from "./ui-shared.js";

requireAuth(() => {
  renderNavbar("ticket-fermeture");
  initGenerator();
});

function initGenerator() {
  const hoursInput    = document.getElementById("hours");
  const minutesInput  = document.getElementById("minutes");
  const output        = document.getElementById("output");
  const previewDate   = document.getElementById("previewDate");
  const discordPreview= document.getElementById("discordPreview");
  const copyBtn       = document.getElementById("copyBtn");
  const presetsWrap   = document.getElementById("presets");

  const PRESETS = [
    { label: "2h",  h: 2,  m: 0 },
    { label: "6h",  h: 6,  m: 0 },
    { label: "12h", h: 12, m: 0 },
    { label: "24h", h: 24, m: 0 },
    { label: "48h", h: 48, m: 0 }
  ];

  PRESETS.forEach(p => {
    const btn = document.createElement("button");
    btn.className    = "preset-btn";
    btn.textContent  = p.label;
    btn.dataset.h    = p.h;
    btn.dataset.m    = p.m;
    btn.addEventListener("click", () => {
      hoursInput.value   = p.h;
      minutesInput.value = p.m;
      update();
      highlightPreset();
    });
    presetsWrap.appendChild(btn);
  });

  function highlightPreset() {
    const h = parseInt(hoursInput.value)   || 0;
    const m = parseInt(minutesInput.value) || 0;
    [...presetsWrap.children].forEach(btn => {
      btn.classList.toggle("active",
        parseInt(btn.dataset.h) === h && parseInt(btn.dataset.m) === m
      );
    });
  }

  function formatDateFR(date) {
    return date.toLocaleString("fr-FR", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  }

  function update() {
    const h      = parseInt(hoursInput.value)   || 0;
    const m      = parseInt(minutesInput.value) || 0;
    const target = new Date(Date.now() + (h * 3600 + m * 60) * 1000);
    const ts     = Math.floor(target.getTime() / 1000);
    const dlStr  = formatDateFR(target);

    previewDate.textContent = dlStr;

    output.value =
`⚠️ **Fermeture automatique du ticket**

En cas de non réponse de votre part, ce ticket sera automatiquement **fermé** <t:${ts}:R> (le <t:${ts}:F>).

Merci de nous répondre avant cette échéance pour que nous puissions traiter votre demande.

Cordialement,
**L'équipe Illégal de FratWorld** 🔒`;

    const delay = h > 0
      ? `dans ${h}h${m ? ` ${m}min` : ""}`
      : `dans ${m}min`;

    discordPreview.innerHTML =
      `⚠️ <b>Fermeture automatique du ticket</b><br><br>
       En cas de non réponse de votre part, ce ticket sera automatiquement <b>fermé</b>
       <span class="ts">${delay}</span> (le <span class="ts">${dlStr}</span>).<br><br>
       Merci de nous répondre avant cette échéance pour que nous puissions traiter votre demande.<br><br>
       Cordialement,<br><b>L'équipe Illégal de FratWorld</b> 🔒`;
  }

  hoursInput.addEventListener("input",   () => { update(); highlightPreset(); });
  minutesInput.addEventListener("input", () => { update(); highlightPreset(); });

  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(output.value).then(() => {
      copyBtn.textContent = "Copié ✓";
      copyBtn.classList.add("copied");
      setTimeout(() => {
        copyBtn.textContent = "Copier";
        copyBtn.classList.remove("copied");
      }, 1500);
    });
  });

  update();
  highlightPreset();
}
