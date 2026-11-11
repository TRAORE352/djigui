/**
 * Contrat d'API — Plateforme de don de sang.
 *
 * Source de vérité entre le backend et les deux interfaces.
 * Version 0.2 : toutes les routes de l'application des donneurs (écrans D1 à D14).
 * À valider par Zozerigué (backend) et Solange avant d'être figé (jalon J1).
 *
 * Conventions :
 *  - Succès : { "donnees": ... }   Échec : { "erreur": { "code", "message", "champ"? } }
 *  - Dates : "AAAA-MM-JJ" ; dates-heures : ISO 8601 en UTC.
 *  - Téléphone : format international "+226XXXXXXXX".
 *  - Routes protégées : en-tête "Authorization: Bearer <jeton>".
 */

// =====================================================================
// Enveloppe commune
// =====================================================================
export type Reponse<T> = { donnees: T };
export type ReponseErreur = {
  erreur: {
    code: CodeErreur;
    message: string;
    /** Nom du champ de la requête en cause, pour l'afficher sous le bon champ. */
    champ?: string;
  };
};

export type CodeErreur =
  | "IDENTIFIANTS_INVALIDES"
  | "TELEPHONE_DEJA_INSCRIT"
  | "EMAIL_DEJA_UTILISE"
  | "TELEPHONE_NON_VERIFIE"
  | "CODE_INCORRECT"
  | "CODE_EXPIRE"
  | "TROP_DE_TENTATIVES"
  | "ALERTE_CLOTUREE"
  | "MOT_DE_PASSE_INCORRECT"
  | "DONNEES_INVALIDES"
  | "NON_CONNECTE"
  | "INTROUVABLE"
  // Panne d'infrastructure (base de données injoignable) : à distinguer
  // d'un bug applicatif, car l'utilisateur doit simplement réessayer.
  | "SERVICE_INDISPONIBLE"
  | "ERREUR_SERVEUR";

// =====================================================================
// Référentiels
// =====================================================================
export type GroupeSanguin = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";
export type Sexe = "F" | "M";
export type Role =
  | "donneur" | "agent_accueil" | "agent_prelevement" | "agent_labo"
  | "agent_stock" | "agent_depot" | "admin";

/** Moyens par lesquels le donneur accepte d'être prévenu. */
export type Canal = "whatsapp" | "sms" | "appel";

export type StatutAlerte = "ouverte" | "cloturee";
export type ReponseAlerte = "je_viens" | "pas_disponible";
export type MotifRefus = "don_recent" | "absent" | "sante" | "autre";
export type Creneau = "08h-10h" | "10h-12h" | "12h-14h" | "14h-16h";
export type MoyenDeplacement = "a_pied" | "deux_roues" | "transport_commun";

/** GET /zones (public) — liste des zones proposées à l'inscription. */
export interface Zone {
  id: string;
  nom: string;   // quartier ou secteur
  ville: string;
}

// =====================================================================
// Authentification (D3 à D7)
// =====================================================================

/** POST /auth/connexion — D5 */
export interface ConnexionRequete { telephone: string; motDePasse: string }
export interface ConnexionReponse {
  jeton: string;
  utilisateur: { id: string; role: Role; nomComplet: string };
}

/**
 * POST /auth/inscription — D3
 * Le compte est créé « non vérifié » ; un code part par WhatsApp.
 * Réponse : CodeEnvoye.
 */
export interface InscriptionDonneurRequete {
  nom: string;
  prenom: string;
  sexe: Sexe;
  dateNaissance: string;               // AAAA-MM-JJ, 18 ans révolus
  telephone: string;                   // +226XXXXXXXX
  motDePasse: string;                  // 8 caractères au moins
  groupeSanguin: GroupeSanguin | null; // null = « je ne sais pas »
  zoneId: string;
  canaux: Canal[];                     // au moins un
  consentement: true;
}

/** Réponse commune aux routes qui envoient un code par WhatsApp. */
export interface CodeEnvoye {
  telephone: string;
  canal: "whatsapp";
  /** Durée de validité du code, en secondes. */
  expireDans: number;
  /** Délai avant de pouvoir redemander un code, en secondes. */
  renvoiPossibleDans: number;
}

/** POST /auth/verification — D4. Réponse : ConnexionReponse (le donneur est connecté). */
export interface VerificationRequete { telephone: string; code: string }

/** POST /auth/code/renvoi — D4 et D7. Réponse : CodeEnvoye. */
export interface RenvoiCodeRequete { telephone: string; objet: "inscription" | "mot_de_passe" }

/**
 * POST /auth/mot-de-passe-oublie — D6. Réponse : CodeEnvoye.
 * Répond de la même façon que le numéro soit inscrit ou non (on ne révèle pas qui est inscrit).
 */
export interface MotDePasseOublieRequete { telephone: string }

/** POST /auth/nouveau-mot-de-passe — D7. Réponse : null. Ferme toutes les sessions ouvertes. */
export interface NouveauMotDePasseRequete { telephone: string; code: string; motDePasse: string }

// =====================================================================
// Donneur connecté
// =====================================================================

/** GET /donneurs/moi — D13 */
export interface ProfilDonneur {
  id: string;
  numeroDonneur: string;
  nom: string;
  prenom: string;
  sexe: Sexe;
  dateNaissance: string;
  telephone: string;
  groupeSanguin: GroupeSanguin | null;
  zone: Zone;
  canaux: Canal[];
  enPause: boolean;
  /** Date de reprise automatique ; null si pas de pause ou pause sans fin. */
  finPause: string | null;
  creeLe: string;
}

/** PATCH /donneurs/moi — D13. Réponse : ProfilDonneur. */
export interface ModifierProfilRequete { zoneId?: string; canaux?: Canal[] }

/**
 * PUT /donneurs/moi/pause — D13. Réponse : ProfilDonneur.
 * enPause=false pour reprendre. Pendant une pause, le donneur ne reçoit aucune alerte.
 */
export interface MiseEnPauseRequete { enPause: boolean; finPause: string | null }

/** PUT /donneurs/moi/mot-de-passe — D13. Réponse : null. */
export interface ChangerMotDePasseRequete { ancienMotDePasse: string; nouveauMotDePasse: string }

/** GET /donneurs/moi/carte — D8. Calculée par le backend avec les valeurs de l'Annexe E. */
export interface CarteDonneur {
  numeroDonneur: string;
  nomComplet: string;
  groupeSanguin: GroupeSanguin | null;
  zone: string;
  nombreDons: number;
  dernierDon: string | null;
  prochainDonPossible: string | null;
  eligible: boolean;
  /** Délai appliqué entre deux dons, en mois (Annexe E). */
  delaiMois: number;
  enPause: boolean;
}

/** Résumé d'un centre, inclus dans une alerte. */
export interface CentreResume {
  id: string;
  nom: string;
  adresse: string;
  telephone: string;
  horaires: string;
}

export interface Venue { creneau: Creneau | null; moyen: MoyenDeplacement | null }

/** GET /donneurs/moi/alertes (D9) et GET /donneurs/moi/alertes/:id (D10). */
export interface Alerte {
  id: string;
  /** null = appel ouvert à tous les donneurs (campagne sans groupe précis). */
  groupeSanguin: GroupeSanguin | null;
  centre: CentreResume;
  message: string;
  statut: StatutAlerte;
  creeLe: string;
  /** Après cette date-heure, le centre n'attend plus de réponse. */
  dateLimite: string;
  maReponse: ReponseAlerte | null;
  motifRefus: MotifRefus | null;
  venue: Venue | null;
}

/**
 * POST /alertes/:id/reponse — D9, D10. Réponse : Alerte mise à jour.
 * La réponse peut être changée tant que l'alerte est ouverte.
 */
export interface RepondreAlerteRequete {
  reponse: ReponseAlerte;
  motifRefus?: MotifRefus | null;
  venue?: Venue | null;
}

/**
 * GET /donneurs/moi/historique — D11.
 * Règle CNTS : le motif d'un ajournement n'est jamais transmis à l'application.
 */
export interface DonHistorique {
  id: string;
  date: string;
  centre: string;
  resultat: "apte" | "ajourne";
}

/** GET /centres — D12 */
export interface Centre {
  id: string;
  nom: string;
  type: "cnts" | "site_collecte";
  adresse: string;
  ville: string;
  telephone: string;
  horaires: string;
}

/** GET /donneurs/moi/notifications — D14 */
export interface Notification {
  id: string;
  type: "alerte" | "eligibilite" | "compte" | "info";
  titre: string;
  message: string;
  lue: boolean;
  creeLe: string;
  /** Écran à ouvrir au toucher, ex. "/alertes/a_014" ; null si aucun. */
  lien: string | null;
}

/** POST /donneurs/moi/notifications/lues — D14. ids absent = toutes. Réponse : null. */
export interface MarquerLuesRequete { ids?: string[] }

// =====================================================================
// Campagnes de collecte proposées par des structures (pages publiques)
// Repris de la page « Demandes » du prototype CNTS-Registering.
// À valider en point d'équipe : fonctionnalité ajoutée après le calendrier initial.
// =====================================================================

export type TypeStructure =
  | "jeunes_quartier" | "etablissement_scolaire" | "etablissement_superieur"
  | "association" | "entreprise" | "communaute_religieuse" | "autre";

export type MomentCollecte = "matin" | "apres_midi" | "journee";

/** Ce que la structure peut mettre à disposition le jour de la collecte. */
export type Equipement = "salle_ou_abri" | "tables_chaises" | "electricite" | "eau" | "collation";

/** en_attente → acceptee (devient une séance de collecte) ou refusee. */
export type StatutDemandeCampagne = "en_attente" | "acceptee" | "refusee";

/**
 * POST /campagnes/demandes (public, sans compte) — réponse : DemandeCampagne.
 * Le backend limite le nombre de demandes par numéro (TROP_DE_TENTATIVES).
 */
export interface DemandeCampagneRequete {
  structure: string;
  typeStructure: TypeStructure;
  responsable: string;
  telephone: string;              // +226XXXXXXXX, le CNTS rappelle ce numéro
  zoneId: string;
  lieu: string;                   // lieu précis : cour de l'école, salle, terrain…
  dateSouhaitee: string;          // AAAA-MM-JJ, au moins 14 jours après la demande
  moment: MomentCollecte;
  participantsAttendus: number;   // estimation du nombre de donneurs
  equipements: Equipement[];
  precisions: string;             // peut être vide
}

/** Réponse du CNTS, présente quand la demande a été traitée. */
export interface ReponseCnts {
  message: string;
  dateRetenue: string | null;     // AAAA-MM-JJ, si acceptée
  heureDebut: string | null;      // "08:00", si acceptée
  objectifPoches: number | null;  // si acceptée
  contact: string;                // nom et numéro de l'agent qui suit la collecte
}

export interface DemandeCampagne {
  id: string;
  reference: string;              // ex. CAMP-2026-0007, à garder pour le suivi
  structure: string;
  typeStructure: TypeStructure;
  responsable: string;
  telephone: string;
  zone: Zone;
  lieu: string;
  dateSouhaitee: string;
  moment: MomentCollecte;
  participantsAttendus: number;
  equipements: Equipement[];
  precisions: string;
  statut: StatutDemandeCampagne;
  creeLe: string;
  reponseCnts: ReponseCnts | null;
}

/**
 * POST /campagnes/demandes/suivi (public) — réponse : DemandeCampagne.
 * Référence ET numéro exigés ; même erreur INTROUVABLE si l'un des deux est faux.
 * En POST pour ne pas faire passer le numéro de téléphone dans l'adresse.
 */
export interface SuiviDemandeCampagneRequete { reference: string; telephone: string }

/**
 * Côté CNTS (espace agent, Solange / Zozerigué) :
 *   GET   /gestion/campagnes/demandes          → DemandeCampagne[]
 *   PATCH /gestion/campagnes/demandes/:id      → DemandeCampagne
 * Accepter une demande crée une séance de collecte (et peut déclencher une alerte aux donneurs de la zone).
 */
export interface TraiterDemandeCampagneRequete {
  statut: "acceptee" | "refusee";
  message: string;
  dateRetenue?: string;
  heureDebut?: string;
  objectifPoches?: number;
}

// =====================================================================
// Plateforme du CNTS — authentification (Annexe C)
// =====================================================================

/** POST /auth/agent/connexion — connexion d'un agent par e-mail + mot de passe. */
export interface AgentConnexionRequete { email: string; motDePasse: string }

export interface AgentConnecte {
  id: string;
  nomComplet: string;
  email: string;
  roles: Role[];
  siteId: string;
  /** Nom du centre de rattachement, pour le badge de contexte de l'en-tête. */
  siteNom?: string;
}

export interface AgentConnexionReponse {
  jeton: string;
  utilisateur: AgentConnecte;
}

// =====================================================================
// Plateforme du CNTS — accueil (P3) : retrouver, inscrire sur place,
// réinitialiser le mot de passe d'un donneur.
// =====================================================================

/** GET /donneurs?telephone=… — le donneur tel que le voit l'agent d'accueil. */
export interface DonneurAgent {
  id: string;
  numeroDonneur: string;
  nom: string;
  prenom: string;
  sexe: Sexe;
  dateNaissance: string;
  telephone: string;
  telephoneVerifie: boolean;
  groupeSanguin: GroupeSanguin | null;
  zone: Zone | null;
  canaux: Canal[];
  enPause: boolean;
  actif: boolean;
  origine: "application" | "sur_place";
  creeLe: string;
}

/** POST /donneurs — inscrire un donneur sur place (sans l'application). */
export interface InscriptionSurPlaceRequete {
  nom: string;
  prenom: string;
  sexe: Sexe;
  dateNaissance: string;          // AAAA-MM-JJ
  telephone: string;              // +226XXXXXXXX
  zoneId?: string | null;
  groupeSanguin?: GroupeSanguin | null;
  canaux?: Canal[];
}

/** POST /donneurs/:id/reinitialisation — réponse : mot de passe temporaire en clair. */
export interface ReinitialisationMotDePasseReponse {
  motDePasseTemporaire: string;
}

// =====================================================================
// Plateforme du CNTS — collecte et laboratoire (P3, P4, P5)
// =====================================================================

/** Statut d'une poche dans son parcours (prélèvement → produits). */
export type StatutPoche = "prelevee" | "en_analyse" | "conforme" | "non_conforme" | "preparee" | "detruite";

/** POST /passages — enregistrer une venue (P3). Réponse : Passage. */
export interface EnregistrerPassageRequete {
  donneurId: string;
  resultat: "apte" | "ajourne";
  /** Requis si « ajourné » : date jusqu'à laquelle le donneur ne peut pas revenir. */
  ajourneJusquau?: string | null;
  /** Alerte d'origine, si la venue fait suite à un appel au don. */
  alerteId?: string | null;
}

export interface Passage {
  id: string;
  donneurId: string;
  numeroDonneur: string;
  siteId: string;
  date: string;                      // AAAA-MM-JJ
  resultat: "apte" | "ajourne";
  ajourneJusquau: string | null;
  alerteId: string | null;
  creeLe: string;
}

/** POST /poches — créer une poche et générer son code (P3). Réponse : Poche. */
export interface CreerPocheRequete {
  passageId: string;
  volume?: number | null;            // millilitres
}

export interface Poche {
  id: string;
  code: string;                      // ex. OUA-26-04812-K
  donneurId: string;
  passageId: string;
  siteId: string;
  date: string;
  volume: number | null;
  statut: StatutPoche;
  creeLe: string;
}

/** POST /poches/:code/analyse — enregistrer l'analyse (P4). Réponse : Analyse. */
export interface EnregistrerAnalyseRequete {
  groupeSanguin: GroupeSanguin;
  resultat: "conforme" | "non_conforme";
}

export interface Analyse {
  id: string;
  pocheId: string;
  code: string;
  groupeSanguin: GroupeSanguin;
  resultat: "conforme" | "non_conforme";
  date: string;
}

/** POST /poches/:code/preparation — créer les produits (P5). Réponse : Produit[]. */
export interface PreparerPocheRequete {
  produits: ("GR" | "PL" | "PQ")[];
}

export interface Produit {
  id: string;
  code: string;                      // ex. OUA-26-04812-K-GR
  typeProduit: "GR" | "PL" | "PQ";
  groupeSanguin: GroupeSanguin;
  datePeremption: string | null;
  statut: "disponible";
  creeLe: string;
}

// =====================================================================
// Plateforme du CNTS — qualification biologique au laboratoire
//
// La chaîne réelle d'un laboratoire de qualification du don, en quatre
// étapes. Une poche ne devient transfusable qu'au bout des quatre.
//   1. réception  : les tubes d'échantillon sont-ils exploitables ?
//   2. groupage   : ABO/RhD en DOUBLE détermination + RAI ;
//   3. sérologie  : marqueurs des maladies transmissibles ;
//   4. libération : verdict final, qui écrit dans `analyses`.
// =====================================================================

/** Étape où se trouve une poche dans la chaîne du laboratoire. */
export type EtapeLabo = "reception" | "groupage" | "serologie" | "liberation" | "terminee";

/** Pourquoi un échantillon est refusé à la réception. */
export type MotifRefusEchantillon =
  | "tubes_absents" | "etiquetage_illisible" | "echantillon_hemolyse"
  | "volume_insuffisant" | "chaine_du_froid_rompue" | "autre";

/** Marqueurs recherchés. VIH, hépatites B et C et syphilis sont obligatoires. */
export type MarqueurSerologie =
  | "vih" | "hepatite_b" | "hepatite_c" | "syphilis" | "htlv" | "paludisme";

export type ResultatSerologie = "negatif" | "positif" | "ininterpretable";

/** POST /poches/:code/reception-labo */
export interface ReceptionLaboRequete {
  conforme: boolean;
  motif?: MotifRefusEchantillon | null;
  precisions?: string;
}

/** POST /poches/:code/groupage — les deux déterminations doivent concorder. */
export interface GroupageRequete {
  determination1: GroupeSanguin;
  determination2: GroupeSanguin;
  raiPositive: boolean;
  phenotype?: string;
}

export interface Groupage {
  determination1: GroupeSanguin;
  determination2: GroupeSanguin;
  raiPositive: boolean;
  phenotype: string;
  technicien: string;
  date: string;
}

/** POST /poches/:code/serologie — un ou plusieurs marqueurs à la fois. */
export interface SerologieRequete {
  resultats: { marqueur: MarqueurSerologie; resultat: ResultatSerologie }[];
}

export interface ResultatMarqueur {
  marqueur: MarqueurSerologie;
  resultat: ResultatSerologie;
  technicien: string;
  date: string;
}

/**
 * GET /poches/:code/dossier — tout ce que le laboratoire sait d'une poche.
 * C'est la vue qui pilote l'écran : elle dit où en est la poche et ce
 * qu'il reste à faire.
 */
export interface DossierLabo {
  code: string;
  statut: StatutPoche;
  etape: EtapeLabo;
  datePrelevement: string;
  volume: number | null;
  numeroDonneur: string | null;
  reception: {
    conforme: boolean;
    motif: MotifRefusEchantillon | null;
    precisions: string;
    technicien: string;
    date: string;
  } | null;
  groupage: Groupage | null;
  serologies: ResultatMarqueur[];
  /** Marqueurs obligatoires encore manquants. Vide = prêt à libérer. */
  marqueursManquants: MarqueurSerologie[];
  /**
   * Verdict calculé par le backend : « conforme » seulement si la
   * réception est conforme, le groupage validé et tous les marqueurs
   * obligatoires négatifs.
   */
  verdictPossible: "conforme" | "non_conforme" | "incomplet";
}

/** GET /poches/file-labo — la file d'attente, étape par étape. */
export interface FileLabo {
  aRecevoir: DossierLabo[];
  aGrouper: DossierLabo[];
  aTester: DossierLabo[];
  aLiberer: DossierLabo[];
}

/**
 * GET /codes/:code — fiche de traçabilité (P9). Le code est normalisé
 * (majuscules, tirets ignorés) : « oua2604812k » est accepté.
 */
export interface FicheTracabilite {
  code: string;
  type: "poche" | "produit";
  statut: string;
  groupeSanguin: GroupeSanguin | null;
  donneur: { numeroDonneur: string } | null;
  site: string;
  date: string;
  evenements: {
    type: string;
    date: string;
    site: string | null;
    agent: string | null;
  }[];
}

// =====================================================================
// Plateforme du CNTS — stock, alertes, distribution (P6, P7, P8, P10)
// =====================================================================

/** GET /stock — le stock est calculé, jamais saisi. */
export interface LigneStock {
  typeProduit: "GR" | "PL" | "PQ";
  groupeSanguin: GroupeSanguin;
  quantite: number;
  niveau: "suffisant" | "bas" | "critique";
}

/** POST /alertes/estimation — combien de donneurs seront prévenus. */
export interface EstimationAlerteRequete {
  zoneIds: string[];
}

export interface EstimationAlerteReponse {
  donneursCibles: number;
}

/**
 * GET /stock/besoins — ce que le stock réclame, calculé.
 *
 * Répond à la question « dois-je lancer un appel au don, et pour quoi ? »
 * sans obliger l'agent à lire le tableau et à faire le calcul de tête.
 * Un besoin n'est PAS une alerte : c'est une proposition que l'agent
 * confirme, modifie ou ignore.
 */
export interface BesoinStock {
  typeProduit: "GR" | "PL" | "PQ";
  groupeSanguin: GroupeSanguin;
  /** Unités actuellement disponibles. */
  quantite: number;
  /** Seuil sous lequel ce groupe est jugé bas. */
  seuilBas: number;
  niveau: "bas" | "critique";
  /** Unités manquantes pour repasser au-dessus du seuil bas. */
  manque: number;
  /** Donneurs à mobiliser pour combler ce manque. */
  donneursSuggeres: number;
  /** Urgence proposée, déduite du niveau. */
  urgenceSuggeree: "normale" | "urgente" | "critique";
}

/** POST /alertes — lancer une alerte (gestionnaire de stock). */
export interface LancerAlerteRequete {
  /**
   * Groupe MENTIONNÉ dans l'appel, ou null pour un appel ouvert à tous.
   * Il ne restreint JAMAIS les destinataires : le ciblage se fait par zone
   * et par éligibilité. La plupart des donneurs ignorent leur groupe — il
   * est déterminé au laboratoire, après le prélèvement.
   */
  groupeSanguin: GroupeSanguin | null;
  urgence: "normale" | "urgente" | "critique";
  objectifDonneurs: number;
  dateLimite: string;               // ISO 8601
  message: string;
  zoneIds: string[];
}

/** GET /alertes/:id — suivi des réponses en direct. */
export interface SuiviAlerte {
  id: string;
  /** null = campagne ouverte à tous les donneurs, sans mention de groupe. */
  groupeSanguin: GroupeSanguin | null;
  urgence: "normale" | "urgente" | "critique";
  objectifDonneurs: number;
  dateLimite: string;
  statut: "ouverte" | "cloturee";
  message: string;
  creeLe: string;
  compteurs: { jeViens: number; pasDisponible: number; besoinTransport: number };
  donneurs: {
    numeroDonneur: string;
    nom: string;
    reponse: "je_viens" | "pas_disponible";
    momentPassage: string | null;
    besoinTransport: boolean;
  }[];
}

/** POST /demandes — une dépôt/hôpital demande des produits. */
export interface LigneDemande {
  typeProduit: "GR" | "PL" | "PQ";
  groupeSanguin: GroupeSanguin;
  quantite: number;
}

export interface DemandeRequete {
  siteFournisseurId: string;
  urgence: "normale" | "urgente" | "critique";
  lignes: LigneDemande[];
}

export interface Demande {
  id: string;
  siteDemandeurId: string;
  /** Nom lisible du site qui demande : un écran doit nommer qui attend. */
  siteDemandeurNom: string;
  siteFournisseurId: string;
  /** Nom lisible du site qui fournit. */
  siteFournisseurNom: string;
  urgence: string;
  statut: string;
  date: string;
  lignes: LigneDemande[];
}

/** POST /expeditions — le centre envoie des produits. */
export interface ExpeditionRequete {
  demandeId: string;
  produitIds: string[];
}

export interface Expedition {
  id: string;
  demandeId: string;
  siteDepartId: string;
  siteArriveeId: string;
  statut: "en_cours" | "recue";
  produits: string[];               // codes des produits
}

/** POST /delivrances — délivrer un produit à un service. */
export interface DelivranceRequete {
  code: string;
  service: string;
  /** Nom de l'agent de santé qui reçoit la poche (traçabilité). */
  nomAgent: string;
}

/** POST /delivrances — réponse : les détails du produit pour imprimer le reçu. */
export interface DelivranceReponse {
  code: string;
  typeProduit: "GR" | "PL" | "PQ";
  groupeSanguin: GroupeSanguin;
  service: string;
  nomAgent: string;
  statut: string;
}

/** GET /delivrances — une délivrance enregistrée (historique). */
export interface Delivrance {
  id: string;
  code: string;
  typeProduit: "GR" | "PL" | "PQ";
  groupeSanguin: GroupeSanguin;
  service: string;
  nomAgent: string;
  /** ISO datetime — date et heure exactes de la délivrance. */
  creeLe: string;
}

// ---------------------------------------------------------------------
// Entrées de stock externes (lots reçus d'un laboratoire ou d'une banque)
// ---------------------------------------------------------------------

/**
 * Une ligne de lot : un type de produit, un groupe, une quantité.
 * La saisie est GROUPÉE (« 40 × GR O+ ») parce qu'un agent qui reçoit
 * 100 poches ne va pas taper 100 formulaires. L'enregistrement reste
 * unitaire côté base : chaque unité devient un produit avec son code.
 */
export interface LigneLotRequete {
  typeProduit: "GR" | "PL" | "PQ";
  groupeSanguin: GroupeSanguin;
  quantite: number;
  /** AAAA-MM-JJ. Absente = pas de péremption connue. */
  datePeremption?: string | null;
}

/** POST /stock/entrees — enregistrer un lot reçu de l'extérieur. */
export interface EntreeStockRequete {
  /** Référence du bordereau de livraison du fournisseur. */
  reference: string;
  /** Site du réseau qui a livré… */
  fournisseurId?: string | null;
  /** …ou son nom, s'il n'est pas dans le réseau. L'un des deux est requis. */
  fournisseurLibre?: string | null;
  note?: string;
  lignes: LigneLotRequete[];
}

/** Ce que renvoie l'enregistrement d'un lot. */
export interface EntreeStock {
  id: string;
  reference: string;
  fournisseur: string;
  recuLe: string;
  /** Nombre d'unités réellement créées. */
  unitesCreees: number;
  /** Les codes générés, pour que l'agent puisse les reporter. */
  codes: string[];
}

/**
 * GET /sites-partenaires — les sites auxquels le site courant peut adresser
 * une demande de produits (son propre site exclu).
 *
 * À ne pas confondre avec `GET /sites`, réservé à l'administration, qui
 * expose tout le réseau et le nombre d'agents de chaque site. Ici, seul
 * l'indispensable pour remplir le champ « fournisseur » d'une demande.
 */
export interface SitePartenaire {
  id: string;
  code: string;
  nom: string;
  type: "centre" | "depot" | "hopital";
  ville: string;
}

// =====================================================================
// Espace CNTS (administration) — P1 (comptes et rôles), P2 (zones et
// centres), règles de don (Annexe E) et tableau de bord.
// =====================================================================

/** Compte agent ou administrateur, tel que le CNTS le voit (GET /agents). */
export interface AgentCompte {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  roles: Role[];
  siteId: string;
  siteNom: string;
  ville: string;
  actif: boolean;
  creeLe: string;
}

/** GET /donneurs — un donneur, vu de l'espace CNTS. */
export interface DonneurAdmin {
  id: string;
  nom: string;
  prenom: string;
  telephone: string;
  groupeSanguin: GroupeSanguin | null;
  ville: string;
  zone: string;
  actif: boolean;
  creeLe: string;
}

/** GET /activite — un événement d'activité (qui a fait quoi, quand). */
export interface Evenement {
  id: string;
  type: string;
  /** Nom de l'acteur (agent ou donneur). */
  acteur: string;
  /** Site où l'action a eu lieu. */
  siteNom: string;
  /** Poche ou produit concerné, si pertinent. */
  cible: string;
  date: string;
}

/** POST /agents — créer un compte agent (avec ses rôles). */
export interface CreerAgentRequete {
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  motDePasse: string;      // 8 caractères au moins
  siteId: string;
  roles: Role[];           // au moins un, rôles plateforme uniquement
}

/** POST /zones — ajouter une zone. */
export interface CreerZoneRequete { nom: string; ville: string; }

/**
 * GET /sites — tous les sites vus par le CNTS (Annexe B : centre, dépôt,
 * hôpital), actifs ou non. À ne pas confondre avec `GET /centres`, public,
 * qui ne liste que les centres de collecte ouverts aux donneurs.
 */
export interface SiteAdmin {
  id: string;
  code: string;
  nom: string;
  type: "centre" | "depot" | "hopital";
  adresse: string;
  zoneId: string | null;
  zoneNom: string | null;
  ville: string;
  telephone: string;
  horaires: string;
  actif: boolean;
  agents: number;
}

/** POST /centres — ajouter un site (centre, dépôt ou hôpital). */
export interface CreerCentreRequete {
  code: string;            // 3 lettres majuscules
  nom: string;
  type: "centre" | "depot" | "hopital";
  adresse?: string;
  zoneId?: string | null;
  telephone?: string;
  horaires?: string;
}

/** Une règle réglable (Annexe E), lue et modifiée par le CNTS. */
export interface Regle {
  cle: string;
  valeur: string;
  description: string;
}

/** PUT /regles/:cle — changer la valeur d'une règle. */
export interface ModifierRegleRequete { valeur: string; }

/** GET /statistiques — tableau de bord temps réel du CNTS. */
export interface Statistiques {
  donneurs: { total: number; actifs: number; enPause: number };
  donsAujourdhui: number;
  pochesEnAnalyse: number;
  produitsDisponibles: number;
  alertesEnCours: number;
  demandesEnAttente: number;
  zones: number;
  sites: number;
  agents: number;
}
