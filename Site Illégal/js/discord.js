import { DISCORD_WEBHOOK_URL, SITE_URL } from "../config.js";

const STATUS_COLORS = {
  "Validé":    0x22c55e,
  "Refusé":    0xef4444,
  "En débat":  0xf97316
};

const STATUS_EMOJI = {
  "Validé":   "✅",
  "Refusé":   "❌",
  "En débat": "🟡"
};

const CAT_EMOJI = {
  "Décision & position prise":     "⚖️",
  "Ajout serveur (règle, mécanique)": "⚙️",
  "Fiche faction":                 "🏴",
  "Historique débat staff":        "📜"
};

// type : "create" | "status_change"
// entry : { id, title, category, status, faction, authorName }
export async function sendDiscordNotification(type, entry) {
  if (!DISCORD_WEBHOOK_URL || DISCORD_WEBHOOK_URL.includes("VOTRE_WEBHOOK_ICI")) return;

  const color  = STATUS_COLORS[entry.status] ?? 0x4f86f7;
  const catIco = CAT_EMOJI[entry.category]   ?? "📋";
  const stIco  = STATUS_EMOJI[entry.status]  ?? "•";
  const url    = `${SITE_URL}/entry-detail.html?id=${entry.id}`;

  const title = type === "create"
    ? `${catIco} Nouvelle entrée — ${entry.title}`
    : `🔄 Statut modifié — ${entry.title}`;

  const description = type === "create"
    ? `Une nouvelle entrée a été créée par **${entry.authorName}**.`
    : `Le statut a été mis à jour vers **${entry.status}** par **${entry.authorName}**.`;

  const payload = {
    embeds: [{
      title,
      description,
      color,
      url,
      fields: [
        { name: "Catégorie",         value: entry.category,        inline: true },
        { name: `Statut ${stIco}`,   value: entry.status,          inline: true },
        { name: "Faction",           value: entry.faction || "Aucune", inline: true },
        { name: "Auteur",            value: entry.authorName,      inline: true }
      ],
      footer: { text: "FratWorld RP — Staff Illégal" },
      timestamp: new Date().toISOString()
    }]
  };

  try {
    const res = await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) console.warn("Discord webhook HTTP", res.status);
  } catch (err) {
    console.error("Erreur webhook Discord :", err);
  }
}
