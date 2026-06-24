// Règlement FratWorld RP — données structurées pour la recherche
export const REGLEMENT = [
  {
    id: "vocab",
    color: "#4f86f7",
    label: "Vocabulaire RP",
    articles: [
      { id: "roleplay",    title: "RolePlay",      content: "Incarner un personnage et agir comme dans la vie réelle, en respectant l'univers du serveur." },
      { id: "hrp",         title: "Hors RolePlay (HRP)", content: "Tout ce qui concerne le joueur et non le personnage : Discord, règles, discussions hors jeu." },
      { id: "powergaming", title: "Powergaming",   content: "Réaliser une action irréalisable dans la vraie vie.\nEx : faire plusieurs tonneaux en voiture et continuer à rouler vite." },
      { id: "metagaming",  title: "Metagaming",    content: "Utiliser des informations obtenues hors RP (Discord, stream, rediffusion) dans votre RP.\nEx : voir sur Discord où habite un gang et s'y rendre directement." },
      { id: "offroad",     title: "Off Road",       content: "Utiliser un véhicule non adapté à l'environnement.\nEx : prendre une limousine pour grimper en montagne = interdit." },
      { id: "nofear",      title: "No Fear",        content: "Absence de peur face à un danger crédible. Vous devez agir comme dans la vraie vie.\nEx : être braqué par plusieurs personnes et décider de les insulter.\n⚠️ Le Fear Police est essentiel en ville." },
      { id: "nopain",      title: "No Pain",        content: "Ignorer une blessure sans jouer la douleur du personnage.\nEx : reprendre normalement après un accident grave." },
      { id: "winrp",       title: "Win RP",         content: "Chercher à gagner une scène à tout prix, sans respecter la logique ou le fair-play." },
      { id: "freekill",    title: "Freekill",       content: "Tuer un joueur sans raison RP valable.\nEx : croiser quelqu'un et le tuer par ennui.\nRevenir sur une scène pour tuer par vengeance après avoir été tué = strictement interdit." },
      { id: "carkill",     title: "Carkill",        content: "Tuer volontairement en percutant avec un véhicule, sans contexte RP.\nEx : foncer sur un groupe qui discute." },
      { id: "forcerp",     title: "Force RP",       content: "Imposer une action à un joueur alors que d'autres issues RP existent.\nEx : forcer la police à vous poursuivre en inventant une scène inutile." },
      { id: "streamhack",  title: "Streamhack",     content: "Utiliser un live ou rediffusion pour obtenir des infos RP.\nEx : voir sur le stream de Paul qu'il est à l'Unicorn et s'y rendre." },
      { id: "massrp",      title: "Mass RP",        content: "Prendre en compte des PNJ ou foules inexistantes en jeu.\nEx : 'On est à Paris, les rues doivent être bondées.'" },
      { id: "chickenrun",  title: "Chicken Run",    content: "Zigzaguer de gauche à droite pour esquiver les balles." },
      { id: "bunnyhop",    title: "Bunny Hop",      content: "Sauter en continu pour avancer plus vite." },
      { id: "acteherou",   title: "Acte héroïque",  content: "Action irréaliste où un joueur fait preuve d'un courage démesuré, hors RP crédible.\nEx : attaquer un groupe armé seul sans raison RP." },
      { id: "fearpolice",  title: "Fear Police",    content: "Les joueurs doivent développer un sentiment de peur crédible face à la police.\n• Civil : respecter l'autorité.\n• Criminel/gang : tenir compte des risques d'arrestation et agir de manière cohérente." }
    ]
  },
  {
    id: "general",
    color: "#f97316",
    label: "🟠 Règles Générales",
    articles: [
      { id: "gen-1", title: "1. Règles Générales", content: "Le respect est obligatoire envers tous les joueurs et le staff.\nAucun propos insultant, discriminatoire ou HRP abusif ne sera toléré.\nLe but est de créer du RolePlay, pas de « gagner ».\nLe règlement est obligatoire et applicable à tous." },
      { id: "gen-2", title: "2. Règles RolePlay",  content: "• No Fear RP → vous devez simuler la peur.\n• No Pain RP → vous devez jouer vos blessures.\n• Metagaming → interdit d'utiliser des informations hors RP.\n• Powergaming → interdit de forcer ou de réaliser une action irréalisable dans la vraie vie." },
      { id: "gen-3", title: "3. Interdictions Globales", content: "• Freekill / Mass RP abusif\n• Combat log (déconnexion en scène)\n• Exploit / utilisation de bugs\n• Streamhack / ghosting\n• Triche" },
      { id: "gen-4", title: "4. Identité du Personnage", content: "• Pas de noms de célébrités ou fictifs.\n• Pas de noms trolls ou irréalistes.\n• Pas de double identité identique.\n• Après une mort RP → nouveau personnage obligatoire." },
      { id: "gen-5", title: "5. Comportement RP", content: "• Provocations non RP interdites.\n• Toute interaction doit avoir un sens RP.\n• Chicken run & Bunny hop interdits." },
      { id: "gen-6", title: "6. Médias RP", content: "• Photos / vidéos doivent être visibles en RP.\n• Sans téléphone ou caméra → non valable.\n• GoPro / enregistrements doivent être annoncés en RP." },
      { id: "gen-7", title: "7. Groupes & Entreprises", content: "• Entreprise : 20 membres max\n• Services d'urgence : 50 membres max / service\n• Groupe illégal : 25 membres max / 6 minimum\n➡️ Utilisation de véhicule de service obligatoire pour toute action liée à votre entité (police, restaurateur, EMS, groupe illégal…)" },
      { id: "gen-8", title: "8. Zones Safe & QG", content: "• Interdit de fuir une scène en safe zone ou vers un QG illégal.\n• Toute activité illégale est interdite en safe zone.\n• Toute personne brisant la mass RP/QG engage sa responsabilité.\n• Exception uniquement avec validation staff." },
      { id: "gen-9", title: "9. Coma", content: "🩺 Règle Coma / Mémoire RP :\nLorsqu'un joueur tombe dans le coma, il perd automatiquement la mémoire des événements survenus dans les 2 heures précédant son coma.\n\n🚑 Coma en scène RP :\nLe joueur est automatiquement considéré hors scène et ne peut plus y participer.\nEx : si un otage tombe dans le coma, le groupe ne peut plus continuer la scène avec lui." },
      { id: "gen-10", title: "10. Fair-Play", content: "• Respect entre joueurs\n• Favoriser le RP\n• Ne pas nuire à l'expérience\n• Ne pas se servir dans le coffre de société au-delà de 500k$ / semaine pour utilisation perso / vol / détournement." }
    ]
  },
  {
    id: "fdo",
    color: "#4f86f7",
    label: "🔵 Forces de l'Ordre",
    articles: [
      { id: "fdo-1", title: "1. Force de l'Ordre", content: "• Priorité au RP\n• Win RP interdit\n• Motif RP obligatoire pour réaliser une fouille\n• Les GAV doivent être joués avec les joueurs enfermés ; un joueur ne peut rester bloqué plus de 30 min en GAV\n• Les sanctions RP doivent être cohérentes et justifiées" },
      { id: "fdo-2", title: "2. Braquages (FDO)", content: "• Négociation obligatoire\n• Assaut autorisé si : refus de négociation illégal, danger grave et immédiat (légitime défense), tir côté illégal\n• Poursuite max 2 véhicules par véhicule illégal + 1 renfort en attente si nécessaire\n• Interdiction de PIT abusif ; PIT autorisé après 5 min de course-poursuite" },
      { id: "fdo-3", title: "3. Usage de la Force (ordre)", content: "1. Dialogue\n2. Taser\n3. Arme blanche non contendante\n4. Armes\nToujours en fonction de l'usage en face et de la légitime défense." },
      { id: "fdo-4", title: "4. Interdits FDO", content: "• Demande de renfort en étant braqué\n• Abus de pouvoir\n• Corruption / ripoux sans dossier et validation staff en amont\n• Revente des saisies" },
      { id: "fdo-ems", title: "EMS", content: "• Pas de double facturation\n• Obligation de soigner\n• Pas de vente d'équipement\n• Réanimation après 2 minutes max\n• Un EMS ne peut pas faire de l'illégal (sauf sous dossier Staff)" }
    ]
  },
  {
    id: "legal",
    color: "#22c55e",
    label: "🟢 Légal / Mécano",
    articles: [
      { id: "leg-5mec", title: "5. Mécano", content: "• Pas d'abus de permissions\n• Pas de modification sans accord\n• Pas de full performance gratuit\n• Service uniquement en tenue" },
      { id: "leg-5eff", title: "5. Effectifs", content: "• Entreprise : 20 membres max\n• Service public : 50 membres max\n• Véhicule de service obligatoire pour tout le légal & SP" },
      { id: "leg-6",    title: "6. Usebug", content: "Tout usebug profitable à votre avantage, non remonté et dont vous profitez, sera sanctionné." }
    ]
  },
  {
    id: "illegal",
    color: "#ef4444",
    label: "🔴 Illégal",
    articles: [
      { id: "ill-1",  title: "1. Création Groupe Officiel", content: "• Toute organisation doit être validée via whitelist staff.\n• Dossier complet requis : Background ; Expérience ; Liste des membres ; Hiérarchie interne ; Objectif RP ; Emplacement QG ; Minimum 7 membres.\n• Délais : 24h max prise en charge → 3 jours pour étude + réponse → Si positif 3 à 4 jours pour mise en place IG.\n• Les dossiers LEAK/COPIER-COLLER ne sont plus refusés, mais à nombre et expérience égal, priorité au dossier original." },
      { id: "ill-2",  title: "2. Hiérarchie Groupes Illégaux", content: "• CARTEL → Production & importation importantes de drogue ; armes grosse catégorie. Fournisseur principal.\n• MAFIA → Drogue, armes moyenne catégorie, blanchiment, opérations à grande ampleur.\n• MC & GROUPE ATYPIQUE → Alcool, armes petites catégories, transport, intermédiaire.\n• GANG → Armes petites catégories, vente de drogue, contrôle de territoire, activité de rue.\n• INDÉPENDANT → Activités mineures, peut travailler pour différents gangs. Aucune revendication." },
      { id: "ill-3",  title: "3. Cohérence RP des Groupes", content: "Les membres doivent respecter leur lore en vêtements, véhicules, couleurs, comportement.\n• Mafias : Berlines luxueuses, SUV discrets, couleurs sombres.\n• Cartel : 4x4, pick-up, tout-terrain.\n• Gang/Indé : Compactes, sportives bas de gamme, SUV volés, véhicules modifiés.\n• Un même personnage ne peut pas rejoindre plusieurs organisations de façon incohérente (ex: Vagos → Cartel) → WIPE obligatoire." },
      { id: "ill-4",  title: "4. Mentalité GF / Loot", content: "Les comportements GunFight ou Loot sont strictement interdits car ils nuisent à la qualité du RP. Chaque action doit être motivée et mise en scène.\nCependant, certains endroits spécifiques autorisent le GF, tant que les sommations sont respectées." },
      { id: "ill-5",  title: "5. Fear Illégal", content: "• Indés : fear RP obligatoire envers tous les groupes officiels.\n• Gangs : fear RP obligatoire envers MC, Mafia, Cartel.\n• MC : fear RP obligatoire envers Mafia / Cartel.\n• Mafia : fear RP obligatoire envers Cartel.\nL'ennemi principal reste les forces de l'ordre. Tout manquement expose à une mort RP." },
      { id: "ill-6",  title: "6. Responsabilité du Chef de Groupe", content: "Si un chef découvre qu'un membre triche, duplique, ou enfreint le règlement :\n• Mort RP IMMÉDIAT de ce membre\n• Informer le staff IMMÉDIATEMENT\nEn cas de non-respect : le chef peut être tenu responsable et l'organisation WIPE / BAN immédiat." },
      { id: "ill-7",  title: "7. Armement Autorisé par Groupe", content: "• Pistolet MK2, Beretta, Pétoire, Vintage, Révolver lourd* → Indé / Gang\n• Pistolet cal.50 → Indé / Gang / MC\n• Pistolet de combat, Perico → Gang\n• Tec-9 → 2 par gang (lead)\n• Gusenberg → MC\n• AK → Mafia/Cartel (leads, 2 max)\n• AK-u → Mafia/Cartel/MC (leads, 3 max)\n• Fusil amélioré / militaire → Mafia/Cartel (leads, 2 max)\n• Canon scié → Mafia/Cartel/MC (leads, 2 max)\n*Révolver lourd interdit sur zones GF\nTOUTES les armes récupérées lors d'un convoi illégal sont autorisées." },
      { id: "ill-8",  title: "8. Groupe Game Master", content: "• Groupe INTOUCHABLE EN RP.\n• Objectif : incorporer et gérer groupes & situations, lien staff ↔ RP.\n• Les GM ne font aucune préférence et restent neutres.\n• Interdit de braquer la cargaison durant une livraison GM.\n• Autorisé d'intercepter le convoi de l'acheteur après la transaction." },
      { id: "ill-9",  title: "9. Utilisation des Armes", content: "• Tir à vue strictement interdit. 3 sommations orales obligatoires avant de tirer, même en zone GF.\n• Exception : si le joueur fait un No Fear, tir autorisé sans sommation.\n• Gangs de rue : lors de rencontres imprévues, privilégier la rixe à mains nues ou arme non contendante.\n• Drive-by interdit.\n• Utilisation d'armes légales interdite sauf si mentionné au point 7." },
      { id: "ill-10", title: "10. Utilisation des Véhicules", content: "• Tout véhicule peut être volé hors zone SAFE.\n• En Prise d'Otage : interdit de crocheter, le véhicule doit être déverrouillé par le propriétaire.\n• Les MC sont les seuls autorisés à réaliser des actions illégales en moto (cohérence requise)." },
      { id: "ill-11", title: "11. Traitement des Otages / Braquages", content: "• Interdit de braquer / prendre en otage / dépouiller les employés légaux (récolte, traitement, vente, transport).\n• Interdit d'insulter / frapper / humilier un otage. Il doit être traité avec respect.\n• L'otage qui joue son FEAR ne doit PAS être mis dans le coma.\n• Interdit de demander des actes dégradants.\n• Vol maximum : 50% des possessions d'un joueur.\n• Rançon : 25k (bas grade) / 150k (bras droit) / 400k (chef)" },
      { id: "ill-12", title: "12. Les Braquages", content: "• SUPÉRETTE : 1-4 braqueurs ; 2 policiers mini ; 3 max/jour. Attendre 10 min l'arrivée FDO avant de partir.\n• FLEECA : 2-5 braqueurs ; 4 policiers mini ; 1 max/jour ; 3 otages mini.\n• BANQUE PRINCIPALE : 8+ braqueurs ; 8+ policiers ; groupe officiel obligatoire ; 1/semaine ; 6 otages mini.\n• BIJOUTERIE : 4-8 braqueurs ; 6 policiers mini ; 1/jour ; 5 otages mini." },
      { id: "ill-13", title: "13. Loot", content: "• Maximum 50% argent / item (soyez fair-play).\n• Free loot interdit même sur véhicule ouvert ; justification RP obligatoire prouvable.\n• Items sensibles (arme, kevlar, sacs, téléphone) : justification encore plus importante.\n• Interdit de looter des armes de boutique (réservé aux FDO).\n• Interdit d'aller dans les QG des services publics pour voler (FDO, EMS, GOUV)." },
      { id: "ill-14", title: "14. Alliance", content: "• Alliances interdites (pas de présence multi-groupe lors d'un RDV).\n• Entente commerciale possible (ex : partage de territoire sur récolte).\n• Mandat contre finance à un autre groupe officiel possible pour une action isolée, mais pas ensemble sur scène.\n• Si un groupe tiers intervient de façon imprévue, vous pouvez vous unir pour le faire partir.\n• RDV inter-groupes : obligatoirement en terrain neutre (pas dans un QG)." },
      { id: "ill-15", title: "15. Argent", content: "• Toute transaction illégale entre groupes officiels DOIT se faire en argent sale.\n• Si un groupe donne de l'argent propre : ne réagissez pas (métagaming), continuez la scène et rapportez avec preuves.\n• Blanchiment réservé aux membres de MAFIA (ou autre avec accord admin/gérant). Taux : entre 20% et 30% inclus." },
      { id: "ill-16", title: "16. KOTH & GF", content: "• Tirs en dehors de la zone KOTH = interdits. Tirs à l'intérieur = autorisés.\n• Zones GF autorisées : table de création d'armes, convoi d'armes illégal, points de récolte de drogues.\n• Les labos et points de traitement/assemblage ne sont PAS des zones GF.\n• Points chauds soumis aux sommations avant tir.\n• GF : 15 vs 15 max.\n• Policiers : libre d'intervenir avec 6+ policiers, tir autorisé si tirs reçus.\n• Tout autre lieu : règles générales → le GF ne doit pas être une solution !" }
    ]
  }
];
