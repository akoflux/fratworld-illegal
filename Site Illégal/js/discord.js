import { DISCORD_WEBHOOK_URL, SITE_URL } from "../config.js";

// ID du rôle gestionnaire — mentionné sur les notifs critiques
const GESTIONNAIRE_ROLE_ID = "1486124849159209152";

const STATUS_COLORS = {
  "Validé":     0x22c55e,
  "Refusé":     0xef4444,
  "En débat":   0xf97316,
  "En attente": 0xeab308,
  "Archivée":   0x6b7280
};

const STATUS_EMOJI = {
  "Validé":     "✅",
  "Refusé":     "❌",
  "En débat":   "🟡",
  "En attente": "⏳",
  "Archivée":   "🗄️"
};

const CAT_EMOJI = {
  "Décision & position prise":          "⚖️",
  "Ajout serveur (règle, mécanique)":   "⚙️",
  "Fiche faction":                      "🏴",
  "Historique débat staff":             "📜",
  "Position officielle":                "📌",
  "Règle tranchée":                     "📐",
  "Règle faction":                      "🏴",
  "Accord inter-faction":               "🤝",
  "Proposition règlement":              "📝",
  "Idée mécanique":                     "💡"
};

const SECTION_LABEL = {
  decisions:    "Décisions",
  propositions: "Propositions",
  factions:     "Factions"
};

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  }).replace(",", " à");
}

function fmtVoteCount(arr) {
  return arr?.length ? String(arr.length) : "0";
}

// ── Dossiers ──────────────────────────────────────────────────

// type : "dossier_create" | "dossier_threshold" | "dossier_archive"
// dossier : { id, nomGroupe, typeGroupe, description, authorName, votes, statut, lienDossier }
export async function sendDossierNotification(type, dossier, votesNeeded) {
  if (!DISCORD_WEBHOOK_URL || DISCORD_WEBHOOK_URL.includes("VOTRE_WEBHOOK_ICI")) return;

  const url = `${SITE_URL}/dossiers.html`;
  let title, description, color, fields, mentionRole = false;

  // Backward compat : anciens docs n'ont que `votes`
  const voteForCount     = dossier.votesFor?.length ?? dossier.votes?.length ?? 0;
  const voteAgainstCount = dossier.votesAgainst?.length ?? 0;

  if (type === "dossier_create") {
    color       = 0x4f86f7;
    title       = `📂 Nouveau dossier — ${dossier.nomGroupe}`;
    description = `**${dossier.authorName}** a soumis un dossier de candidature.`;
    fields = [
      { name: "Type de groupe", value: dossier.typeGroupe || "—",  inline: true },
      { name: "Déposé par",     value: dossier.authorName || "—",  inline: true },
      { name: "Votes requis",   value: String(votesNeeded ?? "—"), inline: true }
    ];
    if (dossier.voteDeadline) fields.push({ name: "⏰ Deadline", value: fmtDate(dossier.voteDeadline), inline: true });
    if (dossier.description)  fields.push({ name: "Description", value: dossier.description.slice(0, 150), inline: false });
    if (dossier.lienDossier)  fields.push({ name: "🔗 Dossier",  value: dossier.lienDossier,               inline: false });

  } else if (type === "dossier_threshold") {
    mentionRole = true;
    color       = 0xeab308;
    title       = `🗳️ Seuil de votes atteint — ${dossier.nomGroupe}`;
    description = `Le dossier a reçu **${voteForCount}/${votesNeeded}** votes favorables.\nUn gestionnaire doit planifier l'entretien.`;
    fields = [
      { name: "Type de groupe", value: dossier.typeGroupe || "—",            inline: true },
      { name: "Statut",         value: dossier.statut    || "—",            inline: true },
      { name: "👍 Pour",        value: `${voteForCount}/${votesNeeded}`,     inline: true },
      { name: "👎 Contre",      value: String(voteAgainstCount),             inline: true }
    ];
    if (dossier.lienDossier) fields.push({ name: "🔗 Dossier", value: dossier.lienDossier, inline: false });

  } else if (type === "dossier_archive") {
    const isValid = dossier.statut === "Validé";
    mentionRole   = isValid;
    color         = isValid ? 0x22c55e : 0xef4444;
    title         = `${isValid ? "✅" : "❌"} Dossier ${dossier.statut} — ${dossier.nomGroupe}`;
    description   = isValid
      ? `Le dossier a été **validé**. La faction peut être intégrée.`
      : `Le dossier a été **refusé**.`;
    fields = [
      { name: "Type de groupe", value: dossier.typeGroupe || "—", inline: true },
      { name: "Décision",       value: dossier.statut    || "—", inline: true },
      { name: "👍 Pour",        value: String(voteForCount),     inline: true },
      { name: "👎 Contre",      value: String(voteAgainstCount), inline: true }
    ];
    if (dossier.lienDossier) fields.push({ name: "🔗 Dossier", value: dossier.lienDossier, inline: false });
  }

  const payload = {
    content: mentionRole ? `<@&${GESTIONNAIRE_ROLE_ID}>` : undefined,
    embeds: [{
      title, description, color, url, fields,
      footer:    { text: "FratWorld RP — Staff Illégal · Dossiers" },
      timestamp: new Date().toISOString()
    }]
  };
  if (!payload.content) delete payload.content;

  try {
    const res = await fetch(DISCORD_WEBHOOK_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload)
    });
    if (!res.ok) console.warn("Discord dossier webhook HTTP", res.status);
  } catch (err) {
    console.error("Erreur webhook Discord dossier :", err);
  }
}

// ── Entrées ───────────────────────────────────────────────────

// type : "create" | "status_change" | "vote_result" | "deadline_reminder"
// entry : { id, title, category, status, section, factions, authorName,
//           votesFor, votesAgainst, votesAbstain, voteDeadline, description }
export async function sendDiscordNotification(type, entry) {
  if (!DISCORD_WEBHOOK_URL || DISCORD_WEBHOOK_URL.includes("VOTRE_WEBHOOK_ICI")) return;

  const color    = STATUS_COLORS[entry.status] ?? 0x4f86f7;
  const catIco   = CAT_EMOJI[entry.category]   ?? "📋";
  const stIco    = STATUS_EMOJI[entry.status]  ?? "•";
  const section  = entry.section || "decisions";
  const url      = `${SITE_URL}/entry-detail.html?id=${entry.id}&section=${section}`;
  const sectionLabel = SECTION_LABEL[section] || section;

  const factionVal = Array.isArray(entry.factions) && entry.factions.length
    ? entry.factions.join(", ")
    : (entry.faction || "Aucune");

  // Extrait court de la description
  const descSnippet = entry.description
    ? entry.description.slice(0, 120) + (entry.description.length > 120 ? "…" : "")
    : null;

  let title, description, fields, mentionRole = false;

  // ── Deadline reminder (critique → mention gestionnaires) ──────
  if (type === "deadline_reminder") {
    mentionRole = true;
    const vFor     = fmtVoteCount(entry.votesFor);
    const vAgainst = fmtVoteCount(entry.votesAgainst);
    const vAbstain = fmtVoteCount(entry.votesAbstain);

    title       = `⏰ Deadline imminente — ${entry.title}`;
    description = `Le vote doit être clôturé **dans moins de 24 h**.\nConsultez et votez avant l'expiration.`;
    fields = [
      { name: "Section",        value: sectionLabel,          inline: true },
      { name: "Catégorie",      value: entry.category || "—", inline: true },
      { name: "Deadline",       value: fmtDate(entry.voteDeadline), inline: true },
      { name: "Votes Pour",     value: vFor,                  inline: true },
      { name: "Votes Contre",   value: vAgainst,              inline: true },
      { name: "Abstentions",    value: vAbstain,              inline: true },
      { name: "Faction(s)",     value: factionVal,            inline: true },
      { name: "Auteur",         value: entry.authorName || "—", inline: true }
    ];
    if (descSnippet) fields.push({ name: "Résumé", value: descSnippet, inline: false });

  // ── Vote result (critique → mention gestionnaires) ────────────
  } else if (type === "vote_result") {
    mentionRole = true;
    const isValid   = entry.status === "Validé";
    const vFor      = fmtVoteCount(entry.votesFor);
    const vAgainst  = fmtVoteCount(entry.votesAgainst);
    const vAbstain  = fmtVoteCount(entry.votesAbstain);
    const total     = (entry.votesFor?.length || 0) + (entry.votesAgainst?.length || 0) + (entry.votesAbstain?.length || 0);

    title       = `${isValid ? "✅" : "❌"} Proposition ${entry.status} — ${entry.title}`;
    description = isValid
      ? `La proposition a été **validée** et entre en vigueur.`
      : `La proposition a été **refusée** par le staff.`;
    fields = [
      { name: "Section",         value: sectionLabel,          inline: true },
      { name: "Catégorie",       value: entry.category || "—", inline: true },
      { name: "Auteur",          value: entry.authorName || "—", inline: true },
      { name: "👍 Pour",         value: vFor,                  inline: true },
      { name: "👎 Contre",       value: vAgainst,              inline: true },
      { name: "➖ Abstentions",  value: vAbstain,              inline: true },
      { name: "Total votants",   value: String(total),         inline: true },
      { name: "Faction(s)",      value: factionVal,            inline: true }
    ];
    if (descSnippet) fields.push({ name: "Résumé", value: descSnippet, inline: false });

  // ── Nouvelle entrée ───────────────────────────────────────────
  } else if (type === "create") {
    title       = `${catIco} Nouvelle entrée — ${entry.title}`;
    description = `**${entry.authorName}** a ajouté une nouvelle entrée dans **${sectionLabel}**.`;
    fields = [
      { name: "Section",    value: sectionLabel,            inline: true },
      { name: "Catégorie",  value: entry.category || "—",  inline: true },
      { name: `Statut`,     value: `${stIco} ${entry.status || "—"}`, inline: true },
      { name: "Auteur",     value: entry.authorName || "—", inline: true },
      { name: "Faction(s)", value: factionVal,              inline: true }
    ];
    if (entry.voteDeadline) {
      fields.push({ name: "⏰ Deadline vote", value: fmtDate(entry.voteDeadline), inline: true });
    }
    if (descSnippet) fields.push({ name: "Description", value: descSnippet, inline: false });

  // ── Changement de statut ──────────────────────────────────────
  } else {
    title       = `🔄 Statut mis à jour — ${entry.title}`;
    description = `Le statut est passé à **${stIco} ${entry.status}** par **${entry.authorName}**.`;
    fields = [
      { name: "Section",    value: sectionLabel,            inline: true },
      { name: "Catégorie",  value: entry.category || "—",  inline: true },
      { name: "Nouveau statut", value: `${stIco} ${entry.status || "—"}`, inline: true },
      { name: "Modifié par",value: entry.authorName || "—", inline: true },
      { name: "Faction(s)", value: factionVal,              inline: true }
    ];
  }

  const payload = {
    content: mentionRole ? `<@&${GESTIONNAIRE_ROLE_ID}>` : undefined,
    embeds: [{
      title,
      description,
      color,
      url,
      fields,
      footer:    { text: "FratWorld RP — Staff Illégal" },
      timestamp: new Date().toISOString()
    }]
  };

  // Supprime `content` si undefined pour ne pas l'envoyer
  if (!payload.content) delete payload.content;

  try {
    const res = await fetch(DISCORD_WEBHOOK_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(payload)
    });
    if (!res.ok) console.warn("Discord webhook HTTP", res.status);
  } catch (err) {
    console.error("Erreur webhook Discord :", err);
  }
}
