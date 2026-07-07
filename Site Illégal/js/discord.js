import { DISCORD_WEBHOOK_URL, SITE_URL } from "../config.js";

// Rôle gestionnaire global (fallback)
const GESTIONNAIRE_ROLE_ID = "1486124849159209152";

// Rôles gestionnaire par type de faction
const DOSSIER_ROLE_IDS = {
  "Gang":                 "1523264159695769701",
  "MC / Groupe atypique": "1523264369171890176",
  "Mafia":                "1523264657257926706",
  "Cartel":               "1523264657257926706"
};

function getDossierRoleId(typeGroupe) {
  return DOSSIER_ROLE_IDS[typeGroupe] || GESTIONNAIRE_ROLE_ID;
}

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
export async function sendDossierNotification(type, dossier, votesNeeded, mentionStaff = true) {
  if (!DISCORD_WEBHOOK_URL || DISCORD_WEBHOOK_URL.includes("VOTRE_WEBHOOK_ICI")) return;

  const url    = `${SITE_URL}/dossiers.html`;
  // Création → tout le staff ; threshold/archive → gestionnaire du type
  const roleId = (type === "dossier_create") ? GESTIONNAIRE_ROLE_ID : getDossierRoleId(dossier.typeGroupe);

  const voteForCount     = dossier.votesFor?.length ?? dossier.votes?.length ?? 0;
  const voteAgainstCount = dossier.votesAgainst?.length ?? 0;

  let title, description, color, fields;

  if (type === "dossier_create") {
    const contact = dossier.contactName || dossier.authorName || "—";
    color  = 0x3b82f6;
    title  = `📂 Nouveau dossier · ${dossier.nomGroupe}`;
    description = `**${contact}** souhaite créer une faction sur le serveur.`
      + (dossier.description ? `\n> ${dossier.description.slice(0, 100)}${dossier.description.length > 100 ? "…" : ""}` : "")
      + `\n_Consultez le dossier et exprimez votre vote._`;
    fields = [
      { name: "Type",          value: dossier.typeGroupe || "—", inline: true },
      { name: "Contact",       value: contact,                   inline: true },
      { name: "Votes requis",  value: String(votesNeeded ?? "—"),inline: true }
    ];
    if (dossier.voteDeadline) fields.push({ name: "⏰ Deadline", value: fmtDate(dossier.voteDeadline), inline: true });
    if (dossier.lienDossier)  fields.push({ name: "📄 Dossier",  value: dossier.lienDossier, inline: false });

  } else if (type === "dossier_threshold") {
    color       = 0xeab308;
    title       = `🗳️ Seuil de votes atteint — ${dossier.nomGroupe}`;
    description = `Le dossier a reçu **${voteForCount}/${votesNeeded}** votes favorables.\nUn gestionnaire doit planifier l'entretien.`;
    fields = [
      { name: "Type de groupe", value: dossier.typeGroupe || "—",        inline: true },
      { name: "👍 Pour",        value: `${voteForCount}/${votesNeeded}`, inline: true },
      { name: "👎 Contre",      value: String(voteAgainstCount),         inline: true }
    ];
    if (dossier.lienDossier) fields.push({ name: "🔗 Dossier", value: dossier.lienDossier, inline: false });

  } else {
    const isValid = dossier.statut === "Validé" || dossier.statut === "Faction créée";
    color         = isValid ? 0x22c55e : 0xef4444;
    title         = `${isValid ? "✅" : "❌"} Dossier ${dossier.statut} — ${dossier.nomGroupe}`;
    description   = isValid ? `Le dossier a été **validé**. La faction peut être intégrée.` : `Le dossier a été **refusé**.`;
    fields = [
      { name: "Type de groupe", value: dossier.typeGroupe || "—", inline: true },
      { name: "Décision",       value: dossier.statut    || "—", inline: true },
      { name: "👍 Pour",        value: String(voteForCount),     inline: true },
      { name: "👎 Contre",      value: String(voteAgainstCount), inline: true }
    ];
    if (dossier.lienDossier) fields.push({ name: "🔗 Dossier", value: dossier.lienDossier, inline: false });
  }

  const shouldMention = type === "dossier_create" ? mentionStaff : true;
  const payload = {
    ...(shouldMention ? { content: `<@&${roleId}>` } : {}),
    embeds: [{
      title, description, color, url, fields,
      footer:    { text: "FratWorld RP — Staff Illégal · Dossiers" },
      timestamp: new Date().toISOString()
    }]
  };

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

// Notification par changement de statut (badge cliquable)
export async function sendDossierStatusChange(newStatut, dossier) {
  if (!DISCORD_WEBHOOK_URL || DISCORD_WEBHOOK_URL.includes("VOTRE_WEBHOOK_ICI")) return;

  const url = `${SITE_URL}/dossiers.html`;
  const voteForCount     = dossier.votesFor?.length ?? dossier.votes?.length ?? 0;
  const voteAgainstCount = dossier.votesAgainst?.length ?? 0;

  const CONF = {
    "En attente d'étude": {
      roleId: GESTIONNAIRE_ROLE_ID,
      color:  0xef4444,
      title:  `⚡ Vote URGENT — ${dossier.nomGroupe}`,
      desc:   `Le dossier est en attente d'étude. Votez dès que possible !`
    },
    "En attente d'entretien": {
      roleId: getDossierRoleId(dossier.typeGroupe),
      color:  0xeab308,
      title:  `🗓 Entretien à planifier — ${dossier.nomGroupe}`,
      desc:   `Le dossier a obtenu les votes nécessaires. Planifiez l'entretien.`
    },
    "En attente d'installation": {
      roleId: GESTIONNAIRE_ROLE_ID,
      color:  0x60a5fa,
      title:  `🔧 Installation en attente — ${dossier.nomGroupe}`,
      desc:   `L'entretien a été validé. La faction attend d'être installée sur le serveur.`
    },
    "Installation faite": {
      roleId: GESTIONNAIRE_ROLE_ID,
      color:  0x22c55e,
      title:  `✅ Faction installée — ${dossier.nomGroupe}`,
      desc:   `La faction a été officiellement installée et ajoutée à la liste des factions.`
    },
    "Refusé": {
      roleId: null,
      color:  0xef4444,
      title:  `❌ Dossier refusé — ${dossier.nomGroupe}`,
      desc:   `Le dossier a été refusé.${dossier.refusalReason ? ` Motif : ${dossier.refusalReason}` : ""}`
    }
  };

  const cfg = CONF[newStatut];
  if (!cfg) return;

  const fields = [
    { name: "Type",    value: dossier.typeGroupe || "—",                             inline: true },
    { name: "Contact", value: dossier.contactName || dossier.authorName || "—",      inline: true },
    { name: "👍 Pour", value: `${voteForCount}`,                                     inline: true },
    { name: "👎 Contre", value: `${voteAgainstCount}`,                               inline: true }
  ];
  if (dossier.lienDossier) fields.push({ name: "🔗 Dossier", value: dossier.lienDossier, inline: false });

  const payload = {
    content: cfg.roleId ? `<@&${cfg.roleId}>` : undefined,
    embeds: [{
      title: cfg.title, description: cfg.desc, color: cfg.color,
      url, fields,
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
    if (!res.ok) console.warn("Discord statut dossier webhook HTTP", res.status);
  } catch (err) {
    console.error("Erreur webhook Discord statut dossier :", err);
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
    if (entry.documentUrl) {
      fields.push({ name: "📎 Document joint", value: entry.documentUrl, inline: false });
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
