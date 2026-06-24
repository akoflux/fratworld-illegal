# FratWorld RP — Site Staff Illégal

Outil interne centralisé pour les référents illégaux du serveur FiveM FratWorld RP.

---

## Déploiement Netlify

### Prérequis
- Un projet Firebase créé (Firestore + Authentication activés)
- Un dépôt GitHub contenant ce projet

### Étapes

1. **Configurer Firebase**
   - Va sur [console.firebase.google.com](https://console.firebase.google.com)
   - Crée un projet → active **Cloud Firestore** et **Authentication** (méthode Email/Password)
   - Récupère la config SDK : Paramètres du projet → Tes applications → SDK

2. **Remplir `config.js`**
   ```js
   const FIREBASE_CONFIG = {
     apiKey:            "...",
     authDomain:        "...",
     projectId:         "...",
     storageBucket:     "...",
     messagingSenderId: "...",
     appId:             "..."
   };
   const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/...";
   const SITE_URL = "https://TON-SITE.netlify.app"; // à mettre à jour après déploiement
   ```

3. **Déployer les règles Firestore**
   - Installe Firebase CLI : `npm install -g firebase-tools`
   - `firebase login && firebase init firestore`
   - Remplace le fichier `firestore.rules` généré par celui du projet
   - `firebase deploy --only firestore:rules`

4. **Déployer sur Netlify**
   - Push le projet sur GitHub
   - Netlify → New site from Git → sélectionne le dépôt
   - Pas de commande de build, pas de dossier publié (juste `.`)
   - Déploie

5. **Mettre à jour `SITE_URL`** dans `config.js` avec l'URL Netlify obtenue, puis redéployer.

---

## Créer un compte utilisateur

Les comptes sont créés **manuellement** depuis la console Firebase. Pas d'inscription publique.

### 1. Créer le compte Firebase Auth
1. Console Firebase → Authentication → Users → **Add user**
2. Renseigne l'email et un mot de passe temporaire
3. Note l'**UID** généré automatiquement (colonne User UID)

### 2. Créer le document Firestore
1. Console Firebase → Firestore → Collection `users`
2. **+ Add document** → ID du document = **UID de l'utilisateur** (copie exactement)
3. Ajoute ces champs :

| Champ         | Type   | Valeur                  |
|---------------|--------|-------------------------|
| `uid`         | string | UID Firebase Auth       |
| `displayName` | string | Pseudo du référent      |
| `role`        | string | `referent` ou `admin`   |

### 3. Communiquer les identifiants
Envoie l'email + mot de passe temporaire au référent via un canal sécurisé.
Il pourra se connecter sur le site — il ne peut pas changer son mot de passe depuis l'interface (à faire depuis la console Firebase si besoin).

---

## Rôles

| Rôle      | Droits                                                   |
|-----------|----------------------------------------------------------|
| `admin`   | Lire, créer, modifier et supprimer **toutes** les entrées |
| `referent`| Lire toutes les entrées, créer des entrées, modifier/supprimer **ses propres** entrées uniquement |

---

## Webhook Discord

L'URL du webhook est dans `config.js`. Elle est **visible dans le code source** côté client.

Pour la régénérer :
- Discord → Channel → Paramètres du salon → Intégrations → Webhooks
- Supprimer l'ancien webhook et en créer un nouveau
- Mettre à jour `DISCORD_WEBHOOK_URL` dans `config.js`

---

## Structure du projet

```
├── config.js           → Config Firebase + Discord webhook
├── css/style.css       → Thème dark global
├── js/
│   ├── firebase-init.js
│   ├── auth.js
│   ├── discord.js
│   ├── entries.js      → CRUD Firestore
│   ├── ui-shared.js    → Navbar, toasts, helpers
│   ├── page-login.js
│   ├── page-dashboard.js
│   ├── page-entries.js
│   ├── page-detail.js
│   └── page-form.js
├── login.html
├── index.html          → Tableau de bord
├── entries.html        → Liste des entrées
├── entry-detail.html   → Détail + historique
├── entry-form.html     → Création / édition
└── firestore.rules     → Règles de sécurité
```
