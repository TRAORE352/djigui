# DJIGUI — instructions pour Claude Code

Plateforme numérique de don de sang et de traçabilité. Projet Give Back,
bourse de la Fondation Mastercard, 2iE, Ouagadougou. Un seul développeur.

**Documents de référence, dans cet ordre :**

1. Le cahier des charges v1.1 (règles RG1 à RG48, tables T1 à T16,
   contraintes C1 à C8 et K1 à K7, services du chapitre 10.3).
2. Les trois maquettes : espace donneur (E1 à E12), espace gestion
   (E13 à E26), espace administration (E27 à E32).

Quand les deux se contredisent, la section « Arbitrages » plus bas dit
qui gagne. N'invente jamais un troisième comportement.

---

## Architecture — deux projets, jamais fusionnés

| Dossier | Rôle | Port |
|---|---|---|
| `backend/` | Couche de service : Express, MariaDB, tout le SQL | 4000 |
| `frontend/` | Couche de présentation : Next.js, PWA + écrans de bureau | 3000 |

C'est la variante « deux projets » de l'annexe F, exigée par l'enseignant.
Ne rapatrie jamais le service dans `frontend/app/api/`.

---

## Règles absolues

1. **SQL écrit à la main**, uniquement dans `backend/src/requetes/`.
   Jamais d'ORM, jamais de Prisma, jamais de constructeur de requêtes
   (contraintes C1, K1).
2. **Paramètres liés partout** (`?`). Aucune concaténation dans une
   requête, jamais (contrainte C2).
3. **Aucun fichier de remplissage.** Zones et structures se créent par
   l'écran E29 ; les comptes par E27 ; le premier administrateur par
   `npm run creer-admin` (contraintes C3, K3).
4. **Droits vérifiés côté serveur à chaque route** :
   `verifierSession` puis `exigerRole`. Masquer un bouton à l'écran
   n'est pas un contrôle (contrainte C4, règle RG34).
5. **bcryptjs pour tout condensat** : mot de passe et réponse de sécurité
   (règles RG27, C5). `bcryptjs` et non `bcrypt` : pur JavaScript, rien
   à compiler sous Windows.
6. **Aucune valeur chiffrée en dur.** Âges, délais, seuils, verrous,
   longueurs viennent de la table `parametre`, lue par `lireParametres()`.
7. **Un fetch = une fonction dans `frontend/lib/api.js`.** Aucun `fetch`
   ailleurs. La règle est vérifiable :
   `grep -rn "fetch(" frontend/app` doit ne rien renvoyer.
8. **Le journal ne fait jamais échouer une action** (`journaliser` avale
   ses erreurs). Mais toute action sensible est journalisée, y compris
   les refus, avec `resultat` valant `reussie`, `refusee` ou `echouee`.
   **Ce qui s'écrit dans le journal s'écrit en français lisible, jamais
   en JSON ni en nom technique** (contrainte U3) : une `cible` décrit ce
   qui s'est passé en une phrase courte, jamais `JSON.stringify` d'une
   requête ni le nom d'un champ de base de données.
9. **Côté donneur, un écran qui a besoin d'une aide est un écran à
   corriger.** Les explications tiennent en une phrase, à l'endroit du
   doute — jamais une aide dépliable de plus. Un donneur ouvre
   l'application trois fois par an, sur un téléphone, souvent avec une
   connexion lente : il n'a ni le temps ni l'usage d'un mode d'emploi.
   Seul E1 (l'accueil, avant tout compte créé) garde une aide dépliable,
   parce que c'est la seule fois où expliquer le principe entier a un
   sens. Cette règle ne s'applique qu'à l'espace donneur ; gestion et
   administration restent bâtis sur `composants/AideEcran.js`.

---

## Conventions d'écriture

- **Tout en français** : variables, fonctions, commentaires, messages.
- **`snake_case` de bout en bout** : les champs de l'API portent le nom
  exact des colonnes (`date_naissance`, `groupe_sanguin`, `id_zone`).
- Les fonctions et variables JavaScript sont en `camelCase` français
  (`lireParametres`, `motDePasse`, `idDonneur`).
- **Messages d'écran** : dire ce qui s'est passé et quoi faire ensuite.
  Jamais de mot technique, jamais d'excuse, jamais d'anglicisme. Un
  bouton garde son mot dans toute la suite : « Enregistrer » produit
  « Enregistré ».
- **Un refus dit toujours pourquoi et propose la suite possible.**

---

## Système de mise en page

Tout est dans `frontend/app/globals.css`, en trois disciplines. Elles ne
se contournent pas : c'est ce qui empêche les textes de flotter.

1. **Échelle d'espacement, base 4** : `--e1` (4 px) à `--e10` (80 px).
   Aucune valeur libre. Une marge vaut `var(--e4)`, jamais `17px`.
2. **Échelle typographique, neuf tailles** : `--t-micro` (12) à
   `--t-enorme` (44). Aucune taille hors échelle.
3. **Largeurs de lecture** : 430 px sur téléphone
   (`.page-telephone`), 640 px pour un formulaire de bureau
   (`.contenu-formulaire`), 1120 px pour un registre
   (`.contenu-registre`). Un texte ne s'étale jamais sur 1440 px.

**Le rythme vertical passe par les piles**, jamais par des marges posées
à la main : `.pile-s` (8), `.pile` (16), `.pile-l` (24), `.pile-xl` (40).
Si tu écris `marginTop` sur un titre, c'est presque toujours une erreur.

### Couleurs

| Variable | Valeur | Emploi |
|---|---|---|
| `--sang` | `#8C1C2C` | action principale, marque, niveau critique, erreur |
| `--encre` | `#241E1D` | texte, action professionnelle |
| `--encre-secondaire` | `#6B5F5C` | textes d'appui |
| `--seve` | `#2E6A4F` | état acquis, réussite |
| `--ocre` | `#9A6400` | attente, délai qui court, prudence |
| `--trait` | `#E5DCD6` | filets, bordures |
| `--fond` | `#FBF7F4` | fond de page |

Un seul accent Sang par écran. Le rouge n'apparaît qu'à l'erreur
constatée, jamais sur un champ encore vide.

### Typographies

Chargées dans `app/layout.js` : **Archivo 700** (mot-écrit, blocs de
groupe sanguin, grands compteurs), **IBM Plex Sans** (interface),
**IBM Plex Mono** (numéros, dates, codes de poche, identifiants —
tout ce qui se lit chiffre par chiffre ou se dicte à voix haute).

### Élément signature

Le **bloc groupe sanguin** : carré à angles droits, bordure 2 px en
Sang, Archivo 700, filet d'ancrage sous les lettres. Composant
`BlocGroupe`, cinq tailles. Il ne change **jamais** de couleur selon
l'état : c'est la phrase qui porte la différence.

### Icônes et mouvement

`lucide-react`, `size={20}` en ligne et `size={24}` en navigation,
`strokeWidth={1.75}`, couleur `currentColor`, jamais de remplissage.

**Une icône ne remplace jamais un mot.** Sur un état — critique, bas,
joint, éligible — on écrit l'icône ET le mot. Un écran mal réglé, une
impression en noir et blanc ou un daltonisme ne doivent jamais faire
perdre le sens. C'est la seule limite posée à la demande d'icônes.

Mouvement avec `motion` : 150 à 300 ms, `easeOut`, aucun rebond.
`useReducedMotion()` respecté partout. Le mouvement explique ce qui
apparaît ou change ; il ne divertit pas.

### Adaptation aux écrans

L'espace donneur est pensé pour le téléphone : responsivité totale.
Les espaces professionnels sont dessinés en 1440 × 900 pour un poste
partagé du centre ; ils tiennent jusqu'à 1024 px, et sous 900 px le
rail passe en bandeau horizontal tandis que les registres défilent
latéralement (`.registre-defilant`). Un registre de 214 poches ne sera
jamais confortable sur un téléphone : ce n'est pas l'usage prévu
(règle U1 du cahier des charges).

---

## Arbitrages entre le cahier des charges et les maquettes

Décidés avec le porteur du projet le 31 juillet. Ne les rouvre pas sans
lui.

| Sujet | Cahier des charges | Maquettes | Retenu |
|---|---|---|---|
| Mot de passe professionnel | 10 caractères | E14 dit 8, E32 dit 10 | **10**, plus majuscule, minuscule et chiffre |
| Délai entre deux dons | 3 mois homme, 4 mois femme | 90 j, puis 120 j pour tous | **Cahier des charges**, à confirmer par le centre |
| Conservation d'une poche | 35 jours | 42 j et 365 j selon le type | **35 jours**, un seul type de poche en v1 |
| Alerte avant péremption | 5 jours | 7 jours | **7 jours** |
| Session inactive | 30 minutes | 30 min, mais 15 min à l'état J | **30 minutes** |
| Verrouillage | 5 essais, 15 minutes | E13 montre 3 essais restants | **5 essais** (E13 montrait le troisième) |
| Groupe sanguin | `NOT NULL` | E4 offre « Je ne sais pas » | **NULL autorisé** |
| Icônes | — | « aucune icône » partout | **Icônes permises**, jamais seules sur un état |

---

## Corrections apportées au schéma de l'annexe B

Chacune vient d'un manque constaté dans les maquettes. Elles sont
commentées dans `backend/sql/01-creation.sql`.

1. `utilisateur.nom`, `.prenom` — E28 et E15 affichent le nom des agents.
2. `utilisateur.fonction` — saisie en E27, affichée en E15.
3. `utilisateur.provisoire_expire_le`, `.provisoire_deja_affiche` —
   E27 bis : provisoire valable 48 heures, visible une seule fois.
4. `journal_activite.resultat` — E31 affiche Réussie, Refusée, Échouée.
5. `donneur.groupe_sanguin` NULLable — E4, « Je ne sais pas ».
6. `reponse_alerte.motif_refus` — E19 compte les refus par motif.
7. `poche_historique.poste`, `don.poste` — E23 et E27 affichent le poste.
8. `alerte.heure_limite`, table `alerte_zone` — E18 sépare date et heure
   et fait cocher **plusieurs** zones ; l'annexe B n'en prévoyait qu'une.
9. `donneur.repere_position`, `fiche_disponibilite.aide_satisfaite`,
   `seuil_stock.modifie_par`, `parametre.libelle/consequence/unite/categorie`
   — respectivement E19, E26, E25 et E30.

---

## Ciblage des appels au don

Corrigé après un défaut grave constaté en test : un donneur inscrit,
éligible, du bon groupe et de la bonne zone, était exclu des
destinataires parce que son numéro portait le statut `non_verifie`. Le
compteur affichait « 1 donneur » puis « 0 peuvent donner aujourd'hui »,
et l'appel ne partait pas — refuser du sang disponible pour une raison
purement administrative. La règle, désormais :

**La joignabilité ORDONNE la liste d'appel (E20). Elle ne FILTRE jamais
qui reçoit l'appel.**

- **Seul `injoignable` exclut.** Un donneur est destinataire dès qu'il
  est éligible aujourd'hui (RG5) ET qu'au moins un de ses numéros n'est
  pas signalé injoignable. `confirme` et `non_verifie` comptent tous les
  deux comme « numéro utilisable » (`requetes/alertes.js`,
  `EXPR_A_UN_NUMERO_UTILISABLE`).
- **Le numéro principal part confirmé.** Il a été saisi deux fois à
  l'inscription, sans collage possible (RG25), et vient de servir à la
  connexion : c'est déjà une vérification, le traiter comme douteux n'a
  aucun sens (`auth.controleur.js`). Les numéros secondaires, eux,
  restent `non_verifie` par défaut : ils n'ont subi aucune double
  saisie. `backend/sql/03-correctifs.sql` aligne les comptes créés avant
  cette règle (numéro principal seulement, jamais un secondaire).
- **Les quatre nombres emboîtés de l'encadré de ciblage (E18)** sont
  désormais : donneurs du groupe dans les zones choisies → dont numéros
  confirmés (information seule, jamais un filtre) → dont pouvant donner
  aujourd'hui (RG5) → **RECEVRONT L'APPEL**, en gras, le seul nombre qui
  compte. Si des donneurs éligibles sont écartés, l'écran le dit :
  « N donneurs ne sont pas appelés : tous leurs numéros ont été
  signalés injoignables. »
- **Zéro destinataire bloque l'envoi, jamais ne l'autorise.** L'action
  principale devient inactive et E18 calcule quel réglage est de trop
  (même mécanisme que l'état vide de E24) : il essaie l'élargissement
  aux groupes compatibles, puis chaque zone non cochée, et propose la
  piste qui débloquerait le plus de monde.
- **`non_verifie` n'est plus un signal d'alerte.** Sur E24 et la fiche
  donneur, seul `injoignable` porte le filet Ocre. Un numéro jamais
  vérifié dit simplement qu'aucun agent ne l'a encore appelé — le
  donneur reçoit les appels au don tout de même. C'est en E20 (la liste
  d'appel), et seulement là, que l'ordre confirmé → jamais vérifié →
  injoignable a un sens : décider qui appeler en premier, pas qui
  appeler du tout.

---

## État du projet

### Fait

**Backend, complet pour cette étape.** Schéma corrigé et paramètres.
Diagnostic (`/api/sante` et page lisible sur `/`) qui dit en français
ce qui manque. Inscription en transaction (RG13, RG21, RG23, RG25).
Connexion donneur et professionnelle avec essais restants annoncés et
verrouillage (RG35). Provisoire à 48 heures, changement obligatoire
(RG33). Récupération en trois temps (RG26 à RG32). Sessions : 12 h pour
un donneur, 30 min glissantes pour un compte professionnel via l'en-tête
`X-Jeton-Rafraichi` (RG39) ; tout changement de mot de passe ferme les
sessions (RG31). Espace donneur entier : profil et éligibilité, numéros,
remplacement du principal (RG38), question de sécurité, désactivation
(RG14), registre des dons, rappel `.ics`. Espace administration entier :
comptes, provisoire, réinitialisation, désactivation avec les deux
garde-fous (RG44, RG45), structures et seuils (R12), zones, paramètres
avec bornes, journal filtrable.

**Frontend.** Système de mise en page complet. Écran d'ouverture avec
mot-écrit et slogan, non bloquant. E1 accueil, E2 à E4 inscription,
connexion donneur, E11 récupération, E12 installation, E5 carte,
E6 état vide, E9 registre, E10 compte entier. E13 connexion
professionnelle, E14 changement obligatoire, E15 mot de passe oublié.
Administration : rail, E27, E27 bis, E28 avec ses confirmations,
E29 structures et zones. PWA installable, icônes engendrées.

**Socle de l'espace gestion.** Backend : `requetes/poches.js`
(`stockParGroupe` — requête C.1, `listerPoches`, `prochesPeremption`,
`detailGroupe`) et `requetes/seuils.js` (refus si seuil critique >
seuil bas, refus si un seuil vaut zéro), routes `/api/gestion/*`
réservées au rôle gestionnaire et à sa propre structure (RG41).
Frontend : rail de gestion (groupes Stock, Appels, Registre, avec le
nombre de groupes critiques en pied de rail), E16 tableau de bord (huit
groupes toujours dans l'ordre d'affichage, filet Sang ou Ocre en marge,
jauge de remplissage, poches proches de la péremption), E17 détail d'un
groupe (ligne réglée de quatre valeurs, phrase de synthèse, place
réservée pour la courbe), E25 seuils (stock du jour à côté de chaque
champ, résumé de l'effet avant enregistrement).

**Cœur du registre de gestion.** Backend : `requetes/dons.js`
(`rechercherDonneurPourDon` — nom ou numéro dans un seul champ,
`enregistrerDon` — transaction unique don + poche + première ligne
d'historique + mise à jour de l'éligibilité RG9, code de poche
PO-AAAA-NNNN engendré sous `SELECT ... FOR UPDATE` pour que deux agents
ne reçoivent jamais le même code). `requetes/poches.js` complété :
`trouverParCode` (poche et parcours complet), `codesProches` (rattrapage
d'un code inconnu), `changerSituation` (transitions autorisées de la
table d'état, une étape jamais effacée), et la péremption constatée à
la lecture (`basculerPochesPerimees` / `basculerSiPerimee`, appelées
avant tout comptage de stock — RG16 reste vrai même sans tâche
planifiée). Décision RG6 appliquée : un donneur non éligible peut être
enregistré si l'agent coche l'autorisation médicale et écrit un motif ;
journalisé `reussie` avec le motif. Frontend : E21 (recherche à
retardement, fiche donneur avec éligibilité en clair, encadré « Ce qui
sera enregistré » avec l'effet sur le stock présenté comme une
projection, confirmation avec le code de poche en grand), E22 registre
des poches (filtres en langage courant, ligne choisie avec filet Encre,
action principale qui nomme la poche), E23 recherche par code (codes
voisins si inconnu, parcours en chronologie verticale), E27 gestion
(effet complet annoncé avant validation, irréversibilité dite en clair,
historique et donneur d'origine rappelés). Toutes les entrées du rail
Stock et Registre sont construites ; restent en « Écran en
construction » : Appels au don, Liste d'appel.

**Deux écrans de registre.** Backend : `requetes/registre-donneurs.js`
— `chercherDonneurs`/`resumerListe` partagent une seule construction de
filtres (texte, groupes, zones, éligibilité, joignabilité, ancienneté),
avec l'éligibilité calculée en SQL pour rester filtrable et paginable ;
c'est le moteur de ciblage que E18 réutilisera. `ficheDonneur` pour la
fiche lecture seule. Un donneur n'appartient à aucune structure (RG41
ne s'applique qu'aux dons et aux poches) : le registre montre tout le
bassin. `requetes/statistiques.js` — quatre fonctions structure-scopées
par période (totaux, dons par groupe, rendement des appels, aide au
transport), aucun nom de donneur. Frontend : E24 registre des donneurs
(filtres toujours visibles avec leurs puces « retirer », résumé sur la
liste filtrée, état vide qui calcule quel filtre est de trop et ce que
donnerait son retrait plutôt que de constater une absence), la fiche
donneur en lecture seule, E26 statistiques (quatre périodes nommées,
barres en CSS pur, phrases de lecture calculées à partir des chiffres
reçus). Le rail de gestion est maintenant entièrement construit, sauf
Appels au don et Liste d'appel.

**L'appel au don, de bout en bout.** C'est le cœur de DJIGUI : stock bas
→ appel → réponse → don enregistré → stock qui remonte. Backend :
`requetes/alertes.js` réutilise tel quel le moteur de ciblage de E24
(`construireFiltres`, `EXPR_ELIGIBLE`, `DEPUIS`, exportés par
`registre-donneurs.js` pour l'occasion) : `compterCibles` donne les
quatre nombres emboîtés de E18, `envoyerAlerte` fige la liste des
destinataires dans une transaction — RÈGLE ABSOLUE, rien ne la recalcule
ensuite. Une alerte dont la limite est passée se clôture à la lecture,
même principe que la péremption des poches. `requetes/reponses.js`
porte le côté donneur (répondre, changer de réponse tant que l'appel est
ouvert, la fiche de disponibilité). Aucun service de messagerie payant :
l'envoi produit une notification dans l'application (le seul canal
réellement automatisé), plus un message et une liste de numéros
copiables et un lien `wa.me` par donneur ayant accepté la messagerie —
l'écran le dit sans détour. Frontend, espace gestion : E18 (compteur de
ciblage recalculé à chaque réglage, élargissement aux groupes
compatibles grisé sans substitut, confirmation obligatoire avec le
nombre exact avant envoi), E19 (quatre compteurs sur une ligne réglée,
refus comptés par motif, bloc envoi copiable), E20 (liste d'appel
téléphone en main, progression écrite avant d'être dessinée, un
donneur déjà joint reste visible avec son résultat). Frontend, espace
donneur : E6 (état de chaque alerte en clair, un seul bouton principal
qui nomme l'alerte la plus urgente), E7 (les deux réponses au même
poids visuel — refuser aussi facile qu'accepter), E8 (repère de position
en texte libre, aucune carte, aucun GPS). Le rail de gestion est
maintenant entièrement construit.

**Correction du ciblage.** Un défaut grave a été corrigé après coup : le
ciblage excluait les donneurs au numéro `non_verifie`, refusant du sang
disponible pour une raison administrative. Règles complètes dans la
section « Ciblage des appels au don » plus haut.

**Lisibilité de l'espace gestion.** Les écrans fonctionnaient mais ne
s'expliquaient pas à un agent qui les découvre ; passe corrective sur
tout le rail Stock et Appels.

- **Centre neuf.** `stockParGroupe` (`requetes/poches.js`) compte les
  poches de la structure toutes situations confondues ; si le total vaut
  zéro, les huit groupes portent le niveau `en_attente` (« En attente de
  premier don », Encre secondaire, aucun filet) au lieu d'un niveau
  calculé sur des seuils qui n'ont encore rien à mesurer. E16 affiche
  alors un encadré dédié plutôt que huit lignes Critique, et le pied de
  rail n'annonce aucun groupe critique. Dès la première poche, le calcul
  normal reprend de lui-même.
- **E16** affiche sous le titre une phrase de lecture calculée (aucun
  souci / N groupes critiques nommés / centre neuf) et une ligne d'aide
  qui explique pourquoi « Disponibles » peut être inférieur au nombre de
  poches au registre (contrôle, réservation).
- **E25** ouvre sur un encadré qui explique ce qu'est un seuil en
  français courant, ajoute une colonne « Ce que cela veut dire » qui
  traduit chaque paire de seuils en phrase concrète, et la colonne
  « Conséquence du réglage » ne parle plus que des lignes réellement
  modifiées (`inchangé` plutôt que répéter le même niveau). Le bouton
  d'enregistrement reste inactif tant que rien n'a changé et le dit au
  survol ; un lien « Remettre les valeurs conseillées » repose les huit
  seuils sur 10 (bas) et 5 (critique), avec confirmation, sans rien
  enregistrer avant le clic sur « Enregistrer les seuils ».
- **E22** rappelle en tête ce qu'est ce registre, explique chaque
  situation dans un encadré repliable, et distingue un registre
  réellement vide (lien vers Enregistrer un don) d'un simple filtre sans
  résultat.
- **E23** dit à quoi sert la recherche par code avant le champ, et
  rappelle sous le champ où trouver ce code.
- **Appels au don (liste)** : chaque ligne porte l'action possible pour
  son statut — un brouillon se supprime (confirmation en deux temps,
  `DELETE /api/gestion/alertes/:id`, refusé si le statut n'est plus
  `brouillon`, journalisé), un appel envoyé ne se clôture que depuis
  cette liste, un appel clos ne porte plus aucune action. Une phrase en
  tête explique les trois états (brouillon, en cours, clos).
- **Une aide par écran.** Composant `composants/AideEcran.js`
  (`useAide`, `BoutonAide`, `PanneauAide`) : un petit bouton « À quoi
  sert cet écran ? » à côté de chaque titre de l'espace gestion, replié
  par défaut, l'état retenu en `sessionStorage` par écran. Posé sur les
  quinze écrans du rail Stock, Appels et Registre.

**E30, E31, E32 : les trois derniers écrans de l'administration.** Le
service existait déjà en entier (`admin.controleur.js`,
`admin.routes.js`) ; seuls les écrans manquaient, les cinq entrées du
rail renvoyaient une 404.

- **E30 paramètres** (`/administration/parametres`) : bandeau Ocre
  permanent rappelant que les valeurs médicales viennent d'une
  instruction écrite de la direction médicale, trois sections dans
  l'ordre du risque (`categorie` : medical, conservation, securite),
  chaque ligne en langage courant (`libelle`, valeur et unité en chasse
  fixe, `consequence`). Les bornes de sécurité du service
  (`admin.controleur.js`, constante `BORNES`) sont dupliquées côté
  écran pour être annoncées sous le champ avant toute saisie, jamais
  découvertes après un refus. Confirmation récapitulative (ancienne
  valeur → nouvelle, avec unité) avant tout envoi ; bouton inactif tant
  que rien n'a changé ou qu'une valeur dépasse ses bornes.
- **E31 journal** (`/administration/journal`) : mention « Lecture
  seule » dans l'en-tête, quatre filtres cumulables (agent, résultat,
  type d'action, période — la période active porte un filet Encre),
  aucune colonne d'actions, une phrase fixe sous le tableau rappelle
  qu'aucune ligne ne peut être ni supprimée ni modifiée. Réussie/
  Refusée/Échouée portent chacune leur propre icône (`Etat` avec les
  tons `seve`, `alerte`, `sang` — `alerte` donne CircleAlert là où
  `sang` donne TriangleAlert, pour que les deux résultats en Sang
  restent distinguables au pictogramme). Pagination par lot de 20 avec
  le compte exact ; un filtre sans résultat dit lequel retirer et ce
  que cela donnerait, sur le principe de l'état vide de E24. L'écran
  s'ouvre sur les sept derniers jours, jamais sur tout l'historique.
- **E32 mon mot de passe** (`/administration/mon-mot-de-passe`) : écran
  étroit (480 px), l'exigence énoncée une seule fois en une phrase
  (pas de liste technique), indicateur de force à quatre segments
  repris tel quel de `app/mot-de-passe/page.js` (même calcul, dupliqué
  plutôt que partagé pour ne pas toucher cet écran), avertissement
  Ocre sur la fermeture des sessions avant l'action. Après succès, le
  jeton est effacé et l'agent est renvoyé vers `/gestion/connexion`,
  avec un message de confirmation affiché le temps de la redirection.

**Nettoyage du journal.** Trois défauts corrigés après la construction
de E31.

- **Plus de JSON à l'écran.** La consultation du registre des donneurs
  écrivait `JSON.stringify(requete.query)` comme cible — visible en
  toutes lettres dans le journal (`{"limite":"20","depart":"0"}`),
  contraire à U3. `phraseFiltresDonneurs` (`gestion.controleur.js`)
  écrit désormais une phrase française qui ne décrit QUE les filtres
  réellement posés (« groupe O négatif, zone Tanghin »), jamais la
  pagination ; aucun filtre posé laisse la cible vide. Une cible plus
  ancienne qui contiendrait encore du JSON ne s'affiche pas brute côté
  écran (E31) : elle porte un tiret. La ligne déjà écrite en base n'est
  pas corrigée, ce registre reste inaltérable.
- **Bruit des consultations.** `journaliserConsultation`
  (`requetes/journal.js`) n'écrit qu'une ligne par agent et par action
  toutes les quinze minutes : ouvrir E24 puis affiner les filtres reste
  le même geste de consultation, une seule fois. Seule la liste des
  donneurs passe par cette fonction ; le résumé ne journalise jamais
  (il ne l'a jamais fait, c'est la même consultation). Cette limite ne
  s'applique qu'aux consultations : `journaliser` reste appelé une fois
  par geste pour toute action qui modifie quelque chose, sans
  exception.
- **Auteur donneur masqué.** L'identifiant d'un compte donneur est son
  numéro de téléphone : `admin.controleur.js` ne le renvoie plus jamais
  pour l'écran E31. Quand `listerJournal` indique un auteur de rôle
  `donneur`, la réponse écrit « un donneur » suivi de son code D-XXXX,
  en réutilisant `codeDonneur` (`donneurs.controleur.js`, exportée pour
  l'occasion) — jamais un nouvel accès aux données du donneur, RG43
  reste vrai.

**Lisibilité de l'espace administration.** Même principe que la passe
sur le rail Stock/Appels : uniquement des explications et un vrai
écran d'accueil, aucun comportement changé.

- **`composants/AideEcran.js` réutilisé tel quel** (il vivait déjà au
  bon endroit, partagé entre gestion et administration) : posé sur les
  cinq écrans de l'administration.
- **Accueil de l'administration** (`/administration`, qui redirigeait
  jusqu'ici vers Comptes) : phrase d'ouverture sur la séparation des
  accès, quatre nombres sur une ligne réglée (comptes actifs,
  structures, zones, lignes au journal des sept derniers jours), et des
  points d'attention calculés avec leur lien pour y remédier — un seul
  administrateur actif, aucune zone, aucune structure, comptes inutilisés
  depuis plus de soixante jours, provisoires expirés. Rien à signaler se
  dit en une ligne sobre, sans aplat vert. Backend : `GET
  /api/administration/etat` (`admin.controleur.js`), qui ne fait que
  recombiner `listerComptesProfessionnels`, `listerStructures`,
  `listerZones` et `listerJournal` — aucune requête neuve. La clé de
  chaque point d'attention (`administrateur_unique`, `aucune_zone`…) est
  choisie côté service ; c'est l'écran qui la relie à une adresse, le
  service ignore les routes du frontend.
- **Comptes** : phrase d'ouverture sur la différence gestionnaire/
  administrateur, l'explication de la désactivation reprise là où on
  chercherait une suppression, encadré repliable « Comment se passe
  l'arrivée d'un agent ? » en cinq étapes.
- **Structures et zones** : une phrase permanente par section (pas
  seulement dans l'état vide) expliquant ce qu'est une structure et ce
  qu'est une zone, et pourquoi l'une précède les comptes gestionnaires
  quand l'autre conditionne l'inscription des donneurs.
- **Paramètres** : une phrase sous le bandeau Ocre sur le rôle de
  l'écran, une phrase d'introduction par section (médical, conservation,
  sécurité).
- **Journal** : phrase d'ouverture sur ce que le journal permet de
  reconstituer, encadré repliable expliquant Réussie, Refusée et
  Échouée avec un exemple concret pour chacune.
- **Mon mot de passe** : phrase rappelant qu'un administrateur ne peut
  pas retrouver le mot de passe d'un agent, seulement lui en délivrer un
  nouveau depuis Comptes.

**Lisibilité de l'espace donneur.** Principe opposé à celui de
gestion et de l'administration : pas d'aide dépliable, une phrase
calculée à l'endroit précis du doute, jamais plus de deux par écran
(règle absolue 9).

- **E5 carte** : sous la phrase d'état, la raison réelle de la date —
  le délai retrouvé par différence de calendrier entre
  `date_dernier_don` et `date_prochaine_eligibilite` (posée par le
  service en `DATE_ADD ... INTERVAL delaiMois MONTH`), jamais un « 3 »
  ou un « 4 » écrit en dur. Quota, poids ou âge : une seule ligne,
  celle de la raison principale. Sous le code, un rappel de le montrer
  à l'agent.
- **E6 mes alertes** : l'état vide distingue maintenant trois cas —
  groupe pas encore connu, pas encore éligible aujourd'hui (avec la
  date), ou le cas général — au lieu d'une seule phrase pour tous.
- **E7 répondre à un appel** : la date limite dit maintenant ce qui se
  passe après elle ; une ligne sous les boutons rappelle que répondre
  n'engage pas à donner.
- **E8 disponibilité** : la promesse sur la position, renforcée à
  l'endroit du champ concerné.
- **E9 mes dons** : quand le compte a plus de trois mois et zéro don,
  la phrase explique que les dons faits ailleurs qu'à DJIGUI n'y
  figurent pas. Backend : `mesDons` (`donneurs.controleur.js`) renvoie
  `date_creation`, déjà lue par `chargerMonDonneur`, aucune requête
  neuve.
- **E10 mon compte** : une phrase par section sur sa conséquence, pas
  sur son contenu (zone, ordre d'appel, canaux) ; question de sécurité
  et désactivation gardent leurs phrases déjà écrites.
- **E11 retrouver mon compte** : la règle des trois essais par heure
  est dite avant la première tentative, pas découverte après un refus.
- **E1 accueil** : seule aide dépliable de tout l'espace donneur, un
  lien discret (pas le composant `Repliable` des espaces professionnels,
  jugé trop appuyé pour cette page) qui déplie six phrases sur le
  fonctionnement des appels au don. Replié par défaut.

### À faire, dans cet ordre

1. **E17 courbe sur trente jours** : reconstitution du stock passé à
   partir de `poche_historique`. Coûteux, à garder pour la fin. La place
   est réservée sur l'écran, avec une note.
2. **Mode hors connexion réel** (état F de la maquette gestion) : très
   coûteux, à ne faire que si le temps le permet.
3. **Enregistrer un nouveau donneur depuis la gestion.** Une note d'une
   étape précédente appelait ceci « E24 » : ce numéro désigne en réalité
   le registre des donneurs, déjà construit. Cet écran d'inscription
   côté gestion reste sans numéro confirmé ; la question de conception
   n'est pas tranchée (quel mot de passe ? quelle question de
   sécurité ?). À décider avec le groupe avant d'écrire.
4. **Rapport mensuel** : le bouton existe sur E26, l'export non.
5. **PUT `/api/gestion/alertes/:id`** (`modifierAlerte`) est écrit et
   routé mais aucun écran ne l'appelle : E18 crée puis envoie en un
   seul geste. À relier si un jour un vrai brouillon reprenable est
   demandé.

### Ce qui reste à décider avec le centre de transfusion

- Le découpage réel des zones de Ouagadougou.
- Les seuils de départ des huit groupes.
- La confirmation du délai entre deux dons (3 et 4 mois).
- Le texte exact des messages envoyés aux donneurs : un modèle est
  proposé et modifiable à l'écran (E18), rien n'est figé.

---

## Pièges connus

- **Express 4 ne rattrape pas les rejets d'une fonction `async`.** Une
  erreur inattendue dans un contrôleur (une requête SQL mal formée, par
  exemple) ne tombe pas dans le middleware d'erreur de `server.js` :
  elle sort comme un rejet de promesse non intercepté et **arrête tout
  le service** pour tout le monde. Rencontré une fois en écrivant
  `codesProches` (soustraction `UNSIGNED` qui débordait). Ce n'est pas
  spécifique à ce fichier : aucun contrôleur du projet ne s'en protège
  aujourd'hui. Écrire du SQL prudent reste la meilleure garde tant
  qu'aucun filet global n'est ajouté (ce qui demanderait une
  bibliothèque comme `express-async-errors`, interdite par les règles
  absolues).
- **Base en `utf8mb4`** : le script de création s'en charge. Ne crée
  jamais la base à la main avant l'import, les accents casseraient.
- **CORS** : le jour du test avec un tunnel, ajoute l'adresse dans
  `ORIGINES_AUTORISEES` du fichier `.env` et redémarre le backend.
- **Port 3001** : si un ancien serveur tourne encore, Next démarre sur
  3001 et le backend refuse ses appels. Le `.env.example` autorise déjà
  les deux ports.
- **Taille de police minimale 16 px** sur les champs : en dessous,
  Safari zoome tout seul à la saisie.
- **`.env.local` du frontend** n'est relu qu'au démarrage : après une
  modification, arrête et relance `npm run dev`.

---

## Lancer le projet

```bash
cd backend  && npm install && npm run verifier && npm run dev
cd frontend && npm install && npm run dev
```

`npm run verifier` dit en français tout ce qui manque encore. Détail
complet de l'installation dans `README.md`.

Après `01-creation.sql` et `02-parametres.sql`, importe aussi
`backend/sql/03-correctifs.sql` : il aligne les comptes déjà créés sur
la règle « numéro principal confirmé à l'inscription » (voir « Ciblage
des appels au don » plus haut). Sans danger à réimporter : il ne touche
que les numéros encore `non_verifie`.
