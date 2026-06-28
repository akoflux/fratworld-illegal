// ============================================================
// CONFIGURATION FRATWORLD RP — STAFF ILLÉGAL
// ============================================================
//
// ⚠️  SÉCURITÉ — LIS AVANT DE MODIFIER
//
// La config Firebase (apiKey, authDomain, etc.) est NORMALE
// à exposer côté client. La sécurité repose sur les Firestore
// Security Rules, pas sur la confidentialité de ces clés.
//
// En revanche, l'URL du webhook Discord EST SENSIBLE.
// Si ce fichier est poussé sur un dépôt public ou que le
// webhook fuite, régénère-le immédiatement depuis :
//   Discord → Paramètres du channel → Intégrations → Webhooks
// ============================================================

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCV-roKSOVrzfbmdosARAaAQuXo9AyG8y8",
  authDomain: "fratworld-illegal.firebaseapp.com",
  projectId: "fratworld-illegal",
  storageBucket: "fratworld-illegal.firebasestorage.app",
  messagingSenderId: "134257273692",
  appId: "1:134257273692:web:47f6a9a58bc296be60af99"
};
// ⚠️  Ce webhook est visible dans le code source côté client.
// Régénère-le depuis Discord si tu penses qu'il a été compromis.
const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1520789790226911322/QC1otPkcZa-xudbKj1h7iNztPSX3oslYKE_6po4I3G-vUXev_FPSoilyvxOP6b7ciPUS";

// URL publique du site (utilisée pour les liens dans les messages Discord).
// Ex: "https://fratworld-staff.netlify.app"
const SITE_URL = "https://fratworld-illegal.netlify.app/";

export { FIREBASE_CONFIG, DISCORD_WEBHOOK_URL, SITE_URL };
