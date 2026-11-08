/**
 * Parcours métier complet de l'espace agent, via l'API de production locale :
 * accueil -> prélèvement -> laboratoire -> préparation -> stock -> traçabilité.
 * But : trouver ce qui casse dans la chaîne réelle, pas dans l'affichage.
 */
const API = "http://localhost:4000";
const S = Date.now().toString().slice(-6);
const r = [];
const ok = (n, c, d = "") => { r.push(`${c ? "OK  " : "ECHEC"} ${n}${d ? " — " + d : ""}`); return c; };

async function call(m, chemin, jeton, corps) {
  const res = await fetch(API + chemin, {
    method: m,
    headers: { "Content-Type": "application/json", ...(jeton ? { Authorization: "Bearer " + jeton } : {}) },
    body: corps ? JSON.stringify(corps) : undefined,
  });
  let j = null; try { j = await res.json(); } catch {}
  return { statut: res.status, donnees: j?.donnees, erreur: j?.erreur };
}
const connexion = async (email) =>
  (await call("POST", "/auth/agent/connexion", null, { email, motDePasse: "ChangeMoi2026!" })).donnees?.jeton;

(async () => {
  const admin = await connexion("admin@cnts.bf");
  ok("Connexion admin", !!admin);

  // 1. Inscription d'un donneur sur place (P3)
  const tel = "+2267" + String(Math.floor(1000000 + Math.random() * 8999999));
  const insc = await call("POST", "/donneurs", admin, {
    nom: "TestNom", prenom: "TestPrenom", sexe: "M", dateNaissance: "1995-04-12",
    telephone: tel, groupeSanguin: "O+", zoneId: null, canaux: ["whatsapp"],
  });
  const donneur = insc.donnees;
  if (!ok("Inscription sur place", insc.statut === 201 || !!donneur, insc.erreur?.message || `HTTP ${insc.statut}`)) {
    console.log(r.join("\n")); return;
  }
  ok("Numéro de donneur attribué", !!donneur.numeroDonneur, donneur.numeroDonneur);

  // 2. Retrouver le donneur par téléphone
  const trouve = await call("GET", `/donneurs?telephone=${encodeURIComponent(tel)}`, admin);
  ok("Donneur retrouvé par téléphone", trouve.donnees?.id === donneur.id);

  // 3. Passage déclaré apte (P3)
  const pass = await call("POST", "/passages", admin, { donneurId: donneur.id, resultat: "apte", ajourneJusquau: null });
  ok("Passage apte enregistré", !!pass.donnees?.id, pass.erreur?.message || "");

  // 4. Création de la poche (P3)
  const poche = await call("POST", "/poches", admin, { passageId: pass.donnees?.id, volume: null });
  const code = poche.donnees?.code;
  ok("Poche créée", !!code, code || poche.erreur?.message);

  // 5. La poche apparaît-elle au laboratoire ? (P4)
  const aAnalyser = await call("GET", "/poches?statut=a_analyser", admin);
  ok("Poche visible au laboratoire", (aAnalyser.donnees || []).some((x) => x.code === code),
     `${(aAnalyser.donnees || []).length} poche(s) en attente`);

  // 6. Analyse (P4)
  const ana = await call("POST", `/poches/${encodeURIComponent(code)}/analyse`, admin, {
    groupeSanguin: "O+", resultat: "conforme",
  });
  ok("Analyse enregistrée", ana.statut < 400, ana.erreur?.message || `HTTP ${ana.statut}`);

  // 7. Préparation en produits (P5)
  const prep = await call("POST", `/poches/${encodeURIComponent(code)}/preparation`, admin, { produits: ["GR", "PL"] });
  const produits = prep.donnees || [];
  ok("Préparation en produits", produits.length > 0, produits.map((x) => x.code).join(", ") || prep.erreur?.message);

  // 8. Les produits sont-ils au stock ? (P6)
  const stock = await call("GET", "/stock", admin);
  ok("Stock lisible", Array.isArray(stock.donnees), `${(stock.donnees || []).length} ligne(s)`);

  // 9. Traçabilité du code (P9)
  const fiche = await call("GET", `/codes/${encodeURIComponent(code)}`, admin);
  ok("Fiche de traçabilité", fiche.statut === 200 && !!fiche.donnees, fiche.erreur?.message || "");

  // 10. Cloisonnement des rôles
  const labo = await connexion("labo@cnts.bf");
  const refus = await call("GET", "/stock", labo);
  ok("Un agent labo n'accède pas au stock", refus.statut === 403, `HTTP ${refus.statut}`);
  const accueil = await connexion("accueil@cnts.bf");
  const refus2 = await call("GET", "/agents", accueil);
  ok("Un agent accueil n'accède pas aux comptes", refus2.statut === 403, `HTTP ${refus2.statut}`);

  console.log("\n===== PARCOURS AGENT =====");
  r.forEach((x) => console.log(x));
  const ko = r.filter((x) => x.startsWith("ECHEC")).length;
  console.log(`\n${r.length - ko}/${r.length} réussis`);
  console.log(`donneur de test : ${donneur.numeroDonneur} (${tel}), poche ${code}`);
})();
