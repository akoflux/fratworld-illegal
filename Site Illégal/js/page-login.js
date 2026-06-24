import { auth } from "./firebase-init.js";
import { login } from "./auth.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Si déjà connecté, rediriger directement.
onAuthStateChanged(auth, user => {
  if (user) window.location.href = "/index.html";
});

const form     = document.getElementById("login-form");
const emailEl  = document.getElementById("email");
const passEl   = document.getElementById("password");
const errorEl  = document.getElementById("login-error");
const submitEl = document.getElementById("submit-btn");

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.classList.add("show");
}

function clearError() {
  errorEl.classList.remove("show");
}

const ERROR_MESSAGES = {
  "auth/invalid-credential":         "Email ou mot de passe incorrect.",
  "auth/user-not-found":             "Aucun compte trouvé avec cet email.",
  "auth/wrong-password":             "Mot de passe incorrect.",
  "auth/invalid-email":              "Adresse email invalide.",
  "auth/user-disabled":              "Ce compte a été désactivé.",
  "auth/too-many-requests":          "Trop de tentatives. Réessaie dans quelques minutes.",
  "auth/network-request-failed":     "Erreur réseau. Vérifie ta connexion."
};

form.addEventListener("submit", async e => {
  e.preventDefault();
  clearError();

  const email    = emailEl.value.trim();
  const password = passEl.value;

  if (!email || !password) {
    showError("Remplis tous les champs.");
    return;
  }

  submitEl.disabled     = true;
  submitEl.textContent  = "Connexion…";

  try {
    await login(email, password);
    window.location.href = "/index.html";
  } catch (err) {
    showError(ERROR_MESSAGES[err.code] || "Erreur inattendue. Réessaie.");
    submitEl.disabled    = false;
    submitEl.textContent = "Se connecter";
  }
});
