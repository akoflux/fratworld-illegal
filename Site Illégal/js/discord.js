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

// type : "create" | "status_change" | "vote_result"
// entry : { id, title, category, status, factions, authorName, votesFor, votesAgainst }
export async function sendDiscordNotification(type, entry) {
  if (!DISCORD_WEBHOOK_URL || DISCORD_WEBHOOK_URL.includes("VOTRE_WEBHOOK_ICI")) return;

  const color  = STATUS_COLORS[entry.status] ?? 0x4f86f7;
  const catIco = CAT_EMOJI[entry.category]   ?? "📋";
  const stIco  = STATUS_EMOJI[entry.status]  ?? "•";
  const url    = `${SITE_URL}/entry-detail.html?id=${entry.id}&section=${entry.section || "propositions"}`;

  const factionVal = Array.isArray(entry.factions) && entry.factions.length
    ? entry.factions.join(", ")
    : (entry.faction || "Aucune");

  let title, description, fields;

  if (type === "vote_result") {
    const isValid = entry.status === "Validé";
    title       = `${isValid ? "✅" : "❌"} Proposition ${entry.status} — ${entry.title}`;
    description = `La proposition a été **${entry.status}** après vote du staff.`;
    fields = [
      { name: "Catégorie",  value: entry.category || "—",             inline: true },
      { name: "Votes Pour", value: String((entry.votesFor || []).length),     inline: true },
      { name: "Votes Contre", value: String((entry.votesAgainst || []).length), inline: true },
      { name: "Faction(s)", value: factionVal,                         inline: true }
    ];
  } else if (type === "create") {
    title       = `${catIco} Nouvelle entrée — ${entry.title}`;
    description = `Une nouvelle entrée a été créée par **${entry.authorName}**.`;
    fields = [
      { name: "Catégorie",      value: entry.category || "—",  inline: true },
      { name: `Statut ${stIco}`, value: entry.status || "—",   inline: true },
      { name: "Faction(s)",     value: factionVal,             inline: true },
      { name: "Auteur",         value: entry.authorName,       inline: true }
    ];
  } else {
    title       = `🔄 Statut modifié — ${entry.title}`;
    description = `Le statut a été mis à jour vers **${entry.status}** par **${entry.authorName}**.`;
    fields = [
      { name: "Catégorie",      value: entry.category || "—",  inline: true },
      { name: `Statut ${stIco}`, value: entry.status || "—",   inline: true },
      { name: "Faction(s)",     value: factionVal,             inline: true },
      { name: "Auteur",         value: entry.authorName,       inline: true }
    ];
  }

  const payload = {
    embeds: [{
      title, description, color, url, fields,
      footer:    { text: "FratWorld RP — Staff Illégal" },
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
