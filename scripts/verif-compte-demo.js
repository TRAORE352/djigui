/**
 * Vérifie le COMPTE FICTIF de l'application des donneurs, sur le vrai backend.
 *
 * Un `curl` sur /auth/connexion ne suffit pas : le compte peut se connecter et
 * n'avoir ni historique, ni alerte, ni notification — la démonstration est alors
 * vide. Ce script se connecte puis lit les cinq écrans qui dépendent du compte.
 *
 *   node scripts/verif-compte-demo.js [adresse-api]
 *
 * Adresse par défaut : https://djigui-api.vercel.app/api (le backend de production
 * est monté sous /api — API_BASE_PATH côté serveur).
 */
const API = process.argv[2] || "https://djigui-api.vercel.app/api";
const TELEPHONE = process.env.TEL_DEMO || "+22670000001";
const MOT_DE_PASSE = process.env.MDP_DONNEUR_DEMO || "donneur2026";

const echecs = [];
const ok = (condition, message) => {
  console.log((condition ? "  OK  " : " ECHEC") + "  " + message);
  if (!condition) echecs.push(message);
};

async function lire(chemin, jeton) {
  const r = await fetch(`${API}${chemin}`, {
    headers: jeton ? { Authorization: `Bearer ${jeton}` } : {},
  });
  const corps = await r.json().catch(() => null);
  return { statut: r.status, donnees: corps?.donnees, erreur: corps?.erreur };
}

(async () => {
  console.log(`\n--- Compte fictif du donneur (${API})`);

  const connexion = await fetch(`${API}/auth/connexion`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ telephone: TELEPHONE, motDePasse: MOT_DE_PASSE }),
  });
  const corps = await connexion.json().catch(() => null);
  ok(connexion.status === 200, `connexion ${TELEPHONE} → ${connexion.status}`);
  if (connexion.status !== 200) {
    console.log("       réponse :", JSON.stringify(corps?.erreur ?? corps));
    process.exit(1);
  }

  const jeton = corps.donnees.jeton;
  ok(corps.donnees.utilisateur?.role === "donneur", `rôle : ${corps.donnees.utilisateur?.role}`);

  const profil = await lire("/donneurs/moi", jeton);
  ok(profil.statut === 200, `profil → ${profil.statut}`);
  ok(!!profil.donnees?.numeroDonneur, `numéro donneur : ${profil.donnees?.numeroDonneur}`);
  ok(!!profil.donnees?.zone?.nom, `zone : ${profil.donnees?.zone?.nom}, ${profil.donnees?.zone?.ville}`);
  ok(!!profil.donnees?.groupeSanguin, `groupe : ${profil.donnees?.groupeSanguin}`);

  const carte = await lire("/donneurs/moi/carte", jeton);
  ok(carte.statut === 200, `carte → ${carte.statut}`);
  ok(carte.donnees?.nombreDons > 0, `dons réalisés : ${carte.donnees?.nombreDons}`);
  console.log(`        éligible : ${carte.donnees?.eligible} — prochain don : ${carte.donnees?.prochainDonPossible ?? "immédiat"}`);

  const historique = await lire("/donneurs/moi/historique", jeton);
  ok(historique.statut === 200 && historique.donnees.length > 0,
     `historique → ${historique.statut}, ${historique.donnees?.length ?? 0} passage(s)`);

  const alertes = await lire("/donneurs/moi/alertes", jeton);
  ok(alertes.statut === 200, `alertes → ${alertes.statut}`);
  const ouvertes = (alertes.donnees ?? []).filter((a) => a.statut === "ouverte" && !a.maReponse);
  ok(ouvertes.length > 0, `alerte ouverte sans réponse : ${ouvertes.length}`);

  const notifications = await lire("/donneurs/moi/notifications", jeton);
  ok(notifications.statut === 200 && notifications.donnees.length > 0,
     `notifications → ${notifications.statut}, ${notifications.donnees?.length ?? 0}`);
  ok((notifications.donnees ?? []).some((n) => !n.lue), "au moins une notification non lue");

  console.log(echecs.length === 0
    ? "\nCompte de démonstration complet.\n"
    : `\n${echecs.length} contrôle(s) en échec.\n`);
  process.exit(echecs.length === 0 ? 0 : 1);
})();
